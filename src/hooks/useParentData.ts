import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";

export interface ParentStudent {
  id: string;
  nom: string;
  prenom: string;
  niveau: string | null;
  class_id: string | null;
  class_nom: string | null;
}

export function useParentData() {
  const { orgId } = useOrganization();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["parent-students", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    queryFn: async (): Promise<ParentStudent[]> => {
      if (!orgId || !user?.id) throw new Error("Contexte manquant");

      // 1. Get profile id for the logged-in user
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .maybeSingle();

      if (!profile) return [];

      // 2. Get students linked to this parent
      const { data: students, error } = await supabase
        .from("madrasa_students")
        .select("id, nom, prenom, niveau")
        .eq("org_id", orgId)
        .eq("parent_id", profile.id);

      if (error) throw error;
      if (!students || students.length === 0) return [];

      // 3. Fetch enrollments for class info
      const studentIds = students.map((s) => s.id);
      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("student_id, class_id, madrasa_classes(nom)")
        .eq("org_id", orgId)
        .in("student_id", studentIds);

      const enrollMap: Record<string, { class_id: string; class_nom: string }> = {};
      for (const e of enrollments ?? []) {
        const cls = e.madrasa_classes as any;
        enrollMap[e.student_id] = { class_id: e.class_id, class_nom: cls?.nom ?? null };
      }

      return students.map((s) => ({
        id: s.id,
        nom: s.nom,
        prenom: s.prenom,
        niveau: s.niveau,
        class_id: enrollMap[s.id]?.class_id ?? null,
        class_nom: enrollMap[s.id]?.class_nom ?? null,
      }));
    },
  });
}
