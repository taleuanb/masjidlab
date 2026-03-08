/**
 * Core Type Definitions for Poles
 * 
 * core_type is the immutable technical key that links a pole to its MODULE_REGISTRY entry.
 * nom is the user-facing label that can be freely renamed.
 */

import { MODULE_REGISTRY } from "@/config/module-registry";

export const CORE_TYPES = MODULE_REGISTRY
  .filter((m) => !m.isCore)
  .map((m) => ({ value: m.id, label: m.label }));

/** Get the default display name for a core_type */
export function getDefaultPoleName(coreType: string): string {
  return CORE_TYPES.find((ct) => ct.value === coreType)?.label ?? coreType;
}
