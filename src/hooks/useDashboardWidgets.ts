import { useMemo, useEffect, useState } from "react";
import { useRole, UI_ROLE_TO_DB } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getVisibleWidgets, type WidgetDef, type DbWidgetConfig } from "@/config/widget-registry";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardSection {
  name: string;
  emoji: string;
  widgets: WidgetDef[];
}

export function useDashboardWidgets() {
  const { isSuperAdmin, userDbRoles, role } = useRole();
  const { impersonatedUser } = useAuth();
  const { orgId, activePoles, loading: orgLoading, org } = useOrganization();

  const isParentRole = role === "Parent d'élève";

  // ── Resolve effective roles ──
  const isGhostMode = !!impersonatedUser;
  const isPreviewingRole = isSuperAdmin && !isGhostMode && role !== "Super Admin";

  const effectiveRoles = isGhostMode
    ? (impersonatedUser.roles ?? [])
    : isPreviewingRole
    ? [UI_ROLE_TO_DB[role] ?? "benevole"]
    : userDbRoles;
  const effectiveSuperAdmin = isSuperAdmin && !isGhostMode && !isPreviewingRole;

  // ── Fetch DB widget configs (SaaS console overrides) ──
  const [dbConfigs, setDbConfigs] = useState<DbWidgetConfig[] | undefined>(undefined);
  useEffect(() => {
    supabase
      .from("saas_widget_configs")
      .select("widget_key, label, required_plans, allowed_roles, required_pole, priority, is_enabled")
      .then(({ data }) => {
        if (data && data.length > 0) setDbConfigs(data as DbWidgetConfig[]);
      });
  }, []);

  // ── Registry-driven filtering ──
  const visibleWidgets = useMemo(
    () =>
      getVisibleWidgets(
        activePoles,
        effectiveRoles,
        effectiveSuperAdmin,
        org?.subscription_plan,
        dbConfigs,
      ),
    [activePoles, effectiveRoles, effectiveSuperAdmin, org?.subscription_plan, dbConfigs],
  );

  // ── Group by section preserving weight order ──
  const sections = useMemo<DashboardSection[]>(() => {
    const map = new Map<string, { emoji: string; widgets: WidgetDef[] }>();
    for (const w of visibleWidgets) {
      if (!map.has(w.section)) {
        map.set(w.section, { emoji: w.sectionEmoji, widgets: [] });
      }
      map.get(w.section)!.widgets.push(w);
    }
    return Array.from(map.entries()).map(([name, { emoji, widgets }]) => ({
      name,
      emoji,
      widgets,
    }));
  }, [visibleWidgets]);

  return {
    sections,
    visibleWidgets,
    orgId,
    orgLoading,
    isParentRole,
    role,
  };
}
