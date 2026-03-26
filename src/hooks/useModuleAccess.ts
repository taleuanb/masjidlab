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
      const baseQuery = supabase
        .from("role_permissions")
        .select("module, enabled, can_view, role, org_id")
        .in("role", effectiveRoles as any);

      const { data, error } = orgId
        ? await baseQuery.or(`org_id.is.null,org_id.eq.${orgId}`)
        : await baseQuery.is("org_id", null);

      if (error || !data) {
        console.error("useModuleAccess: error fetching global perms", error?.message);
        setGlobalPerms(new Map());
        return;
      }

      type RolePermissionRow = {
        module: string;
        enabled: boolean | null;
        can_view: boolean | null;
        org_id: string | null;
      };

      // Smart merge: org-specific rows win over global rows for the same module.
      // Within each scope, union is permissive (enabled OR can_view across roles).
      const merged = new Map<string, { global: boolean; org: boolean; hasOrg: boolean }>();
      for (const row of data as RolePermissionRow[]) {
        const current = merged.get(row.module) ?? { global: false, org: false, hasOrg: false };
        const isActive = !!row.enabled || !!row.can_view;
        const isOrgSpecific = !!orgId && row.org_id === orgId;

        if (isOrgSpecific) {
          current.org = current.org || isActive;
          current.hasOrg = true;
        } else if (row.org_id === null) {
          current.global = current.global || isActive;
        }

        merged.set(row.module, current);
      }

      const map = new Map<string, boolean>();
      for (const [module, value] of merged.entries()) {
        map.set(module, value.hasOrg ? value.org : value.global);
      }

      setGlobalPerms(map);
    })();
  }, [effectiveRoles, orgId]);

  // Build activation set from org's active_poles
  const activePoleSet = useMemo<Set<string>>(() => new Set(activePoles), [activePoles]);

  const logRbacDecision = useCallback((
    moduleKey: string,
    allowed: boolean,
    details: {
      inPlan: boolean | null;
      inActivePoles: boolean | null;
      inGlobalPerms: boolean | null;
    }
  ) => {
    if (!import.meta.env.DEV) return;
    console.groupCollapsed(`🔐 RBAC Debug - ${moduleKey}`);
    console.log("allowed:", allowed);
    console.log("InPlan:", details.inPlan);
    console.log("InActivePoles:", details.inActivePoles);
    console.log("InGlobalPerms:", details.inGlobalPerms);
    console.groupEnd();
  }, []);

  const checkAccess = useCallback((moduleKey: string): ModuleAccessResult => {
    const finalize = (
      result: ModuleAccessResult,
      details: { inPlan: boolean | null; inActivePoles: boolean | null; inGlobalPerms: boolean | null }
    ): ModuleAccessResult => {
      logRbacDecision(moduleKey, result.allowed, details);
      return result;
    };

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
      return finalize(
        { allowed, blockedByPlan: false, blockedByRbac: !allowed, isCore },
        { inPlan: null, inActivePoles: null, inGlobalPerms: allowed }
      );
    }

    // ── Priority 2: super_admin bypass (non-ghost) ──
    if (isBypassing) {
      return finalize(
        { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore },
        { inPlan: true, inActivePoles: true, inGlobalPerms: true }
      );
    }

    // ── Priority 3: Org status filter — pending orgs only get CORE ──
    if (orgStatus === "pending" || orgStatus === "suspended") {
      return finalize(
        { allowed: false, blockedByPlan: false, blockedByRbac: false, isCore },
        { inPlan: null, inActivePoles: null, inGlobalPerms: null }
      );
    }

    // ── Priority 4: Triple filter (Plan + Activation + Global RBAC) ──

    // A) Plan filter
    const inPlan = isModuleInPlan(moduleKey, currentPlan);
    if (!inPlan) {
      return finalize(
        { allowed: false, blockedByPlan: true, blockedByRbac: false, isCore },
        { inPlan: false, inActivePoles: null, inGlobalPerms: null }
      );
    }

    // B) Activation filter — module's parent must be in org's active_poles
    const parentKey = moduleKey.includes(".") ? moduleKey.split(".")[0] : moduleKey;
    const inActivePoles = activePoleSet.size === 0 || activePoleSet.has(parentKey);
    if (!inActivePoles) {
      return finalize(
        { allowed: false, blockedByPlan: false, blockedByRbac: false, isCore },
        { inPlan: true, inActivePoles: false, inGlobalPerms: null }
      );
    }

    // C) RBAC filter — resolve permission with parent inheritance
    // Priority: explicit DB entry > parent DB entry > factory default > parent factory default
    const resolveRbac = (key: string): boolean => {
      // 1. Check explicit DB entry for this key
      if (globalPerms.has(key)) return !!globalPerms.get(key);
      // 2. Check factory default for this key
      const factoryAccess = effectiveRoles.some((r) => hasDefaultView(r, key));
      if (factoryAccess) return true;
      // 3. For sub-modules, inherit from parent
      if (key.includes(".")) {
        const pKey = key.split(".")[0];
        if (globalPerms.has(pKey)) return !!globalPerms.get(pKey);
        return effectiveRoles.some((r) => hasDefaultView(r, pKey));
      }
      return false;
    };

    const inGlobalPerms = resolveRbac(moduleKey);
    if (!inGlobalPerms) {
      return finalize(
        { allowed: false, blockedByPlan: false, blockedByRbac: true, isCore },
        { inPlan: true, inActivePoles: true, inGlobalPerms: false }
      );
    }

    return finalize(
      { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore },
      { inPlan: true, inActivePoles: true, inGlobalPerms }
    );
  }, [isBypassing, currentPlan, orgStatus, effectiveRoles, globalPerms, activePoleSet, logRbacDecision]);

  const hasAccess = useCallback((moduleKey: string): boolean => {
    return checkAccess(moduleKey).allowed;
  }, [checkAccess]);

  return { checkAccess, hasAccess, currentPlan, isBypassing };
}
