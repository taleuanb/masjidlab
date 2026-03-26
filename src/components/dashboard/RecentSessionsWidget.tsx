import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { useParentScope } from "@/hooks/useParentScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, ChevronRight, ClipboardEdit, Phone, BookOpen } from "lucide-react";
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
  status: string | null;
  madrasa_classes: { nom: string; niveau: string | null; prof_id: string | null } | null;
  profiles: { display_name: string } | null;
}

export function RecentSessionsWidget() {
  const { orgId } = useOrganization();
  const navigate = useNavigate();
  const { isTeacher, profileId, teacherClassIds } = useTeacherScope();
  const { isParent, students, childrenClassIds } = useParentScope();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  // Teacher with no classes assigned → show initialisation state
  if (isTeacher && teacherClassIds.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Mon activité pédagogique
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-20 animate-pulse" />
            <p className="text-sm font-medium">Initialisation</p>
            <p className="text-xs mt-1 text-center max-w-[260px]">
              En attente d'assignation de vos classes par l'administration
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["recent-sessions", orgId, isTeacher, teacherClassIds, isParent, childrenClassIds],
    enabled: !!orgId && (!isParent || childrenClassIds.length > 0) && (!isTeacher || teacherClassIds.length > 0),
    staleTime: 2 * 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("madrasa_sessions")
        .select(`
          id, class_id, date, summary_note, attendance_count, average_rating, completed_at, status,
          madrasa_classes(nom, niveau, prof_id),
          profiles:actual_teacher_id(display_name)
        `)
        .eq("org_id", orgId!);

      if (isParent) {
        query = query.in("class_id", childrenClassIds).eq("status", "completed");
      } else if (isTeacher) {
        // Scope strictly to assigned classes
        query = query.in("class_id", teacherClassIds);
      }

      const { data, error } = await query
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("date", { ascending: false })
        .limit(8);

      if (error) throw error;

      const rows = (data ?? []) as unknown as SessionRow[];

      if (isTeacher) {
        return rows.sort((a, b) => {
          const aPending = a.status === "completed" && !a.summary_note ? 1 : 0;
          const bPending = b.status === "completed" && !b.summary_note ? 1 : 0;
          if (aPending !== bPending) return bPending - aPending;
          return 0;
        });
      }

      if (isParent) return rows;

      return rows.filter((s) => s.status === "completed");
    },
  });

  // Enrollment counts (admin/teacher only)
  const classIds = sessions?.map((s) => s.class_id).filter(Boolean) ?? [];
  const { data: enrollmentCounts } = useQuery({
    queryKey: ["enrollment-counts", classIds.join(",")],
    enabled: classIds.length > 0 && !isParent,
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

  // Today's schedule (teacher only)
  const { data: todaySchedule } = useQuery({
    queryKey: ["today-schedule", orgId, profileId],
    enabled: isTeacher && !!profileId && !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const dayOfWeek = new Date().getDay();
      const { data } = await supabase
        .from("madrasa_schedules")
        .select("id, class_id, start_time, end_time, madrasa_classes!inner(nom, prof_id)")
        .eq("org_id", orgId!)
        .eq("day_of_week", dayOfWeek);
      return (data ?? []).filter((s: any) => s.madrasa_classes?.prof_id === profileId);
    },
  });

  const openSession = (session: SessionRow) => {
    const needsBilan = session.status === "completed" && !session.summary_note;
    if (isTeacher && needsBilan) {
      navigate(`/appel?class=${session.class_id}`);
      return;
    }
    setSelectedSession(session);
    setSheetOpen(true);
  };

  // Build child-to-class name map for parent
  const childClassMap = new Map<string, string>();
  if (isParent) {
    for (const s of students) {
      if (s.class_id) childClassMap.set(s.class_id, `${s.prenom} ${s.nom}`);
    }
  }

  const widgetTitle = isParent
    ? "Journal des cours"
    : isTeacher
      ? "Mon activité pédagogique"
      : "Activité des Classes";

  const getActiveSchedule = () => {
    if (!todaySchedule || todaySchedule.length === 0) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    for (const sched of todaySchedule) {
      const [h, m] = sched.start_time.split(":").map(Number);
      const schedMinutes = h * 60 + m;
      if (Math.abs(nowMinutes - schedMinutes) <= 30) return sched;
    }
    return null;
  };

  const activeSchedule = isTeacher ? getActiveSchedule() : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-3 px-6">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
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
            {widgetTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">
              {isParent ? "Aucun cours enregistré pour le moment" : "Aucune séance clôturée récemment"}
            </p>
            <p className="text-xs mt-1">
              {isParent
                ? "Les bilans apparaîtront ici après chaque cours."
                : "Les bilans apparaîtront ici après la première clôture."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Parent: Timeline / Feed view ──
  if (isParent) {
    return (
      <>
        <Card>
          <CardHeader className="pb-2 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {widgetTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Derniers bilans transmis par les enseignants</p>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
            <div className="relative space-y-0">
              {/* Vertical timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              {sessions.map((session) => {
                const childName = childClassMap.get(session.class_id) ?? "Enfant";
                return (
                  <button
                    key={session.id}
                    onClick={() => { setSelectedSession(session); setSheetOpen(true); }}
                    className="w-full text-left relative pl-10 py-3 hover:bg-accent/30 rounded-lg transition-colors cursor-pointer group"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 h-[10px] w-[10px] rounded-full bg-primary/20 border-2 border-primary group-hover:scale-125 transition-transform" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-foreground">
                            {session.madrasa_classes?.nom ?? "Classe"}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">
                            {childName}
                          </Badge>
                        </div>
                        {session.summary_note ? (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {session.summary_note}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">Pas de bilan pour cette séance</p>
                        )}
                        {session.profiles?.display_name && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            Par {session.profiles.display_name}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                        {format(new Date(session.completed_at ?? session.date), "d MMM", { locale: fr })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

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

  // ── Admin / Teacher: Table view ──
  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {widgetTitle}
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
          {activeSchedule && (
            <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {(activeSchedule as any).madrasa_classes?.nom} — maintenant
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeSchedule.start_time?.slice(0, 5)} – {activeSchedule.end_time?.slice(0, 5)}
                </p>
              </div>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(`/appel?class=${activeSchedule.class_id}`)}>
                <Phone className="h-3.5 w-3.5" />
                Prendre l'appel
              </Button>
            </div>
          )}

          <div className="grid grid-cols-[100px_1fr_minmax(0,2fr)_auto] gap-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50">
            <span>Date</span>
            <span>Classe / Prof</span>
            <span>Résumé</span>
            <span className="text-right">KPIs</span>
          </div>

          <div className="divide-y divide-border">
            {sessions.map((session) => {
              const totalEnrolled = enrollmentCounts?.[session.class_id] ?? 0;
              const attendanceRate = totalEnrolled > 0 ? Math.round(((session.attendance_count ?? 0) / totalEnrolled) * 100) : null;
              const rating = session.average_rating ?? 0;
              const isAlert = rating < 3 || (attendanceRate !== null && attendanceRate < 50);
              const needsBilan = session.status === "completed" && !session.summary_note;

              return (
                <button
                  key={session.id}
                  onClick={() => openSession(session)}
                  className={`w-full text-left grid grid-cols-[100px_1fr_minmax(0,2fr)_auto] gap-4 items-center px-3 py-3 transition-colors rounded-md cursor-pointer hover:bg-accent/50 ${
                    needsBilan && isTeacher
                      ? "bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20"
                      : isAlert ? "bg-destructive/[0.04]" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground tabular-nums leading-tight">
                    <span className="block font-medium text-foreground">
                      {session.completed_at
                        ? format(new Date(session.completed_at), "d MMM", { locale: fr })
                        : format(new Date(session.date), "d MMM", { locale: fr })}
                    </span>
                    {session.completed_at && (
                      <span className="text-[10px]">{format(new Date(session.completed_at), "HH:mm")}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className="text-sm font-semibold truncate">{session.madrasa_classes?.nom ?? "Classe"}</span>
                      {needsBilan && isTeacher && (
                        <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] h-4 px-1.5 shrink-0">
                          <ClipboardEdit className="h-2.5 w-2.5 mr-0.5" />
                          Bilan à saisir
                        </Badge>
                      )}
                    </div>
                    {!isTeacher && session.profiles?.display_name && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{session.profiles.display_name}</p>
                    )}
                  </div>

                  <div className="min-w-0">
                    {needsBilan && isTeacher ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigate(`/appel?class=${session.class_id}`); }}
                      >
                        <ClipboardEdit className="h-3 w-3" />
                        Saisir le bilan maintenant
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {session.summary_note || <span className="italic opacity-50">Aucun résumé</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium border ${attendanceRate !== null && attendanceRate < 50 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"}`}>
                      👥 {session.attendance_count ?? 0}{totalEnrolled > 0 && <span className="opacity-60">/{totalEnrolled}</span>}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium border ${rating < 3 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"}`}>
                      ⭐ {rating.toFixed(1)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
