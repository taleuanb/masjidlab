import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useParentData } from "@/hooks/useParentData";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface StudentStats {
  prenom: string;
  nom: string;
  averageScore: number | null;
  attendanceRate: number;
}

export function StudentProgressWidget() {
  const { orgId } = useOrganization();
  const { data: students } = useParentData();
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["student-progress", orgId, studentIds],
    enabled: !!orgId && studentIds.length > 0,
    queryFn: async (): Promise<StudentStats[]> => {
      const results: StudentStats[] = [];

      for (const student of students ?? []) {
        // Grades
        const { data: grades } = await supabase
          .from("madrasa_grades")
          .select("score, madrasa_evaluations(max_points)")
          .eq("org_id", orgId!)
          .eq("student_id", student.id);

        let averageScore: number | null = null;
        if (grades && grades.length > 0) {
          const validGrades = grades.filter((g) => g.score !== null);
          if (validGrades.length > 0) {
            const totalPct = validGrades.reduce((sum, g) => {
              const max = (g.madrasa_evaluations as any)?.max_points ?? 20;
              return sum + ((g.score ?? 0) / max) * 100;
            }, 0);
            averageScore = Math.round(totalPct / validGrades.length);
          }
        }

        // Attendance via enrollment
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("id")
          .eq("org_id", orgId!)
          .eq("student_id", student.id);

        let attendanceRate = 100;
        if (enrollments && enrollments.length > 0) {
          const enrollmentIds = enrollments.map((e) => e.id);
          const { data: attendance } = await supabase
            .from("madrasa_attendance")
            .select("status")
            .eq("org_id", orgId!)
            .in("enrollment_id", enrollmentIds);

          if (attendance && attendance.length > 0) {
            const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
            attendanceRate = Math.round((present / attendance.length) * 100);
          }
        }

        results.push({
          prenom: student.prenom,
          nom: student.nom,
          averageScore,
          attendanceRate,
        });
      }

      return results;
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Suivi Scolaire</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Moyennes & assiduité</p>
        </div>
        <GraduationCap className="h-4 w-4 text-accent" />
      </div>

      {!stats || stats.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <GraduationCap className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground italic">
            Le voyage éducatif commence.<br />Les résultats apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((s) => (
            <div key={`${s.prenom}-${s.nom}`} className="rounded-lg border bg-card/50 p-3 space-y-2.5">
              <p className="text-sm font-semibold text-foreground">{s.prenom} {s.nom}</p>

              {/* Average */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> Moyenne
                  </span>
                  <span className="font-bold text-foreground">
                    {s.averageScore !== null ? `${s.averageScore}%` : "—"}
                  </span>
                </div>
                <Progress
                  value={s.averageScore ?? 0}
                  className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-secondary"
                />
              </div>

              {/* Attendance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Assiduité
                  </span>
                  <span className="font-bold text-foreground">{s.attendanceRate}%</span>
                </div>
                <Progress
                  value={s.attendanceRate}
                  className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-secondary"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
