import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { useTeacherFilter } from "@/contexts/TeacherFilterContext";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileWarning, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EvalAlert {
  evalId: string;
  evalTitle: string;
  className: string;
  classId: string;
  gradeCount: number;
  studentCount: number;
}

export function EvalVigilanceWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, teacherClassIds } = useTeacherScope();
  const { isSuperAdmin } = useRole();
  const { selectedClassId } = useTeacherFilter();
  const navigate = useNavigate();

  const isAdmin = isSuperAdmin;
  const canShow = isTeacher || isAdmin;

  const filterClassIds = selectedClassId ? [selectedClassId] : (isTeacher ? teacherClassIds : []);

  const { data, isLoading } = useQuery({
    queryKey: ["edu-eval-vigilance", orgId, filterClassIds, isAdmin],
    enabled: !!orgId && canShow && (isAdmin || filterClassIds.length > 0),
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let evalQuery = supabase
        .from("madrasa_evaluations")
        .select("id, title, class_id, madrasa_classes(nom)")
        .eq("org_id", orgId!)
        .eq("status", "published");

      if (filterClassIds.length > 0) {
        evalQuery = evalQuery.in("class_id", filterClassIds);
      }

      const { data: evals, error: evalErr } = await evalQuery;
      if (evalErr) throw evalErr;
      if (!evals || evals.length === 0) return [];

      const evalIds = evals.map((e) => e.id);
      const classIds = [...new Set(evals.map((e) => e.class_id))];

      const { data: grades } = await supabase
        .from("madrasa_grades")
        .select("evaluation_id, student_id")
        .eq("org_id", orgId!)
        .in("evaluation_id", evalIds);

      const gradeCountMap: Record<string, Set<string>> = {};
      for (const g of grades ?? []) {
        if (!gradeCountMap[g.evaluation_id]) gradeCountMap[g.evaluation_id] = new Set();
        gradeCountMap[g.evaluation_id].add(g.student_id);
      }

      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("class_id")
        .eq("org_id", orgId!)
        .in("class_id", classIds)
        .in("statut", ["place", "Actif"]);

      const enrollCountMap: Record<string, number> = {};
      for (const e of enrollments ?? []) {
        if (e.class_id) enrollCountMap[e.class_id] = (enrollCountMap[e.class_id] ?? 0) + 1;
      }

      const alerts: EvalAlert[] = [];
      for (const ev of evals as any[]) {
        const gradeStudents = gradeCountMap[ev.id]?.size ?? 0;
        const totalStudents = enrollCountMap[ev.class_id] ?? 0;
        if (totalStudents > 0 && gradeStudents < totalStudents) {
          alerts.push({
            evalId: ev.id,
            evalTitle: ev.title,
            className: ev.madrasa_classes?.nom ?? "Classe",
            classId: ev.class_id,
            gradeCount: gradeStudents,
            studentCount: totalStudents,
          });
        }
      }
      return alerts;
    },
  });

  if (!canShow) return null;
  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const alerts = data ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-blue-500" />
          Examens à Finaliser
          {alerts.length > 0 && (
            <Badge className="text-[10px] h-4 px-1.5 ml-auto bg-blue-500/15 text-blue-700 border border-blue-500/30">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Star className="h-8 w-8 mb-2 text-blue-400/40" />
            <p className="text-sm font-medium">Tout est à jour, bon travail ! 🌟</p>
            <p className="text-xs mt-1">Toutes les notes ont été saisies.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <button
                key={a.evalId}
                onClick={() => navigate(`/evaluations?evalId=${a.evalId}&classId=${a.classId}`)}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer"
              >
                <FileWarning className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">
                    {a.evalTitle} — {a.className}
                  </p>
                  <p className="text-[11px] text-blue-600">
                    {a.gradeCount}/{a.studentCount} notes saisies
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-blue-400/40 text-blue-600 shrink-0">
                  Compléter
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
