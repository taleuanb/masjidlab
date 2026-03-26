import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldAlert, Clock, AlertTriangle, ClipboardEdit, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export function EducationVigilanceWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, profileId, teacherClassIds } = useTeacherScope();
  const navigate = useNavigate();


  const { data, isLoading } = useQuery({
    queryKey: ["edu-vigilance", orgId, isTeacher, profileId],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      // Sessions pending today (not completed)
      let pendingQuery = supabase
        .from("madrasa_sessions")
        .select("id, class_id, date, status, summary_note, madrasa_classes(nom)")
        .eq("org_id", orgId!)
        .eq("date", today)
        .neq("status", "completed");

      if (isTeacher) {
        pendingQuery = pendingQuery.eq("actual_teacher_id", profileId!);
      }

      const { data: pending } = await pendingQuery;

      // Sessions completed without summary_note (bilan missing)
      let bilanQuery = supabase
        .from("madrasa_sessions")
        .select("id, class_id, date, status, summary_note, madrasa_classes(nom)")
        .eq("org_id", orgId!)
        .eq("status", "completed")
        .is("summary_note", null)
        .order("date", { ascending: false })
        .limit(5);

      if (isTeacher) {
        bilanQuery = bilanQuery.eq("actual_teacher_id", profileId!);
      }

      const { data: missingBilan } = await bilanQuery;

      // Sessions completed with low rating
      let lowQuery = supabase
        .from("madrasa_sessions")
        .select("id, class_id, average_rating, date, madrasa_classes(nom)")
        .eq("org_id", orgId!)
        .eq("status", "completed")
        .lt("average_rating", 2.5)
        .order("completed_at", { ascending: false })
        .limit(5);

      if (isTeacher) {
        lowQuery = lowQuery.eq("actual_teacher_id", profileId!);
      }

      const { data: lowRated } = await lowQuery;

      return {
        pendingCount: pending?.length ?? 0,
        pendingSessions: (pending ?? []).slice(0, 3) as any[],
        missingBilanSessions: (missingBilan ?? []) as any[],
        lowRatedSessions: (lowRated ?? []) as any[],
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  const hasMissingBilan = data.missingBilanSessions.length > 0;
  const hasAlerts = data.pendingCount > 0 || data.lowRatedSessions.length > 0 || hasMissingBilan;

  const openBilan = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate directly to attendance page with the class pre-selected
    navigate(`/appel?class=${s.class_id}`);
  };

  const goToAttendance = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/appel?class=${classId}`);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bento-card h-full flex flex-col"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-1.5">
                {isTeacher ? "Mes points de vigilance" : "Points de vigilance"}
                {hasMissingBilan && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold animate-pulse">
                    {data.missingBilanSessions.length}
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isTeacher ? "Élèves de vos classes nécessitant une attention particulière." : "Suivi temps réel"}
              </p>
            </div>
          </div>
          <ShieldAlert className={`h-4 w-4 ${hasAlerts ? "text-destructive" : "text-muted-foreground"}`} />
        </div>

        {!hasAlerts ? (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-muted-foreground">
            <ShieldAlert className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">Tout est en ordre ✅</p>
            <p className="text-xs mt-0.5">Aucun point de vigilance pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto">
            {/* Pending sessions today */}
            {data.pendingCount > 0 && (
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-xs font-semibold text-accent-foreground">
                    {data.pendingCount} séance{data.pendingCount > 1 ? "s" : ""} en attente
                  </span>
                </div>
                <div className="space-y-1.5">
                  {data.pendingSessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between pl-5 py-0.5 rounded hover:bg-accent/30 transition-colors cursor-pointer" onClick={(e) => goToAttendance(s.class_id, e)}>
                      <p className="text-xs text-muted-foreground truncate">
                        • {s.madrasa_classes?.nom ?? "Classe"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-primary gap-1 cursor-pointer"
                        onClick={(e) => goToAttendance(s.class_id, e)}
                      >
                        <Phone className="h-3 w-3" />
                        Faire l'appel
                      </Button>
                    </div>
                  ))}
                  {data.pendingCount > 3 && (
                    <p className="text-xs text-muted-foreground pl-5 italic">
                      +{data.pendingCount - 3} autre{data.pendingCount - 3 > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Missing bilans */}
            {hasMissingBilan && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardEdit className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">
                    {data.missingBilanSessions.length} bilan{data.missingBilanSessions.length > 1 ? "s" : ""} à saisir
                  </span>
                </div>
                <div className="space-y-1.5">
                  {data.missingBilanSessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between pl-5 py-0.5 rounded hover:bg-amber-500/10 transition-colors cursor-pointer" onClick={(e) => openBilan(s, e)}>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.madrasa_classes?.nom ?? "Classe"} — {format(new Date(s.date), "dd/MM")}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-amber-700 gap-1 hover:bg-amber-500/10 cursor-pointer"
                        onClick={(e) => openBilan(s, e)}
                      >
                        <ClipboardEdit className="h-3 w-3" />
                        Bilan
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low rated sessions */}
            {data.lowRatedSessions.length > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-semibold text-destructive">
                    Séances avec moyenne critique (&lt; 2.5/5)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {data.lowRatedSessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between pl-5">
                      <p className="text-xs text-muted-foreground truncate">
                        {s.madrasa_classes?.nom ?? "Classe"}
                      </p>
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">
                        ⭐ {Number(s.average_rating).toFixed(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
}
