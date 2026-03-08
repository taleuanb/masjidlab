import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { HandCoins, TrendingUp, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

export function FinanceWidget() {
  const { orgId } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-finance", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: donations } = await supabase
        .from("donations")
        .select("montant, date_don, methode_paiement")
        .eq("org_id", orgId!)
        .order("date_don", { ascending: false })
        .limit(5);

      const { data: transactions } = await supabase
        .from("finance_transactions")
        .select("montant, type, titre, date_transaction")
        .eq("org_id", orgId!)
        .order("date_transaction", { ascending: false })
        .limit(3);

      const totalDons = (donations ?? []).reduce((s, d) => s + Number(d.montant), 0);
      return { donations: donations ?? [], transactions: transactions ?? [], totalDons };
    },
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (!data || (data.donations.length === 0 && data.transactions.length === 0)) {
    return (
      <div className="bento-card gradient-emerald-subtle flex flex-col items-center justify-center py-14">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Aucune activité financière</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Aucun don ou transaction enregistré</p>
      </div>
    );
  }

  return (
    <div className="bento-card gradient-emerald-subtle">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Finance & Récoltes</h3>
        <HandCoins className="h-4 w-4 text-primary" />
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold tracking-tight text-gradient-brand">
          {data.totalDons.toLocaleString("fr-FR")} €
        </p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          Total des dons enregistrés
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dernières entrées</p>
        {data.donations.slice(0, 3).map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between text-sm"
          >
            <div>
              <span className="font-medium">{d.methode_paiement ?? "Don"}</span>
              {d.date_don && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {new Date(d.date_don).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            <span className="font-semibold tabular-nums">+{Number(d.montant).toLocaleString("fr-FR")} €</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
