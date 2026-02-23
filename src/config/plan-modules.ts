/**
 * @deprecated — Use module-registry.ts instead.
 * This file re-exports for backward compatibility.
 */
export {
  PLAN_FEATURE_MAPPING as PLAN_CONFIG,
  CORE_MODULE_IDS as CORE_MODULE_SET,
  isModuleInPlan as isModuleAllowedForPlan,
  type PlanId as SubscriptionPlan,
} from "@/config/module-registry";
