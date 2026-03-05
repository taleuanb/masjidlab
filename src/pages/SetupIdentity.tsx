import { useState, useEffect } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";

export default function SetupIdentityPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "",
    postal_code: "",
    phone: "",
    siret: "",
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Save form data before redirecting so user can come back
      if (form.name || form.city) {
        sessionStorage.setItem("setup_identity", JSON.stringify(form));
      }
      navigate("/login?redirect=/setup/identity", { replace: true });
    }
  }, [authLoading, user]);

  // Restore form state from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("setup_identity");
    if (saved) {
      try {
        setForm(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  const canContinue = form.name.trim().length > 0 && form.city.trim().length > 0;

  const handleNext = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      // Create the organization via handle_onboarding RPC with default plan
      const { data: orgId, error } = await supabase.rpc("handle_onboarding" as any, {
        p_name: form.name.trim(),
        p_city: form.city.trim(),
        p_postal_code: form.postal_code || null,
        p_phone: form.phone || null,
        p_siret: form.siret || null,
        p_plan: "starter", // Default plan, will be updated in SetupPlan
      });

      if (error) {
        console.error("[SetupIdentity] handle_onboarding error:", error);
        throw error;
      }

      console.log("[SetupIdentity] Organization created with ID:", orgId);

      // Store org ID for the plan step
      sessionStorage.setItem("setup_org_id", orgId);
      sessionStorage.removeItem("setup_identity");

      navigate("/setup/plan");
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de créer l'organisation.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(222 68% 6%)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-brand-cyan" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-4" style={{ background: "hsl(222 68% 6%)" }}>
      <div className="px-2 pt-3 pb-6">
        <a href="https://masjidlab.com" className="inline-flex items-center gap-1.5 text-sm font-light text-white/40 hover:text-white/70 transition-colors">
          ← Site Officiel
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-lg shadow-2xl border-white/10 bg-brand-navy/60 backdrop-blur-xl text-white">
        <CardHeader className="text-center space-y-2">
          <a href="https://masjidlab.com" className="mx-auto mb-2 block">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-auto object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(62,212,226,0.3)]" />
          </a>
          <CardTitle className="text-xl font-bold text-white">Identité de votre mosquée</CardTitle>
          <CardDescription className="text-white/50">Renseignez les informations de base. Vous pourrez les modifier plus tard.</CardDescription>
          <div className="flex justify-center gap-2 pt-2">
            <div className="h-1.5 w-12 rounded-full bg-brand-emerald" />
            <div className="h-1.5 w-12 rounded-full bg-white/10" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Nom de la mosquée *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Mosquée Al-Fath" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Ville *</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Paris" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Code postal</Label>
              <Input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} placeholder="75001" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Téléphone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01 23 45 67 89" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Numéro RNA / SIRET <span className="text-white/30">(Optionnel)</span></Label>
            <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} placeholder="W123456789 ou 123 456 789 00012" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <Button className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald/90 text-white" onClick={handleNext} disabled={!canContinue || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Suivant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
