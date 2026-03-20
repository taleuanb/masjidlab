import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Target, Save, BookOpen, Flag, TrendingUp, TrendingDown, Minus, Pencil, X, Check } from "lucide-react";

interface StudentGoalsTabProps {
  studentId: string;
  studentPrenom: string;
}

const UNITS = ["Hizb", "Versets", "Pages", "Chapitres", "Sourates", "Leçons"];

// Sept 1 → June 30 academic year
function currentAcademicYear() {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function getAcademicYearBounds(academicYear: string) {
  const [startY] = academicYear.split("-").map(Number);
  const start = new Date(startY, 8, 1); // Sept 1
  const end = new Date(startY + 1, 5, 30); // June 30
  return { start, end };
}

function computeTrajectory(target: number, current: number, academicYear: string) {
  const { start, end } = getAcademicYearBounds(academicYear);
  const now = new Date();
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
  const elapsedDays = Math.max(0, Math.min(totalDays, (now.getTime() - start.getTime()) / 86400000));
  const theoreticalValue = (elapsedDays / totalDays) * target;
  const theoreticalPct = Math.min(100, Math.round((theoreticalValue / target) * 100));
  const realPct = Math.min(100, Math.round((current / target) * 100));
  const diff = current - theoreticalValue;
  const remainingDays = Math.max(0, (end.getTime() - now.getTime()) / 86400000);
  const remaining = target - current;
  const projectedPct = remainingDays > 0 && elapsedDays > 0
    ? Math.min(100, Math.round(((current / elapsedDays) * totalDays / target) * 100))
    : realPct;

  let status: "ahead" | "on_track" | "behind";
  if (diff > target * 0.05) status = "ahead";
  else if (diff < -(target * 0.05)) status = "behind";
  else status = "on_track";

  return { theoreticalValue: Math.round(theoreticalValue * 10) / 10, theoreticalPct, realPct, status, projectedPct, remaining, elapsedDays, totalDays };
}

const statusConfig = {
  ahead: { label: "En avance", color: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30", icon: TrendingUp },
  on_track: { label: "Sur les rails", color: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30", icon: Minus },
  behind: { label: "En retard", color: "bg-destructive/15 text-destructive border-destructive/30", icon: TrendingDown },
};

const StudentGoalsTab = ({ studentId, studentPrenom }: StudentGoalsTabProps) => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const academicYear = currentAcademicYear();

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects")
        .select("id, name")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ["student_goals", studentId, orgId, academicYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_student_goals")
        .select("*")
        .eq("student_id", studentId)
        .eq("org_id", orgId!)
        .eq("academic_year", academicYear);
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && !!orgId,
  });

  // Fetch latest progress per subject to sync current_position
  const { data: latestProgress = [] } = useQuery({
    queryKey: ["student_latest_progress", studentId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_student_progress")
        .select("data_json, madrasa_session_configs(subject_id)")
        .eq("student_id", studentId)
        .eq("org_id", orgId!)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && !!orgId,
  });

  const [formState, setFormState] = useState<Record<string, { target: string; unit: string }>>({});
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState("");

  const getLatestPositionForSubject = (subjectId: string): number | null => {
    for (const entry of latestProgress) {
      const config = entry.madrasa_session_configs as any;
      if (config?.subject_id === subjectId) {
        const json = entry.data_json as any;
        if (json?._goal_position != null) return Number(json._goal_position);
      }
    }
    return null;
  };

  const getGoalForSubject = (subjectId: string) => goals.find((g) => g.subject_id === subjectId);

  const getFormValue = (subjectId: string) => {
    if (formState[subjectId]) return formState[subjectId];
    const existing = getGoalForSubject(subjectId);
    return {
      target: existing ? String(existing.target_value) : "",
      unit: existing?.unit_label || "Versets",
    };
  };

  const setField = (subjectId: string, field: "target" | "unit", value: string) => {
    setFormState((prev) => ({
      ...prev,
      [subjectId]: { ...getFormValue(subjectId), [field]: value },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async ({ subjectId, target, unit }: { subjectId: string; target: number; unit: string }) => {
      const existing = getGoalForSubject(subjectId);
      if (existing) {
        const { error } = await supabase
          .from("madrasa_student_goals")
          .update({ target_value: target, unit_label: unit })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("madrasa_student_goals").insert({
          student_id: studentId,
          subject_id: subjectId,
          org_id: orgId!,
          target_value: target,
          current_position: 0,
          unit_label: unit,
          academic_year: academicYear,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      const subName = subjects.find((s) => s.id === vars.subjectId)?.name || "Matière";
      toast.success(`Objectif enregistré pour ${subName}`);
      queryClient.invalidateQueries({ queryKey: ["student_goals", studentId] });
      setAdjustingId(null);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const handleSave = (subjectId: string) => {
    const vals = getFormValue(subjectId);
    const target = parseFloat(vals.target);
    if (!target || target <= 0) {
      toast.error("Veuillez saisir une cible valide");
      return;
    }
    saveMutation.mutate({ subjectId, target, unit: vals.unit });
  };

  const handleAdjust = (goal: typeof goals[0]) => {
    const newTarget = parseFloat(adjustValue);
    if (!newTarget || newTarget <= 0) {
      toast.error("Cible invalide");
      return;
    }
    saveMutation.mutate({ subjectId: goal.subject_id, target: newTarget, unit: goal.unit_label });
  };

  if (loadingSubjects || loadingGoals) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Aucune matière configurée pour cette organisation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Objectifs annuels de <span className="font-medium text-brand-navy">{studentPrenom}</span> — <span className="font-semibold">{academicYear}</span>
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {subjects.map((subject) => {
          const goal = getGoalForSubject(subject.id);
          const vals = getFormValue(subject.id);
          const hasGoal = goal && Number(goal.target_value) > 0;

          // Trajectory analysis
          const trajectory = hasGoal
            ? computeTrajectory(Number(goal.target_value), Number(goal.current_position), academicYear)
            : null;

          const statusInfo = trajectory ? statusConfig[trajectory.status] : null;
          const StatusIcon = statusInfo?.icon;
          const isAdjusting = adjustingId === goal?.id;

          return (
            <Card key={subject.id} className="border-brand-cyan/20 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-brand-navy">
                    <BookOpen className="h-4 w-4 text-brand-cyan" />
                    {subject.name}
                  </CardTitle>
                  {statusInfo && StatusIcon && (
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 ${statusInfo.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Goal definition form (when no goal exists) */}
                {!hasGoal && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Cible annuelle</label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 60"
                        value={vals.target}
                        onChange={(e) => setField(subject.id, "target", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <label className="text-xs text-muted-foreground">Unité</label>
                      <Select value={vals.unit} onValueChange={(v) => setField(subject.id, "unit", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      className="h-9 bg-brand-emerald hover:bg-brand-emerald/90 text-white"
                      onClick={() => handleSave(subject.id)}
                      disabled={saveMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Progression analysis (when goal exists) */}
                {hasGoal && trajectory && (
                  <>
                    {/* Dual progress bars */}
                    <div className="space-y-1.5">
                      {/* Theoretical line */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-muted-foreground">Théorique</span>
                        <div className="flex-1 relative">
                          <Progress value={trajectory.theoreticalPct} className="h-2 bg-muted [&>div]:bg-brand-navy/40" />
                        </div>
                        <span className="w-10 text-right text-muted-foreground font-medium">{trajectory.theoreticalPct}%</span>
                      </div>
                      {/* Real progress */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-brand-emerald font-medium">Réel</span>
                        <div className="flex-1 relative">
                          <Progress value={trajectory.realPct} className="h-2 bg-muted [&>div]:bg-brand-emerald" />
                        </div>
                        <span className="w-10 text-right text-brand-emerald font-semibold">{trajectory.realPct}%</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex justify-between text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                      <div>
                        <Flag className="h-3 w-3 inline mr-1 text-brand-navy" />
                        {Number(goal.current_position)} / {Number(goal.target_value)} {goal.unit_label}
                      </div>
                      <div>
                        Attendu : ~{trajectory.theoreticalValue} {goal.unit_label}
                      </div>
                    </div>

                    {/* Projection text */}
                    <p className="text-xs text-muted-foreground italic">
                      À ce rythme, l'objectif sera atteint à <span className={`font-semibold ${trajectory.projectedPct >= 90 ? 'text-brand-emerald' : trajectory.projectedPct >= 60 ? 'text-brand-cyan' : 'text-destructive'}`}>{trajectory.projectedPct}%</span> en fin d'année.
                    </p>

                    {/* Adjust button */}
                    {isAdjusting ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={adjustValue}
                          onChange={(e) => setAdjustValue(e.target.value)}
                          className="h-8 w-28 text-sm"
                          placeholder="Nouvelle cible"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">{goal.unit_label}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-brand-emerald"
                          onClick={() => handleAdjust(goal)}
                          disabled={saveMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setAdjustingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setAdjustingId(goal.id);
                          setAdjustValue(String(goal.target_value));
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Réajuster l'objectif
                      </Button>
                    )}
                  </>
                )}

                {!hasGoal && vals.target && parseFloat(vals.target) > 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Cliquez sur enregistrer pour définir l'objectif.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentGoalsTab;