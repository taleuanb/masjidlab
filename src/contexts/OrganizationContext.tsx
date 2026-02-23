import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { isModuleAllowedForPlan } from "@/config/plan-modules";

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
  pendingAffectation: boolean;
  /** Force un rechargement du contexte (après création d'org) */
  refetch: () => void;
  /** Super-admin: override l'org courante */
  overrideOrgId: string | null;
  setOverrideOrgId: (id: string | null) => void;
  /** Toutes les orgs (pour super-admin) */
  allOrgs: Organization[];
  /** Vérifie si un module est autorisé pour le plan de l'org courante */
  isModuleInPlan: (moduleName: string) => boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, session, loading: authLoading, dbRole } = useAuth();
  const queryClient = useQueryClient();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAffectation, setPendingAffectation] = useState(false);
  const [tick, setTick] = useState(0);
  const [overrideOrgId, setOverrideOrgId] = useState<string | null>(null);
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);

  const { impersonatedUser } = useAuth();
  const isSuperAdmin = dbRole === "super_admin";

  const isModuleInPlan = useCallback((moduleName: string): boolean => {
    // Super Admin bypass absolu (sauf en mode Ghost)
    if (isSuperAdmin && !impersonatedUser) return true;
    return isModuleAllowedForPlan(moduleName, org?.subscription_plan);
  }, [isSuperAdmin, impersonatedUser, org?.subscription_plan]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setTick((t) => t + 1);
  }, [queryClient]);

  // Fetch all orgs for super-admin
  useEffect(() => {
    if (!isSuperAdmin || !user) { setAllOrgs([]); return; }
    supabase.rpc("get_all_organizations").then(({ data }) => {
      setAllOrgs(
        (data ?? []).map((o: any) => ({
          id: o.id,
          name: o.name,
          active_poles: o.active_poles ?? [],
          subscription_plan: o.subscription_plan,
        }))
      );
    });
  }, [isSuperAdmin, user]);

  // When super-admin overrides org, use that directly
  useEffect(() => {
    if (!isSuperAdmin || !overrideOrgId) return;
    const found = allOrgs.find((o) => o.id === overrideOrgId);
    if (found) {
      setOrg(found);
      setPendingAffectation(false);
      setLoading(false);
    }
  }, [overrideOrgId, allOrgs, isSuperAdmin]);

  const fetchOrg = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const resolvedUserId = freshUser?.id ?? userId;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      console.log("Current Org ID:", profile?.org_id, "| Profile error:", profileError?.message ?? null);

      if (!profile?.org_id) {
        setPendingAffectation(true);
        setOrg(null);
        return;
      }

      const { data: orgData, error: orgError } = await supabase
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
    } catch (err) {
      console.error("OrganizationContext fetchOrg error:", err);
      setPendingAffectation(true);
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setOrg(null);
      setLoading(false);
      setPendingAffectation(false);
      return;
    }
    // If super-admin has an override, skip profile fetch
    if (isSuperAdmin && overrideOrgId) return;

    fetchOrg(user.id);

    const handlePolesUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active_poles: string[] };
      setOrg((prev) => prev ? { ...prev, active_poles: detail.active_poles } : prev);
    };
    window.addEventListener("org-poles-updated", handlePolesUpdated);
    return () => window.removeEventListener("org-poles-updated", handlePolesUpdated);
  }, [user, session, authLoading, tick, fetchOrg, isSuperAdmin, overrideOrgId]);

  return (
    <OrganizationContext.Provider
      value={{
        org,
        orgId: org?.id ?? null,
        activePoles: org?.active_poles ?? [],
        loading,
        pendingAffectation,
        refetch,
        overrideOrgId,
        setOverrideOrgId,
        allOrgs,
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
