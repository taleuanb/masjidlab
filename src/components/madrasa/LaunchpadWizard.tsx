import React, { useState, useEffect } from "react";
import {
  Sparkles, ArrowLeft, ArrowRight, BookOpen, Users, Moon,
  GraduationCap, Star, Layers, Globe, Heart, Loader2,
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

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
}

interface CycleIdentity {
  nom: string;
  description: string;
}

export function LaunchpadWizard({ open, onOpenChange }: LaunchpadWizardProps) {
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState<CycleIdentity>({ nom: "", description: "" });
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // Fetch template packs
  const [packs, setPacks] = useState<Tables<"madrasa_template_packs">[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset state on open
    setStep(1);
    setIdentity({ nom: "", description: "" });
    setSelectedPackId(null);
  }, [open]);

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

  const canProceedStep1 = identity.nom.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lancer un cursus
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Identifiez votre nouveau cycle pédagogique."
              : "Choisissez un modèle de programme pour pré-remplir vos niveaux et matières."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-1">
          <div className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-colors",
            step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>1</div>
          <div className={cn("flex-1 h-0.5 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
          <div className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-colors",
            step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>2</div>
        </div>

        {/* Step content */}
        <div className="flex-1 min-h-0">
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
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
          ) : (
            <div />
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Suivant <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button disabled={!selectedPackId}>
              Valider <Sparkles className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
