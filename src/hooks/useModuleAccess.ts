/**
 * useModuleAccess — Triple-Filter Hook for Module Visibility
 * 
 * Encapsulates the decision logic for whether a module should be visible/accessible.
 * 
 * Triple Filter:
 *   A) Plan Filter   — Is the module included in the org's subscription plan?
 *   B) Activation     — Is the module enabled in the org's active_poles?
 *   C) RBAC Filter   — Does the user have `enabled` permission via get_effective_permissions?
 * 
 * Bypass: super_admin (non-ghost) returns true immediately.
 * CORE modules bypass RBAC for admin-like roles (non-ghost).
 */

import { useMemo, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  isModuleInPlan,
  CORE_MODULE_IDS,
  type PlanId,
  MODULE_MAP,
} from "@/config/module-registry";
import { hasDefaultView } from "@/config/default-rbac";

export interface ModuleAccessResult {
  allowed: boolean;
  blockedByPlan: boolean;
  blockedByRbac: boolean;
  isCore: boolean;
}

interface UseModuleAccessReturn {
  checkAccess: (moduleKey: string) => ModuleAccessResult;
  hasAccess: (moduleKey: string) => boolean;
  currentPlan: PlanId;
  isBypassing: boolean;
}


export function useModuleAccess(): UseModuleAccessReturn {
  const { dbRole, dbRoles, impersonatedUser } = useAuth();
  const { org, activePoles } = useOrganization();

  const isSuperAdmin = dbRole === "super_admin";
  const isGhostActive = !!impersonatedUser;
  const isBypassing = isSuperAdmin && !isGhostActive;

  const currentPlan = (org?.subscription_plan ?? "starter") as PlanId;
  const orgStatus = org?.status ?? "active";

  // ── Fetch GLOBAL permissions (org_id IS NULL) for effective roles ──
  const effectiveRoles = useMemo(() => {
    if (isGhostActive && impersonatedUser?.roles) return impersonatedUser.roles;
    return dbRoles.length > 0 ? dbRoles : (dbRole ? [dbRole] : []);
  }, [dbRoles, dbRole, isGhostActive, impersonatedUser]);

  const [globalPerms, setGlobalPerms] = useState<Map<string, boolean>>(new Map());

  // Refetch when orgId changes (plan/activation context switch)
  const orgId = org?.id;

  useEffect(() => {
    if (effectiveRoles.length === 0) {
      setGlobalPerms(new Map());
      return;
    }
    // Query global permissions (org_id IS NULL) for all effective roles, union permissive
    (async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("module, enabled, role")
        .is("org_id", null)
        .in("role", effectiveRoles as any);

      if (error || !data) {
        console.error("useModuleAccess: error fetching global perms", error?.message);
        setGlobalPerms(new Map());
        return;
      }
      // BOOL_OR: if any role has enabled=true for a module, it's enabled
      const map = new Map<string, boolean>();
      for (const row of data as any[]) {
        const current = map.get(row.module) ?? false;
        map.set(row.module, current || !!(row.enabled));
      }
      setGlobalPerms(map);
    })();
  }, [effectiveRoles, orgId]);

  // Build activation set from org's active_poles
  const activePoleSet = useMemo<Set<string>>(() => new Set(activePoles), [activePoles]);

  const checkAccess = useCallback((moduleKey: string): ModuleAccessResult => {
    const meta = MODULE_MAP.get(moduleKey);
    const isCore = CORE_MODULE_IDS.has(moduleKey);

    // ── Priority 1: CORE modules — resolved via defaultRoles ──
    if (isCore && meta) {
      const defaultRoles = meta.defaultRoles ?? [];
      const hasWildcard = defaultRoles.includes("*");
      const allowed = hasWildcard || effectiveRoles.some((r) => defaultRoles.includes(r));
      if (!allowed) {
        console.debug(`[useModuleAccess] CORE "${moduleKey}" blocked — effectiveRoles:`, effectiveRoles, "defaultRoles:", defaultRoles);
      }
      return { allowed, blockedByPlan: false, blockedByRbac: !allowed, isCore };
    }

    // ── Priority 2: super_admin bypass (non-ghost) ──
    if (isBypassing) {
      return { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore };
    }

    // ── Priority 3: Org status filter — pending orgs only get CORE ──
    if (orgStatus === "pending" || orgStatus === "suspended") {
      return { allowed: false, blockedByPlan: false, blockedByRbac: false, isCore };
    }

    // ── Priority 4: Triple filter (Plan + Activation + Global RBAC) ──

    // A) Plan filter
    const inPlan = isModuleInPlan(moduleKey, currentPlan);
    if (!inPlan) {
      return { allowed: false, blockedByPlan: true, blockedByRbac: false, isCore };
    }

    // B) Activation filter — module's parent must be in org's active_poles
    const parentKey = moduleKey.includes(".") ? moduleKey.split(".")[0] : moduleKey;
    if (activePoleSet.size > 0 && !activePoleSet.has(parentKey)) {
      return { allowed: false, blockedByPlan: false, blockedByRbac: false, isCore };
    }

    // C) Global RBAC filter — check global permissions (org_id IS NULL)
    // Only block if an explicit entry exists with enabled=false.
    // Missing entries default to ALLOWED (plan filter already restricts by subscription).
    if (globalPerms.has(moduleKey) && !globalPerms.get(moduleKey)) {
      return { allowed: false, blockedByPlan: false, blockedByRbac: true, isCore };
    }
    // Also check parent-level permission for sub-modules (e.g. "education" for "education.eleves")
    if (moduleKey.includes(".")) {
      const parentKey = moduleKey.split(".")[0];
      if (globalPerms.has(parentKey) && !globalPerms.get(parentKey)) {
        return { allowed: false, blockedByPlan: false, blockedByRbac: true, isCore };
      }
    }

    return { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore };
  }, [isBypassing, currentPlan, orgStatus, effectiveRoles, globalPerms, activePoleSet]);

  const hasAccess = useCallback((moduleKey: string): boolean => {
    return checkAccess(moduleKey).allowed;
  }, [checkAccess]);

  return { checkAccess, hasAccess, currentPlan, isBypassing };
}
