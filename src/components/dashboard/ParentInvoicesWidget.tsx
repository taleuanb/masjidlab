import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Check, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useParentData } from "@/hooks/useParentData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string; icon: typeof Check; cls: string }> = {
  paid: { label: "Payé", icon: Check, cls: "bg-secondary text-secondary-foreground" },
  pending: { label: "En attente", icon: Clock, cls: "bg-primary/10 text-primary" },
  overdue: { label: "Retard", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
};

export function ParentInvoicesWidget() {
  const { orgId } = useOrganization();
  const { data: students } = useParentData();
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: fees, isLoading } = useQuery({
    queryKey: ["parent-invoices", orgId, studentIds],
    enabled: !!orgId && studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_fees")
        .select("id, amount, due_date, status, student_id")
        .eq("org_id", orgId!)
        .in("student_id", studentIds)
        .order("due_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Prochaines Échéances</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Frais de scolarité</p>
        </div>
        <Receipt className="h-4 w-4 text-primary" />
      </div>

      {!fees || fees.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground italic">
            Aucune échéance à venir. Tout est à jour ✓
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {fees.map((fee) => {
            const student = studentMap.get(fee.student_id);
            const cfg = STATUS_MAP[fee.status] ?? STATUS_MAP.pending;
            const StatusIcon = cfg.icon;
            return (
              <div key={fee.id} className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <StatusIcon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {student ? `${student.prenom} ${student.nom}` : "Élève"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(fee.due_date), "dd MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{Number(fee.amount).toLocaleString("fr-FR")} €</p>
                  <Badge className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
