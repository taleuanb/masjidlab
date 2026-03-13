import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

export interface FeeRow {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  student_id: string;
  student_nom: string;
  student_prenom: string;
  class_nom: string | null;
  class_id: string | null;
}

export function useMadrasaFees() {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

  const feesQuery = useQuery({
    queryKey: ["madrasa-fees", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<FeeRow[]> => {
      if (!orgId) throw new Error("org_id manquant");

      const { data, error } = await supabase
        .from("madrasa_fees")
        .select("id, amount, due_date, status, student_id, madrasa_students(nom, prenom)")
        .eq("org_id", orgId);

      if (error) throw error;

      // Fetch enrollments to map student → class
      const studentIds = [...new Set((data ?? []).map((f) => f.student_id))];
      let enrollmentMap: Record<string, { class_id: string; class_nom: string }> = {};

      if (studentIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("student_id, class_id, madrasa_classes(nom)")
          .eq("org_id", orgId)
          .in("student_id", studentIds);

        for (const e of enrollments ?? []) {
          const cls = e.madrasa_classes as any;
          enrollmentMap[e.student_id] = {
            class_id: e.class_id,
            class_nom: cls?.nom ?? null,
          };
        }
      }

      return (data ?? []).map((f) => {
        const student = f.madrasa_students as any;
        const enrollment = enrollmentMap[f.student_id];
        return {
          id: f.id,
          amount: Number(f.amount),
          due_date: f.due_date,
          status: f.status,
          student_id: f.student_id,
          student_nom: student?.nom ?? "",
          student_prenom: student?.prenom ?? "",
          class_nom: enrollment?.class_nom ?? null,
          class_id: enrollment?.class_id ?? null,
        };
      });
    },
  });

  const encaisserMutation = useMutation({
    mutationFn: async ({ feeId, amount }: { feeId: string; amount: number }) => {
      if (!orgId) throw new Error("org_id manquant");

      const { error } = await supabase
        .from("madrasa_fees")
        .update({ status: "paid" })
        .eq("id", feeId)
        .eq("org_id", orgId);

      if (error) throw error;

      // Create finance transaction for traceability
      await supabase.from("finance_transactions").insert({
        org_id: orgId,
        titre: "Frais de scolarité",
        montant: amount,
        type: "recette",
        categorie: "Scolarité",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa-fees", orgId] });
      toast({ title: "Encaissement enregistré", description: "Le paiement a été validé avec succès." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer l'encaissement.", variant: "destructive" });
    },
  });

  return { ...feesQuery, fees: feesQuery.data ?? [], encaisser: encaisserMutation };
}
