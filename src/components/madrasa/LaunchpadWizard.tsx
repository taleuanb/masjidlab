import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles, ArrowLeft, ArrowRight, BookOpen, Users, Moon,
  GraduationCap, Star, Layers, Globe, Heart, Loader2,
  X, Plus, Euro, CheckCircle2, Rocket,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Json, Tables } from "@/integrations/supabase/types";

/* ── Dynamic icon resolver ── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen, Users, Moon, GraduationCap, Star, Layers, Globe, Heart, Sparkles,
};

function DynamicIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = ICON_MAP[name ?? "BookOpen"] ?? BookOpen;
  return <Icon className={className} />;
}

/* ── Types ── */
interface LaunchpadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  onSuccess?: () => void;
}

interface CycleIdentity {
  nom: string;
  description: string;
}

export interface CustomLevel {
  templateItemId: string;
  label: string;
  tarifMensuel: string;
  subjects: string[];
  rank: number;
}

const TOTAL_STEPS = 4;

export function LaunchpadWizard({ open, onOpenChange, orgId, onSuccess }: LaunchpadWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState<CycleIdentity>({ nom: "", description: "" });
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // Packs
  const [packs, setPacks] = useState<Tables<"madrasa_template_packs">[]>([]);
  const [loading, setLoading] = useState(false);

  // Step 3: custom structure
  const [customStructure, setCustomStructure] = useState<CustomLevel[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // New subject input per level
  const [newSubjectInputs, setNewSubjectInputs] = useState<Record<string, string>>({});

  // Finalize state
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setIdentity({ nom: "", description: "" });
    setSelectedPackId(null);
    setCustomStructure([]);
    setNewSubjectInputs({});
    setSaving(false);
    setSaveProgress(0);
  }, [open]);

  // Fetch packs on step 2
  useEffect(() => {
    if (!open || step !== 2) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("madrasa_template_packs")
      .select("*")
      .order("nom")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setPacks(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, step]);

  // Fetch template items when entering step 3
  const loadTemplateItems = useCallback(async () => {
    if (!selectedPackId) return;
    setItemsLoading(true);
    const { data, error } = await supabase
      .from("madrasa_template_items")
      .select("*")
      .eq("pack_id", selectedPackId)
      .order("rank");
    if (!error && data) {
      const selectedPack = packs.find(p => p.id === selectedPackId);
      const isConv = selectedPack?.tag_label?.toLowerCase().includes("converti")
        || selectedPack?.nom?.toLowerCase().includes("converti");
      setCustomStructure(
        data.map((item) => {
          const suggestedSubjects = Array.isArray(item.suggested_subjects)
            ? (item.suggested_subjects as string[])
            : [];
          return {
            templateItemId: item.id,
            label: item.level_label,
            tarifMensuel: isConv ? "0" : "",
            subjects: suggestedSubjects,
            rank: item.rank ?? 0,
          };
        })
      );
    }
    setItemsLoading(false);
  }, [selectedPackId, packs]);

  // Update helpers
  const updateLevel = (idx: number, patch: Partial<CustomLevel>) => {
    setCustomStructure(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const removeSubject = (levelIdx: number, subjectIdx: number) => {
    setCustomStructure(prev => prev.map((l, i) => {
      if (i !== levelIdx) return l;
      return { ...l, subjects: l.subjects.filter((_, si) => si !== subjectIdx) };
    }));
  };

  const addSubject = (levelIdx: number) => {
    const key = String(levelIdx);
    const val = (newSubjectInputs[key] ?? "").trim();
    if (!val) return;
    setCustomStructure(prev => prev.map((l, i) => {
      if (i !== levelIdx) return l;
      if (l.subjects.includes(val)) return l;
      return { ...l, subjects: [...l.subjects, val] };
    }));
    setNewSubjectInputs(prev => ({ ...prev, [key]: "" }));
  };

  // ── FINALIZE ──
  const handleFinalizeLaunch = async () => {
    if (!orgId) {
      toast({ title: "Erreur", description: "Aucune organisation sélectionnée.", variant: "destructive" });
      return;
    }

    setSaving(true);
    setSaveProgress(10);

    try {
      // Step 1: Create cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from("madrasa_cycles")
        .insert({
          nom: identity.nom.trim(),
          description: identity.description.trim() || null,
          org_id: orgId,
        })
        .select("id")
        .single();
      if (cycleError) throw new Error(`Erreur cycle : ${cycleError.message}`);
      const cycleId = cycleData.id;
      setSaveProgress(30);

      // Step 2: Create levels
      const levelInserts = customStructure.map((level) => ({
        label: level.label.trim(),
        tarif_mensuel: parseFloat(level.tarifMensuel) || 0,
        cycle_id: cycleId,
        org_id: orgId,
      }));
      const { data: levelsData, error: levelsError } = await supabase
        .from("madrasa_levels")
        .insert(levelInserts)
        .select("id, label");
      if (levelsError) throw new Error(`Erreur niveaux : ${levelsError.message}`);
      setSaveProgress(60);

      // Step 3: Create subjects (deduplicated per org)
      // First, fetch existing subjects for this org
      const { data: existingSubjects } = await supabase
        .from("madrasa_subjects")
        .select("id, name")
        .eq("org_id", orgId);
      const existingMap = new Map((existingSubjects ?? []).map(s => [s.name.toLowerCase(), s.id]));

      // Collect all unique subject names across all levels
      const allSubjectNames = new Set<string>();
      for (const level of customStructure) {
        for (const s of level.subjects) {
          allSubjectNames.add(s.trim());
        }
      }

      // Insert only new ones
      const newSubjects = [...allSubjectNames].filter(name => !existingMap.has(name.toLowerCase()));
      if (newSubjects.length > 0) {
        const { data: insertedSubjects, error: subjectsError } = await supabase
          .from("madrasa_subjects")
          .insert(newSubjects.map(name => ({ name, org_id: orgId })))
          .select("id, name");
        if (subjectsError) throw new Error(`Erreur matières : ${subjectsError.message}`);
        // Add newly created to the map
        for (const s of insertedSubjects ?? []) {
          existingMap.set(s.name.toLowerCase(), s.id);
        }
      }
      setSaveProgress(90);

      setSaveProgress(100);

      toast({
        title: "Cursus créé avec succès !",
        description: `Le cycle « ${identity.nom} » est maintenant opérationnel avec ${levelsData?.length ?? 0} niveaux.`,
      });

      // Close and refresh
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: "Erreur lors de la génération",
        description: err.message ?? "Une erreur inattendue est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  // Validation
  const canProceedStep1 = identity.nom.trim().length > 0;
  const canProceedStep3 = customStructure.length > 0
    && customStructure.every(l => l.label.trim().length > 0 && l.subjects.length > 0);

  const selectedPack = packs.find(p => p.id === selectedPackId);
  const isConvertis = selectedPack?.tag_label?.toLowerCase().includes("converti")
    || selectedPack?.nom?.toLowerCase().includes("converti");

  const totalSubjects = customStructure.reduce((sum, l) => {
    const unique = new Set(l.subjects);
    return sum + unique.size;
  }, 0);

  const goToStep = async (target: number) => {
    if (target === 3 && step === 2) {
      await loadTemplateItems();
    }
    setStep(target);
  };

  const stepDescriptions: Record<number, string> = {
    1: "Identifiez votre nouveau cycle pédagogique.",
    2: "Choisissez un modèle de programme pour pré-remplir vos niveaux et matières.",
    3: "Personnalisez les niveaux, tarifs et matières de votre cursus.",
    4: "Vérifiez votre configuration avant de lancer la génération.",
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" onInteractOutside={saving ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lancer un cursus
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const s = i + 1;
            return (
              <React.Fragment key={s}>
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-colors shrink-0",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
                {s < TOTAL_STEPS && (
                  <div className={cn("flex-1 h-0.5 rounded-full transition-colors", step > s ? "bg-primary" : "bg-muted")} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Saving overlay */}
        {saving && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Génération du cursus en cours…</span>
            </div>
            <Progress value={saveProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {saveProgress < 30 && "Création du cycle…"}
              {saveProgress >= 30 && saveProgress < 60 && "Insertion des niveaux…"}
              {saveProgress >= 60 && saveProgress < 90 && "Configuration des matières…"}
              {saveProgress >= 90 && "Finalisation…"}
            </p>
          </div>
        )}

        {/* Step content */}
        {!saving && (
          <div className="flex-1 min-h-0">
            {/* ── STEP 1: Identity ── */}
            {step === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="cycle-nom">Nom du cycle *</Label>
                  <Input
                    id="cycle-nom"
                    placeholder="Ex : École du Samedi 2026"
                    value={identity.nom}
                    onChange={(e) => setIdentity(prev => ({ ...prev, nom: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle-desc">Description</Label>
                  <Textarea
                    id="cycle-desc"
                    placeholder="Décrivez le programme, le public cible, les objectifs…"
                    value={identity.description}
                    onChange={(e) => setIdentity(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: Pack selection ── */}
            {step === 2 && (
              <ScrollArea className="h-[380px] pr-2">
                {loading ? (
                  <div className="grid grid-cols-2 gap-3 p-1">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-36 rounded-lg" />
                    ))}
                  </div>
                ) : packs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Aucun modèle disponible dans le catalogue.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contactez l'administrateur pour ajouter des templates.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-1">
                    {packs.map((pack) => {
                      const isSelected = selectedPackId === pack.id;
                      return (
                        <Card
                          key={pack.id}
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            isSelected
                              ? "ring-2 ring-primary border-primary shadow-md"
                              : "hover:border-primary/40"
                          )}
                          onClick={() => setSelectedPackId(isSelected ? null : pack.id)}
                        >
                          <CardContent className="p-4 space-y-2.5">
                            <div className="flex items-start justify-between">
                              <div className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                <DynamicIcon name={pack.icon_name} className="h-5 w-5" />
                              </div>
                              {pack.tag_label && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {pack.tag_label}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold leading-tight">{pack.nom}</h4>
                              {pack.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {pack.description}
                                </p>
                              )}
                            </div>
                            {pack.public_cible && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{pack.public_cible}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            )}

            {/* ── STEP 3: Customization ── */}
            {step === 3 && (
              <ScrollArea className="h-[380px] pr-2">
                {itemsLoading ? (
                  <div className="space-y-3 p-1">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
                  </div>
                ) : customStructure.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Ce modèle ne contient aucun niveau pré-configuré.
                    </p>
                  </div>
                ) : (
                  <div className="p-1 space-y-1">
                    {isConvertis && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent mb-3">
                        <Heart className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Pour ce public, un tarif symbolique ou la gratuité est souvent privilégié(e).
                          Les tarifs ont été pré-remplis à 0 €.
                        </p>
                      </div>
                    )}
                    <Accordion
                      type="multiple"
                      defaultValue={customStructure.map((_, i) => String(i))}
                      className="space-y-2"
                    >
                      {customStructure.map((level, idx) => {
                        const hasErrors = !level.label.trim() || level.subjects.length === 0;
                        return (
                          <AccordionItem
                            key={level.templateItemId}
                            value={String(idx)}
                            className={cn(
                              "border rounded-lg px-0 overflow-hidden",
                              hasErrors && "border-destructive/40"
                            )}
                          >
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                  {idx + 1}
                                </div>
                                <span className="font-medium truncate">
                                  {level.label || <span className="text-muted-foreground italic">Sans nom</span>}
                                </span>
                                <Badge variant="outline" className="text-[10px] ml-auto mr-2">
                                  {level.subjects.length} matière{level.subjects.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 space-y-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Nom du niveau</Label>
                                <Input
                                  value={level.label}
                                  onChange={(e) => updateLevel(idx, { label: e.target.value })}
                                  placeholder="Ex : Niveau Débutant"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Tarif mensuel</Label>
                                <div className="relative">
                                  <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    min="0"
                                    step="5"
                                    value={level.tarifMensuel}
                                    onChange={(e) => updateLevel(idx, { tarifMensuel: e.target.value })}
                                    placeholder="0"
                                    className="h-9 pl-8"
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Ce tarif sera appliqué par défaut lors de la génération des frais mensuels pour ce niveau.
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Matières</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {level.subjects.map((subject, si) => (
                                    <Badge key={si} variant="secondary" className="text-xs gap-1 pr-1 cursor-default">
                                      {subject}
                                      <button
                                        type="button"
                                        onClick={() => removeSubject(idx, si)}
                                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </Badge>
                                  ))}
                                  {level.subjects.length === 0 && (
                                    <p className="text-[10px] text-destructive">Au moins une matière requise.</p>
                                  )}
                                </div>
                                <div className="flex gap-1.5 mt-1">
                                  <Input
                                    value={newSubjectInputs[String(idx)] ?? ""}
                                    onChange={(e) => setNewSubjectInputs(prev => ({ ...prev, [String(idx)]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubject(idx); } }}
                                    placeholder="Ajouter une matière…"
                                    className="h-8 text-xs flex-1"
                                  />
                                  <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => addSubject(idx)}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </ScrollArea>
            )}

            {/* ── STEP 4: Summary ── */}
            {step === 4 && (
              <div className="py-4 space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Rocket className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Prêt à lancer ?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vérifiez les détails ci-dessous avant de générer votre cursus.
                    </p>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cycle</p>
                        <p className="text-sm font-semibold">{identity.nom}</p>
                        {identity.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{identity.description}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Modèle</p>
                        <p className="text-sm font-semibold">{selectedPack?.nom ?? "—"}</p>
                        {selectedPack?.tag_label && (
                          <Badge variant="secondary" className="text-[10px] mt-1">{selectedPack.tag_label}</Badge>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                        {customStructure.length} niveau{customStructure.length !== 1 ? "x" : ""} · {totalSubjects} matière{totalSubjects !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-2">
                        {customStructure.map((level, idx) => (
                          <div key={level.templateItemId} className="flex items-start gap-2 text-xs">
                            <div className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate">{level.label}</span>
                                <span className="text-muted-foreground shrink-0 ml-2">
                                  {level.tarifMensuel ? `${level.tarifMensuel} €/mois` : "Gratuit"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {level.subjects.map((s, si) => (
                                  <Badge key={si} variant="outline" className="text-[10px]">{s}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!saving && (
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
            ) : (
              <div />
            )}
            {step === 1 && (
              <Button onClick={() => goToStep(2)} disabled={!canProceedStep1}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => goToStep(3)} disabled={!selectedPackId}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => goToStep(4)} disabled={!canProceedStep3}>
                Récapitulatif <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleFinalizeLaunch}>
                <Sparkles className="h-4 w-4 mr-1" /> Générer le cursus
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
