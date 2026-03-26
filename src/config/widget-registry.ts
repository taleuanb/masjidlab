import { lazy, type ComponentType } from "react";

export interface WidgetDef {
  id: string;
  /** Display section label */
  section: string;
  sectionEmoji: string;
  /** Technical pole required in active_poles (null = always visible) */
  requiredPole: string | null;
  /** DB roles allowed (empty = all authenticated) */
  allowedRoles: string[];
  /** Higher = rendered first */
  defaultWeight: number;
  /** Grid column span (out of 12) */
  colSpan: 1 | 2 | 3 | 4 | 6 | 8 | 12;
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<ComponentType<any>>;
  /** Plans required (from DB config) */
  requiredPlans?: string[];
  /** Globally enabled (from DB config) */
  isEnabled?: boolean;
}

// ─── Lazy imports ───────────────────────────────────────────────────
const OrgKpiStats = lazy(() => import("@/components/dashboard/OrgKpiStats").then((m) => ({ default: m.OrgKpiStats })));
const RoomsOccupancyWidget = lazy(() => import("@/components/dashboard/RoomsOccupancyWidget").then((m) => ({ default: m.RoomsOccupancyWidget })));
const EventsTimelineWidget = lazy(() => import("@/components/dashboard/EventsTimelineWidget").then((m) => ({ default: m.EventsTimelineWidget })));
const FinanceWidget = lazy(() => import("@/components/dashboard/FinanceWidget").then((m) => ({ default: m.FinanceWidget })));
const AssetsWidget = lazy(() => import("@/components/dashboard/AssetsWidget").then((m) => ({ default: m.AssetsWidget })));
const EducationEffectifsWidget = lazy(() => import("@/components/dashboard/EducationEffectifsWidget").then((m) => ({ default: m.EducationEffectifsWidget })));
const EducationInscriptionsWidget = lazy(() => import("@/components/dashboard/EducationInscriptionsWidget").then((m) => ({ default: m.EducationInscriptionsWidget })));
const EducationAlertesWidget = lazy(() => import("@/components/dashboard/EducationAlertesWidget").then((m) => ({ default: m.EducationAlertesWidget })));
const EducationAssiduiteWidget = lazy(() => import("@/components/dashboard/EducationAssiduiteWidget").then((m) => ({ default: m.EducationAssiduiteWidget })));
const EducationFinanceWidget = lazy(() => import("@/components/dashboard/EducationFinanceWidget").then((m) => ({ default: m.EducationFinanceWidget })));
const StudentProgressWidget = lazy(() => import("@/components/dashboard/StudentProgressWidget").then((m) => ({ default: m.StudentProgressWidget })));
const ParentInvoicesWidget = lazy(() => import("@/components/dashboard/ParentInvoicesWidget").then((m) => ({ default: m.ParentInvoicesWidget })));
const SchoolAgendaWidget = lazy(() => import("@/components/dashboard/SchoolAgendaWidget").then((m) => ({ default: m.SchoolAgendaWidget })));
const RecentSessionsWidget = lazy(() => import("@/components/dashboard/RecentSessionsWidget").then((m) => ({ default: m.RecentSessionsWidget })));

// ─── All roles shorthand ────────────────────────────────────────────
const ADMIN_ROLES = ["super_admin", "admin", "responsable"];
const EDUCATION_ROLES = ["super_admin", "admin", "responsable", "enseignant"];
const PARENT_ROLES = ["parent"];

