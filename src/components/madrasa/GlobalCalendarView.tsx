import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Palmtree,
  Handshake,
  BookOpen,
  CalendarOff,
  Users,
  Calendar as CalendarIcon,
  LayoutGrid,
  AlertCircle,
  MapPin,
  User,
  Building2,
  Monitor,
  CheckSquare,
  XCircle,
  Layers,
  GraduationCap,
} from "lucide-react";
import {
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  isBefore,
  getHours,
  getMinutes,
  differenceInMinutes,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { SessionSummarySheet } from "@/components/madrasa/SessionSummarySheet";

import { useCalendarData, type CalendarEvent } from "@/hooks/useCalendarData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type ViewMode = "week" | "month";

interface Props {
  filterNiveau: string;
  filterSubjects: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────
function buildMonthGrid(refDate: Date): Date[] {
  const mStart = startOfMonth(refDate);
  const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function groupByDay(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const d of days) map.set(format(d, "yyyy-MM-dd"), []);
  for (const ev of events) {
    const key = format(ev.start, "yyyy-MM-dd");
    map.get(key)?.push(ev);
  }
  return map;
}

// ── Current time indicator position (percentage through 7h-21h range) ─
function useCurrentTimePosition() {
  const now = new Date();
  const h = getHours(now);
  const m = getMinutes(now);
  const totalMin = (h - 7) * 60 + m;
  const rangeMin = 14 * 60; // 7h to 21h
  if (totalMin < 0 || totalMin > rangeMin) return null;
  return (totalMin / rangeMin) * 100;
}

// ── Component ──────────────────────────────────────────────────────────
export default function GlobalCalendarView({ filterNiveau, filterSubjects }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [summarySessionEvent, setSummarySessionEvent] = useState<CalendarEvent | null>(null);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthGrid = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const monthRangeStart = monthGrid[0];
  const monthRangeEnd = monthGrid[monthGrid.length - 1];

  const rangeStart = viewMode === "week" ? weekStart : monthRangeStart;
  const rangeEnd = viewMode === "week" ? weekEnd : monthRangeEnd;

  const { events: rawEvents, isLoading } = useCalendarData({
    startDate: rangeStart,
    endDate: rangeEnd,
    includeGlobalEvents: false,
  });

  const events = useMemo(() => {
    let filtered = rawEvents;
    if (filterNiveau && filterNiveau !== "all") {
      filtered = filtered.filter((ev) => ev.type !== "session" || true);
    }
    if (filterSubjects.length > 0) {
      filtered = filtered.filter((ev) => ev.type !== "session" || ev.subjectNames.length > 0);
    }
    return filtered;
  }, [rawEvents, filterNiveau, filterSubjects]);

  const days = viewMode === "week" ? weekDays : monthGrid;
  const byDay = useMemo(() => groupByDay(events, days), [events, days]);

  const navigateWeek = (dir: number) => setCurrentDate((d) => addDays(d, dir * 7));
  const navigateMonth = (dir: number) => setCurrentDate((d) => addMonths(d, dir));
  const goToToday = () => setCurrentDate(new Date());
  const drillToWeek = useCallback((day: Date) => {
    setCurrentDate(day);
    setViewMode("week");
  }, []);

  const timePos = useCurrentTimePosition();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-muted/20 -mx-6 -mb-6 px-6 pb-6 pt-2 rounded-2xl">
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 hover:bg-muted"
            onClick={() => (viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs font-medium hover:bg-muted"
            onClick={goToToday}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 hover:bg-muted"
            onClick={() => (viewMode === "week" ? navigateWeek(1) : navigateMonth(1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h3 className="text-lg font-bold tracking-tight text-foreground capitalize">
          {viewMode === "week" ? (
            <>
              {format(weekStart, "MMMM yyyy", { locale: fr })}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Sem. {format(weekStart, "d", { locale: fr })} – {format(weekEnd, "d MMM", { locale: fr })}
              </span>
            </>
          ) : (
            format(currentDate, "MMMM yyyy", { locale: fr })
          )}
        </h3>

        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9 rounded-full bg-muted/60 p-1">
              <TabsTrigger value="week" className="text-xs gap-1.5 px-3 h-7 rounded-full data-[state=active]:shadow-sm">
                <LayoutGrid className="h-3.5 w-3.5" />
                Semaine
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs gap-1.5 px-3 h-7 rounded-full data-[state=active]:shadow-sm">
                <CalendarIcon className="h-3.5 w-3.5" />
                Mois
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-l-[3px] border-primary bg-primary/5" />
              Cours
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-l-[3px] border-violet-500 bg-violet-50" />
              Remplacement
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-destructive/10" />
              Fermeture
            </span>
          </div>
        </div>
      </div>

      {/* ── WEEK VIEW ──────────────────────────────────────────────── */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(dateStr) ?? [];
            const today = isToday(day);
            const holidays = dayEvents.filter((e) => e.type === "holiday" && e.meta?.affectsClasses);
            const isClosed = holidays.length > 0;
            const sessions = dayEvents.filter((e) => e.type === "session");

            return (
              <div
                key={dateStr}
                className={`rounded-2xl min-h-[240px] flex flex-col transition-all ${
                  isClosed
                    ? "bg-destructive/[0.04]"
                    : today
                    ? "bg-primary/[0.03] ring-1 ring-primary/20"
                    : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                {/* Day header */}
                <div className="px-3 py-3 text-center">
                  <p className={`text-[11px] font-medium uppercase tracking-wider ${
                    today ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {format(day, "EEE", { locale: fr })}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto text-sm"
                      : "text-foreground"
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>

                {/* Holiday banner */}
                {isClosed && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 mx-2 rounded-lg bg-destructive/10">
                    <Palmtree className="h-3 w-3 text-destructive/70 shrink-0" />
                    <span className="text-[10px] font-semibold text-destructive truncate">
                      {holidays[0].title}
                    </span>
                  </div>
                )}

                <div className="flex-1 px-2 pb-2 space-y-1.5 overflow-y-auto relative">
                  {/* Current time indicator for today */}
                  {today && timePos !== null && (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                      style={{ top: `${timePos}%` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 -ml-1 shadow-sm shadow-rose-500/40" />
                      <span className="flex-1 h-[1.5px] bg-rose-500/70" />
                    </div>
                  )}

                  {!isClosed && dayEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 py-8">
                      <CalendarOff className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Aucun cours</span>
                    </div>
                  )}
                  {isClosed && sessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-destructive/25 py-8">
                      <CalendarOff className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">École fermée</span>
                    </div>
                  )}
                  {sessions.map((ev) => (
                    <div key={ev.id} className={isClosed ? "opacity-25 pointer-events-none" : ""}>
                      <WeekEventCard event={ev} onClick={() => !isClosed && setSelectedEvent(ev)} />
                    </div>
                  ))}
                  {dayEvents
                    .filter((e) => e.type !== "session" && e.type !== "holiday")
                    .map((ev) => (
                      <WeekEventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW ─────────────────────────────────────────────── */}
      {viewMode === "month" && (
        <div className="rounded-2xl overflow-hidden bg-card">
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"].map((d) => (
              <div key={d} className="text-center py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/30">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayEvents = byDay.get(dateStr) ?? [];
              const today = isToday(day);
              const inMonth = isSameMonth(day, currentDate);
              const sessions = dayEvents.filter((e) => e.type === "session");
              const holidays = dayEvents.filter((e) => e.type === "holiday");
              const hasHoliday = holidays.length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => drillToWeek(day)}
                  className={`relative flex flex-col items-start p-2 min-h-[100px] text-left transition-colors border-b border-r border-border/10 hover:bg-accent/30 ${
                    !inMonth ? "opacity-30" : ""
                  } ${
                    hasHoliday
                      ? "bg-destructive/[0.04]"
                      : today
                      ? "bg-primary/[0.03]"
                      : ""
                  }`}
                >
                  <span className={`text-xs font-semibold leading-none mb-1.5 ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-[11px]"
                      : inMonth ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {format(day, "d")}
                  </span>
                  <div className="w-full space-y-0.5 overflow-hidden">
                    {hasHoliday && (
                      <div className="flex items-center gap-0.5 text-[9px] text-destructive font-medium truncate px-1 py-0.5 rounded bg-destructive/10">
                        <Palmtree className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{holidays[0].title}</span>
                      </div>
                    )}
                    <div className={hasHoliday ? "opacity-25" : ""}>
                      {sessions.slice(0, 3).map((ev) => (
                        <MonthEventPill key={ev.id} event={ev} />
                      ))}
                      {sessions.length > 3 && (
                        <span className="text-[9px] text-muted-foreground font-medium pl-1">+{sessions.length - 3}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Detail Sheet ───────────────────────────────────────────── */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-[400px] sm:w-[460px] p-0 flex flex-col">
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onViewBilan={(ev) => {
                setSelectedEvent(null);
                setSummarySessionEvent(ev);
              }}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <SessionSummarySheet
        open={!!summarySessionEvent}
        onOpenChange={(open) => !open && setSummarySessionEvent(null)}
        sessionId={summarySessionEvent?.sessionId ?? null}
        className={summarySessionEvent?.className}
        classNiveau={summarySessionEvent?.classNiveau}
        sessionDate={summarySessionEvent?.start}
        teacherName={summarySessionEvent?.assignedTeacherName ?? summarySessionEvent?.actualTeacherName}
      />
    </div>
  );
}

// ── Month compact pill ─────────────────────────────────────────────────
function MonthEventPill({ event: ev }: { event: CalendarEvent }) {
  const dotColor = ev.status === "cancelled"
    ? "border-l-destructive/60"
    : ev.isReplacement
    ? "border-l-violet-500"
    : ev.status === "completed"
    ? "border-l-emerald-500"
    : "border-l-primary";

  return (
    <div className={`flex items-center gap-1 text-[9px] truncate rounded px-1.5 py-[2px] border-l-[3px] bg-muted/40 ${dotColor}`}>
      <span className="font-medium text-foreground truncate">
        {format(ev.start, "HH:mm")}
      </span>
      <span className="truncate text-muted-foreground">
        {ev.className}
      </span>
    </div>
  );
}

// ── Week event card (pastel + left border) ─────────────────────────────
function WeekEventCard({ event: ev, onClick }: { event: CalendarEvent; onClick: () => void }) {
  if (ev.type === "holiday") {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-xl px-3 py-2 text-left bg-destructive/[0.06] hover:bg-destructive/10 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Palmtree className="h-3 w-3 text-destructive/60 shrink-0" />
          <span className="text-[10px] font-medium text-destructive truncate">{ev.title}</span>
        </div>
      </button>
    );
  }

  if (ev.type === "global_event") {
    return (
      <button onClick={onClick} className="w-full rounded-xl bg-muted/40 px-3 py-2 text-left hover:bg-muted/60 transition-colors">
        <span className="text-[10px] text-muted-foreground truncate block">{ev.title}</span>
      </button>
    );
  }

  const isCancelled = ev.status === "cancelled";
  const isReplacement = ev.isReplacement;
  const isPast = isBefore(ev.end, new Date()) && ev.status !== "completed";

  const borderColor = isCancelled
    ? "border-l-destructive/40"
    : isReplacement
    ? "border-l-violet-500"
    : ev.status === "completed"
    ? "border-l-emerald-500"
    : "border-l-primary";

  const bgColor = isCancelled
    ? "bg-destructive/[0.04]"
    : isReplacement
    ? "bg-violet-50 dark:bg-violet-500/5"
    : ev.status === "completed"
    ? "bg-emerald-50 dark:bg-emerald-500/5"
    : "bg-primary/[0.04]";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border-l-[3px] ${borderColor} ${bgColor} px-3 py-2.5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-px ${
        isPast ? "opacity-45" : ""
      } ${isCancelled ? "opacity-45" : ""}`}
    >
      <p className="text-[11px] font-medium text-foreground truncate">{ev.className ?? ev.title}</p>
      {ev.subjectNames.length > 0 && (
        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{ev.subjectNames.join(", ")}</p>
      )}
      <div className="flex items-center gap-2.5 mt-1.5 text-[9px] text-muted-foreground/70">
        <span className="flex items-center gap-0.5 tabular-nums">
          <Clock className="h-2.5 w-2.5" />
          {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
        </span>
        {ev.roomName && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{ev.roomName}</span>
          </span>
        )}
      </div>
      {ev.assignedTeacherName && (
        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/70">
          <User className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{ev.assignedTeacherName}</span>
        </div>
      )}
      {isReplacement && (
        <Badge variant="outline" className="text-[8px] h-3.5 px-1.5 mt-1 bg-violet-500/10 border-violet-500/20 text-violet-700">
          <Handshake className="h-2 w-2 mr-0.5" />
          Remplacement
        </Badge>
      )}
    </button>
  );
}

// ── Detail Sheet panel ─────────────────────────────────────────────────
function EventDetailPanel({
  event: ev,
  onViewBilan,
  onClose,
}: {
  event: CalendarEvent;
  onViewBilan: (ev: CalendarEvent) => void;
  onClose: () => void;
}) {
  const isSession = ev.type === "session";
  const isReplacement = ev.isReplacement;
  const isPastUnopened =
    isSession &&
    ev.status === "scheduled" &&
    isBefore(ev.end, new Date()) &&
    !ev.sessionId;

  const { data: sessionData } = useQuery({
    queryKey: ["session-detail", ev.sessionId],
    enabled: isSession && ev.status === "completed" && !!ev.sessionId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_sessions")
        .select("summary_note, average_rating, attendance_count")
        .eq("id", ev.sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ["attendance-stats", ev.sessionId],
    enabled: isSession && ev.status === "completed" && !!ev.sessionId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_attendance")
        .select("status")
        .eq("session_id", ev.sessionId!);
      if (error) throw error;
      const total = data?.length ?? 0;
      const present = data?.filter((a) => a.status === "present" || a.status === "late").length ?? 0;
      return { total, present, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    },
  });

  // Fetch enrollment count for the class
  const { data: enrollmentCount } = useQuery({
    queryKey: ["class-enrollment-count", ev.classId],
    enabled: isSession && !!ev.classId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("madrasa_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("class_id", ev.classId!)
        .eq("statut", "Actif");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const statusBadge = (() => {
    if (ev.status === "completed") return { label: "Terminée", icon: CheckCircle2, className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" };
    if (isPastUnopened) return { label: "Non ouverte", icon: AlertCircle, className: "bg-destructive/10 border-destructive/20 text-destructive" };
    if (ev.status === "cancelled") return { label: "Annulée", icon: Palmtree, className: "bg-destructive/10 border-destructive/20 text-destructive" };
    return { label: "Planifiée", icon: Clock, className: "bg-primary/10 border-primary/20 text-primary" };
  })();

  const StatusIcon = statusBadge.icon;

  return (
    <div className="flex flex-col h-full">
      {/* ── Premium Header ──────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-5 border-b border-border/50 bg-muted/20">
        <SheetHeader className="space-y-3">
          <div>
            <SheetTitle className="text-xl font-bold tracking-tight leading-tight">
              {ev.className ?? ev.title}
            </SheetTitle>
            <SheetDescription className="mt-1">
              {format(ev.start, "EEEE d MMMM yyyy", { locale: fr })}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isSession && ev.classNiveau && (
              <Badge variant="secondary" className="text-[11px] font-medium">
                <GraduationCap className="h-3 w-3 mr-1" />
                {ev.classNiveau}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[11px] ${statusBadge.className}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusBadge.label}
            </Badge>
            {isReplacement && (
              <Badge variant="outline" className="text-[11px] bg-violet-500/10 border-violet-500/20 text-violet-700">
                <Handshake className="h-3 w-3 mr-1" />
                Remplacement
              </Badge>
            )}
          </div>
        </SheetHeader>
      </div>

      {/* ── Scrollable Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Time */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-muted">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Horaire</p>
            <p className="text-sm font-semibold tabular-nums">
              {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
            </p>
          </div>
        </div>

        {/* ── Enseignant ────────────────────────────────────────── */}
        {isSession && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Enseignant
            </p>
            {ev.assignedTeacherId ? (
              <div className="rounded-xl bg-muted/30 p-3.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{ev.assignedTeacherName ?? "Non assigné"}</p>
                    <p className="text-[10px] text-muted-foreground">Oustaz titulaire</p>
                  </div>
                </div>
                {ev.assignedTeacherSpecialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ev.assignedTeacherSpecialties.map((spec, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] h-5 px-2 font-normal">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Aucun enseignant assigné</p>
              </div>
            )}
            {isReplacement && ev.actualTeacherId && (
              <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-violet-500/10 shrink-0">
                    <Handshake className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-700">{ev.actualTeacherName ?? "Inconnu"}</p>
                    <p className="text-[10px] text-muted-foreground">Remplaçant</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Localisation ──────────────────────────────────────── */}
        {ev.roomName && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Localisation
            </p>
            <div className="rounded-xl bg-muted/30 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-accent shrink-0">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{ev.roomName}</p>
                  {ev.roomFloor && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Layers className="h-2.5 w-2.5" />
                      Étage : {ev.roomFloor}
                    </p>
                  )}
                </div>
              </div>
              {ev.roomFeatures.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
                  {ev.roomFeatures.map((feat, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] h-5 px-2 font-normal gap-1">
                      <Monitor className="h-2.5 w-2.5" />
                      {feat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Statistiques rapides ──────────────────────────────── */}
        {isSession && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Statistiques
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">{enrollmentCount ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">Inscrits</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">{ev.classCapacity ?? ev.roomCapacity ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">Places max</p>
              </div>
            </div>
            {ev.status === "completed" && attendanceStats && attendanceStats.total > 0 && (
              <div className="rounded-xl bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Présence</span>
                  <span className="font-semibold tabular-nums">{attendanceStats.present} / {attendanceStats.total}</span>
                </div>
                <Progress value={attendanceStats.percentage} className="h-2" />
                <p className="text-[10px] text-muted-foreground text-right tabular-nums">{attendanceStats.percentage}%</p>
              </div>
            )}
          </div>
        )}

        {/* ── Matières ──────────────────────────────────────────── */}
        {ev.subjectNames.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Matières
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ev.subjectNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── Bilan (completed) ─────────────────────────────────── */}
        {isSession && ev.status === "completed" && sessionData && (
          <div className="space-y-3">
            <Separator />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bilan rapide</p>
            {sessionData.average_rating != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Moyenne</span>
                <span className="font-semibold tabular-nums">⭐ {sessionData.average_rating}/5</span>
              </div>
            )}
            {sessionData.summary_note && (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Résumé</p>
                <p className="text-sm italic text-muted-foreground leading-relaxed">{sessionData.summary_note}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Holiday meta ──────────────────────────────────────── */}
        {ev.type === "holiday" && ev.meta && (
          <div className="space-y-2">
            <Separator />
            <p className="text-xs text-muted-foreground">
              Type : {(ev.meta.calendarType as string) === "holiday" ? "Vacances" : (ev.meta.calendarType as string) === "exam" ? "Examens" : "Pédagogique"}
            </p>
            {ev.meta.affectsClasses && (
              <p className="text-xs text-destructive">Affecte les cours — classes fermées</p>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky Action Footer ────────────────────────────────── */}
      {isSession && ev.status !== "cancelled" && (
        <div className="border-t border-border/50 bg-background px-6 py-4 space-y-2 shrink-0">
          {ev.status === "completed" && ev.sessionId ? (
            <Button className="w-full" onClick={() => onViewBilan(ev)}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Voir le Bilan de Séance
            </Button>
          ) : (
            <>
              <Button className="w-full" size="sm">
                <CheckSquare className="h-4 w-4 mr-2" />
                Faire l'appel
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Modifier le créneau
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Annuler
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
