import { User, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { ClassWithEvalStats } from "@/hooks/useEvaluationData";

interface Props {
  cls: ClassWithEvalStats;
  onClick: () => void;
}

function getBorderColor(avg: number | null): string {
  if (avg === null) return "border-border";
  if (avg >= 14) return "border-emerald-500";
  if (avg >= 10) return "border-amber-500";
  return "border-destructive";
}

function getAvgColor(avg: number | null): string {
  if (avg === null) return "text-muted-foreground";
  if (avg >= 14) return "text-emerald-600";
  if (avg >= 10) return "text-amber-600";
  return "text-destructive";
}

export function ClassEvalCard({ cls, onClick }: Props) {
  const sparkData = cls.recentAverages.map((v, i) => ({ i, v }));

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border bg-card shadow-sm cursor-pointer",
        "border-l-4 transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-lg",
        getBorderColor(cls.classAverage)
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground truncate">{cls.nom}</h3>
            {cls.niveau && (
              <Badge variant="secondary" className="text-[10px] font-normal mt-1">
                {cls.niveau}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 tabular-nums">
            {cls.evalCount} examen{cls.evalCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Data section */}
        <div className="flex items-center justify-between gap-3">
          {/* Average */}
          <div>
            {cls.classAverage !== null ? (
              <>
                <p className={cn("text-3xl font-bold tabular-nums leading-none", getAvgColor(cls.classAverage))}>
                  {cls.classAverage.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">/20 moyenne</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Pas de notes</p>
            )}
          </div>

          {/* Sparkline */}
          {sparkData.length >= 2 && (
            <div className="w-24 h-10 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-3">
            {cls.teacherName && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[100px]">{cls.teacherName}</span>
              </span>
            )}
            <span>{cls.studentCount} élèves</span>
          </div>
          {cls.attendanceRate !== null && (
            <span className="flex items-center gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              {cls.attendanceRate}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
