import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useCurrentAcademicYear() {
  const { orgId } = useOrganization();

  const { data } = useQuery({
    queryKey: ["current_academic_year", orgId],
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30, // 30 min cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_academic_years")
        .select("id, label")
        .eq("org_id", orgId!)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    yearId: data?.id ?? null,
    yearLabel: data?.label ?? null,
  };
}
