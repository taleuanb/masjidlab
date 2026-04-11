import { User, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { ClassWithEvalStats } from "@/hooks/useEvaluationData";

interface Props {
  cls: ClassWithEvalStats;
  onClick: () => void;
  focused?: boolean;
  dimmed?: boolean;
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ClassEvalCard({ cls, onClick, focused, dimmed }: Props) {
  const sparkData = cls.recentAverages.map((v, i) => ({ i, v }));

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border bg-card cursor-pointer",
        "border-l-4 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg",
        getBorderColor(cls.classAverage),
        focused && "shadow-lg ring-2 ring-primary/30 scale-[1.01]",
        dimmed && "opacity-40 grayscale-[30%] hover:opacity-70 hover:grayscale-0",
        !focused && !dimmed && "shadow-sm"
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

        {/* Subject badges */}
        {cls.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cls.subjects.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">
                {s.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-3">
            {cls.teacherName ? (
              <span className="flex items-center gap-1.5 truncate">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                    {getInitials(cls.teacherName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[90px]">{cls.teacherName}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground/50">
                <User className="h-3 w-3" />
                Non assigné
              </span>
            )}
            <span>{cls.studentCount} élèves</span>
          </div>
          {cls.attendanceRate !== null && (
            <span className="flex items-center gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {cls.attendanceRate}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
