import { lazy, type ComponentType } from "react";

export interface WidgetDef {
  id: string;
  section: string;
  sectionEmoji: string;
  requiredPole: string | null;
  allowedRoles: string[];
  defaultWeight: number;
  colSpan: 1 | 2 | 3 | 4 | 6 | 8 | 12;
  component: React.LazyExoticComponent<ComponentType<any>>;
  requiredPlans?: string[];
  isEnabled?: boolean;
}

// ─── Lazy imports ───────────────────────────────────────────────────
const OrgKpiStats = lazy(() => import("@/components/dashboard/OrgKpiStats").then((m) => ({ default: m.OrgKpiStats })));
const RoomsOccupancyWidget = lazy(() => import("@/components/dashboard/RoomsOccupancyWidget").then((m) => ({ default: m.RoomsOccupancyWidget })));
const EventsTimelineWidget = lazy(() => import("@/components/dashboard/EventsTimelineWidget").then((m) => ({ default: m.EventsTimelineWidget })));
const FinanceWidget = lazy(() => import("@/components/dashboard/FinanceWidget").then((m) => ({ default: m.FinanceWidget })));
const AssetsWidget = lazy(() => import("@/components/dashboard/AssetsWidget").then((m) => ({ default: m.AssetsWidget })));
const EducationAssiduiteWidget = lazy(() => import("@/components/dashboard/EducationAssiduiteWidget").then((m) => ({ default: m.EducationAssiduiteWidget })));
const EducationEffectifsWidget = lazy(() => import("@/components/dashboard/EducationEffectifsWidget").then((m) => ({ default: m.EducationEffectifsWidget })));
const EducationInscriptionsWidget = lazy(() => import("@/components/dashboard/EducationInscriptionsWidget").then((m) => ({ default: m.EducationInscriptionsWidget })));
const EducationAlertesWidget = lazy(() => import("@/components/dashboard/EducationAlertesWidget").then((m) => ({ default: m.EducationAlertesWidget })));
const EducationFinanceWidget = lazy(() => import("@/components/dashboard/EducationFinanceWidget").then((m) => ({ default: m.EducationFinanceWidget })));
const EducationVigilanceWidget = lazy(() => import("@/components/dashboard/EducationVigilanceWidget").then((m) => ({ default: m.EducationVigilanceWidget })));
const StudentProgressWidget = lazy(() => import("@/components/dashboard/StudentProgressWidget").then((m) => ({ default: m.StudentProgressWidget })));
const ParentInvoicesWidget = lazy(() => import("@/components/dashboard/ParentInvoicesWidget").then((m) => ({ default: m.ParentInvoicesWidget })));
const SchoolAgendaWidget = lazy(() => import("@/components/dashboard/SchoolAgendaWidget").then((m) => ({ default: m.SchoolAgendaWidget })));
const RecentSessionsWidget = lazy(() => import("@/components/dashboard/RecentSessionsWidget").then((m) => ({ default: m.RecentSessionsWidget })));

// ─── Role shorthands ────────────────────────────────────────────────
const ADMIN_ROLES = ["super_admin", "admin", "responsable"];
const EDUCATION_ROLES = ["super_admin", "admin", "responsable", "enseignant"];
const PARENT_ROLES = ["parent"];

// ─── Registry ───────────────────────────────────────────────────────
export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Vue d'ensemble KPIs (full width) ──
  {
    id: "org-kpis",
    section: "Vue d'ensemble",
    sectionEmoji: "📊",
    requiredPole: null,
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 1000,
    colSpan: 12,
    component: OrgKpiStats,
  },

  // ── Ligne Macro : 3 × col-4 ──
  {
    id: "edu-assiduité",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 900,
    colSpan: 4,
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

  // ── Ligne Opérationnelle : Finance (col-8) + Vigilance (col-4) ──
  {
    id: "edu-finance",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 870,
    colSpan: 8,
    component: EducationFinanceWidget,
  },
  {
    id: "edu-vigilance",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 860,
    colSpan: 4,
    component: EducationVigilanceWidget,
  },

  // ── Ligne Activité : full width ──
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
  // Top: Journal des cours (col-12) — freshest info
  {
    id: "parent-sessions",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 960,
    colSpan: 12,
    component: RecentSessionsWidget,
  },
  // Middle: Suivi long terme (col-8) + Paiements (col-4)
  {
    id: "parent-progress",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 950,
    colSpan: 8,
    component: StudentProgressWidget,
  },
  {
    id: "parent-invoices",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 940,
    colSpan: 4,
    component: ParentInvoicesWidget,
  },
  // Bottom: Calendrier (col-12)
  {
    id: "parent-agenda",
    section: "Suivi Famille",
    sectionEmoji: "👨‍👩‍👧‍👦",
    requiredPole: "education",
    allowedRoles: PARENT_ROLES,
    defaultWeight: 930,
    colSpan: 12,
    component: SchoolAgendaWidget,
  },

  // ── Gestion des Espaces ──
  {
    id: "rooms-occupancy",
    section: "Gestion des Espaces",
    sectionEmoji: "📍",
    requiredPole: "logistics",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 700,
    colSpan: 8,
    component: RoomsOccupancyWidget,
  },
  {
    id: "events-timeline",
    section: "Gestion des Espaces",
    sectionEmoji: "📍",
    requiredPole: "logistics",
    allowedRoles: [...ADMIN_ROLES, "enseignant"],
    defaultWeight: 690,
    colSpan: 4,
    component: EventsTimelineWidget,
  },

  // ── Finance & Social ──
  {
    id: "finance-overview",
    section: "Finance & Social",
    sectionEmoji: "💰",
    requiredPole: "finance",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 500,
    colSpan: 6,
    component: FinanceWidget,
  },
  {
    id: "assets-inventory",
    section: "Finance & Social",
    sectionEmoji: "💰",
    requiredPole: "logistics",
    allowedRoles: ADMIN_ROLES,
    defaultWeight: 490,
    colSpan: 6,
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
      if (w.isEnabled === false) return false;
      if (w.requiredPlans && orgPlan && !w.requiredPlans.includes(orgPlan)) {
        if (!isSuperAdmin) return false;
      }
      if (w.requiredPole && !poleIsActive(w.requiredPole, activePoles)) return false;
      if (isSuperAdmin) return true;
      if (w.allowedRoles.length === 0) return true;
      return w.allowedRoles.some((r) => userDbRoles.includes(r));
    })
    .sort((a, b) => b.defaultWeight - a.defaultWeight);
}
