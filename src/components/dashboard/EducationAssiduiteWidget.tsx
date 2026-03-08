import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

export function EducationAssiduiteWidget() {
  const { orgId } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-assiduite-radial", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: records } = await supabase
        .from("madrasa_attendance")
        .select("status")
        .eq("org_id", orgId!);

      const total = records?.length ?? 0;
      if (total === 0) return { rate: 0, present: 0, absent: 0, late: 0, excused: 0, total: 0 };

      const present = records!.filter((r) => r.status === "present").length;
      const absent = records!.filter((r) => r.status === "absent").length;
      const late = records!.filter((r) => r.status === "late").length;
      const excused = records!.filter((r) => r.status === "excused").length;

      return { rate: Math.round(((present + late) / total) * 100), present, absent, late, excused, total };
    },
  });

  if (isLoading) return <Skeleton className="h-52 rounded-xl" />;
  if (!data) return null;

  const { rate } = data;
  // SVG radial chart
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const rateColor = rate >= 80 ? "hsl(var(--primary))" : rate >= 50 ? "hsl(var(--accent))" : "hsl(var(--destructive))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card flex flex-col items-center"
    >
      <div className="flex items-center justify-between w-full mb-4">
        <div>
          <h3 className="text-base font-semibold">Assiduité</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{data.total} relevés enregistrés</p>
        </div>
        <Activity className="h-4 w-4 text-primary" />
      </div>

      {/* Radial chart */}
      <div className="relative">
        <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
          <circle
            cx="65" cy="65" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          <motion.circle
            cx="65" cy="65" r={radius}
            fill="none"
            stroke={rateColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{rate}%</span>
          <span className="text-[10px] text-muted-foreground">présence</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-4 gap-2 w-full mt-4 text-center">
        {[
          { label: "Présent", value: data.present, cls: "text-primary" },
          { label: "Retard", value: data.late, cls: "text-accent-foreground" },
          { label: "Excusé", value: data.excused, cls: "text-muted-foreground" },
          { label: "Absent", value: data.absent, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label}>
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
