import { useMemo, useState } from "react";
import { ClipboardCheck, BarChart3, FileText, Users, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { EvalMonitoringWidgets } from "./EvalMonitoringWidgets";
import type { ClassWithEvalStats } from "@/hooks/useEvaluationData";

interface Props {
  classes: ClassWithEvalStats[];
  loading: boolean;
  onSelectClass: (id: string) => void;
}

export function EvalClassesView({ classes, loading, onSelectClass }: Props) {
  const { yearLabel } = useCurrentAcademicYear();

  const kpis = useMemo(() => {
    const totalExams = classes.reduce((s, c) => s + c.evalCount, 0);
    const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
    const avgs = classes.filter((c) => c.classAverage !== null).map((c) => c.classAverage!);
    const globalAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    return { totalExams, totalStudents, globalAvg, classCount: classes.length };
  }, [classes]);

  const classIds = useMemo(() => classes.map((c) => c.id), [classes]);

  const statItems: StatCardItem[] = [
    { label: "Classes", value: kpis.classCount, icon: Users, color: "hsl(var(--brand-navy))" },
    { label: "Examens créés", value: kpis.totalExams, icon: FileText, color: "hsl(var(--brand-cyan))" },
    { label: "Élèves évalués", value: kpis.totalStudents, icon: Users, color: "hsl(var(--brand-emerald))" },
    { label: "Moyenne générale", value: kpis.globalAvg !== null ? kpis.globalAvg.toFixed(1) + "/20" : "—", icon: BarChart3, color: "hsl(var(--brand-cyan))" },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ClipboardCheck className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Évaluations & Notes</h1>
            <p className="text-sm text-muted-foreground">
              Gestion des examens multi-critères{yearLabel ? ` — ${yearLabel}` : ""}
            </p>
          </div>
        </div>

        <StatCards items={statItems} />

        {/* Monitoring widgets */}
        {!loading && classes.length > 0 && <EvalMonitoringWidgets classIds={classIds} />}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucune classe configurée.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelectClass(c.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{c.nom}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{c.evalCount} exam{c.evalCount !== 1 ? "s" : ""}</Badge>
                  </div>
                  {c.niveau && <CardDescription>{c.niveau}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.studentCount} élèves</span>
                    {c.classAverage !== null && (
                      <span className="font-semibold text-foreground">
                        Moy. {c.classAverage.toFixed(1)}/20
                      </span>
                    )}
                  </div>
                  {c.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.subjects.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">{s.name}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
