import React, { useState } from "react";
import { Settings2, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Loader2, Eye, ClipboardList, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface SubjectCriterion {
  id?: string;
  label: string;
  default_max_score: number;
  default_weight: number;
  order_index: number;
}

const FIELD_TYPE_LABELS: Record<FormField["type"], string> = {
  text: "Texte",
  number: "Nombre",
  rating5: "Note sur 5",
  rating10: "Note sur 10",
  checkbox: "Case à cocher",
};

/* ── Preview Component (Session) ── */

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
          {f.type === "text" && <Input disabled placeholder={`Saisir ${f.label.toLowerCase()}…`} className="bg-muted/30" />}
          {f.type === "number" && <Input type="number" disabled placeholder="0" className="bg-muted/30 w-32" />}
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
      <Separator className="my-3" />
      <div className="space-y-1.5">
        <Label className="text-sm">À faire (prochaine séance)</Label>
        <Input disabled placeholder="Devoirs / objectifs…" className="bg-muted/30" />
      </div>
    </div>
  );
}

/* ── Suivi de séance Tab Content ── */

function SessionTrackingContent({
  subject,
  orgId,
}: {
  subject: Tables<"madrasa_subjects">;
  orgId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["session_config", subject.id, orgId],
    enabled: !!orgId,
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

  const [fields, setFields] = useState<FormField[]>([]);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
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
  }, [isLoading, existingConfig, initialized]);

  const addField = () => {
    setFields((prev) => [...prev, { key: `field_${Date.now()}`, label: "", type: "text", required: false }]);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => setFields((prev) => prev.filter((_, i) => i !== idx));

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
      const finalFields = cleanFields.map((f, i) => ({
        ...f,
        key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `champ_${i}`,
      }));
      const schemaJson = finalFields as unknown as Json;
      if (existingConfig?.id) {
        const { error } = await supabase.from("madrasa_session_configs").update({ form_schema_json: schemaJson }).eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("madrasa_session_configs").insert({ subject_id: subject.id, org_id: orgId, form_schema_json: schemaJson });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session_config", subject.id, orgId] });
      queryClient.invalidateQueries({ queryKey: ["session_configs_all", orgId] });
      toast({ title: `Configuration enregistrée pour ${subject.name} ✓` });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto my-8 text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Champs du formulaire</h4>
            <Button size="sm" variant="outline" onClick={addField} className="border-[hsl(var(--brand-cyan))] text-[hsl(var(--brand-cyan))] hover:bg-[hsl(var(--brand-cyan))]/10">
              <Plus className="h-4 w-4" /> Ajouter un champ
            </Button>
          </div>
          {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun champ configuré.</p>}
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <Card key={field.key} className="rounded-lg border bg-card">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input placeholder="Label du champ…" value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} className="flex-1 h-8 text-sm" />
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(idx, -1)} disabled={idx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeField(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v as FormField["type"] })}>
                      <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} className="scale-75" />
                      <span className="text-xs text-muted-foreground">Requis</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        {/* Preview */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Prévisualisation Oustaz</h4>
          </div>
          <Card className="rounded-lg border-dashed bg-muted/20">
            <CardContent className="p-4"><FormPreview fields={fields} /></CardContent>
          </Card>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || fields.length === 0} className="bg-brand-emerald hover:bg-brand-emerald/90 text-white gap-2">
          {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer la configuration"}
        </Button>
      </div>
    </div>
  );
}

/* ── Référentiel Évaluation Tab Content ── */

