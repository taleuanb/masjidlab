import { useAuth } from "@/contexts/AuthContext";
import { useParentData } from "@/hooks/useParentData";

/**
 * Returns whether the current user is a parent and their children's class IDs.
 */
export function useParentScope() {
  const { dbRoles } = useAuth();

  const isParent =
    dbRoles.includes("parent") &&
    !dbRoles.includes("admin") &&
    !dbRoles.includes("super_admin") &&
    !dbRoles.includes("responsable");

  const { data: students, isLoading } = useParentData();

  const childrenIds = (students ?? []).map((s) => s.id);
  const childrenClassIds = [
    ...new Set((students ?? []).map((s) => s.class_id).filter(Boolean)),
  ] as string[];

  return {
    isParent,
    students: students ?? [],
    childrenIds,
    childrenClassIds,
    isLoading,
  };
}
