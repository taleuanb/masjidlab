/**
 * Mapping des modules autorisés par plan d'abonnement.
 * Chaque plan inclut les modules des plans inférieurs (héritage cumulatif).
 *
 * Les block IDs de la sidebar doivent correspondre aux clés listées ici.
 */

/** Modules CORE : toujours visibles pour admin/super_admin, hors matrice RBAC */
export const CORE_MODULES = [
  "operations",   // dashboard + planning + events
  "config",       // settings / configuration
  "gouvernance",  // members / structure
] as const;

/** Set for O(1) lookups */
export const CORE_MODULE_SET = new Set<string>(CORE_MODULES);

const STARTER_MODULES = [
  ...CORE_MODULES,
  "education",
] as const;

const PRO_MODULES = [
  ...STARTER_MODULES,
  "finance",
  "social",
  "comms",
] as const;

const ELITE_MODULES = [
  ...PRO_MODULES,
  "gestion-rh",
  "advanced_rbac", // Ghost Mode, RBAC avancé
] as const;

export type SubscriptionPlan = "starter" | "pro" | "elite";

export const PLAN_CONFIG: Record<SubscriptionPlan, readonly string[]> = {
  starter: STARTER_MODULES,
  pro: PRO_MODULES,
  elite: ELITE_MODULES,
};

/**
 * Vérifie si un module est autorisé pour un plan donné.
 * Retourne true si le plan est inconnu (fallback permissif pour ne pas bloquer).
 */
export function isModuleAllowedForPlan(
  moduleName: string,
  plan: string | null | undefined
): boolean {
  if (!plan) return true; // pas de plan = pas de restriction (fallback)
  const allowed = PLAN_CONFIG[plan as SubscriptionPlan];
  if (!allowed) return true; // plan inconnu = pas de restriction
  return allowed.includes(moduleName);
}
