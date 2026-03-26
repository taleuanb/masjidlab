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
  ExternalLink,
  Calendar as CalendarIcon,
  LayoutGrid,
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
} from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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

type ViewMode = "week" | "month";

interface Props {
  /** Filter by niveau label */
  filterNiveau: string;
  /** Filter by subject IDs (from schedule subject_ids) */
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

// ── Component ──────────────────────────────────────────────────────────
export default function GlobalCalendarView({ filterNiveau, filterSubjects }: Props) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Week range
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Month range
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

  // ── Apply page-level filters ─────────────────────────────────────────
  const events = useMemo(() => {
    let filtered = rawEvents;

    if (filterNiveau && filterNiveau !== "all") {
      filtered = filtered.filter((ev) => {
        if (ev.type !== "session") return true;
        return true;
      });
    }

    if (filterSubjects.length > 0) {
      filtered = filtered.filter((ev) => {
        if (ev.type !== "session") return true;
        return filterSubjects.some((sid) =>
          ev.subjectNames.length > 0
        );
      });
    }

    return filtered;
  }, [rawEvents, filterNiveau, filterSubjects]);

  const days = viewMode === "week" ? weekDays : monthGrid;
  const byDay = useMemo(() => groupByDay(events, days), [events, days]);

  // Navigation
  const navigateWeek = (dir: number) => setCurrentDate((d) => addDays(d, dir * 7));
  const navigateMonth = (dir: number) => setCurrentDate((d) => addMonths(d, dir));
  const goToToday = () => setCurrentDate(new Date());
  const drillToWeek = useCallback((day: Date) => {
    setCurrentDate(day);
    setViewMode("week");
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => (viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => (viewMode === "week" ? navigateWeek(1) : navigateMonth(1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h3 className="text-sm font-semibold text-foreground">
          {viewMode === "week" ? (
            <>
              {format(weekStart, "MMMM yyyy", { locale: fr })} —{" "}
              <span className="text-muted-foreground font-normal">
                Sem. du {format(weekStart, "d", { locale: fr })} au{" "}
                {format(weekEnd, "d MMM", { locale: fr })}
              </span>
            </>
          ) : (
            format(currentDate, "MMMM yyyy", { locale: fr })
          )}
        </h3>

        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="week" className="text-xs gap-1 px-2.5 h-6">
                <LayoutGrid className="h-3 w-3" />
                Semaine
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs gap-1 px-2.5 h-6">
                <CalendarIcon className="h-3 w-3" />
                Mois
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border-l-[3px] border-primary bg-card" />
              Cours
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border-l-[3px] border-violet-500 bg-card" />
              Remplacement
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-destructive/15" />
              Fermeture
            </span>
          </div>
        </div>
      </div>

      {/* ── WEEK VIEW ──────────────────────────────────────────────── */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(dateStr) ?? [];
            const today = isToday(day);

            return (
              <div
                key={dateStr}
                className={`rounded-xl border min-h-[220px] flex flex-col transition-colors ${
                  today ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
                }`}
              >
                <div className={`px-3 py-2 border-b text-center ${today ? "border-primary/20" : "border-border/50"}`}>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${
                    today ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {format(day, "EEE", { locale: fr })}
                  </p>
                  <p className={`text-base font-bold mt-0.5 ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto text-sm"
                      : "text-foreground"
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>
                <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                  {dayEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 py-6">
                      <CalendarOff className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Aucun cours</span>
                    </div>
                  )}
                  {dayEvents.map((ev) => (
                    <WeekEventBlock key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH VIEW ─────────────────────────────────────────────── */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-center py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                  className={`relative flex flex-col items-start border-b border-r border-border/30 p-1.5 min-h-[72px] text-left transition-colors hover:bg-accent/50 ${
                    !inMonth ? "opacity-40" : ""
                  } ${today ? "bg-primary/[0.04]" : ""} ${hasHoliday ? "bg-destructive/[0.04]" : ""}`}
                >
                  <span className={`text-xs font-medium leading-none ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                      : inMonth ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                    {hasHoliday && (
                      <div className="flex items-center gap-0.5 text-[9px] text-destructive truncate">
                        <Palmtree className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{holidays[0].title}</span>
                      </div>
                    )}
                    {sessions.slice(0, 2).map((ev) => (
                      <MonthDot key={ev.id} event={ev} />
                    ))}
                    {sessions.length > 2 && (
                      <span className="text-[9px] text-muted-foreground pl-3">+{sessions.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Detail Sheet ───────────────────────────────────────────── */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-[380px] sm:w-[420px]">
          {selectedEvent && <EventDetailPanel event={selectedEvent} onNavigate={navigate} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Month compact dot ──────────────────────────────────────────────────
function MonthDot({ event: ev }: { event: CalendarEvent }) {
  const dotColor = ev.status === "cancelled"
    ? "bg-destructive/60"
    : ev.isReplacement
    ? "bg-violet-500"
    : ev.status === "completed"
    ? "bg-emerald-500"
    : "bg-primary";

  return (
    <div className="flex items-center gap-1 text-[9px] truncate">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span className="truncate text-muted-foreground">
        {format(ev.start, "HH:mm")} {ev.className}
      </span>
    </div>
  );
}

// ── Week event block ───────────────────────────────────────────────────
function WeekEventBlock({ event: ev, onClick }: { event: CalendarEvent; onClick: () => void }) {
  if (ev.type === "holiday") {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-left"
      >
        <div className="flex items-center gap-1">
          <Palmtree className="h-3 w-3 text-destructive/70 shrink-0" />
          <span className="text-[10px] font-medium text-destructive truncate">{ev.title}</span>
        </div>
      </button>
    );
  }

  if (ev.type === "global_event") {
    return (
      <button onClick={onClick} className="w-full rounded-md border border-border bg-muted/30 px-2 py-1.5 text-left">
        <span className="text-[10px] text-muted-foreground truncate block">{ev.title}</span>
      </button>
    );
  }

  const isCancelled = ev.status === "cancelled";
  const isReplacement = ev.isReplacement;
  const isPast = isBefore(ev.end, new Date()) && ev.status !== "completed";

  const borderClass = isCancelled
    ? "border-destructive/20 bg-destructive/5 opacity-60"
    : isReplacement
    ? "border-violet-500/30 bg-violet-500/5 border-l-[3px] border-l-violet-500"
    : "border-border bg-card border-l-[3px] border-l-primary";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md border px-2 py-1.5 text-left transition-shadow hover:shadow-sm ${borderClass} ${isPast ? "opacity-50" : ""}`}
    >
      <p className="text-[10px] font-semibold truncate">{ev.className ?? ev.title}</p>
      {ev.subjectNames.length > 0 && (
        <p className="text-[9px] text-muted-foreground truncate">{ev.subjectNames.join(", ")}</p>
      )}
      <div className="flex items-center gap-1 mt-0.5">
        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground tabular-nums">
          {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
        </span>
      </div>
      {isReplacement && (
        <Badge variant="outline" className="text-[8px] h-3.5 px-1 mt-0.5 bg-violet-500/10 border-violet-500/20 text-violet-700">
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
  onNavigate,
}: {
  event: CalendarEvent;
  onNavigate: (path: string) => void;
}) {
  const isSession = ev.type === "session";
  const isReplacement = ev.isReplacement;

  return (
    <div className="space-y-5 pt-2">
      <SheetHeader>
        <SheetTitle className="text-lg">{ev.className ?? ev.title}</SheetTitle>
        <SheetDescription>
          {format(ev.start, "EEEE d MMMM yyyy", { locale: fr })}
        </SheetDescription>
      </SheetHeader>

      <Separator />

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Statut :</span>
        {ev.status === "completed" && (
          <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Session validée
          </Badge>
        )}
        {ev.status === "scheduled" && (
          <Badge variant="outline" className="text-xs">Planifié</Badge>
        )}
        {ev.status === "cancelled" && (
          <Badge variant="outline" className="text-xs bg-destructive/10 border-destructive/20 text-destructive">
            <Palmtree className="h-3 w-3 mr-1" />
            Fermé
          </Badge>
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums">
          {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
        </span>
      </div>

      {/* Subjects */}
      {ev.subjectNames.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Matières</p>
          <div className="flex flex-wrap gap-1.5">
            {ev.subjectNames.map((name, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Teachers */}
      {isSession && (
        <div className="space-y-3">
          {ev.assignedTeacherId && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Professeur titulaire</p>
                <p className="font-medium text-sm">{ev.assignedTeacherId}</p>
              </div>
            </div>
          )}

          {isReplacement && ev.actualTeacherId && (
            <div className="flex items-center gap-2 text-sm">
              <Handshake className="h-4 w-4 text-violet-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Remplaçant (session)</p>
                <p className="font-medium text-sm text-violet-700">{ev.actualTeacherId}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Holiday meta */}
      {ev.type === "holiday" && ev.meta && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Type : {(ev.meta.calendarType as string) === "holiday" ? "Vacances" : (ev.meta.calendarType as string) === "exam" ? "Examens" : "Pédagogique"}
          </p>
          {ev.meta.affectsClasses && (
            <p className="text-xs text-destructive">Affecte les cours — classes fermées</p>
          )}
        </div>
      )}

      <Separator />

      {/* Action */}
      {isSession && ev.classId && (
        <Button
          className="w-full"
          onClick={() => onNavigate(`/attendance?classId=${ev.classId}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Accéder à la feuille d'appel
        </Button>
      )}
    </div>
  );
}
