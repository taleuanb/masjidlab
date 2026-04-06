import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface StudentFeeSummary {
  student_id: string;
  nom: string;
  prenom: string;
  classe_nom: string | null;
  total_annuel: number;
  total_paye: number;
  solde_restant: number;
  nb_echeances: number;
  nb_retards: number;
}

export function useStudentFeesSummary() {
  const { orgId } = useOrganization();

  return useQuery({
    queryKey: ["student-fees-summary", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<StudentFeeSummary[]> => {
      if (!orgId) throw new Error("org_id manquant");

      const { data, error } = await supabase
        .from("view_student_fees_summary")
        .select("*")
        .eq("org_id", orgId);

      if (error) throw error;

      return (data ?? []).map((row) => ({
        student_id: row.student_id!,
        nom: row.nom ?? "",
        prenom: row.prenom ?? "",
        classe_nom: row.classe_nom,
        total_annuel: Number(row.total_annuel ?? 0),
        total_paye: Number(row.total_paye ?? 0),
        solde_restant: Number(row.solde_restant ?? 0),
        nb_echeances: Number(row.nb_echeances ?? 0),
        nb_retards: Number(row.nb_retards ?? 0),
      }));
    },
  });
}
