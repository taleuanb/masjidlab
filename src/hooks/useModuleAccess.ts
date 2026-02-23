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

import { useMemo, useCallback } from "react";
import { useAuth, type EffectivePermission } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  isModuleInPlan,
  CORE_MODULE_IDS,
  type PlanId,
  PLAN_META,
  MODULE_MAP,
} from "@/config/module-registry";

export interface ModuleAccessResult {
  /** Whether the module is fully accessible (passes all 3 filters) */
  allowed: boolean;
  /** Whether the module is blocked by plan (upgrade required) */
  blockedByPlan: boolean;
  /** Whether the module is blocked by RBAC */
  blockedByRbac: boolean;
  /** Whether the module is a CORE module */
  isCore: boolean;
}

interface UseModuleAccessReturn {
  /** Check full access for a single module */
  checkAccess: (moduleKey: string) => ModuleAccessResult;
  /** Simple boolean check (convenience) */
  hasAccess: (moduleKey: string) => boolean;
  /** Current plan of the org */
  currentPlan: PlanId;
  /** Whether user has super_admin bypass */
  isBypassing: boolean;
}

export function useModuleAccess(): UseModuleAccessReturn {
  const { dbRole, permissions, impersonatedUser } = useAuth();
  const { org, activePoles } = useOrganization();

  const isSuperAdmin = dbRole === "super_admin";
  const isGhostActive = !!impersonatedUser;
  // Super admin bypass only when NOT in ghost mode
  const isBypassing = isSuperAdmin && !isGhostActive;
  const isAdminLike = !isGhostActive && (dbRole === "admin" || dbRole === "super_admin");

  const currentPlan = (org?.subscription_plan ?? "starter") as PlanId;

  // Build a set of RBAC-enabled modules from permissions
  const rbacSet = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const p of permissions) {
      if (p.enabled) set.add(p.module);
    }
    return set;
  }, [permissions]);

  const checkAccess = useCallback((moduleKey: string): ModuleAccessResult => {
    const meta = MODULE_MAP.get(moduleKey);
    const isCore = CORE_MODULE_IDS.has(moduleKey);

    // Super admin bypass (non-ghost)
    if (isBypassing) {
      return { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore };
    }

    // Condition A: Plan filter
    const inPlan = isModuleInPlan(moduleKey, currentPlan);
    if (!inPlan) {
      return { allowed: false, blockedByPlan: true, blockedByRbac: false, isCore };
    }

    // CORE modules bypass RBAC for admin-like roles (non-ghost)
    if (isCore && isAdminLike) {
      return { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore };
    }

    // Condition C: RBAC filter
    // If permissions are loaded and this module isn't enabled, block it
    if (permissions.length > 0 && !rbacSet.has(moduleKey)) {
      return { allowed: false, blockedByPlan: false, blockedByRbac: true, isCore };
    }

    return { allowed: true, blockedByPlan: false, blockedByRbac: false, isCore };
  }, [isBypassing, currentPlan, isAdminLike, permissions, rbacSet]);

  const hasAccess = useCallback((moduleKey: string): boolean => {
    return checkAccess(moduleKey).allowed;
  }, [checkAccess]);

  return { checkAccess, hasAccess, currentPlan, isBypassing };
}
