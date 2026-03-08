import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Banknote, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export function EducationFinanceWidget() {
  const { orgId } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-finance", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: fees } = await supabase
        .from("madrasa_fees")
        .select("amount, status")
        .eq("org_id", orgId!);

      const items = fees ?? [];
      const total = items.reduce((s, f) => s + Number(f.amount), 0);
      const paid = items.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
      const pending = items.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
      const overdue = items.filter((f) => f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
      const rate = total > 0 ? Math.round((paid / total) * 100) : 0;

      return { total, paid, pending, overdue, rate, count: items.length };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  const TrendIcon = data.rate >= 70 ? TrendingUp : TrendingDown;
  const trendCls = data.rate >= 70 ? "text-primary" : "text-destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">Frais Scolaires</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{data.count} échéance{data.count > 1 ? "s" : ""}</p>
        </div>
        <Banknote className="h-4 w-4 text-primary" />
      </div>

      {/* Recouvrement rate */}
      <div className="flex items-end gap-2 mb-1">
        <span className="text-3xl font-bold">{data.rate}%</span>
        <TrendIcon className={`h-5 w-5 mb-1 ${trendCls}`} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">Taux de recouvrement</p>
      <Progress value={data.rate} className="h-2 mb-4" />

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Payé", value: data.paid, cls: "text-primary" },
          { label: "En attente", value: data.pending, cls: "text-muted-foreground" },
          { label: "Impayé", value: data.overdue, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="text-center rounded-lg border bg-card p-2">
            <p className={`text-sm font-bold ${s.cls}`}>{s.value.toLocaleString("fr-FR")} €</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {data.overdue > 0 && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{data.overdue.toLocaleString("fr-FR")} € d'impayés à relancer</span>
        </div>
      )}
    </motion.div>
  );
}
