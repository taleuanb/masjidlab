import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, ArrowLeft } from "lucide-react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import {
  PLAN_IDS, PLAN_META, getModulesForPlan,
  type PlanId,
} from "@/config/module-registry";

export default function SetupPlanPage() {
  const navigate = useNavigate();
  const { refetch } = useOrganization();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState<PlanId | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleChoosePlan = async (plan: PlanId) => {
    setLoading(plan);

    try {
      // Retrieve identity from sessionStorage
      const raw = sessionStorage.getItem("setup_identity");
      if (!raw) {
        toast({ title: "Erreur", description: "Données d'identité manquantes. Retournez à l'étape précédente.", variant: "destructive" });
        setLoading(null);
        return;
      }
      const identity = JSON.parse(raw);

      console.log("[SetupPlan] Calling handle_onboarding RPC with:", { name: identity.name, city: identity.city, plan });

      // Use security definer RPC — bypasses RLS for role assignment
      const { data: orgId, error } = await supabase.rpc("handle_onboarding" as any, {
        p_name: identity.name,
        p_city: identity.city,
        p_postal_code: identity.postal_code || null,
        p_phone: identity.phone || null,
        p_siret: identity.siret || null,
        p_plan: plan,
      });

      if (error) {
        console.error("[SetupPlan] handle_onboarding error:", error);
        throw error;
      }

      console.log("[SetupPlan] Organization created with ID:", orgId);

      // Cleanup
      sessionStorage.removeItem("setup_identity");

      // Refresh org context
      refetch();

      navigate("/setup/success", { replace: true });
    } catch (err: any) {
      console.error("[SetupPlan] Error:", err);
      toast({ title: "Erreur lors de la création", description: err.message || "Une erreur inattendue est survenue.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const PLAN_PRICES: Record<PlanId, string> = {
    starter: "Gratuit",
    pro: "29€/mois",
    elite: "59€/mois",
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: "hsl(222 68% 6%)" }}>
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-2">
            <img src={masjidLabLogo} alt="MASJIDLAB" className="h-16 w-16 object-contain drop-shadow-[0_0_20px_hsl(185_73%_57%/0.3)]" />
          </div>
          <h1 className="text-xl font-bold text-white">Choisissez votre plan</h1>
          <p className="text-sm text-white/50">Vous pourrez changer de plan à tout moment.</p>
          <div className="flex justify-center gap-2 pt-1">
            <div className="h-1.5 w-12 rounded-full bg-primary" />
            <div className="h-1.5 w-12 rounded-full bg-primary" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_IDS.map((planId) => {
            const meta = PLAN_META[planId];
            const modules = getModulesForPlan(planId).filter((m) => !m.isCore);
            const Icon = meta.icon;

            return (
              <Card
                key={planId}
                className={`relative border-2 transition-all hover:shadow-md ${
                  planId === "pro" ? "border-primary shadow-sm" : "border-border"
                }`}
              >
                {planId === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px]">Recommandé</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{meta.label}</CardTitle>
                  <p className="text-2xl font-bold text-foreground">{PLAN_PRICES[planId]}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {modules.map((m) => (
                      <li key={m.id} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{m.label}</span>
                      </li>
                    ))}
                    {modules.length === 0 && (
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>Modules de base inclus</span>
                      </li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={planId === "pro" ? "default" : "outline"}
                    onClick={() => handleChoosePlan(planId)}
                    disabled={loading !== null}
                  >
                    {loading === planId && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Choisir {meta.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/setup/identity")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
        </div>
      </div>
    </div>
  );
}
