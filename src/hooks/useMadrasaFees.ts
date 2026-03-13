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
    mutationFn: async ({ feeId, amount, studentNom, studentPrenom, dueDate }: {
      feeId: string; amount: number; studentNom: string; studentPrenom: string; dueDate: string;
    }) => {
      if (!orgId) throw new Error("org_id manquant");

      // 1. Create finance transaction first (if this fails, fee stays untouched)
      const { data: txData, error: txError } = await supabase.from("finance_transactions").insert({
        org_id: orgId,
        titre: `Paiement frais scolaires : ${studentPrenom} ${studentNom} - ${dueDate}`,
        montant: amount,
        type: "recette",
        categorie: "Scolarité",
      }).select("id").single();

      if (txError) {
        console.error("Erreur insertion finance_transactions:", txError);
        throw new Error(`Échec écriture comptable : ${txError.message}`);
      }

      // 2. Only then update fee status + link transaction_id
      const { error: feeError } = await supabase
        .from("madrasa_fees")
        .update({ status: "paid", transaction_id: txData.id })
        .eq("id", feeId)
        .eq("org_id", orgId);

      if (feeError) {
        console.error("Erreur mise à jour madrasa_fees:", feeError);
        throw new Error(`Échec mise à jour du frais : ${feeError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa-fees", orgId] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast({ title: "Encaissement réussi ✓", description: "Le paiement a été validé et enregistré en comptabilité." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur d'encaissement", description: error.message, variant: "destructive" });
    },
  });

  return { ...feesQuery, fees: feesQuery.data ?? [], encaisser: encaisserMutation };
}
