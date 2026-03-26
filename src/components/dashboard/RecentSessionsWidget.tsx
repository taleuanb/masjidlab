import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { SessionSummarySheet } from "@/components/madrasa/SessionSummarySheet";

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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["recent-completed-sessions", orgId],
    enabled: !!orgId,
    staleTime: 2 * 60_000,
    refetchInterval: 60_000,
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

  const openSession = (session: SessionRow) => {
    setSelectedSession(session);
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3 px-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
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
        <CardContent className="px-6">
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activité des Classes
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2 hover:text-foreground"
            onClick={() => navigate("/classes")}
          >
            Voir tout
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-5 pt-0">
          {/* Table header */}
          <div className="grid grid-cols-[100px_1fr_minmax(0,2fr)_auto] gap-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50">
            <span>Date</span>
            <span>Classe / Prof</span>
            <span>Résumé</span>
            <span className="text-right">KPIs</span>
          </div>

          {/* Rows — journal style with clear separators */}
          <div className="divide-y divide-border">
            {sessions.map((session) => {
              const totalEnrolled = enrollmentCounts?.[session.class_id] ?? 0;
              const attendanceRate =
                totalEnrolled > 0
                  ? Math.round(((session.attendance_count ?? 0) / totalEnrolled) * 100)
                  : null;
              const rating = session.average_rating ?? 0;
              const isAlert =
                rating < 3 || (attendanceRate !== null && attendanceRate < 50);

              return (
                <button
                  key={session.id}
                  onClick={() => openSession(session)}
                  className={`w-full text-left grid grid-cols-[100px_1fr_minmax(0,2fr)_auto] gap-4 items-center px-3 py-3 transition-colors hover:bg-accent/50 rounded-md ${
                    isAlert ? "bg-destructive/[0.04]" : ""
                  }`}
                >
                  {/* Date / Time */}
                  <div className="text-xs text-muted-foreground tabular-nums leading-tight">
                    <span className="block font-medium text-foreground">
                      {session.completed_at
                        ? format(new Date(session.completed_at), "d MMM", { locale: fr })
                        : format(new Date(session.date), "d MMM", { locale: fr })}
                    </span>
                    {session.completed_at && (
                      <span className="text-[10px]">
                        {format(new Date(session.completed_at), "HH:mm")}
                      </span>
                    )}
                  </div>

                  {/* Class / Prof */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isAlert && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-semibold truncate">
                        {session.madrasa_classes?.nom ?? "Classe"}
                      </span>
                    </div>
                    {session.profiles?.display_name && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {session.profiles.display_name}
                      </p>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {session.summary_note || (
                      <span className="italic opacity-50">Aucun résumé</span>
                    )}
                  </p>

                  {/* KPI badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 px-1.5 font-medium border ${
                        attendanceRate !== null && attendanceRate < 50
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      }`}
                    >
                      👥 {session.attendance_count ?? 0}
                      {totalEnrolled > 0 && (
                        <span className="opacity-60">/{totalEnrolled}</span>
                      )}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 px-1.5 font-medium border ${
                        rating < 3
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                      }`}
                    >
                      ⭐ {rating.toFixed(1)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Session Summary Sheet */}
      <SessionSummarySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sessionId={selectedSession?.id ?? null}
        className={selectedSession?.madrasa_classes?.nom}
        classNiveau={selectedSession?.madrasa_classes?.niveau}
        sessionDate={selectedSession?.completed_at ? new Date(selectedSession.completed_at) : selectedSession?.date ? new Date(selectedSession.date) : null}
        teacherName={selectedSession?.profiles?.display_name}
      />
    </>
  );
}
