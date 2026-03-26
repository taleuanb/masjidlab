import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function EducationAlertesWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, teacherClassIds } = useTeacherScope();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-alertes-presence", orgId, isTeacher, teacherClassIds],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    queryFn: async () => {
      // Get settings threshold
      const { data: settings } = await supabase
        .from("madrasa_settings")
        .select("attendance_threshold")
        .eq("org_id", orgId!)
        .maybeSingle();

      const threshold = settings?.attendance_threshold ?? 3;

      // Count absences per enrollment, filtered by teacher's classes if applicable
      let absQuery = supabase
        .from("madrasa_attendance")
        .select("enrollment_id, class_id")
        .eq("org_id", orgId!)
        .eq("status", "absent");

      if (isTeacher && teacherClassIds.length > 0) {
        absQuery = absQuery.in("class_id", teacherClassIds);
      }

      const { data: absences } = await absQuery;

      const countByEnrollment: Record<string, number> = {};
      (absences ?? []).forEach((a) => {
        countByEnrollment[a.enrollment_id] = (countByEnrollment[a.enrollment_id] ?? 0) + 1;
      });

      const alertEnrollmentIds = Object.entries(countByEnrollment)
        .filter(([, count]) => count >= threshold)
        .map(([id]) => id);

      if (alertEnrollmentIds.length === 0) return { alerts: [], threshold };

      // Get student names via enrollments
      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("id, student_id, madrasa_students(nom, prenom)")
        .in("id", alertEnrollmentIds.slice(0, 10));

      const alerts = (enrollments ?? []).map((e: any) => ({
        enrollmentId: e.id,
        name: `${e.madrasa_students?.prenom ?? ""} ${e.madrasa_students?.nom ?? ""}`.trim(),
        absences: countByEnrollment[e.id] ?? 0,
      }));

      return { alerts, threshold };
    },
  });

  if (isLoading) return <Skeleton className="h-36 rounded-xl" />;
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">
            {isTeacher ? "Absences à suivre (Mes classes)" : "Alertes Présence"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seuil : {data.threshold} absences
          </p>
        </div>
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>

      {data.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucune alerte — tous les élèves sont assidus ✅
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.alerts.map((a) => (
            <div
              key={a.enrollmentId}
              className="flex items-center justify-between rounded-lg border bg-destructive/5 px-3 py-2"
            >
              <span className="text-sm font-medium truncate mr-2">{a.name}</span>
              <Badge variant="destructive" className="text-[10px] shrink-0">
                {a.absences} abs.
              </Badge>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
