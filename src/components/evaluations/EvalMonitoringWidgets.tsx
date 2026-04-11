import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  classIds: string[];
  classNameMap?: Record<string, string>;
  maxAlerts?: number;
}

type PeriodFilter = "all" | "trimestre1" | "trimestre2" | "trimestre3";

export function EvalMonitoringWidgets({ classIds, classNameMap = {}, maxAlerts = 8 }: Props) {
  const { orgId } = useOrganization();
  const [period, setPeriod] = useState<PeriodFilter>("all");

  // Fetch last evaluations with their grades for trend
  const { data: evalTrends = [] } = useQuery({
    queryKey: ["eval_trends", orgId, classIds.join(",")],
    enabled: !!orgId && classIds.length > 0,
    queryFn: async () => {
      const { data: evals } = await supabase
        .from("madrasa_evaluations")
        .select("id, title, date, class_id")
        .eq("org_id", orgId!)
        .in("class_id", classIds)
        .order("date", { ascending: true })
        .limit(50);
      if (!evals || evals.length === 0) return [];

      const evalIds = evals.map((e) => e.id);
      const { data: grades } = await supabase
        .from("madrasa_grades")
        .select("evaluation_id, score")
        .eq("org_id", orgId!)
        .in("evaluation_id", evalIds);

      const evalAvgs: Record<string, { total: number; count: number }> = {};
      for (const g of grades ?? []) {
        if (g.score == null) continue;
        if (!evalAvgs[g.evaluation_id]) evalAvgs[g.evaluation_id] = { total: 0, count: 0 };
        evalAvgs[g.evaluation_id].total += Number(g.score);
        evalAvgs[g.evaluation_id].count += 1;
      }

      return evals.map((e) => ({
        ...e,
        average: evalAvgs[e.id] ? evalAvgs[e.id].total / evalAvgs[e.id].count : null,
      }));
    },
  });

  // Struggling students from latest evals
  const { data: strugglingStudents = [] } = useQuery({
    queryKey: ["struggling_students", orgId, classIds.join(",")],
    enabled: !!orgId && classIds.length > 0,
    queryFn: async () => {
      // Get last eval per class
      const { data: evals } = await supabase
        .from("madrasa_evaluations")
        .select("id, class_id, title")
        .eq("org_id", orgId!)
        .in("class_id", classIds)
        .order("date", { ascending: false })
        .limit(20);
      if (!evals || evals.length === 0) return [];

      // Take only the latest eval per class
      const latestByClass = new Map<string, typeof evals[0]>();
      for (const e of evals) {
        if (!latestByClass.has(e.class_id)) latestByClass.set(e.class_id, e);
      }
      const latestEvalIds = Array.from(latestByClass.values()).map((e) => e.id);

      const { data: grades } = await supabase
        .from("madrasa_grades")
        .select("evaluation_id, student_id, score")
        .eq("org_id", orgId!)
        .in("evaluation_id", latestEvalIds);

      // Compute avg per student per eval, track classId
      const evalClassMap = new Map(Array.from(latestByClass.entries()).map(([cId, e]) => [e.id, cId]));
      const studentAvgs: Record<string, { total: number; count: number; evalId: string; classId: string }> = {};
      for (const g of grades ?? []) {
        if (g.score == null) continue;
        const key = `${g.student_id}_${g.evaluation_id}`;
        if (!studentAvgs[key]) studentAvgs[key] = { total: 0, count: 0, evalId: g.evaluation_id, classId: evalClassMap.get(g.evaluation_id) ?? "" };
        studentAvgs[key].total += Number(g.score);
        studentAvgs[key].count += 1;
      }

      // Filter < 10/20
      const struggling: { studentId: string; avg: number; classId: string }[] = [];
      for (const [key, v] of Object.entries(studentAvgs)) {
        const avg = v.total / v.count;
        if (avg < 10) {
          struggling.push({ studentId: key.split("_")[0], avg, classId: v.classId });
        }
      }

      if (struggling.length === 0) return [];

      // Fetch student names
      const ids = [...new Set(struggling.map((s) => s.studentId))];
      const { data: students } = await supabase
        .from("madrasa_students")
        .select("id, nom, prenom")
        .in("id", ids);

      const nameMap = new Map((students ?? []).map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      return struggling
        .map((s) => ({ name: nameMap.get(s.studentId) ?? "Inconnu", avg: s.avg, classId: s.classId }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, maxAlerts);
    },
  });

  // Filter trends by period
  const filteredTrends = useMemo(() => {
    if (period === "all") return evalTrends;
    const month = (d: string) => new Date(d).getMonth();
    const ranges: Record<string, [number, number]> = {
      trimestre1: [8, 11], // Sep-Nov
      trimestre2: [11, 14], // Dec-Feb (wraps)
      trimestre3: [2, 5], // Mar-May
    };
    const [start, end] = ranges[period];
    return evalTrends.filter((e) => {
      const m = month(e.date);
      if (start > end) return m >= start || m < end; // wrap
      return m >= start && m < end;
    });
  }, [evalTrends, period]);

  const chartData = useMemo(
    () =>
      filteredTrends
        .filter((e) => e.average !== null)
        .map((e) => ({
          name: format(new Date(e.date), "dd MMM", { locale: fr }),
          moyenne: Number(e.average!.toFixed(1)),
        })),
    [filteredTrends]
  );

  if (classIds.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Tendance des moyennes</CardTitle>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              <SelectItem value="trimestre1">Trimestre 1</SelectItem>
              <SelectItem value="trimestre2">Trimestre 2</SelectItem>
              <SelectItem value="trimestre3">Trimestre 3</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Pas assez de données pour afficher la tendance (min. 2 examens).
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="moyenne"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Struggling students */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Élèves en difficulté
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strugglingStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucun élève sous la moyenne de 10/20. 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {strugglingStudents.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-foreground block">{s.name}</span>
                    {classNameMap[s.classId] && (
                      <span className="text-[10px] text-muted-foreground">{classNameMap[s.classId]}</span>
                    )}
                  </div>
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    {s.avg.toFixed(1)}/20
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
