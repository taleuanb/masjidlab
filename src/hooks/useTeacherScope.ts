import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's profile ID, whether they are a teacher,
 * and the class IDs they are assigned to (via madrasa_classes.prof_id).
 *
 * In ghost mode, uses the impersonated user's roles & profile so that
 * the dashboard correctly reflects the teacher scope.
 */
export function useTeacherScope() {
  const { user, dbRoles, impersonatedUser } = useAuth();
  const { orgId } = useOrganization();

  // In ghost mode, use impersonated user's roles; otherwise use real roles
  const effectiveRoles = impersonatedUser?.roles ?? dbRoles;

  const isTeacher =
    effectiveRoles.includes("enseignant") &&
    !effectiveRoles.includes("admin") &&
    !effectiveRoles.includes("super_admin") &&
    !effectiveRoles.includes("responsable");

  // In ghost mode, look up the impersonated user's profile; otherwise use real user
  const targetUserId = impersonatedUser?.id ?? user?.id;

  const { data: profileId } = useQuery({
    queryKey: ["my-profile-id", targetUserId],
    enabled: !!targetUserId,
    staleTime: Infinity,
    queryFn: async () => {
      // If impersonating, targetUserId is a profile ID already — check both
      // First try as user_id (normal case)
      const { data: byUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", targetUserId!)
        .maybeSingle();

      if (byUser?.id) return byUser.id;

      // If impersonated ID is a profile ID directly (common in ghost mode)
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", targetUserId!)
        .maybeSingle();

      return byId?.id ?? null;
    },
  });

  const { data: teacherClassIds } = useQuery({
    queryKey: ["teacher-class-ids", profileId, orgId],
    enabled: isTeacher && !!profileId && !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_classes")
        .select("id")
        .eq("org_id", orgId!)
        .eq("prof_id", profileId!);
      return (data ?? []).map((c) => c.id);
    },
  });

  return {
    profileId: profileId ?? null,
    isTeacher,
    teacherClassIds: isTeacher ? (teacherClassIds ?? []) : [],
  };
}
