import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowUpDown, Printer, TrendingUp, Filter, Target, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";

interface ClassProgressBoardProps {
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
}

/** Mini badge for a score out of max (default 5) */
function ScoreBadge({ score, max = 5 }: { score: number; max?: number }) {
  const ratio = score / max;
  const color =
    ratio >= 0.8 ? "bg-brand-emerald text-white" :
    ratio >= 0.6 ? "bg-amber-400/80 text-amber-900" :
    "bg-destructive/70 text-white";
  return (
    <span className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold", color)}>
      {score}
    </span>
  );
}

/** Progress bar color class based on ratio */
function progressColor(ratio: number): string {
  if (ratio >= 0.7) return "bg-brand-emerald";
  if (ratio >= 0.4) return "bg-amber-500";
  return "bg-destructive";
}

/** Attendance badge color */
function attendanceColor(pct: number): string {
  if (pct >= 85) return "text-brand-emerald";
  if (pct >= 60) return "text-amber-600";
  return "text-destructive";
}

type StudentRow = {
  student_id: string;
  enrollment_id: string;
  prenom: string;
  nom: string;
};

export function ClassProgressBoard({ classId, className, subjects }: ClassProgressBoardProps) {
  const { orgId } = useOrganization();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [sortByPriority, setSortByPriority] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; prenom: string; nom: string } | null>(null);

  // ── Fetch config for selected subject ──
  const { data: config } = useQuery({
    queryKey: ["session_config", orgId, selectedSubjectId],
    enabled: !!orgId && !!selectedSubjectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_session_configs")
        .select("id, form_schema_json")
        .eq("org_id", orgId!)
        .eq("subject_id", selectedSubjectId)
        .maybeSingle();
      return data;
    },
  });

  // ── Fetch enrolled students ──
  const { data: students = [] } = useQuery({
    queryKey: ["class_students_progress", orgId, classId],
    enabled: !!orgId && !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_enrollments")
        .select("id, student:madrasa_students!madrasa_enrollments_student_id_fkey(id, prenom, nom)")
        .eq("class_id", classId)
        .eq("org_id", orgId!)
        .eq("statut", "Actif");
      return (data ?? [])
        .map((e: any) => ({
          enrollment_id: e.id,
          student_id: e.student?.id ?? "",
          prenom: e.student?.prenom ?? "",
          nom: e.student?.nom ?? "",
        }))
        .sort((a: any, b: any) => a.nom.localeCompare(b.nom)) as StudentRow[];
    },
  });

  // ── Fetch annual goals for all students ──
  const { data: goalsMap = new Map() } = useQuery({
    queryKey: ["class_goals", orgId, classId, selectedSubjectId],
    enabled: !!orgId && !!selectedSubjectId && students.length > 0,
    queryFn: async () => {
      const studentIds = students.map((s) => s.student_id).filter(Boolean);
      if (studentIds.length === 0) return new Map<string, { current: number; target: number; unit: string }>();
      const { data } = await supabase
        .from("madrasa_student_goals")
        .select("student_id, current_position, target_value, unit_label")
        .eq("org_id", orgId!)
        .eq("subject_id", selectedSubjectId)
        .in("student_id", studentIds);
      const m = new Map<string, { current: number; target: number; unit: string }>();
      for (const g of data ?? []) {
        m.set(g.student_id, { current: Number(g.current_position), target: Number(g.target_value), unit: g.unit_label });
      }
      return m;
    },
  });

  // ── Determine the score field from schema ──
  const scoreFieldKey = useMemo(() => {
    if (!config?.form_schema_json) return null;
    const schema = config.form_schema_json as any[];
    const numField = schema.find((f: any) => f.type === "number");
    return numField ? { key: numField.key, max: numField.max ?? 5, label: numField.label } : null;
  }, [config]);

  // ── Fetch last 5 scores per student ──
  const { data: scoresMap = new Map(), isLoading: isLoadingScores } = useQuery({
    queryKey: ["class_last_scores", orgId, classId, config?.id],
    enabled: !!orgId && !!classId && !!config?.id && students.length > 0,
    queryFn: async () => {
      const studentIds = students.map((s) => s.student_id).filter(Boolean);
      if (studentIds.length === 0) return new Map<string, number[]>();
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("student_id, lesson_date, data_json")
        .eq("class_id", classId)
        .eq("config_id", config!.id)
        .eq("org_id", orgId!)
        .in("student_id", studentIds)
        .order("lesson_date", { ascending: false })
        .limit(500);
      const m = new Map<string, number[]>();
      for (const p of data ?? []) {
        if (!scoreFieldKey) continue;
        const json = p.data_json as Record<string, any>;
        const val = json[scoreFieldKey.key];
        if (val == null) continue;
        const arr = m.get(p.student_id) ?? [];
        if (arr.length < 5) arr.push(Number(val));
        m.set(p.student_id, arr);
      }
      return m;
    },
  });

  // ── Fetch attendance last 30 days ──
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const { data: attendanceMap = new Map() } = useQuery({
    queryKey: ["class_attendance_30d", orgId, classId],
    enabled: !!orgId && !!classId && students.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_attendance")
        .select("student_id, status")
        .eq("class_id", classId)
        .eq("org_id", orgId!)
        .gte("date", thirtyDaysAgo);
      const m = new Map<string, { total: number; present: number }>();
      for (const a of data ?? []) {
        if (!a.student_id) continue;
        const entry = m.get(a.student_id) ?? { total: 0, present: 0 };
        entry.total++;
        if (a.status === "present" || a.status === "late") entry.present++;
        m.set(a.student_id, entry);
      }
      return m;
    },
  });

  // ── Computed: priority score for sorting ──
  const getPriority = (sid: string): number => {
    let priority = 0;
    // Low goal progress → higher priority
    const goal = goalsMap.get(sid);
    if (goal && goal.target > 0) {
      const ratio = goal.current / goal.target;
      if (ratio < 0.4) priority += 3;
      else if (ratio < 0.7) priority += 1;
    }
    // Declining scores → higher priority
    const scores = scoresMap.get(sid);
    if (scores && scores.length >= 2 && scoreFieldKey) {
      const recent = scores[0] / scoreFieldKey.max;
      const older = scores[scores.length - 1] / scoreFieldKey.max;
      if (recent < older) priority += 2;
      if (recent < 0.4) priority += 2;
    }
    // Low attendance
    const att = attendanceMap.get(sid);
    if (att && att.total > 0 && (att.present / att.total) < 0.7) priority += 2;
    return priority;
  };

  const sortedStudents = useMemo(() => {
    if (!sortByPriority) return students;
    return [...students].sort((a, b) => getPriority(b.student_id) - getPriority(a.student_id));
  }, [students, sortByPriority, goalsMap, scoresMap, attendanceMap, scoreFieldKey]);

  const openDrawer = (student: StudentRow) => {
    setDrawerStudent({ id: student.student_id, prenom: student.prenom, nom: student.nom });
    setDrawerOpen(true);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Pilotage classe - ${className}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #0B1A3D; color: white; }
        td:first-child { text-align: left; font-weight: 500; }
        .bar { height: 8px; border-radius: 4px; }
        .good { background: #10b981; } .mid { background: #f59e0b; } .bad { background: #ef4444; }
        h2 { color: #0B1A3D; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; }
      </style></head><body>
      <h2>${className} — Pilotage Pédagogique</h2>
      <p>Matière : ${subjects.find(s => s.id === selectedSubjectId)?.name ?? ""} · Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
      ${printRef.current.querySelector("table")?.outerHTML ?? ""}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (subjects.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Aucune matière liée à cette classe.
      </div>
    );
  }

  const isLoading = isLoadingScores;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Matière…" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={sortByPriority ? "default" : "outline"}
            size="sm"
            className={cn("gap-1.5", sortByPriority && "bg-brand-navy hover:bg-brand-navy/90")}
            onClick={() => setSortByPriority(!sortByPriority)}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Trier par priorité
          </Button>

          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Objectif annuel</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 5 dernières notes</span>
          <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> Assiduité 30j</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-emerald" /> ≥ 70%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 40–70%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> &lt; 40%</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm rounded-xl border border-dashed">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            Aucun élève inscrit dans cette classe.
          </div>
        ) : (
          <div ref={printRef} className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-navy text-white">
                  <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Élève</th>
                  <th className="px-4 py-3 text-left font-medium min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" /> Objectif Annuel
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-medium min-w-[160px]">
                    <div className="flex items-center gap-1.5 justify-center">
                      <TrendingUp className="h-3.5 w-3.5" /> Santé Académique
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-medium min-w-[100px]">
                    <div className="flex items-center gap-1.5 justify-center">
                      <CalendarCheck className="h-3.5 w-3.5" /> Assiduité
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => {
                  const goal = goalsMap.get(student.student_id);
                  const goalRatio = goal && goal.target > 0 ? goal.current / goal.target : null;
                  const goalPct = goalRatio != null ? Math.min(goalRatio * 100, 100) : null;

                  const scores = scoresMap.get(student.student_id) ?? [];
                  const att = attendanceMap.get(student.student_id);
                  const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

                  const initials = `${student.prenom?.[0] ?? ""}${student.nom?.[0] ?? ""}`.toUpperCase();

                  return (
                    <tr
                      key={student.student_id}
                      onClick={() => openDrawer(student)}
                      className={cn(
                        "border-t border-border/50 cursor-pointer transition-colors hover:bg-primary/5",
                        idx % 2 === 0 && "bg-muted/10",
                        sortByPriority && getPriority(student.student_id) >= 4 && "bg-destructive/5 hover:bg-destructive/10"
                      )}
                    >
                      {/* Élève */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-brand-navy/10 text-brand-navy text-xs font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground leading-tight">{student.prenom} {student.nom}</p>
                            {sortByPriority && getPriority(student.student_id) >= 4 && (
                              <span className="text-[10px] text-destructive font-medium">⚠ Attention requise</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Objectif Annuel */}
                      <td className="px-4 py-3">
                        {goalPct != null && goal ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">{goal.current}/{goal.target} {goal.unit}</span>
                                  <span className={cn("font-semibold", goalRatio! >= 0.7 ? "text-brand-emerald" : goalRatio! >= 0.4 ? "text-amber-600" : "text-destructive")}>
                                    {Math.round(goalPct)}%
                                  </span>
                                </div>
                                <Progress
                                  value={goalPct}
                                  className="h-2"
                                  style={{
                                    // Override indicator color via CSS variable
                                    ["--progress-color" as any]: goalRatio! >= 0.7 ? "hsl(var(--brand-emerald))" : goalRatio! >= 0.4 ? "hsl(38, 92%, 50%)" : "hsl(var(--destructive))",
                                  }}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {goal.current} / {goal.target} {goal.unit} mémorisés
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs italic">Non défini</span>
                        )}
                      </td>

                      {/* Santé Académique - 5 dernières notes */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {scores.length > 0 ? (
                            scores.map((s, i) => (
                              <ScoreBadge key={i} score={s} max={scoreFieldKey?.max ?? 5} />
                            ))
                          ) : (
                            <span className="text-muted-foreground/40 text-xs italic">—</span>
                          )}
                        </div>
                      </td>

                      {/* Assiduité */}
                      <td className="px-4 py-3 text-center">
                        {attPct != null ? (
                          <span className={cn("text-sm font-bold", attendanceColor(attPct))}>
                            {attPct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down drawer */}
      <SessionReportDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        student={drawerStudent}
        classId={classId}
        subjectId={selectedSubjectId}
      />
    </TooltipProvider>
  );
}
