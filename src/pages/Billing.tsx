import { useState, useCallback } from "react";
import {
  Lock, Check, ArrowRight,
} from "lucide-react";
import {
  PLAN_IDS, PLAN_META,
  getBusinessModules, getModulesForPlan, isPlanAtLeast, MODULE_MAP,
  type PlanId,
} from "@/config/module-registry";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Navigate } from "react-router-dom";

const BUSINESS_MODULES = getBusinessModules();

export default function BillingPage() {
  const { toast } = useToast();
  const { dbRole } = useAuth();
  const { orgId, activePoles, org } = useOrganization();
  const [polesLoading, setPolesLoading] = useState(false);

  const isSuperAdmin = dbRole === "super_admin";
  const isAdmin = dbRole === "admin" || isSuperAdmin;
  const currentPlan = (org?.subscription_plan ?? "starter") as PlanId;

  // Route guard: only admin or super_admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const togglePole = async (poleId: string) => {
    if (!orgId) return;
    const isActive = activePoles.includes(poleId);
    const next = isActive
      ? activePoles.filter((p) => p !== poleId)
      : [...activePoles, poleId];
    setPolesLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({ active_poles: next })
      .eq("id", orgId);
    setPolesLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      window.dispatchEvent(new CustomEvent("org-poles-updated", { detail: { active_poles: next } }));
      toast({
        title: isActive ? "Pôle désactivé" : "Pôle activé",
        description: MODULE_MAP.get(poleId)?.label ?? poleId,
      });
    }
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-bold text-foreground">Abonnement & Facturation</h1>
            <p className="text-sm text-muted-foreground">
              Gérez votre plan MASJIDLAB et l'activation de vos modules métiers.
            </p>
          </div>
        </div>

        {/* ── Cartes de Plan ── */}
        <div>
          <h2 className="text-sm font-semibold mb-1">Abonnement</h2>
          <p className="text-xs text-muted-foreground mb-4">Comparez les plans et les modules métier inclus.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLAN_IDS.map((plan) => {
              const isCurrent = currentPlan === plan;
              const planMeta = PLAN_META[plan];
              const PlanIcon = planMeta.icon;
              const modules = getModulesForPlan(plan);
              const isUpgrade = PLAN_META[plan].order > PLAN_META[currentPlan].order;

              return (
                <Card
                  key={plan}
                  className={`relative transition-all ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 shadow-sm">
                        Plan Actuel
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3 pt-5 text-center">
                    <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                      isCurrent ? "gradient-emerald" : "bg-muted"
                    }`}>
                      <PlanIcon className={`h-5 w-5 ${isCurrent ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    </div>
                    <CardTitle className="text-base mt-2">{planMeta.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 px-4">
                    <ul className="space-y-2">
                      {modules.map((mod) => (
                        <li key={mod.id} className="flex items-center gap-2 text-xs">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-foreground">{mod.label}</span>
                        </li>
                      ))}
                    </ul>
                    {isUpgrade && (
                      <Button size="sm" className="w-full mt-4 gap-1.5" variant="default">
                        Passer à {planMeta.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isCurrent && (
                      <p className="text-center text-[11px] text-muted-foreground mt-4">
                        Votre plan actif
                      </p>
                    )}
                    {!isCurrent && !isUpgrade && (
                      <p className="text-center text-[11px] text-muted-foreground mt-4">
                        Inclus dans votre plan
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── Gestion des Modules Métier ── */}
        <div>
          <h2 className="text-sm font-semibold mb-1">Gestion des Modules Métier</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Activez ou désactivez les modules inclus dans votre abonnement.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUSINESS_MODULES.map((mod) => {
              const isActive = activePoles.includes(mod.id);
              const included = isPlanAtLeast(currentPlan, mod.minPlan);
              const PoleIcon = mod.icon;
              const badgePlan = PLAN_META[mod.minPlan];

              return (
                <div
                  key={mod.id}
                  className={`relative flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                    included
                      ? isActive
                        ? "bg-primary/5 border-primary/25"
                        : "bg-card border-border"
                      : "bg-muted/30 border-border opacity-70"
                  }`}
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    included && isActive ? "gradient-emerald" : "bg-muted"
                  }`}>
                    {included ? (
                      <PoleIcon className={`h-4 w-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{mod.label}</p>
                      {!included && (
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] px-1.5 py-0 h-4 ${badgePlan.badgeCls}`}
                        >
                          <Lock className="h-2.5 w-2.5" />
                          Plan {badgePlan.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {mod.description}
                    </p>
                    {!included && (
                      <button className="mt-1.5 text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        Débloquer avec le plan {badgePlan.label}
                      </button>
                    )}
                  </div>

                  {included ? (
                    <Switch
                      checked={isActive}
                      disabled={polesLoading}
                      onCheckedChange={() => togglePole(mod.id)}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground/40 mt-1.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
