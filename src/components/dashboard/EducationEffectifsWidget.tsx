import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, BookOpen, LayoutGrid, GraduationCap, Loader2 } from "lucide-react";
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
      if (isTeacher) {
        const [enrollmentsRes, subjectsRes] = await Promise.all([
          supabase
            .from("madrasa_enrollments")
            .select("student_id, madrasa_students(niveau)")
            .eq("org_id", orgId!)
            .eq("statut", "Actif")
            .in("class_id", teacherClassIds),
          supabase
            .from("madrasa_class_subjects")
            .select("subject_id")
            .in("class_id", teacherClassIds),
        ]);

        const byLevel: Record<string, number> = {};
        const seen = new Set<string>();
        (enrollmentsRes.data ?? []).forEach((e: any) => {
          if (seen.has(e.student_id)) return;
          seen.add(e.student_id);
          const key = e.madrasa_students?.niveau ?? "Non défini";
          byLevel[key] = (byLevel[key] ?? 0) + 1;
        });

        const uniqueSubjects = new Set((subjectsRes.data ?? []).map((s) => s.subject_id));

        return {
          total: seen.size,
          classCount: teacherClassIds.length,
          subjectCount: uniqueSubjects.size,
          levelCount: Object.keys(byLevel).length,
          byLevel: Object.entries(byLevel)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5),
        };
      }

      // Admin view
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
        classCount: null,
        subjectCount: null,
        levelCount: null,
        byLevel: Object.entries(byLevel)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5),
      };
    },
  });

  // ── Teacher: waiting for class assignment ──
  if (isTeacher && teacherClassIds.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card h-full flex flex-col items-center justify-center text-center gap-3 py-8"
      >
        <div className="rounded-full bg-muted p-3">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Initialisation</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            En attente d'assignation de vos classes par l'administration
          </p>
        </div>
      </motion.div>
    );
  }

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
            {isTeacher ? "Ma Communauté" : "Effectifs Élèves"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTeacher ? "Élèves de mes classes" : "Répartition par niveau"}
          </p>
        </div>
        <Users className="h-4 w-4 text-primary" />
      </div>

      <p className="text-3xl font-bold mb-3">
        {data.total}
        <span className="text-sm font-normal text-muted-foreground ml-1.5">
          {data.total <= 1 ? "élève" : "élèves"}
        </span>
      </p>

      {/* ── Teacher KPI bar ── */}
      {isTeacher && data.classCount != null && (
        <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 rounded-lg bg-muted/50">
          {[
            { icon: LayoutGrid, label: "Classes", value: data.classCount },
            { icon: BookOpen, label: "Matières", value: data.subjectCount ?? 0 },
            { icon: GraduationCap, label: "Niveaux", value: data.levelCount ?? 0 },
          ].map((kpi) => (
            <div key={kpi.label} className="flex flex-col items-center text-center gap-0.5">
              <kpi.icon className="h-3.5 w-3.5 text-primary mb-0.5" />
              <span className="text-lg font-bold leading-none">{kpi.value}</span>
              <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Level breakdown ── */}
      <div className="space-y-2">
        {data.byLevel.map(([level, count]) => (
          <div key={level} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground truncate mr-2 flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3 text-primary/60 shrink-0" />
              {level}
            </span>
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
