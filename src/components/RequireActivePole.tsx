import { Navigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModuleAccess } from "@/hooks/useModuleAccess";

/**
 * Maps route prefixes to their sub-module RBAC key.
 * useModuleAccess handles the triple filter (Plan + Activation + Global RBAC).
 */
const ROUTE_TO_MODULE: Record<string, string> = {
  // Education
  "/eleves": "education.eleves",
  "/classes": "education.classes",
  "/inscriptions": "education.inscriptions",
  // Finance
  "/finance": "finance.transactions",
  "/donateurs": "finance.donateurs",
  "/recus-fiscaux": "finance.recus",
  // Logistique
  "/planning": "operations.planning",
  "/evenements": "operations.evenements",
  "/inventaire": "operations.inventaire",
  "/parking": "operations.parking",
  "/maintenance": "operations.maintenance",
  // Personnel
  "/approbations": "gestion-rh.approbations",
  "/contrats-staff": "gestion-rh.contrats",
  "/documents": "gestion-rh.documents",
  "/organisation": "gestion-rh.structure",
  // Parent-level routes (check parent module)
  "/structure-membres": "gouvernance",
  "/membres": "gouvernance",
  "/configuration": "config",
};

export function RequireActivePole({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const { hasAccess, isBypassing } = useModuleAccess();
  const path = window.location.pathname;

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
