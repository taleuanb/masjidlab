import { useMemo, useState } from "react";
import { ClipboardCheck, BarChart3, FileText, Users, Loader2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { EvalMonitoringWidgets } from "./EvalMonitoringWidgets";
import { ClassEvalCard } from "./ClassEvalCard";
import type { ClassWithEvalStats } from "@/hooks/useEvaluationData";

interface Props {
  classes: ClassWithEvalStats[];
  loading: boolean;
  onSelectClass: (id: string) => void;
}

export function EvalClassesView({ classes, loading, onSelectClass }: Props) {
  const { yearLabel } = useCurrentAcademicYear();
  const [filterClassId, setFilterClassId] = useState<string>("all");

  const kpis = useMemo(() => {
    const totalExams = classes.reduce((s, c) => s + c.evalCount, 0);
    const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
    const avgs = classes.filter((c) => c.classAverage !== null).map((c) => c.classAverage!);
    const globalAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    return { totalExams, totalStudents, globalAvg, classCount: classes.length };
  }, [classes]);

  const filteredClassIds = useMemo(() => {
    if (filterClassId === "all") return classes.map((c) => c.id);
    return [filterClassId];
  }, [classes, filterClassId]);

  const classNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of classes) map[c.id] = c.nom;
    return map;
  }, [classes]);

  const isFiltered = filterClassId !== "all";

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
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

          {/* Class filter - top right */}
          {!loading && classes.length > 0 && (
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="w-52 h-9 text-sm">
                <SelectValue placeholder="Filtrer par classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <StatCards items={statItems} />

        {/* Monitoring widgets */}
        {!loading && classes.length > 0 && (
          <EvalMonitoringWidgets
            classIds={filteredClassIds}
            classNameMap={classNameMap}
            maxAlerts={isFiltered ? undefined : 5}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucune classe configurée.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <ClassEvalCard key={c.id} cls={c} onClick={() => onSelectClass(c.id)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
