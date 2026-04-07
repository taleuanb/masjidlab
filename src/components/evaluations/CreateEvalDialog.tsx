import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubjectCriteria } from "@/hooks/useEvaluationData";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Loader2, CalendarIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface CriterionDraft {
  label: string;
  max_score: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
  loadingSubjects: boolean;
}

export function CreateEvalDialog({ open, onOpenChange, classId, className: clsName, subjects, loadingSubjects }: Props) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [subjectId, setSubjectId] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);

  // Fetch template criteria when subject changes
  const { data: templateCriteria } = useSubjectCriteria(subjectId || null);

  useEffect(() => {
    if (templateCriteria && templateCriteria.length > 0) {
      setCriteria(templateCriteria.map((c) => ({ label: c.label, max_score: String(c.default_max_score ?? 10) })));
    }
  }, [templateCriteria]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle(""); setDate(undefined); setSubjectId(""); setCriteria([]);
    }
  }, [open]);

  const addCriterion = () => setCriteria((prev) => [...prev, { label: "", max_score: "10" }]);
  const removeCriterion = (i: number) => setCriteria((prev) => prev.filter((_, idx) => idx !== i));
  const updateCriterion = (i: number, field: keyof CriterionDraft, value: string) =>
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const totalPoints = criteria.reduce((s, c) => s + (Number(c.max_score) || 0), 0);

  const createEval = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !date) throw new Error("Titre et date requis");
      if (criteria.length === 0) throw new Error("Ajoutez au moins un critère");

      const { data: evalData, error } = await supabase.from("madrasa_evaluations").insert({
        title: title.trim(),
        date: format(date, "yyyy-MM-dd"),
        subject_id: subjectId || null,
        max_points: totalPoints,
        total_points: totalPoints,
        class_id: classId,
        org_id: orgId!,
      }).select("id").single();
      if (error) throw error;

      // Insert criteria
      const rows = criteria.map((c, i) => ({
        evaluation_id: evalData.id,
        label: c.label.trim(),
        max_score: Number(c.max_score) || 10,
        weight: 1,
      }));
      const { error: crErr } = await supabase.from("madrasa_evaluation_criteria").insert(rows);
      if (crErr) throw crErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["eval_classes_v2"] });
      onOpenChange(false);
      toast({ title: "Évaluation créée avec succès" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvel examen</DialogTitle>
          <DialogDescription>Créez une évaluation multi-critères pour {clsName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Contrôle de Tajwid" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {date ? format(date, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Matière</Label>
            {loadingSubjects ? (
              <p className="text-xs text-muted-foreground py-2">Chargement…</p>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Aucune matière liée à cette classe.</p>
            ) : (
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner une matière" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Criteria builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Critères d'évaluation</Label>
              <Button variant="ghost" size="sm" onClick={addCriterion} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Critère
              </Button>
            </div>
            {criteria.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-md">
                Sélectionnez une matière pour pré-remplir ou ajoutez manuellement.
              </p>
            )}
            {criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={c.label}
                  onChange={(e) => updateCriterion(i, "label", e.target.value)}
                  placeholder="Ex: Lecture"
                  className="h-8 text-sm flex-1"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={c.max_score}
                    onChange={(e) => updateCriterion(i, "max_score", e.target.value)}
                    className="h-8 w-16 text-sm text-center"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeCriterion(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {criteria.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">Total : <span className="font-semibold text-foreground">{totalPoints} pts</span></p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Annuler</Button>
          <Button
            onClick={() => createEval.mutate()}
            disabled={createEval.isPending || !title.trim() || !date || criteria.length === 0}
            className="bg-[#1A2333] hover:bg-[#1A2333]/90"
          >
            {createEval.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
