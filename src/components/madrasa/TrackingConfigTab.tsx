import React, { useState } from "react";
import { Settings2, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

/* ── Types ── */

interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "rating5" | "rating10" | "checkbox";
  required: boolean;
}

const FIELD_TYPE_LABELS: Record<FormField["type"], string> = {
  text: "Texte",
  number: "Nombre",
  rating5: "Note sur 5",
  rating10: "Note sur 10",
  checkbox: "Case à cocher",
};

/* ── Preview Component ── */

function FormPreview({ fields }: { fields: FormField[] }) {
  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
        Ajoutez des champs pour voir la prévisualisation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-sm">
            {f.label}
            {f.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>

          {f.type === "text" && (
            <Input disabled placeholder={`Saisir ${f.label.toLowerCase()}…`} className="bg-muted/30" />
          )}
          {f.type === "number" && (
            <Input type="number" disabled placeholder="0" className="bg-muted/30 w-32" />
          )}
          {(f.type === "rating5" || f.type === "rating10") && (
            <Select disabled>
              <SelectTrigger className="w-32 bg-muted/30">
                <SelectValue placeholder={`/ ${f.type === "rating5" ? 5 : 10}`} />
              </SelectTrigger>
            </Select>
          )}
          {f.type === "checkbox" && (
            <div className="flex items-center gap-2">
              <Checkbox disabled />
              <span className="text-sm text-muted-foreground">{f.label}</span>
            </div>
          )}
        </div>
      ))}

      {/* Standard todo field */}
      <Separator className="my-3" />
      <div className="space-y-1.5">
        <Label className="text-sm">À faire (prochaine séance)</Label>
        <Input disabled placeholder="Devoirs / objectifs…" className="bg-muted/30" />
      </div>
    </div>
  );
}

/* ── Form Builder Dialog ── */

function FormBuilderDialog({
  open,
  onOpenChange,
  subject,
  orgId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: Tables<"madrasa_subjects">;
  orgId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load existing config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["session_config", subject.id, orgId],
    enabled: open && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("*")
        .eq("subject_id", subject.id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fields, setFields] = React.useState<FormField[]>([]);
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (isLoading || initialized) return;
    if (existingConfig?.form_schema_json) {
      try {
        const parsed = existingConfig.form_schema_json as unknown as FormField[];
        setFields(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFields([]);
      }
    } else {
      setFields([]);
    }
    setInitialized(true);
  }, [open, isLoading, existingConfig, initialized]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${Date.now()}`,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanFields = fields.filter((f) => f.label.trim());
      if (cleanFields.length === 0) throw new Error("Ajoutez au moins un champ.");

      // Sanitize keys
      const finalFields = cleanFields.map((f, i) => ({
        ...f,
        key: f.label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "") || `champ_${i}`,
      }));

      const payload = {
        subject_id: subject.id,
        org_id: orgId,
        form_schema_json: finalFields as unknown as Record<string, unknown>[],
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from("madrasa_session_configs")
          .update({ form_schema_json: payload.form_schema_json })
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("madrasa_session_configs")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_config", subject.id, orgId] });
      toast({ title: "Configuration enregistrée ✓" });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-[hsl(var(--brand-cyan))]" />
            Formulaire de suivi — {subject.name}
          </DialogTitle>
          <DialogDescription>
            Configurez les champs que l'Oustaz devra remplir après chaque séance.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mt-2">
            {/* Left: Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Champs du formulaire</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addField}
                  className="border-[hsl(var(--brand-cyan))] text-[hsl(var(--brand-cyan))] hover:bg-[hsl(var(--brand-cyan))]/10"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un champ
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun champ configuré. Cliquez sur "Ajouter un champ" pour commencer.
                </p>
              )}

              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <Card key={field.key} className="rounded-lg border bg-card">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="Label du champ…"
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="flex-1 h-8 text-sm"
                        />
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(idx, -1)}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(idx, 1)}
                            disabled={idx === fields.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeField(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(idx, { type: v as FormField["type"] })}
                        >
                          <SelectTrigger className="h-8 text-xs w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(v) => updateField(idx, { required: v })}
                            className="scale-75"
                          />
                          <span className="text-xs text-muted-foreground">Requis</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Right: Preview */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Prévisualisation Oustaz</h4>
              </div>
              <Card className="rounded-lg border-dashed bg-muted/20">
                <CardContent className="p-4">
                  <FormPreview fields={fields} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || fields.length === 0}
            className="bg-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-navy))]/90"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer la configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Tab ── */

export function TrackingConfigTab() {
  const { orgId } = useOrganization();
  const [selectedSubject, setSelectedSubject] = useState<Tables<"madrasa_subjects"> | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects")
        .select("*")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  // Load all configs to show status
  const { data: configs = [] } = useQuery({
    queryKey: ["session_configs_all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("subject_id, form_schema_json")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
  });

  const configuredSubjects = new Set(configs.map((c) => c.subject_id));

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8 text-muted-foreground" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuration des Suivis
          </CardTitle>
          <CardDescription>
            Définissez le formulaire de compte rendu que l'Oustaz devra remplir après chaque séance, par matière.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune matière configurée. Ajoutez des matières dans l'onglet "Matières" d'abord.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {subjects.map((s) => {
                const configured = configuredSubjects.has(s.id);
                const fieldCount = configured
                  ? (configs.find((c) => c.subject_id === s.id)?.form_schema_json as unknown as FormField[])?.length ?? 0
                  : 0;

                return (
                  <Card
                    key={s.id}
                    className="rounded-lg hover:border-[hsl(var(--brand-cyan))]/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedSubject(s)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {configured ? `${fieldCount} champ(s) configuré(s)` : "Non configuré"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={configured ? "outline" : "default"}
                        className={
                          configured
                            ? ""
                            : "bg-[hsl(var(--brand-cyan))] hover:bg-[hsl(var(--brand-cyan))]/90 text-white"
                        }
                      >
                        <Settings2 className="h-4 w-4" />
                        {configured ? "Modifier" : "Configurer"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSubject && orgId && (
        <FormBuilderDialog
          open={!!selectedSubject}
          onOpenChange={(v) => !v && setSelectedSubject(null)}
          subject={selectedSubject}
          orgId={orgId}
        />
      )}
    </>
  );
}
