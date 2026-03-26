/**
 * DEFAULT_RBAC_MATRIX — Factory-default permissions for each role × module.
 *
 * Used by:
 *   1. SaaS Admin "Réinitialiser" button (preview before save)
 *   2. Sidebar fallback when DB has no entry for a role/module pair
 *
 * Roles not listed here (e.g. super_admin) bypass RBAC entirely.
 * Modules not listed for a role default to { can_view: false, can_edit: false, can_delete: false }.
 */

import { RBAC_MODULE_HIERARCHY, getAllRbacModuleIds } from "@/config/rbac-modules";

export interface DefaultPermission {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/**
 * Shorthand helpers
 */
const FULL: DefaultPermission = { can_view: true, can_edit: true, can_delete: true };
const VIEW_EDIT: DefaultPermission = { can_view: true, can_edit: true, can_delete: false };
const VIEW_ONLY: DefaultPermission = { can_view: true, can_edit: false, can_delete: false };
const NONE: DefaultPermission = { can_view: false, can_edit: false, can_delete: false };

/**
 * Factory-default permission per role per module.
 * Key = app_role value from the DB enum.
 * Inner key = module id (parent or child from RBAC_MODULE_HIERARCHY).
 */
export const DEFAULT_RBAC_MATRIX: Record<string, Record<string, DefaultPermission>> = {
  // ── Admin Mosquée: full access everywhere ──
  admin: (() => {
    const map: Record<string, DefaultPermission> = {};
    for (const id of getAllRbacModuleIds()) {
      map[id] = FULL;
    }
    return map;
  })(),

  // ── Responsable: full on their assigned pole, view on most, no gestion-rh global ──
  responsable: (() => {
    const map: Record<string, DefaultPermission> = {};
    for (const id of getAllRbacModuleIds()) {
      map[id] = NONE;
    }
    // Education — full (typical assignment)
    map["education"] = VIEW_EDIT;
    map["education.eleves"] = VIEW_EDIT;
    map["education.classes"] = VIEW_EDIT;
    map["education.inscriptions"] = VIEW_EDIT;
    map["education.sessions"] = VIEW_EDIT;
    map["education.evaluations"] = VIEW_EDIT;
    map["education.frais"] = VIEW_EDIT;
    // Finance — view + edit
    map["finance"] = VIEW_EDIT;
    map["finance.transactions"] = VIEW_EDIT;
    map["finance.donateurs"] = VIEW_EDIT;
    map["finance.recus"] = VIEW_EDIT;
    // Social & Comms — view + edit
    map["social"] = VIEW_EDIT;
    map["comms"] = VIEW_EDIT;
    // Operations — view + edit
    map["operations"] = VIEW_EDIT;
    map["operations.planning"] = VIEW_EDIT;
    map["operations.evenements"] = VIEW_EDIT;
    map["operations.inventaire"] = VIEW_EDIT;
    map["operations.parking"] = VIEW_EDIT;
    map["operations.maintenance"] = VIEW_EDIT;
    // Personnel — view only (not full gestion-rh)
    map["gestion-rh"] = VIEW_ONLY;
    map["gestion-rh.approbations"] = VIEW_ONLY;
    map["gestion-rh.contrats"] = NONE;
    map["gestion-rh.documents"] = VIEW_ONLY;
    map["gestion-rh.structure"] = VIEW_ONLY;
    return map;
  })(),

  // ── Enseignant: can_view on education only ──
  enseignant: (() => {
    const map: Record<string, DefaultPermission> = {};
    for (const id of getAllRbacModuleIds()) {
      map[id] = NONE;
    }
    map["education"] = VIEW_ONLY;
    map["education.eleves"] = VIEW_ONLY;
    map["education.classes"] = VIEW_ONLY;
    map["education.inscriptions"] = VIEW_ONLY;
    map["education.sessions"] = VIEW_EDIT;
    map["education.evaluations"] = VIEW_EDIT;
    map["education.frais"] = VIEW_ONLY;
    return map;
  })(),

  // ── Bénévole: no access to business modules by default ──
  benevole: (() => {
    const map: Record<string, DefaultPermission> = {};
    for (const id of getAllRbacModuleIds()) {
      map[id] = NONE;
    }
    return map;
  })(),

  // ── Parent: no access to business modules by default ──
  parent: (() => {
    const map: Record<string, DefaultPermission> = {};
    for (const id of getAllRbacModuleIds()) {
      map[id] = NONE;
    }
    return map;
  })(),
};

/**
 * Get the factory-default permission for a role/module pair.
 * Returns NONE if the role or module isn't defined.
 */
export function getDefaultPermission(role: string, moduleId: string): DefaultPermission {
  return DEFAULT_RBAC_MATRIX[role]?.[moduleId] ?? NONE;
}

/**
 * Check if a role has can_view on a module in the factory defaults.
 */
export function hasDefaultView(role: string, moduleId: string): boolean {
  return getDefaultPermission(role, moduleId).can_view;
}
