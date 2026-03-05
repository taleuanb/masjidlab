import { Navigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Clock, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Maps route prefixes to their sub-module RBAC key.
 */
const ROUTE_TO_MODULE: Record<string, string> = {
  "/eleves": "education.eleves",
  "/classes": "education.classes",
  "/inscriptions": "education.inscriptions",
  "/finance": "finance.transactions",
  "/donateurs": "finance.donateurs",
  "/recus-fiscaux": "finance.recus",
  "/planning": "operations.planning",
  "/evenements": "operations.evenements",
  "/inventaire": "operations.inventaire",
  "/parking": "operations.parking",
  "/maintenance": "operations.maintenance",
  "/approbations": "gestion-rh.approbations",
  "/contrats-staff": "gestion-rh.contrats",
  "/documents": "gestion-rh.documents",
  "/organisation": "gestion-rh.structure",
  "/structure-membres": "gouvernance",
  "/membres": "gouvernance",
  "/configuration": "config",
};

// ── Allowed routes when org is pending ──
const PENDING_ALLOWED = ["/dashboard", "/profil"];

function PendingOrgBanner() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mb-3">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Validation en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Votre mosquée est en cours de validation par l'équipe Masjidi.
            Vous recevrez un email dès que votre espace sera activé.
          </p>
          <div className="rounded-lg bg-muted/50 border p-3 flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground text-left">
              En attendant, vous pouvez compléter votre profil et explorer le tableau de bord.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequireActivePole({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const { hasAccess, isBypassing } = useModuleAccess();
  const { org } = useOrganization();
  const path = window.location.pathname;

  const orgStatus = org?.status ?? "active";
  const isPending = orgStatus === "pending" || orgStatus === "suspended";

  // If org is pending and route is not allowed, show banner
  if (isPending && !isBypassing && !PENDING_ALLOWED.some((p) => path.startsWith(p))) {
    return <PendingOrgBanner />;
  }

  // Find the matching module requirement
  const matchedEntry = Object.entries(ROUTE_TO_MODULE).find(([prefix]) =>
    path.startsWith(prefix)
  );
  const requiredModule = matchedEntry?.[1];

  const isBlocked = requiredModule && !isBypassing && !hasAccess(requiredModule);

  useEffect(() => {
    if (isBlocked) {
      toast({
        title: "Module non disponible",
        description: "Ce module n'est pas activé pour votre organisation ou votre rôle.",
        variant: "destructive",
      });
    }
  }, [isBlocked, toast]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
