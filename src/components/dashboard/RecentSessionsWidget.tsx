import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Activity, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";

interface SessionRow {
  id: string;
  class_id: string;
  date: string;
  summary_note: string | null;
  attendance_count: number | null;
  average_rating: number | null;
  completed_at: string | null;
  madrasa_classes: { nom: string; niveau: string | null; prof_id: string | null } | null;
  profiles: { display_name: string } | null;
}

export function RecentSessionsWidget() {
  const { orgId } = useOrganization();
  const navigate = useNavigate();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["recent-completed-sessions", orgId],
    enabled: !!orgId,
    staleTime: 2 * 60_000,
    refetchInterval: 60_000, // auto-refresh every minute
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_sessions")
        .select(`
          id, class_id, date, summary_note, attendance_count, average_rating, completed_at,
          madrasa_classes(nom, niveau, prof_id),
          profiles:actual_teacher_id(display_name)
        `)
        .eq("org_id", orgId!)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as unknown as SessionRow[];
    },
  });

  // Fetch total enrolled per class for attendance percentage
  const classIds = sessions?.map((s) => s.class_id).filter(Boolean) ?? [];
  const { data: enrollmentCounts } = useQuery({
    queryKey: ["enrollment-counts", classIds.join(",")],
    enabled: classIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("class_id")
        .in("class_id", classIds)
        .eq("statut", "Actif");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const openSessionDetail = (session: SessionRow) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activité des Classes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Aucune séance clôturée récemment</p>
            <p className="text-xs mt-1">Les bilans apparaîtront ici après la première clôture.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activité des Classes
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2"
            onClick={() => navigate("/classes")}
          >
            Voir tout
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {sessions.map((session, idx) => {
            const totalEnrolled = enrollmentCounts?.[session.class_id] ?? 0;
            const attendanceRate =
              totalEnrolled > 0
                ? Math.round(((session.attendance_count ?? 0) / totalEnrolled) * 100)
                : null;
            const rating = session.average_rating ?? 0;
            const isAlert =
              rating < 3 || (attendanceRate !== null && attendanceRate < 50);

            return (
              <div key={session.id}>
                <button
                  onClick={() => openSessionDetail(session)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50 ${
                    isAlert ? "bg-destructive/[0.05]" : ""
                  }`}
                >
                  {/* Line 1: Class name + time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isAlert && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-semibold truncate">
                        {session.madrasa_classes?.nom ?? "Classe"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {session.completed_at
                        ? format(new Date(session.completed_at), "d MMM · HH:mm", { locale: fr })
                        : format(new Date(session.date), "d MMM", { locale: fr })}
                    </span>
                  </div>

                  {/* Line 2: Summary note excerpt */}
                  {session.summary_note && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {session.summary_note}
                    </p>
                  )}

                  {/* Line 3: KPI badges */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] h-5 px-1.5 font-normal ${
                        attendanceRate !== null && attendanceRate < 50
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : ""
                      }`}
                    >
                      👥 {session.attendance_count ?? 0}
                      {totalEnrolled > 0 && (
                        <span className="text-muted-foreground ml-0.5">/{totalEnrolled}</span>
                      )}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] h-5 px-1.5 font-normal ${
                        rating < 3
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : ""
                      }`}
                    >
                      ⭐ {rating.toFixed(1)}/5
                    </Badge>
                    {session.profiles?.display_name && (
                      <span className="text-[10px] text-muted-foreground truncate ml-auto">
                        {session.profiles.display_name}
                      </span>
                    )}
                  </div>
                </button>
                {idx < sessions.length - 1 && <Separator className="my-0.5" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Session detail drawer (reusing existing component) */}
      {selectedSession && (
        <SessionReportDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          student={null}
          classId={selectedSession.class_id}
          forDate={selectedSession.date}
          activeSessionId={selectedSession.id}
        />
      )}
    </>
  );
}
