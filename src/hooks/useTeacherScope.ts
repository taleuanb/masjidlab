import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's profile ID, whether they are a teacher,
 * and the class IDs they are assigned to (via madrasa_classes.prof_id).
 */
export function useTeacherScope() {
  const { user, dbRoles } = useAuth();
  const { orgId } = useOrganization();

  const isTeacher =
    dbRoles.includes("enseignant") &&
    !dbRoles.includes("admin") &&
    !dbRoles.includes("super_admin") &&
    !dbRoles.includes("responsable");

  const { data: profileId } = useQuery({
    queryKey: ["my-profile-id", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.id ?? null;
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
