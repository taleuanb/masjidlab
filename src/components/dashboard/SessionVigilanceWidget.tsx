import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { useTeacherFilter } from "@/contexts/TeacherFilterContext";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ClipboardEdit, Phone, Star } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface VigilanceSession {
  id: string;
  class_id: string;
  date: string;
  summary_note: string | null;
  attendance_count: number | null;
  status: string | null;
  madrasa_classes: { nom: string } | null;
}

export function SessionVigilanceWidget() {
  const { orgId } = useOrganization();
  const { isTeacher, profileId, teacherClassIds } = useTeacherScope();
  const { isSuperAdmin } = useRole();
  const { selectedClassId } = useTeacherFilter();
  const navigate = useNavigate();

  const isAdmin = isSuperAdmin;
  const canShow = isTeacher || isAdmin;

  // For teachers: filter by their classes. For admins: show all (or selected class).
  const filterClassIds = selectedClassId ? [selectedClassId] : (isTeacher ? teacherClassIds : []);

  const { data, isLoading } = useQuery({
    queryKey: ["edu-session-vigilance", orgId, profileId, filterClassIds, isAdmin],
    enabled: !!orgId && canShow && (isAdmin || (!!profileId && filterClassIds.length > 0)),
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      let query = supabase
        .from("madrasa_sessions")
        .select("id, class_id, date, summary_note, attendance_count, status, madrasa_classes(nom)")
        .eq("org_id", orgId!)
        .lt("date", today)
        .order("date", { ascending: false })
        .limit(20);

      // Teacher: filter by their profile + classes
      if (isTeacher && profileId) {
        query = query.eq("actual_teacher_id", profileId);
        if (filterClassIds.length > 0) {
          query = query.in("class_id", filterClassIds);
        }
      } else if (filterClassIds.length > 0) {
        // Admin with a class selected
        query = query.in("class_id", filterClassIds);
      }

      const { data: sessions, error } = await query;
      if (error) throw error;

      const alerts: Array<VigilanceSession & { reason: string }> = [];
      for (const s of (sessions ?? []) as unknown as VigilanceSession[]) {
        if (!s.summary_note || s.summary_note.trim() === "") {
          alerts.push({ ...s, reason: "Résumé manquant" });
        } else if (s.attendance_count === 0) {
          alerts.push({ ...s, reason: "Appel non fait" });
        }
      }
      return alerts.slice(0, 8);
    },
  });

  if (!canShow) return null;
  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const alerts = data ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {isTeacher ? "Vigilance — Mes Sessions" : "Vigilance — Sessions"}
          {alerts.length > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5 ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Star className="h-8 w-8 mb-2 text-amber-400/40" />
            <p className="text-sm font-medium">Tout est à jour, bon travail ! 🌟</p>
            <p className="text-xs mt-1">Aucune session en attente de complétion.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/appel?class=${s.class_id}`)}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                {s.reason === "Résumé manquant" ? (
                  <ClipboardEdit className="h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <Phone className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">
                    {s.madrasa_classes?.nom ?? "Classe"} — {format(new Date(s.date), "d MMM", { locale: fr })}
                  </p>
                  <p className="text-[11px] text-amber-700">{s.reason}</p>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-400/40 text-amber-600 shrink-0">
                  Action requise
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
