import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Users, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { Skeleton } from "@/components/ui/skeleton";

export function EducationWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, profileId, teacherClassIds } = useTeacherScope();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-education", orgId, isTeacher, profileId],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    queryFn: async () => {
      if (isTeacher) {
        // Teacher: count students in their classes
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("student_id")
          .eq("org_id", orgId!)
          .eq("statut", "Actif")
          .in("class_id", teacherClassIds);

        const uniqueStudents = new Set((enrollments ?? []).map((e) => e.student_id));

        // Attendance rate for teacher's classes
        const { data: attendance } = await supabase
          .from("madrasa_attendance")
          .select("status")
          .eq("org_id", orgId!)
          .in("class_id", teacherClassIds);

        const total = attendance?.length ?? 0;
        const present = (attendance ?? []).filter((a) => a.status === "present" || a.status === "late").length;
        const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

        return {
          students: uniqueStudents.size,
          classes: teacherClassIds.length,
          attendanceRate,
          isTeacherView: true,
        };
      }

      // Admin view
      const [
        { count: studentsCount },
        { count: classesCount },
        { data: recentEnrollments },
      ] = await Promise.all([
        supabase.from("madrasa_students").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("madrasa_classes").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase
          .from("madrasa_enrollments")
          .select("id, statut")
          .eq("org_id", orgId!)
          .eq("statut", "Actif"),
      ]);

      return {
        students: studentsCount ?? 0,
        classes: classesCount ?? 0,
        activeEnrollments: recentEnrollments?.length ?? 0,
        isTeacherView: false,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  const stats = data.isTeacherView
    ? [
        { label: "Mes élèves", value: data.students, icon: Users, color: "text-primary" },
        { label: "Mes classes", value: data.classes, icon: BookOpen, color: "text-amber-600" },
        { label: "Taux présence", value: `${(data as any).attendanceRate}%`, icon: Activity, color: "text-secondary" },
      ]
    : [
        { label: "Élèves", value: data.students, icon: Users, color: "text-primary" },
        { label: "Classes", value: data.classes, icon: BookOpen, color: "text-amber-600" },
        { label: "Inscrits actifs", value: (data as any).activeEnrollments, icon: GraduationCap, color: "text-primary" },
      ];

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">
            {data.isTeacherView ? "Mon enseignement" : "Éducation"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.isTeacherView ? "Vue personnelle" : "Programme Madrasa"}
          </p>
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
