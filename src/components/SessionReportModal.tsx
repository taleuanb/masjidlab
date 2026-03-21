import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Notebook, ListTodo } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SchemaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  max?: number;
  options?: string[];
}

interface SessionReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; prenom: string; nom: string } | null;
  classId: string;
  /** If known, pass the subject_id tied to this class session */
  subjectId?: string | null;
}

export function SessionReportModal({
  open,
  onOpenChange,
  student,
  classId,
  subjectId,
}: SessionReportModalProps) {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // ── Fetch session config for this subject ──
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["session_config", orgId, subjectId],
    enabled: open && !!orgId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("*")
        .eq("org_id", orgId!)
        .eq("subject_id", subjectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch subjects for this class (to let teacher pick if no subjectId) ──
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["class_subjects_for_report", classId],
    enabled: open && !!classId && !subjectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_class_subjects")
        .select("subject_id, subject:madrasa_subjects(id, name)")
        .eq("class_id", classId);
      return (data ?? []).map((r: any) => r.subject).filter(Boolean) as { id: string; name: string }[];
    },
  });

  // ── Selected subject (manual pick when no subjectId prop) ──
  const [pickedSubjectId, setPickedSubjectId] = useState<string>("");

  // Config for manually picked subject
  const { data: pickedConfig, isLoading: loadingPickedConfig } = useQuery({
    queryKey: ["session_config", orgId, pickedSubjectId],
    enabled: open && !!orgId && !!pickedSubjectId && !subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("*")
        .eq("org_id", orgId!)
        .eq("subject_id", pickedSubjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const activeConfig = subjectId ? config : pickedConfig;
  const isLoadingActiveConfig = subjectId ? loadingConfig : loadingPickedConfig;
  const effectiveSubjectId = subjectId ?? pickedSubjectId;

  const schema: SchemaField[] = activeConfig?.form_schema_json
    ? (activeConfig.form_schema_json as unknown as SchemaField[])
    : [];

  // ── Existing progress for today ──
  const { data: existingProgress } = useQuery({
    queryKey: ["student_progress", student?.id, classId, today, activeConfig?.id],
    enabled: open && !!student?.id && !!activeConfig?.id && !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("*")
        .eq("student_id", student!.id)
        .eq("class_id", classId)
        .eq("lesson_date", today)
        .eq("config_id", activeConfig!.id)
        .eq("org_id", orgId!)
        .maybeSingle();
      return data;
    },
  });

  // ── Form state ──
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [todoNext, setTodoNext] = useState("");

  // Initialize form from existing or empty
  useEffect(() => {
    if (!open) return;
    if (existingProgress?.data_json) {
      const saved = existingProgress.data_json as Record<string, string>;
      setFormData(saved);
      setTodoNext(saved["todo_next"] ?? "");
    } else {
      setFormData({});
      setTodoNext("");
    }
  }, [open, existingProgress]);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!student || !activeConfig || !orgId) throw new Error("Données manquantes");

      // Validate number fields
      for (const field of schema) {
        if (field.type === "number" && formData[field.key]) {
          const num = Number(formData[field.key]);
          if (isNaN(num) || num < 0 || (field.max && num > field.max)) {
            throw new Error(`${field.label} : valeur invalide (max ${field.max ?? "∞"})`);
          }
        }
      }

      const dataToSave = { ...formData, todo_next: todoNext };

      if (existingProgress) {
        // Update
        const { error } = await supabase
          .from("madrasa_student_progress")
          .update({ data_json: dataToSave, updated_at: new Date().toISOString() })
          .eq("id", existingProgress.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("madrasa_student_progress")
          .insert({
            student_id: student.id,
            class_id: classId,
            lesson_date: today,
            config_id: activeConfig.id,
            data_json: dataToSave,
            org_id: orgId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_progress"] });
      toast({ title: "Rapport enregistré ✅", description: `${student?.prenom} ${student?.nom}` });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Notebook className="h-5 w-5 text-accent" />
            Compte rendu de séance
          </DialogTitle>
          <DialogDescription>
            {student.prenom} {student.nom} — {format(new Date(), "d MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Subject picker if no subjectId prop */}
          {!subjectId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Matière du cours</Label>
              {classSubjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune matière liée à cette classe.</p>
              ) : (
                <Select value={pickedSubjectId} onValueChange={setPickedSubjectId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sélectionner la matière…" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Dynamic form */}
          {isLoadingActiveConfig ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : !activeConfig && effectiveSubjectId ? (
            <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-4 text-center">
              <Notebook className="h-8 w-8 mx-auto text-accent/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune configuration de formulaire pour cette matière.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Un administrateur doit configurer les champs dans les paramètres.
              </p>
            </div>
          ) : schema.length > 0 ? (
            <div className="space-y-3">
              {schema.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-medium">
                    {field.label}
                    {field.type === "number" && field.max && (
                      <span className="text-muted-foreground font-normal"> (/{field.max})</span>
                    )}
                  </Label>
                  {field.type === "text" && (
                    <Input
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-9"
                      placeholder={field.label}
                    />
                  )}
                  {field.type === "number" && (
                    <Input
                      type="number"
                      min={0}
                      max={field.max}
                      step={0.5}
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={cn(
                        "h-9 w-24",
                        formData[field.key] && field.max && Number(formData[field.key]) > field.max
                          && "border-destructive"
                      )}
                      placeholder={`/${field.max ?? ""}`}
                    />
                  )}
                  {field.type === "textarea" && (
                    <Textarea
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={2}
                      placeholder={field.label}
                      className="resize-none"
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <Select
                      value={formData[field.key] ?? ""}
                      onValueChange={(v) => updateField(field.key, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Standard "To Do" section — always visible when config is loaded */}
          {activeConfig && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-accent">
                <ListTodo className="h-3.5 w-3.5" />
                À faire (prochaine séance)
              </Label>
              <Textarea
                value={todoNext}
                onChange={(e) => setTodoNext(e.target.value)}
                rows={2}
                placeholder="Ex: Réviser sourate Al-Baqara v.1-5, exercice p.12…"
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !activeConfig}
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Valider le rapport
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
