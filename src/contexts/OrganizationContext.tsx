import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Organization {
  id: string;
  name: string;
  active_poles: string[];
  subscription_plan: string | null;
}

interface OrganizationContextType {
  org: Organization | null;
  orgId: string | null;
  activePoles: string[];
  loading: boolean;
  /** true si l'utilisateur est authentifié mais n'a pas de org_id */
  pendingAffectation: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAffectation, setPendingAffectation] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setOrg(null);
      setLoading(false);
      setPendingAffectation(false);
      return;
    }

    const fetchOrg = async () => {
      setLoading(true);
      try {
        // 1. Récupérer le profil pour obtenir org_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.org_id) {
          setPendingAffectation(true);
          setOrg(null);
          return;
        }

        // 2. Récupérer les infos de l'organisation
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, active_poles, subscription_plan")
          .eq("id", profile.org_id)
          .maybeSingle();

        if (orgData) {
          setOrg({
            id: orgData.id,
            name: orgData.name,
            active_poles: orgData.active_poles ?? [],
            subscription_plan: orgData.subscription_plan,
          });
          setPendingAffectation(false);
        } else {
          setPendingAffectation(true);
          setOrg(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();

    // Écoute les mises à jour optimistes depuis Settings (togglePole)
    const handlePolesUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active_poles: string[] };
      setOrg((prev) => prev ? { ...prev, active_poles: detail.active_poles } : prev);
    };
    window.addEventListener("org-poles-updated", handlePolesUpdated);

    return () => window.removeEventListener("org-poles-updated", handlePolesUpdated);
  }, [user, authLoading]);

  return (
    <OrganizationContext.Provider
      value={{
        org,
        orgId: org?.id ?? null,
        activePoles: org?.active_poles ?? [],
        loading,
        pendingAffectation,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