// ─── Registry ───────────────────────────────────────────────────────
export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "org-kpis",
    section: "Vue d'ensemble",
    sectionEmoji: "📊",
    requiredPole: null,
    allowedRoles: ["super_admin", "admin", "responsable"],
    defaultWeight: 1000,
    colSpan: 12,
    component: OrgKpiStats,
  },
  // ── Education Row 1: Assiduité (6) + Effectifs (3) + Inscriptions (3) ──
  {
    id: "edu-assiduité",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 900,
    colSpan: 6,
    component: EducationAssiduiteWidget,
  },
  {
    id: "edu-effectifs",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 890,
    colSpan: 4,
    component: EducationEffectifsWidget,
  },
  {
    id: "edu-inscriptions",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 880,
    colSpan: 4,
    component: EducationInscriptionsWidget,
  },
  // ── Education Row 2: Finance (8) + Alertes (4) ──
  {
    id: "edu-finance",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: ["super_admin", "admin", "responsable"],
    defaultWeight: 870,
    colSpan: 8,
    component: EducationFinanceWidget,
  },
  {
    id: "edu-alertes",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 860,
    colSpan: 4,
    component: EducationAlertesWidget,
  },
  // ── Education Row 3: Activity feed (full width) ──
  {
    id: "edu-recent-sessions",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 850,
    colSpan: 12,
    component: RecentSessionsWidget,
  },
  // ── Parent widgets ──
  {
    id: "parent-progress",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 950,
    colSpan: 2,
    component: StudentProgressWidget,
  },
  {
    id: "parent-invoices",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 940,
    colSpan: 1,
    component: ParentInvoicesWidget,
  },
  {
    id: "parent-agenda",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 930,
    colSpan: 1,
    component: SchoolAgendaWidget,
  },
  // ── Admin/Staff widgets ──
  {
    id: "rooms-occupancy",
    section: "Gestion des Espaces",
    sectionEmoji: "📍",
    requiredPole: "logistics",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 700,
    colSpan: 2,
    component: RoomsOccupancyWidget,
  },
  {
    id: "events-timeline",
    section: "Gestion des Espaces",
    sectionEmoji: "📍",
    requiredPole: "logistics",
    allowedRoles: [...ADMIN_ROLES, "enseignant"],
    defaultWeight: 690,
    colSpan: 1,
    component: EventsTimelineWidget,
  },
  {
    id: "finance-overview",
    section: "Finance & Social",
    sectionEmoji: "💰",
    requiredPole: "finance",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 500,
    colSpan: 1,
    component: FinanceWidget,
  },
  {
    id: "assets-inventory",
    section: "Finance & Social",
    sectionEmoji: "💰",
    requiredPole: "logistics",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 490,
    colSpan: 1,
    component: AssetsWidget,
  },
];

// ─── Pole alias resolution ──────────────────────────────────────────
const POLE_ALIASES: Record<string, string[]> = {
  logistics: ["logistics", "logistique", "operations"],
  finance: ["finance", "social"],
  education: ["education"],
};

function poleIsActive(requiredPole: string, activePoles: string[]): boolean {
  const aliases = POLE_ALIASES[requiredPole] ?? [requiredPole];
  return aliases.some((a) => activePoles.includes(a));
}

// ─── DB config overlay type ─────────────────────────────────────────
export interface DbWidgetConfig {
  widget_key: string;
  label: string;
  required_plans: string[];
  allowed_roles: string[];
  required_pole: string | null;
  priority: number;
  is_enabled: boolean;
}

/**
 * Merge DB configs into local registry: DB overrides priority, roles, plans, enabled.
 */
export function mergeDbConfigs(dbConfigs: DbWidgetConfig[]): WidgetDef[] {
  const dbMap = new Map<string, DbWidgetConfig>();
  dbConfigs.forEach((c) => dbMap.set(c.widget_key, c));

  return WIDGET_REGISTRY.map((w) => {
    const db = dbMap.get(w.id);
    if (!db) return { ...w, isEnabled: true };
    return {
      ...w,
      allowedRoles: db.allowed_roles.length > 0 ? db.allowed_roles : w.allowedRoles,
      defaultWeight: db.priority,
      requiredPole: db.required_pole ?? w.requiredPole,
      requiredPlans: db.required_plans,
      isEnabled: db.is_enabled,
    };
  });
}

// ─── Filtering engine ───────────────────────────────────────────────
export function getVisibleWidgets(
  activePoles: string[],
  userDbRoles: string[],
  isSuperAdmin: boolean,
  orgPlan?: string | null,
  dbConfigs?: DbWidgetConfig[],
): WidgetDef[] {
  const registry = dbConfigs ? mergeDbConfigs(dbConfigs) : WIDGET_REGISTRY;

  return registry
    .filter((w) => {
      // DB-level kill switch
      if (w.isEnabled === false) return false;
      // Plan check (if DB config provides plans)
      if (w.requiredPlans && orgPlan && !w.requiredPlans.includes(orgPlan)) {
        if (!isSuperAdmin) return false;
      }
      // Pole check
      if (w.requiredPole && !poleIsActive(w.requiredPole, activePoles)) return false;
      // Role check (empty = all, super_admin bypasses)
      if (isSuperAdmin) return true;
      if (w.allowedRoles.length === 0) return true;
      return w.allowedRoles.some((r) => userDbRoles.includes(r));
    })
    .sort((a, b) => b.defaultWeight - a.defaultWeight);
}
