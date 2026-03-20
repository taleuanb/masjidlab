import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ClipboardList } from "lucide-react";
import {
  ResponsiveContainer, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  grades: any[];
}

const StudentResultsTab = ({ grades }: Props) => {
  const chartData = [...grades]
    .sort((a, b) => {
      const dateA = (a.madrasa_evaluations as any)?.date || "";
      const dateB = (b.madrasa_evaluations as any)?.date || "";
      return dateA.localeCompare(dateB);
    })
    .map(g => {
      const eval_ = g.madrasa_evaluations as any;
      const max = eval_?.max_points || 20;
      return {
        date: eval_?.date ? format(parseISO(eval_.date), "dd MMM", { locale: fr }) : "",
        note: g.score ? Number(((g.score / max) * 20).toFixed(1)) : 0,
        matiere: eval_?.madrasa_subjects?.name || "—",
        title: eval_?.title || "",
      };
    });

  return (
    <div className="space-y-4">
      {/* Chart */}
      {chartData.length >= 2 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-emerald" /> Évolution des notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="noteGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(161 84% 39%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(161 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                    formatter={(value: number, _: any, props: any) => [
                      `${value}/20`,
                      props.payload.title || props.payload.matiere,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="note"
                    stroke="hsl(161 84% 39%)"
                    strokeWidth={2}
                    fill="url(#noteGrad)"
                    dot={{ r: 4, fill: "hsl(161 84% 39%)" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Au moins 2 évaluations sont nécessaires pour générer un graphique de progression.
          </p>
        </div>
      )}

      {/* All grades list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-navy" /> Toutes les évaluations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grades.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune évaluation enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {grades.map(g => {
                const eval_ = g.madrasa_evaluations as any;
                const max = eval_?.max_points || 20;
                const pct = g.score ? (g.score / max) * 100 : 0;
                return (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{eval_?.title || "Examen"}</p>
                      <p className="text-xs text-muted-foreground">
                        {eval_?.madrasa_subjects?.name || "—"} · {eval_?.date ? format(parseISO(eval_.date), "dd MMM yyyy", { locale: fr }) : "—"}
                      </p>
                      {g.comment && <p className="text-xs text-muted-foreground italic mt-0.5">{g.comment}</p>}
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono tabular-nums ${pct >= 70 ? "border-brand-emerald/40 text-brand-emerald" : pct >= 50 ? "" : "border-destructive/40 text-destructive"}`}
                    >
                      {g.score ?? "—"}/{max}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentResultsTab;