function EvalCriteriaContent({
  subject,
  orgId,
}: {
  subject: Tables<"madrasa_subjects">;
  orgId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingCriteria, isLoading } = useQuery({
    queryKey: ["subject_criteria", subject.id, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subject_criteria")
        .select("*")
        .eq("subject_id", subject.id)
        .eq("org_id", orgId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const [criteria, setCriteria] = useState<SubjectCriterion[]>([]);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (isLoading || initialized) return;
    if (existingCriteria && existingCriteria.length > 0) {
      setCriteria(
        existingCriteria.map((c) => ({
          id: c.id,
          label: c.label,
          default_max_score: Number(c.default_max_score ?? 10),
          default_weight: Number((c as any).default_weight ?? 1),
          order_index: Number((c as any).order_index ?? 0),
        }))
      );
    } else {
      setCriteria([]);
    }
    setInitialized(true);
  }, [isLoading, existingCriteria, initialized]);

  const addCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      { label: "", default_max_score: 10, default_weight: 1, order_index: prev.length },
    ]);
  };

  const updateCriterion = (idx: number, patch: Partial<SubjectCriterion>) => {
    setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order_index: i })));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const valid = criteria.filter((c) => c.label.trim());
      if (valid.length === 0) throw new Error("Ajoutez au moins un critère.");

      // Delete existing criteria for this subject
      const { error: delErr } = await supabase
        .from("madrasa_subject_criteria")
        .delete()
        .eq("subject_id", subject.id)
        .eq("org_id", orgId);
      if (delErr) throw delErr;

      // Insert all criteria
      const rows = valid.map((c, i) => ({
        org_id: orgId,
        subject_id: subject.id,
        label: c.label.trim(),
        default_max_score: c.default_max_score,
        default_weight: c.default_weight,
        order_index: i,
      }));

      const { error: insErr } = await supabase.from("madrasa_subject_criteria").insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject_criteria", subject.id, orgId] });
      toast({ title: `Référentiel enregistré pour ${subject.name} ✓` });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto my-8 text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Criteria list */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Critères d'évaluation</h4>
            <Button size="sm" variant="outline" onClick={addCriterion} className="border-[hsl(var(--brand-cyan))] text-[hsl(var(--brand-cyan))] hover:bg-[hsl(var(--brand-cyan))]/10">
              <Plus className="h-4 w-4" /> Ajouter un critère
            </Button>
          </div>

          {criteria.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun critère défini. Cliquez sur "Ajouter un critère" pour commencer.
            </p>
          )}

          {/* Header row */}
          {criteria.length > 0 && (
            <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 px-1 text-xs text-muted-foreground uppercase font-medium">
              <span>Label</span>
              <span>Barème</span>
              <span>Coefficient</span>
              <span />
            </div>
          )}

          <div className="space-y-2">
            {criteria.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-center">
                <Input
                  placeholder="Nom du critère…"
                  value={c.label}
                  onChange={(e) => updateCriterion(idx, { label: e.target.value })}
                  className="h-9 text-sm"
                />
                <Input
                  type="number"
                  min={1}
                  value={c.default_max_score}
                  onChange={(e) => updateCriterion(idx, { default_max_score: Number(e.target.value) || 1 })}
                  className="h-9 text-sm"
                />
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={c.default_weight}
                  onChange={(e) => updateCriterion(idx, { default_weight: Number(e.target.value) || 1 })}
                  className="h-9 text-sm"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCriterion(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Preview card */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Aperçu Bulletin</h4>
          </div>
          <Card className="rounded-lg border-dashed bg-muted/20">
            <CardContent className="p-4 space-y-2">
              {criteria.filter((c) => c.label.trim()).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Ajoutez des critères pour voir l'aperçu.</p>
              ) : (
                criteria
                  .filter((c) => c.label.trim())
                  .map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        00 / {c.default_max_score}
                      </span>
                    </div>
                  ))
              )}
              {criteria.filter((c) => c.label.trim()).length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Note Finale</span>
                  <span className="text-sm font-mono font-semibold">
                    00 / {criteria.filter((c) => c.label.trim()).reduce((s, c) => s + c.default_max_score, 0)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || criteria.length === 0} className="bg-brand-emerald hover:bg-brand-emerald/90 text-white gap-2">
          {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer le référentiel"}
        </Button>
      </div>
    </div>
  );
}

/* ── Subject Config Sheet ── */

function SubjectConfigSheet({
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-[hsl(var(--brand-cyan))]" />
            Configuration Pédagogique — {subject.name}
          </SheetTitle>
          <SheetDescription>
            Configurez le suivi de séance et le référentiel d'évaluation pour cette matière.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="suivi" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="suivi" className="flex-1 gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Suivi de séance
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="flex-1 gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Référentiel Évaluation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suivi" className="mt-4">
            <SessionTrackingContent subject={subject} orgId={orgId} />
          </TabsContent>

          <TabsContent value="evaluation" className="mt-4">
            <EvalCriteriaContent subject={subject} orgId={orgId} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
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

  const { data: criteriaCount = [] } = useQuery({
    queryKey: ["subject_criteria_counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subject_criteria")
        .select("subject_id")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
  });

  const configuredSubjects = new Set(configs.map((c) => c.subject_id));
  const criteriaBySubject = criteriaCount.reduce<Record<string, number>>((acc, r) => {
    acc[r.subject_id] = (acc[r.subject_id] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8 text-muted-foreground" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuration Pédagogique
          </CardTitle>
          <CardDescription>
            Configurez le formulaire de suivi de séance et le référentiel d'évaluation par matière.
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
                const hasConfig = configuredSubjects.has(s.id);
                const fieldCount = hasConfig
                  ? (configs.find((c) => c.subject_id === s.id)?.form_schema_json as unknown as FormField[])?.length ?? 0
                  : 0;
                const critCount = criteriaBySubject[s.id] || 0;
                const configured = hasConfig || critCount > 0;

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
                          {fieldCount > 0 && `${fieldCount} champ(s)`}
                          {fieldCount > 0 && critCount > 0 && " · "}
                          {critCount > 0 && `${critCount} critère(s)`}
                          {!fieldCount && !critCount && "Non configuré"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={configured ? "outline" : "default"}
                        className={configured ? "" : "bg-[hsl(var(--brand-cyan))] hover:bg-[hsl(var(--brand-cyan))]/90 text-white"}
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
        <SubjectConfigSheet
          open={!!selectedSubject}
          onOpenChange={(v) => !v && setSelectedSubject(null)}
          subject={selectedSubject}
          orgId={orgId}
        />
      )}
    </>
  );
}
