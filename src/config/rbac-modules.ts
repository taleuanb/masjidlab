/**
 * RBAC Module Hierarchy — Shared between Sidebar & Matrice des Permissions
 *
 * This is the ONLY place where the RBAC sub-module structure is defined.
 * It mirrors the Sidebar navigation blocks exactly.
 * CORE modules (config, gouvernance) are excluded — they have fixed access.
 */

import { MODULE_REGISTRY, MODULE_MAP, type ModuleMeta } from "@/config/module-registry";

export interface RbacSubModule {
  /** Stored in role_permissions.module — e.g. "education.classes" */
  id: string;
  /** Display label — must match sidebar item title */
  label: string;
}

export interface RbacModuleGroup {
  /** Must match MODULE_REGISTRY id — e.g. "education" */
  id: string;
  /** Display label — must match sidebar block label */
  label: string;
  /** Navigation category for grouping in the matrix UI */
  category: "metiers" | "logistique" | "personnel";
  /** Sub-modules (children) — empty means the module has no children */
  children: RbacSubModule[];
}

/**
 * Complete RBAC hierarchy aligned with sidebar navigation.
 * Names MUST be identical to those in AppSidebar NavBlocks.
 */
export const RBAC_MODULE_HIERARCHY: RbacModuleGroup[] = [
  // ── PÔLES MÉTIERS ──
  {
    id: "education",
    label: "Éducation",
    category: "metiers",
    children: [
      { id: "education.eleves", label: "Élèves" },
      { id: "education.classes", label: "Classes" },
      { id: "education.inscriptions", label: "Inscriptions" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    category: "metiers",
    children: [
      { id: "finance.transactions", label: "Transactions" },
      { id: "finance.donateurs", label: "Donateurs" },
      { id: "finance.recus", label: "Reçus Fiscaux" },
    ],
  },
  {
    id: "social",
    label: "Social",
    category: "metiers",
    children: [],
  },
  {
    id: "comms",
    label: "Communication",
    category: "metiers",
    children: [],
  },

  // ── LOGISTIQUE ──
  {
    id: "operations",
    label: "Logistique",
    category: "logistique",
    children: [
      { id: "operations.planning", label: "Planning" },
      { id: "operations.evenements", label: "Événements" },
      { id: "operations.inventaire", label: "Inventaire" },
      { id: "operations.parking", label: "Parking" },
      { id: "operations.maintenance", label: "Maintenance" },
    ],
  },

  // ── PERSONNEL ──
  {
    id: "gestion-rh",
    label: "Personnel",
    category: "personnel",
    children: [
      { id: "gestion-rh.approbations", label: "Approbations" },
      { id: "gestion-rh.contrats", label: "Contrats Staff" },
      { id: "gestion-rh.documents", label: "Documents" },
      { id: "gestion-rh.structure", label: "Structure" },
    ],
  },
];

/** Flat list of ALL module IDs (parents + children) for building the permission matrix */
export function getAllRbacModuleIds(): string[] {
  const ids: string[] = [];
  for (const group of RBAC_MODULE_HIERARCHY) {
    ids.push(group.id);
    for (const child of group.children) {
      ids.push(child.id);
    }
  }
  return ids;
}

/** Get the ModuleMeta from the registry for a given RBAC group */
export function getRegistryMeta(groupId: string): ModuleMeta | undefined {
  return MODULE_MAP.get(groupId);
}

/** Category labels for display */
export const CATEGORY_LABELS: Record<RbacModuleGroup["category"], string> = {
  metiers: "Pôles Métiers",
  logistique: "Logistique",
  personnel: "Personnel",
};
