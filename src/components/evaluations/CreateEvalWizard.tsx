import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useClassSubjects } from "@/hooks/useEvaluationData";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Loader2, CalendarIcon, Plus, Trash2, ChevronRight, ChevronLeft, BookOpen, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface CriterionDraft {
  label: string;
  max_score: number;
  weight: number;
}

interface SubjectDraft {
  id: string;
  name: string;
  selected: boolean;
  weight: number;
  criteria: CriterionDraft[];
  criteriaLoaded: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  onCreated?: (evalId: string) => void;
}

const DEFAULT_CRITERION: CriterionDraft = { label: "Note Globale", max_score: 20, weight: 1 };

export function CreateEvalWizard({ open, onOpenChange, classId, className: clsName, onCreated }: Props) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [subjects, setSubjects] = useState<SubjectDraft[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState<string | null>(null);

  const { data: classSubjects = [], isLoading: loadingSubjects } = useClassSubjects(classId);

  // Initialize subjects list (without criteria yet — loaded on toggle)
  useEffect(() => {
    if (!open || classSubjects.length === 0) return;
    setSubjects(
      classSubjects.map((s) => ({
        id: s.id,
        name: s.name,
        selected: false,
        weight: 1,
        criteria: [],
        criteriaLoaded: false,
      }))
    );
  }, [open, classSubjects]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setTitle("");
      setDate(undefined);
    }
  }, [open]);

  // Fetch criteria from DB when a subject is toggled ON
  const toggleSubject = async (id: string) => {
    const subj = subjects.find((s) => s.id === id);
    if (!subj) return;

    if (!subj.selected && !subj.criteriaLoaded && orgId) {
      // Fetch criteria from madrasa_subject_criteria
      setLoadingCriteria(id);
      try {
        const { data, error } = await supabase
          .from("madrasa_subject_criteria")
          .select("label, default_max_score, default_weight, order_index")
          .eq("subject_id", id)
          .eq("org_id", orgId)
          .order("order_index");

        if (error) throw error;

        const fetched: CriterionDraft[] = (data && data.length > 0)
          ? data.map((c) => ({
              label: c.label,
              max_score: c.default_max_score ?? 10,
              weight: c.default_weight ?? 1,
            }))
          : [{ ...DEFAULT_CRITERION }]; // Fallback: "Note Globale" /20

        setSubjects((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, selected: true, criteria: fetched, criteriaLoaded: true } : s
          )
        );
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      } finally {
        setLoadingCriteria(null);
      }
    } else {
      // Just toggle
      setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
    }
  };

  const selectedSubjects = subjects.filter((s) => s.selected);
  const totalPoints = selectedSubjects.reduce(
    (sum, s) => sum + s.criteria.reduce((cs, c) => cs + c.max_score, 0),
    0
  );

  const updateCriterion = (subjectId: string, idx: number, field: keyof CriterionDraft, value: number | string) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              criteria: s.criteria.map((c, i) =>
                i === idx ? { ...c, [field]: field === "label" ? value : Number(value) || 0 } : c
              ),
            }
          : s
      )
    );
  };

  const removeCriterion = (subjectId: string, idx: number) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId ? { ...s, criteria: s.criteria.filter((_, i) => i !== idx) } : s
      )
    );
  };

  const addCriterion = (subjectId: string) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, criteria: [...s.criteria, { label: "", max_score: 10, weight: 1 }] }
          : s
      )
    );
  };

  const canGoStep2 = title.trim().length > 0 && !!date;
  const canCreate =
    selectedSubjects.length > 0 &&
    selectedSubjects.every((s) => s.criteria.length > 0 && s.criteria.every((c) => c.label.trim()));

  const createEval = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Org manquante");

      // 1. madrasa_evaluations
      const { data: evalData, error: evalErr } = await supabase
        .from("madrasa_evaluations")
        .insert({
          title: title.trim(),
          date: format(date!, "yyyy-MM-dd"),
          class_id: classId,
          org_id: orgId,
          max_points: totalPoints,
          total_points: totalPoints,
        })
        .select("id")
        .single();
      if (evalErr) throw evalErr;

      // 2. madrasa_evaluation_subjects → 3. madrasa_evaluation_criteria
      for (const subj of selectedSubjects) {
        const { data: esData, error: esErr } = await supabase
          .from("madrasa_evaluation_subjects")
          .insert({
            evaluation_id: evalData.id,
            subject_id: subj.id,
            weight: subj.weight,
          })
          .select("id")
          .single();
        if (esErr) throw esErr;

        const criteriaRows = subj.criteria
          .filter((c) => c.label.trim())
          .map((c) => ({
            evaluation_subject_id: esData.id,
            label: c.label.trim(),
            max_score: c.max_score,
            weight: c.weight,
          }));

        if (criteriaRows.length > 0) {
          const { error: crErr } = await supabase.from("madrasa_evaluation_criteria").insert(criteriaRows);
          if (crErr) throw crErr;
        }
      }

      return evalData.id;
    },
    onSuccess: (evalId) => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["eval_classes_v2"] });
      onOpenChange(false);
      toast({ title: "Examen créé avec succès" });
      onCreated?.(evalId);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel examen multi-matières</DialogTitle>
          <DialogDescription>
            {step === 0
              ? `Étape 1/2 — Configuration • ${clsName}`
              : "Étape 2/2 — Composition des matières et critères"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper indicator */}
        <div className="flex items-center gap-2 pb-2">
          {[0, 1].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s + 1}
              </div>
              {s === 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Titre de l'examen *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Examen Trimestre 1"
                className="h-9"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date de l'examen *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full h-9 justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {date ? format(date, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Classe :</span> {clsName}
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 py-1">
            {loadingSubjects ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucune matière associée à cette classe. Configurez les matières dans les paramètres.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Cochez les matières à inclure. Les critères sont récupérés automatiquement depuis le référentiel.
                </p>
                <div className="space-y-3">
                  {subjects.map((subj) => (
                    <Card
                      key={subj.id}
                      className={cn(
                        "transition-colors",
                        subj.selected && "border-primary/40 bg-primary/[0.02]"
                      )}
                    >
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={subj.selected}
                            onCheckedChange={() => toggleSubject(subj.id)}
                            disabled={loadingCriteria === subj.id}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              {subj.name}
                              {loadingCriteria === subj.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                            </CardTitle>
                          </div>
                          {subj.selected && (
                            <Badge variant="secondary" className="text-[10px]">
                              {subj.criteria.length} critère{subj.criteria.length !== 1 ? "s" : ""} •{" "}
                              {subj.criteria.reduce((s, c) => s + c.max_score, 0)} pts
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      {subj.selected && (
                        <CardContent className="px-4 pb-3 pt-0 space-y-2">
                          {subj.criteria.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={c.label}
                                onChange={(e) => updateCriterion(subj.id, i, "label", e.target.value)}
                                placeholder="Ex: Lecture"
                                className="h-8 text-sm flex-1"
                              />
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={c.max_score}
                                  onChange={(e) => updateCriterion(subj.id, i, "max_score", e.target.value)}
                                  className="h-8 w-16 text-sm text-center"
                                  min={1}
                                />
                                <span className="text-[10px] text-muted-foreground">pts</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={c.weight}
                                  onChange={(e) => updateCriterion(subj.id, i, "weight", e.target.value)}
                                  className="h-8 w-14 text-sm text-center"
                                  min={0.1}
                                  step={0.1}
                                />
                                <span className="text-[10px] text-muted-foreground">coef</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeCriterion(subj.id, i)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => addCriterion(subj.id)} className="h-7 text-xs gap-1">
                            <Plus className="h-3 w-3" /> Ajouter un critère
                          </Button>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                {selectedSubjects.length > 0 && (
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {selectedSubjects.length} matière{selectedSubjects.length !== 1 ? "s" : ""} sélectionnée{selectedSubjects.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Total : {totalPoints} pts
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <Button variant="ghost" onClick={() => setStep(0)} className="mr-auto">
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
          )}
          {step === 0 && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
              Annuler
            </Button>
          )}
          {step === 0 ? (
            <Button onClick={() => setStep(1)} disabled={!canGoStep2}>
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => createEval.mutate()}
              disabled={createEval.isPending || !canCreate}
            >
              {createEval.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Créer l'examen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
