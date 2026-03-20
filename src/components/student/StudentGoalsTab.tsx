import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Target, Save, BookOpen } from "lucide-react";

interface StudentGoalsTabProps {
  studentId: string;
  studentPrenom: string;
}

const UNITS = ["Hizb", "Versets", "Pages", "Chapitres", "Sourates", "Leçons"];

function currentAcademicYear() {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

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

  // Local form state per subject
  const [formState, setFormState] = useState<Record<string, { target: string; unit: string }>>({});

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
        Définissez les objectifs annuels de <span className="font-medium text-brand-navy">{studentPrenom}</span> pour l'année <span className="font-semibold">{academicYear}</span>.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {subjects.map((subject) => {
          const goal = getGoalForSubject(subject.id);
          const vals = getFormValue(subject.id);
          const progress = goal && goal.target_value > 0
            ? Math.min(100, Math.round((Number(goal.current_position) / Number(goal.target_value)) * 100))
            : 0;

          return (
            <Card key={subject.id} className="border-brand-cyan/20 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-brand-navy">
                  <BookOpen className="h-4 w-4 text-brand-cyan" />
                  {subject.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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

                {goal && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progression : {Number(goal.current_position)} / {Number(goal.target_value)} {goal.unit_label}</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {!goal && vals.target && parseFloat(vals.target) > 0 && (
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
