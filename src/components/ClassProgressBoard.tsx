import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowUpDown, Printer, TrendingUp, Filter, Target, CalendarCheck, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";

interface ClassProgressBoardProps {
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
}

type ScoreEntry = { score: number; date: string; subjectName: string };

type StudentRow = {
  student_id: string;
  enrollment_id: string;
  prenom: string;
  nom: string;
};

/** Color for a score dot (w-3 h-3) */
function dotColor(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.8) return "bg-emerald-300";
  if (ratio >= 0.6) return "bg-amber-400";
  return "bg-red-500";
}

/** Attendance badge variant */
function attendanceBadge(pct: number): { variant: "default" | "secondary" | "destructive" | "outline"; className: string } {
  if (pct >= 80) return { variant: "default", className: "bg-emerald-500 hover:bg-emerald-500 text-white border-0" };
  if (pct >= 50) return { variant: "secondary", className: "bg-amber-400 hover:bg-amber-400 text-amber-900 border-0" };
  return { variant: "destructive", className: "" };
}

/** Academic year bounds (Sept 1 → June 30) */
function getAcademicYearProgress(): number {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(year, 8, 1); // Sept 1
  const end = new Date(year + 1, 5, 30); // June 30
  const total = differenceInDays(end, start);
  const elapsed = differenceInDays(now, start);
  return Math.max(0, Math.min(1, elapsed / total));
}

/** Skeleton rows for loading state */
function TableSkeletons() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t border-border/50">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[180px]" /></td>
          <td className="px-4 py-3">
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-[8px] w-[8px] rounded-full" />
              ))}
            </div>
          </td>
          <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-6 mx-auto rounded" /></td>
        </tr>
      ))}
    </>
  );
}

export function ClassProgressBoard({ classId, className, subjects }: ClassProgressBoardProps) {
  const { orgId } = useOrganization();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [sortByPriority, setSortByPriority] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; prenom: string; nom: string } | null>(null);

  const selectedSubjectName = subjects.find((s) => s.id === selectedSubjectId)?.name ?? "";
  const academicProgress = useMemo(() => getAcademicYearProgress(), []);

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

  // ── Fetch annual goals ──
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

  // ── Score field from schema ──
  const scoreFieldKey = useMemo(() => {
    if (!config?.form_schema_json) return null;
    const schema = config.form_schema_json as any[];
    const numField = schema.find((f: any) => f.type === "number");
    return numField ? { key: numField.key, max: numField.max ?? 5, label: numField.label } : null;
  }, [config]);

  // ── Fetch last 5 scores per student WITH dates ──
  const { data: scoresMap = new Map(), isLoading: isLoadingScores } = useQuery({
    queryKey: ["class_last_scores", orgId, classId, config?.id],
    enabled: !!orgId && !!classId && !!config?.id && students.length > 0,
    queryFn: async () => {
      const studentIds = students.map((s) => s.student_id).filter(Boolean);
      if (studentIds.length === 0) return new Map<string, ScoreEntry[]>();
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("student_id, lesson_date, data_json")
        .eq("class_id", classId)
        .eq("config_id", config!.id)
        .eq("org_id", orgId!)
        .in("student_id", studentIds)
        .order("lesson_date", { ascending: false })
        .limit(500);
      const m = new Map<string, ScoreEntry[]>();
      for (const p of data ?? []) {
        if (!scoreFieldKey) continue;
        const json = p.data_json as Record<string, any>;
        const val = json[scoreFieldKey.key];
        if (val == null) continue;
        const arr = m.get(p.student_id) ?? [];
        if (arr.length < 5) {
          arr.push({
            score: Number(val),
            date: p.lesson_date,
            subjectName: selectedSubjectName,
          });
        }
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

  // ── WhatsApp template from settings ──
  const { data: waSettings } = useQuery({
    queryKey: ["madrasa_settings_wa", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_settings")
        .select("whatsapp_session_template, whatsapp_absence_template")
        .eq("org_id", orgId!)
        .maybeSingle();
      return data;
    },
  });

  // ── Priority score for sorting ──
  const getPriority = useCallback((sid: string): number => {
    let priority = 0;
    const goal = goalsMap.get(sid);
    if (goal && goal.target > 0) {
      const ratio = goal.current / goal.target;
      if (ratio < 0.4) priority += 3;
      else if (ratio < 0.7) priority += 1;
    }
    const scores = scoresMap.get(sid);
    if (scores && scores.length >= 2 && scoreFieldKey) {
      const recent = scores[0].score / scoreFieldKey.max;
      const older = scores[scores.length - 1].score / scoreFieldKey.max;
      if (recent < older) priority += 2;
      if (recent < 0.4) priority += 2;
    }
    const att = attendanceMap.get(sid);
    if (att && att.total > 0 && (att.present / att.total) < 0.7) priority += 2;
    return priority;
  }, [goalsMap, scoresMap, attendanceMap, scoreFieldKey]);

  const sortedStudents = useMemo(() => {
    if (!sortByPriority) return students;
    return [...students].sort((a, b) => getPriority(b.student_id) - getPriority(a.student_id));
  }, [students, sortByPriority, getPriority]);

  const openDrawer = (student: StudentRow) => {
    setDrawerStudent({ id: student.student_id, prenom: student.prenom, nom: student.nom });
    setDrawerOpen(true);
  };

  const sendWhatsApp = (student: StudentRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const goal = goalsMap.get(student.student_id);
    const scores = scoresMap.get(student.student_id);
    const att = attendanceMap.get(student.student_id);
    const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

    // Choose template: if low attendance or absent pattern → absence, otherwise session
    const isAbsenceContext = attPct != null && attPct < 60;
    let template: string;

    if (isAbsenceContext) {
      template = waSettings?.whatsapp_absence_template ||
        `⚠️ *Absence remarquée*\nAs-salamu alaykum, nous avons noté des absences répétées de [PRENOM].\nMerci de nous contacter.\n\nLa Direction.`;
      template = template
        .replace(/\[PRENOM\]/g, student.prenom)
        .replace(/\[DATE\]/g, format(new Date(), "dd MMMM yyyy", { locale: fr }));
    } else {
      template = waSettings?.whatsapp_session_template ||
        `🕌 *Point Madrasa*\nVoici le résumé de [PRENOM] en [MATIERE].\n📈 *Avancée :* [POSITION]\n[NOTES]\n🗣️ *Mot du prof :* [REMARQUE]`;
      const notesTxt = scores && scores.length > 0
        ? scores.map((s) => `⭐ ${scoreFieldKey?.label ?? "Note"} : ${s.score}/${scoreFieldKey?.max ?? 5}`).join("\n")
        : "";
      template = template
        .replace(/\[PRENOM\]/g, student.prenom)
        .replace(/\[MATIERE\]/g, selectedSubjectName)
        .replace(/\[POSITION\]/g, goal ? `${goal.current}/${goal.target} ${goal.unit}` : "—")
        .replace(/\[NOTES\]/g, notesTxt)
        .replace(/\[REMARQUE\]/g, "");
    }

    const encoded = encodeURIComponent(template);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
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
        h2 { color: #0B1A3D; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      <h2>${className} — Pilotage Pédagogique</h2>
      <p>Matière : ${selectedSubjectName} · Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
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
            className={cn("gap-1.5", sortByPriority && "bg-primary hover:bg-primary/90")}
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
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-secondary" /> ≥ 70%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 40–70%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> &lt; 40%</span>
          <span className="flex items-center gap-1 ml-2 border-l pl-2 border-border">
            <span className="h-3 w-px bg-destructive inline-block" /> Marqueur théorique
          </span>
        </div>

        {/* Table */}
        {students.length === 0 && !isLoadingScores ? (
          <div className="py-12 text-center text-muted-foreground text-sm rounded-xl border border-dashed">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            Aucun élève inscrit dans cette classe.
          </div>
        ) : (
          <div ref={printRef} className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left font-semibold min-w-[180px]">Élève</th>
                  <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                    <div className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Objectif Annuel</div>
                  </th>
                  <th className="px-4 py-3 text-center font-medium min-w-[130px]">
                    <div className="flex items-center gap-1.5 justify-center"><TrendingUp className="h-3.5 w-3.5" /> Santé Académique</div>
                  </th>
                  <th className="px-4 py-3 text-center font-medium min-w-[90px]">
                    <div className="flex items-center gap-1.5 justify-center"><CalendarCheck className="h-3.5 w-3.5" /> Assiduité</div>
                  </th>
                  <th className="px-4 py-3 text-center font-medium w-[60px] no-print">
                    <MessageCircle className="h-3.5 w-3.5 mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingScores ? (
                  <TableSkeletons />
                ) : (
                  sortedStudents.map((student, idx) => {
                    const goal = goalsMap.get(student.student_id);
                    const goalRatio = goal && goal.target > 0 ? goal.current / goal.target : null;
                    const goalPct = goalRatio != null ? Math.min(goalRatio * 100, 100) : null;

                    // Is the student behind the theoretical pace?
                    const isBehind = goalRatio != null && goalRatio < academicProgress;
                    const theoreticalPct = Math.min(academicProgress * 100, 100);

                    const scores = scoresMap.get(student.student_id) ?? [];
                    const att = attendanceMap.get(student.student_id);
                    const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

                    const initials = `${student.prenom?.[0] ?? ""}${student.nom?.[0] ?? ""}`.toUpperCase();
                    const priority = getPriority(student.student_id);

                    return (
                      <tr
                        key={student.student_id}
                        onClick={() => openDrawer(student)}
                        className={cn(
                          "border-t border-border/50 cursor-pointer transition-colors hover:bg-muted/40",
                          idx % 2 === 0 && "bg-muted/10",
                          sortByPriority && priority >= 4 && "bg-destructive/5 hover:bg-destructive/10"
                        )}
                      >
                        {/* Élève */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground leading-tight">{student.prenom} {student.nom}</p>
                              {sortByPriority && priority >= 4 && (
                                <span className="text-[10px] text-destructive font-medium">⚠ Attention requise</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Objectif Annuel — Smart progress */}
                        <td className="px-4 py-3">
                          {goalPct != null && goal ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">{goal.current}/{goal.target} {goal.unit}</span>
                                    <span className={cn("font-semibold",
                                      isBehind ? "text-destructive" : goalRatio! >= 0.7 ? "text-secondary" : "text-amber-600"
                                    )}>
                                      {Math.round(goalPct)}%
                                    </span>
                                  </div>
                                  {/* Progress bar with theoretical marker */}
                                  <div className="relative">
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          isBehind ? "bg-destructive" : goalRatio! >= 0.7 ? "bg-secondary" : "bg-amber-500"
                                        )}
                                        style={{ width: `${goalPct}%` }}
                                      />
                                    </div>
                                    {/* Theoretical marker */}
                                    <div
                                      className="absolute top-0 h-2 w-px bg-foreground/60"
                                      style={{ left: `${theoreticalPct}%` }}
                                    />
                                    <div
                                      className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground/40"
                                      style={{ left: `${theoreticalPct}%`, transform: "translateX(-50%)" }}
                                    />
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p>{goal.current} / {goal.target} {goal.unit}</p>
                                <p className="text-muted-foreground">
                                  Objectif théorique : {Math.round(theoreticalPct)}% à ce jour
                                </p>
                                {isBehind && <p className="text-destructive font-medium">⚠ En retard sur le rythme</p>}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs italic">Non défini</span>
                          )}
                        </td>

                        {/* Santé Académique — Score dots */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {scores.length > 0 ? (
                              scores.map((entry, i) => (
                                <Tooltip key={i}>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        "inline-block h-2 w-2 rounded-full transition-transform hover:scale-150",
                                        dotColor(entry.score, scoreFieldKey?.max ?? 5)
                                      )}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p className="font-medium">{entry.score}/{scoreFieldKey?.max ?? 5}</p>
                                    <p className="text-muted-foreground">
                                      {entry.date ? format(parseISO(entry.date), "dd MMM yyyy", { locale: fr }) : "—"} · {entry.subjectName}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ))
                            ) : (
                              Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className="inline-block h-2 w-2 rounded-full bg-muted" />
                              ))
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

                        {/* WhatsApp quick action */}
                        <td className="px-4 py-3 text-center no-print">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-secondary"
                                onClick={(e) => sendWhatsApp(student, e)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                              Envoyer un bilan au parent via WhatsApp
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
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
