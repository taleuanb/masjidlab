import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Filter, Printer, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";

interface ClassProgressBoardProps {
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
}

/** Returns heatmap color based on score ratio (0-1) */
function heatColor(ratio: number): string {
  if (ratio >= 0.85) return "bg-brand-emerald text-white";
  if (ratio >= 0.6) return "bg-brand-emerald/30 text-brand-emerald";
  if (ratio >= 0.4) return "bg-amber-400/30 text-amber-700";
  return "bg-destructive/20 text-destructive";
}

export function ClassProgressBoard({ classId, className, subjects }: ClassProgressBoardProps) {
  const { orgId } = useOrganization();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const printRef = useRef<HTMLDivElement>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<{ id: string; prenom: string; nom: string } | null>(null);
  const [drawerDate, setDrawerDate] = useState<string>("");

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
        .sort((a: any, b: any) => a.nom.localeCompare(b.nom));
    },
  });

  // ── Fetch progress data (last 8 sessions) ──
  const { data: progressData, isLoading } = useQuery({
    queryKey: ["class_progress_board", orgId, classId, config?.id],
    enabled: !!orgId && !!classId && !!config?.id,
    queryFn: async () => {
      const studentIds = students.map((s) => s.student_id).filter(Boolean);
      if (studentIds.length === 0) return [];

      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("student_id, lesson_date, data_json, updated_at")
        .eq("class_id", classId)
        .eq("config_id", config!.id)
        .eq("org_id", orgId!)
        .in("student_id", studentIds)
        .order("lesson_date", { ascending: false })
        .limit(500);

      return data ?? [];
    },
  });

  // ── Determine the primary "score" field from schema ──
  const scoreFieldKey = useMemo(() => {
    if (!config?.form_schema_json) return null;
    const schema = config.form_schema_json as any[];
    const numField = schema.find((f: any) => f.type === "number");
    return numField ? { key: numField.key, max: numField.max ?? 20, label: numField.label } : null;
  }, [config]);

  // ── Build grid: unique dates (last 8) and lookup ──
  const { sessionDates, grid } = useMemo(() => {
    if (!progressData || progressData.length === 0) return { sessionDates: [], grid: new Map() };

    // Collect unique dates
    const dateSet = new Set<string>();
    for (const p of progressData) dateSet.add(p.lesson_date);
    const sortedDates = Array.from(dateSet).sort().reverse().slice(0, 8).reverse();

    // Build lookup: student_id -> date -> { score, data_json }
    const g = new Map<string, Map<string, { score: number | null; data: any; updated_at: string | null }>>();
    for (const p of progressData) {
      if (!sortedDates.includes(p.lesson_date)) continue;
      if (!g.has(p.student_id)) g.set(p.student_id, new Map());
      const json = p.data_json as Record<string, any>;
      const score = scoreFieldKey ? (json[scoreFieldKey.key] != null ? Number(json[scoreFieldKey.key]) : null) : null;
      g.get(p.student_id)!.set(p.lesson_date, { score, data: json, updated_at: p.updated_at });
    }

    return { sessionDates: sortedDates, grid: g };
  }, [progressData, scoreFieldKey]);

  // ── Class averages per session ──
  const classAverages = useMemo(() => {
    if (!scoreFieldKey) return new Map<string, number | null>();
    const avgs = new Map<string, number | null>();
    for (const date of sessionDates) {
      let sum = 0;
      let count = 0;
      for (const s of students) {
        const cell = grid.get(s.student_id)?.get(date);
        if (cell?.score != null) {
          sum += cell.score;
          count++;
        }
      }
      avgs.set(date, count > 0 ? sum / count : null);
    }
    return avgs;
  }, [sessionDates, grid, students, scoreFieldKey]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Rapport de classe - ${className}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
        th { background: #0B1A3D; color: white; }
        td:first-child { text-align: left; font-weight: 500; }
        .good { background: #d1fae5; } .mid { background: #fef3c7; } .bad { background: #fee2e2; }
        h2 { color: #0B1A3D; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; }
      </style></head><body>
      <h2>${className} — Progression ${subjects.find(s => s.id === selectedSubjectId)?.name ?? ""}</h2>
      <p>Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
      ${printRef.current.querySelector("table")?.outerHTML ?? ""}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const openCellDrawer = (student: typeof students[0], date: string) => {
    setDrawerStudent({ id: student.student_id, prenom: student.prenom, nom: student.nom });
    setDrawerDate(date);
    setDrawerOpen(true);
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

          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>
        </div>

        {/* Score field indicator */}
        {scoreFieldKey && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>Champ noté : <strong className="text-foreground">{scoreFieldKey.label}</strong> (/{scoreFieldKey.max})</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-emerald" /> ≥ 85%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-emerald/30" /> ≥ 60%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400/30" /> ≥ 40%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/20" /> &lt; 40%</span>
          </div>
        )}

        {/* Heatmap grid */}
        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : sessionDates.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm rounded-xl border border-dashed">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            Aucune séance enregistrée pour cette matière.
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div ref={printRef} className="min-w-[500px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-brand-navy text-white">
                    <th className="sticky left-0 z-10 bg-brand-navy px-3 py-2.5 text-left font-semibold min-w-[150px]">
                      Élève
                    </th>
                    {sessionDates.map((date) => (
                      <th key={date} className="px-2 py-2.5 text-center font-medium min-w-[60px]">
                        <div className="leading-tight">
                          <div className="text-[9px] uppercase opacity-70">
                            {format(parseISO(date), "EEE", { locale: fr })}
                          </div>
                          <div>{format(parseISO(date), "dd/MM")}</div>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-semibold min-w-[50px]">Moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const studentGrid = grid.get(student.student_id);
                    let totalScore = 0;
                    let scoreCount = 0;

                    return (
                      <tr
                        key={student.student_id}
                        className={cn(
                          "border-t border-border/50 hover:bg-muted/30 transition-colors",
                          idx % 2 === 0 && "bg-muted/10"
                        )}
                      >
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground whitespace-nowrap">
                          {student.prenom} {student.nom}
                        </td>
                        {sessionDates.map((date) => {
                          const cell = studentGrid?.get(date);
                          const score = cell?.score;

                          if (score != null && scoreFieldKey) {
                            totalScore += score;
                            scoreCount++;
                          }

                          if (!cell) {
                            return (
                              <td key={date} className="px-2 py-2 text-center">
                                <span className="text-muted-foreground/30">—</span>
                              </td>
                            );
                          }

                          const ratio = score != null && scoreFieldKey ? score / scoreFieldKey.max : null;

                          return (
                            <td key={date} className="px-1 py-1.5 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => openCellDrawer(student, date)}
                                    className={cn(
                                      "inline-flex items-center justify-center h-7 min-w-[36px] rounded-md text-[11px] font-semibold cursor-pointer transition-all hover:scale-110 hover:shadow-sm",
                                      ratio != null ? heatColor(ratio) : "bg-muted/50 text-muted-foreground"
                                    )}
                                  >
                                    {score != null ? score : "✓"}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[220px]">
                                  <p className="font-semibold">
                                    {format(parseISO(date), "EEEE d MMMM", { locale: fr })}
                                  </p>
                                  {score != null && scoreFieldKey && (
                                    <p>{scoreFieldKey.label}: {score}/{scoreFieldKey.max}</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground mt-1">Cliquer pour voir/modifier</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold">
                          {scoreCount > 0 && scoreFieldKey ? (
                            <span className={cn(
                              "text-xs",
                              (totalScore / scoreCount / scoreFieldKey.max) >= 0.6
                                ? "text-brand-emerald"
                                : (totalScore / scoreCount / scoreFieldKey.max) >= 0.4
                                ? "text-amber-600"
                                : "text-destructive"
                            )}>
                              {(totalScore / scoreCount).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Class average row */}
                  <tr className="border-t-2 border-brand-navy/20 bg-brand-navy/5 font-semibold">
                    <td className="sticky left-0 z-10 bg-brand-navy/5 px-3 py-2 text-brand-navy whitespace-nowrap">
                      <TrendingUp className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                      Moyenne classe
                    </td>
                    {sessionDates.map((date) => {
                      const avg = classAverages.get(date);
                      return (
                        <td key={date} className="px-2 py-2 text-center">
                          {avg != null && scoreFieldKey ? (
                            <span className={cn(
                              "text-xs font-bold",
                              (avg / scoreFieldKey.max) >= 0.6 ? "text-brand-emerald" : "text-amber-600"
                            )}>
                              {avg.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const allAvgs = Array.from(classAverages.values()).filter((v): v is number => v != null);
                        if (allAvgs.length === 0) return <span className="text-muted-foreground">—</span>;
                        const globalAvg = allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
                        return (
                          <span className="text-xs font-bold text-brand-navy">
                            {globalAvg.toFixed(1)}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Drill-down drawer */}
      <SessionReportDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        student={drawerStudent}
        classId={classId}
        subjectId={selectedSubjectId}
        forDate={drawerDate || undefined}
      />
    </TooltipProvider>
  );
}
