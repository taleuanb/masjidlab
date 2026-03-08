import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

function getHealthColor(statut: string) {
  if (statut === "En panne") return { bar: "bg-destructive", text: "text-destructive", label: "En panne", icon: AlertTriangle };
  if (statut === "En maintenance") return { bar: "bg-amber-500", text: "text-amber-600", label: "Maintenance", icon: AlertTriangle };
  return { bar: "bg-primary", text: "text-primary", label: "OK", icon: CheckCircle2 };
}

export function AssetsWidget() {
  const { orgId } = useOrganization();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["dashboard-assets", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, nom, type, statut, description")
        .eq("org_id", orgId!)
        .order("nom")
        .limit(8);
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-56 rounded-xl" />;

  const items = assets ?? [];
  const alertCount = items.filter((a) => a.statut !== "Disponible").length;

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Inventaire</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} équipement{items.length > 1 ? "s" : ""} · {alertCount} alerte{alertCount > 1 ? "s" : ""}
          </p>
        </div>
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun équipement enregistré</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item, i) => {
            const health = getHealthColor(item.statut);
            const HealthIcon = health.icon;
            return (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <HealthIcon className={`h-3.5 w-3.5 ${health.text}`} />
                    <span className="font-medium truncate">{item.nom}</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      item.statut === "Disponible"
                        ? "bg-primary/10 text-primary"
                        : item.statut === "En panne"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {health.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{item.type}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
