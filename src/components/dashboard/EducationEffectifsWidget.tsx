import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { Skeleton } from "@/components/ui/skeleton";

export function EducationEffectifsWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, teacherClassIds } = useTeacherScope();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-effectifs", orgId, isTeacher, teacherClassIds],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    queryFn: async () => {
      if (isTeacher && teacherClassIds.length > 0) {
        // Only students enrolled in teacher's classes
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("student_id, madrasa_students(niveau)")
          .eq("org_id", orgId!)
          .eq("statut", "Actif")
          .in("class_id", teacherClassIds);

        const byLevel: Record<string, number> = {};
        const seen = new Set<string>();
        (enrollments ?? []).forEach((e: any) => {
          if (seen.has(e.student_id)) return;
          seen.add(e.student_id);
          const key = e.madrasa_students?.niveau ?? "Non défini";
          byLevel[key] = (byLevel[key] ?? 0) + 1;
        });

        return {
          total: seen.size,
          byLevel: Object.entries(byLevel)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5),
        };
      }

      // Admin view: all students
      const { data: students } = await supabase
        .from("madrasa_students")
        .select("niveau")
        .eq("org_id", orgId!);

      const byLevel: Record<string, number> = {};
      (students ?? []).forEach((s) => {
        const key = s.niveau ?? "Non défini";
        byLevel[key] = (byLevel[key] ?? 0) + 1;
      });

      return {
        total: students?.length ?? 0,
        byLevel: Object.entries(byLevel)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5),
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">
            {isTeacher ? "Mes Élèves" : "Effectifs Élèves"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTeacher ? "Élèves de mes classes" : "Répartition par niveau"}
          </p>
        </div>
        <Users className="h-4 w-4 text-primary" />
      </div>

      <p className="text-3xl font-bold mb-3">{data.total}</p>

      <div className="space-y-2">
        {data.byLevel.map(([level, count]) => (
          <div key={level} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground truncate mr-2">{level}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-primary/20 w-20">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (count / data.total) * 100)}%` }}
                />
              </div>
              <span className="font-medium w-6 text-right">{count}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
