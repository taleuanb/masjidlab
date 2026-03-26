import { lazy, type ComponentType } from "react";

export interface WidgetDef {
  id: string;
  label: string;
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
const EDUCATION_ALL_ROLES = ["super_admin", "admin", "responsable", "enseignant", "parent"];

// ─── Icon mapping for SaaS admin console ────────────────────────────
export const WIDGET_ICON_MAP: Record<string, string> = {
  "org-kpis": "bar-chart-3",
  "edu-assiduité": "user-check",
  "edu-effectifs": "users",
  "edu-inscriptions": "user-plus",
  "edu-finance": "wallet",
  "edu-vigilance": "shield-alert",
  "recent-sessions": "activity",
  "student-progress": "graduation-cap",
  "parent-invoices": "receipt",
  "school-agenda": "calendar-days",
  "rooms-occupancy": "door-open",
  "events-timeline": "calendar-clock",
  "finance-overview": "landmark",
  "assets-inventory": "package",
};

// ─── Registry (1 ID = 1 composant physique) ─────────────────────────
export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Vue d'ensemble KPIs (full width) ──
  {
    id: "org-kpis",
    label: "KPIs Organisation",
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
    label: "Assiduité Madrassa",
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
    label: "Effectifs Madrassa",
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
    label: "Inscriptions Madrassa",
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
    label: "Finance Éducation",
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
    label: "Points de Vigilance",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ROLES,
    defaultWeight: 860,
    colSpan: 4,
    component: EducationVigilanceWidget,
  },

  // ── Activité des Classes / Journal des Cours (polymorphe) ──
  {
    id: "recent-sessions",
    label: "Activité des Classes / Journal",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ALL_ROLES,
    defaultWeight: 850,
    colSpan: 12,
    component: RecentSessionsWidget,
  },

  // ── Suivi Scolaire (polymorphe admin/parent) ──
  {
    id: "student-progress",
    label: "Suivi Scolaire",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: [...EDUCATION_ROLES, "parent"],
    defaultWeight: 840,
    colSpan: 8,
    component: StudentProgressWidget,
  },

  // ── Factures Parent ──
  {
    id: "parent-invoices",
    label: "Mes Factures & Paiements",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: ["parent"],
    defaultWeight: 830,
    colSpan: 4,
    component: ParentInvoicesWidget,
  },

  // ── Agenda Scolaire ──
  {
    id: "school-agenda",
    label: "Agenda Scolaire",
    section: "École Madrassa",
    sectionEmoji: "📚",
    requiredPole: "education",
    allowedRoles: EDUCATION_ALL_ROLES,
    defaultWeight: 820,
    colSpan: 12,
    component: SchoolAgendaWidget,
  },

  // ── Gestion des Espaces ──
  {
    id: "rooms-occupancy",
    label: "Occupation des Salles",
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
    label: "Événements à venir",
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
    label: "Trésorerie",
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
    label: "Inventaire Matériel",
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
