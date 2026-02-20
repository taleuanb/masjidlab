import { Navigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useRole } from "@/contexts/RoleContext";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

/** Maps route prefixes to the pole ID required in active_poles */
const ROUTE_TO_POLE: Record<string, string> = {
  "/finance": "admin",
  "/recoltes": "admin",
  "/structure-membres": "admin",
  "/membres": "admin",
  "/organisation": "admin",
  "/planning": "logistics",
  "/evenements": "logistics",
  "/inventaire": "logistics",
  "/parking": "logistics",
  "/maintenance": "logistics",
};

export function RequireActivePole({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activePoles } = useOrganization();
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const path = window.location.pathname;

  // Find the matching pole requirement
  const requiredPole = Object.entries(ROUTE_TO_POLE).find(([prefix]) =>
    path.startsWith(prefix)
  )?.[1];

  const isBlocked =
    requiredPole && !isSuperAdmin && !activePoles.includes(requiredPole);

  useEffect(() => {
    if (isBlocked) {
      toast({
        title: "Module non disponible",
        description: "Ce module n'est pas activé pour votre organisation.",
        variant: "destructive",
      });
    }
  }, [isBlocked, toast]);

  if (isBlocked) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
