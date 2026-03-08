import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ClipboardList, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  Actif: { label: "Actifs", icon: CheckCircle2, cls: "text-emerald-600" },
  "En attente": { label: "En attente", icon: Clock, cls: "text-amber-500" },
  Suspendu: { label: "Suspendus", icon: XCircle, cls: "text-destructive" },
};

export function EducationInscriptionsWidget() {
  const { orgId } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-inscriptions", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("statut")
        .eq("org_id", orgId!);

      const byStatus: Record<string, number> = {};
      (enrollments ?? []).forEach((e) => {
        const key = e.statut ?? "Actif";
        byStatus[key] = (byStatus[key] ?? 0) + 1;
      });

      return {
        total: enrollments?.length ?? 0,
        byStatus,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Inscriptions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Dossiers année en cours</p>
        </div>
        <ClipboardList className="h-4 w-4 text-primary" />
      </div>

      <p className="text-3xl font-bold mb-3">{data.total}</p>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = data.byStatus[key] ?? 0;
          return (
            <div key={key} className="text-center rounded-lg border bg-card p-2.5">
              <cfg.icon className={`h-4 w-4 mx-auto mb-1 ${cfg.cls}`} />
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
