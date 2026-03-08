import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

export function EducationWidget() {
  const { orgId } = useOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-education", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [
        { count: studentsCount },
        { count: classesCount },
        { data: recentEnrollments },
      ] = await Promise.all([
        supabase.from("madrasa_students").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("madrasa_classes").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase
          .from("madrasa_enrollments")
          .select("id, annee_scolaire, statut, created_at")
          .eq("org_id", orgId!)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const activeEnrollments = (recentEnrollments ?? []).filter((e) => e.statut === "Actif").length;

      return {
        students: studentsCount ?? 0,
        classes: classesCount ?? 0,
        recentEnrollments: recentEnrollments ?? [],
        activeEnrollments,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  const stats = [
    { label: "Élèves", value: data.students, icon: Users, color: "text-primary" },
    { label: "Classes", value: data.classes, icon: BookOpen, color: "text-amber-600" },
    { label: "Inscrits actifs", value: data.activeEnrollments, icon: GraduationCap, color: "text-primary" },
  ];

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Éducation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Programme Madrasa</p>
        </div>
        <GraduationCap className="h-4 w-4 text-primary" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center rounded-lg border bg-card p-3"
          >
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
