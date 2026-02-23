/**
 * Module Registry — Single Source of Truth
 * 
 * Toute la metadata des modules est définie ici.
 * Aucun composant UI ne doit hard-coder des noms de plan ou de module.
 */

import {
  BookOpen, Landmark, Heart, Radio, Truck, Crown,
  GraduationCap, SlidersHorizontal, Users, ShieldCheck,
} from "lucide-react";
import type React from "react";

// ── Plan Definitions ──────────────────────────────────────────────────────────

export const PLAN_IDS = ["starter", "pro", "elite"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanMeta {
  label: string;
  icon: React.ElementType;
  /** Tailwind classes for badges */
  badgeCls: string;
  order: number;
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  starter: { label: "Starter",  icon: SlidersHorizontal, order: 0, badgeCls: "bg-muted text-muted-foreground border-border" },
  pro:     { label: "Pro",      icon: ShieldCheck,       order: 1, badgeCls: "bg-primary/10 text-primary border-primary/30" },
  elite:   { label: "Elite",    icon: Crown,             order: 2, badgeCls: "bg-amber-500/10 text-amber-600 border-amber-400/30" },
};

// ── Module Definitions ────────────────────────────────────────────────────────

export interface ModuleMeta {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  /** Minimum plan required to unlock this module */
  minPlan: PlanId;
  /** Whether this module is CORE (exempt from RBAC for admin) */
  isCore?: boolean;
}

/**
 * Complete list of all business modules.
 * Order matters for display in Settings page.
 */
export const MODULE_REGISTRY: ModuleMeta[] = [
  // CORE modules — always visible for admin/super_admin, outside RBAC
  { id: "config",       label: "Configuration",   description: "Paramètres, espaces et inventaire du complexe",        icon: SlidersHorizontal, minPlan: "starter", isCore: true },
  { id: "gouvernance",  label: "Membres & Rôles", description: "Gestion des membres, rôles et permissions",           icon: Users,             minPlan: "starter", isCore: true },

  // Business modules — subject to plan + RBAC
  { id: "education",    label: "Éducation",        description: "Cours, inscriptions, suivi pédagogique",             icon: GraduationCap,     minPlan: "starter" },
  { id: "finance",      label: "Finance",          description: "Transactions, donateurs, reçus fiscaux",             icon: Landmark,          minPlan: "pro" },
  { id: "social",       label: "Social",           description: "Actions sociales, aides, bénéficiaires",             icon: Heart,             minPlan: "pro" },
  { id: "comms",        label: "Communication",    description: "Newsletter, réseaux sociaux, annonces",              icon: Radio,             minPlan: "pro" },
  { id: "operations",   label: "Logistique",       description: "Planning, inventaire, parking, maintenance",         icon: Truck,             minPlan: "elite" },
  { id: "gestion-rh",   label: "Personnel",        description: "Contrats staff, documents, structure RH",            icon: Crown,             minPlan: "elite" },
];

/** Fast lookup map: moduleId → ModuleMeta */
export const MODULE_MAP = new Map<string, ModuleMeta>(
  MODULE_REGISTRY.map((m) => [m.id, m])
);

/** Set of CORE module IDs for O(1) lookups */
export const CORE_MODULE_IDS = new Set<string>(
  MODULE_REGISTRY.filter((m) => m.isCore).map((m) => m.id)
);

// ── Plan → Module Feature Mapping ─────────────────────────────────────────────

/**
 * PLAN_FEATURE_MAPPING — the ONLY place where plans are linked to modules.
 * Cumulative: each plan includes all modules from lower plans.
 */
export const PLAN_FEATURE_MAPPING: Record<PlanId, readonly string[]> = (() => {
  const starter = MODULE_REGISTRY.filter((m) => m.minPlan === "starter").map((m) => m.id);
  const pro     = [...starter, ...MODULE_REGISTRY.filter((m) => m.minPlan === "pro").map((m) => m.id)];
  const elite   = [...pro,    ...MODULE_REGISTRY.filter((m) => m.minPlan === "elite").map((m) => m.id)];
  return { starter, pro, elite } as const;
})();

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if a module is included in a given plan.
 * Returns true if plan is unknown (permissive fallback).
 */
export function isModuleInPlan(moduleId: string, plan: string | null | undefined): boolean {
  if (!plan) return true;
  const allowed = PLAN_FEATURE_MAPPING[plan as PlanId];
  if (!allowed) return true;
  return allowed.includes(moduleId);
}

/**
 * Returns the minimum plan required for a module.
 * Returns null if module is unknown.
 */
export function getMinPlanForModule(moduleId: string): PlanId | null {
  return MODULE_MAP.get(moduleId)?.minPlan ?? null;
}

/**
 * Compare two plans. Returns true if `plan` is >= `required`.
 */
export function isPlanAtLeast(plan: PlanId, required: PlanId): boolean {
  return PLAN_META[plan].order >= PLAN_META[required].order;
}

/**
 * Get all non-CORE business modules (for Settings display).
 */
export function getBusinessModules(): ModuleMeta[] {
  return MODULE_REGISTRY.filter((m) => !m.isCore);
}

/**
 * Get modules included in a specific plan.
 */
export function getModulesForPlan(plan: PlanId): ModuleMeta[] {
  const ids = PLAN_FEATURE_MAPPING[plan];
  return ids.map((id) => MODULE_MAP.get(id)).filter(Boolean) as ModuleMeta[];
}
