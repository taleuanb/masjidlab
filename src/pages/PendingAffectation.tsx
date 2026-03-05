import { useState } from "react";
import { Building2, LogOut, Plus, ChevronRight, Loader2, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

const COMPLEX_TYPES = [
  { value: "mosquee",    label: "Mosquée" },
  { value: "mosquee_ecole", label: "Mosquée + École" },
  { value: "centre_islamique", label: "Centre Islamique" },
  { value: "salle_polyvalente", label: "Salle Polyvalente" },
];

type Step = "choice" | "form" | "creating" | "done";

export default function PendingAffectation() {
  const { user, signOut } = useAuth();
  const { refetch } = useOrganization();

  const [step, setStep] = useState<Step>("choice");
  const [orgName, setOrgName] = useState("");
  const [complexType, setComplexType] = useState("mosquee");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleForceSync = async () => {
    setSyncing(true);
    refetch();
    // Give context time to re-evaluate
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(false);
  };

  const handleCreate = async () => {
    if (!orgName.trim() || !user) return;
    setStep("creating");
    setError(null);

    try {
      // 1. Créer l'organisation
      const { data: newOrg, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          name: orgName.trim(),
          subscription_plan: "starter",
          active_poles: ["gouvernance", "logistique"],
        })
        .select("id")
        .single();

      if (orgErr || !newOrg) throw orgErr ?? new Error("Création impossible");

      // 3. Rattacher le profil à l'organisation
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ org_id: newOrg.id })
        .eq("user_id", user.id);

      if (profileErr) throw profileErr;

      // 4. Nommer Admin dans user_roles
      const { error: roleErr } = await supabase
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", user.id);

      if (roleErr) throw roleErr;

      setStep("done");
      // Rechargement du context après un court délai
      setTimeout(() => refetch(), 800);

    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue");
      setStep("form");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-6">

        {/* Logo */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-16 object-contain" />
          </div>
        </div>

        {/* ── ÉTAPE : CHOICE ── */}
        {step === "choice" && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Bienvenue</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Aucune organisation associée
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Vous n'êtes rattaché à aucune mosquée. Créez votre propre organisation
                ou attendez d'être invité par un administrateur.
              </p>
            </div>

            <div className="grid gap-3">
              <Button
                className="gap-2 h-12 text-sm"
                onClick={() => setStep("form")}
              >
                <Plus className="h-4 w-4" />
                Créer une nouvelle organisation
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>

              <div className="rounded-xl border bg-card p-4 text-left space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vous avez été invité ?
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Contactez votre administrateur de mosquée</li>
                  <li>Demandez-lui de vous affecter à votre pôle</li>
                  <li>Rechargez cette page une fois affecté</li>
                </ul>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={handleForceSync}
              disabled={syncing}
            >
              {syncing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              {syncing ? "Synchronisation…" : "Forcer la synchronisation"}
            </Button>

            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        )}

        {/* ── ÉTAPE : FORM ── */}
        {step === "form" && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold tracking-tight">Créer votre organisation</h1>
              <p className="text-sm text-muted-foreground">
                Vous serez Super-Admin de cette mosquée
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nom de la mosquée *
                </Label>
                <Input
                  placeholder="ex : Mosquée Bilal, Centre Islamique Al-Amine…"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type de complexe
                </Label>
                <Select value={complexType} onValueChange={setComplexType}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLEX_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
                <p className="text-xs text-primary font-medium">
                  Plan Starter activé automatiquement — Gouvernance &amp; Logistique inclus.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("choice")}>
                Retour
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!orgName.trim()}
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                Créer l'organisation
              </Button>
            </div>

            <div className="text-center">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE : CREATING ── */}
        {step === "creating" && (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold">Création en cours…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Initialisation de votre espace — un instant
              </p>
            </div>
          </div>
        )}

        {/* ── ÉTAPE : DONE ── */}
        {step === "done" && (
          <div className="text-center space-y-4 py-8">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold">Organisation créée !</p>
              <p className="text-sm text-muted-foreground mt-1">
                Redirection vers votre tableau de bord…
              </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        )}

      </div>
    </div>
  );
}
