import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, ArrowLeft } from "lucide-react";
import {
  PLAN_IDS, PLAN_META, getModulesForPlan,
  type PlanId,
} from "@/config/module-registry";

export default function SetupPlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState<PlanId | null>(null);

  const handleChoosePlan = async (plan: PlanId) => {
    if (!user) return;
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

      // 1. Create the organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: identity.name,
          city: identity.city,
          postal_code: identity.postal_code,
          phone: identity.phone,
          siret: identity.siret || null,
          status: "pending",
          subscription_plan: plan,
          chosen_plan: plan,
          owner_id: user.id,
        } as any)
        .select("id")
        .single();

      if (orgError) throw orgError;
      const orgId = orgData.id;

      // 2. Update the user's profile to link to this org
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: orgId } as any)
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // 3. Assign 'responsable' role for this org
      // First remove existing non-super_admin roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .neq("role", "super_admin" as any);

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "responsable",
          org_id: orgId,
        } as any);

      if (roleError) throw roleError;

      // 4. Clone default permissions
      await supabase.rpc("clone_default_permissions", { p_org_id: orgId });

      // Cleanup
      sessionStorage.removeItem("setup_identity");

      // Refresh org context
      refetch();

      navigate("/setup/success", { replace: true });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl gradient-emerald flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Choisissez votre plan</h1>
          <p className="text-sm text-muted-foreground">Vous pourrez changer de plan à tout moment.</p>
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
                    {loading === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
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
