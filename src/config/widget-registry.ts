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
  /** Grid column span hint: 1 | 2 | 3 */
  colSpan: 1 | 2 | 3;
  /** Lazy-loaded component */
  component: React.LazyExoticComponent<ComponentType<any>>;
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

// ─── All roles shorthand ────────────────────────────────────────────
const ADMIN_ROLES = ["super_admin", "admin", "responsable"];
const EDUCATION_ROLES = ["super_admin", "admin", "responsable", "enseignant"];
const ALL_ROLES: string[] = []; // empty = everyone

// ─── Registry ───────────────────────────────────────────────────────
export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── KPIs (always, except enseignant handled inside component) ──
  {
    id: "org-kpis",
    section: "Vue d'ensemble",
    sectionEmoji: "📊",
    requiredPole: null,
    allowedRoles: ["super_admin", "admin", "responsable"],
    defaultWeight: 1000,
    colSpan: 3,
    component: OrgKpiStats,
  },

  // ── Éducation (highest weight for Madrassa-first display) ──
  {
    id: "edu-assiduité",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 900,
    colSpan: 1,
    component: EducationAssiduiteWidget,
  },
  {
    id: "edu-effectifs",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 890,
    colSpan: 1,
    component: EducationEffectifsWidget,
  },
  {
    id: "edu-inscriptions",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 880,
    colSpan: 1,
    component: EducationInscriptionsWidget,
  },
  {
    id: "edu-alertes",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 870,
    colSpan: 1,
    component: EducationAlertesWidget,
  },
  {
    id: "edu-finance",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: ["super_admin", "admin", "responsable"],
    defaultWeight: 860,
    colSpan: 1,
    component: EducationFinanceWidget,
  },

  // ── Logistique ──
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

  // ── Finance ──
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

// ─── Filtering engine ───────────────────────────────────────────────
export function getVisibleWidgets(
  activePoles: string[],
  userDbRoles: string[],
  isSuperAdmin: boolean,
): WidgetDef[] {
  return WIDGET_REGISTRY
    .filter((w) => {
      // Pole check
      if (w.requiredPole && !poleIsActive(w.requiredPole, activePoles)) return false;
      // Role check (empty = all, super_admin bypasses)
      if (isSuperAdmin) return true;
      if (w.allowedRoles.length === 0) return true;
      return w.allowedRoles.some((r) => userDbRoles.includes(r));
    })
    .sort((a, b) => b.defaultWeight - a.defaultWeight);
}
