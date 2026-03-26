import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Palmtree,
  Rocket,
  Eye,
  Handshake,
  CalendarOff,
  BookOpen,
} from "lucide-react";
import {
  addDays,
  startOfWeek,
  format,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import { useCalendarData, type CalendarEvent } from "@/hooks/useCalendarData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  teacherId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function groupByDay(events: CalendarEvent[], days: Date[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const d of days) {
    map.set(format(d, "yyyy-MM-dd"), []);
  }
  for (const ev of events) {
    const key = format(ev.start, "yyyy-MM-dd");
    map.get(key)?.push(ev);
  }
  return map;
}

// ── Component ──────────────────────────────────────────────────────────
export default function MadrasaAgendaView({ teacherId }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const { events, isLoading } = useCalendarData({
    startDate: weekStart,
    endDate: weekEnd,
    teacherId,
    includeGlobalEvents: true,
  });

  const byDay = useMemo(() => groupByDay(events, weekDays), [events, weekDays]);

  const navigate_week = (dir: number) =>
    setCurrentDate((d) => addDays(d, dir * 7));

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Navigation bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate_week(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate_week(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {format(weekStart, "MMMM yyyy", { locale: fr })} —{" "}
          <span className="text-muted-foreground font-normal">
            Sem. du {format(weekStart, "d", { locale: fr })} au{" "}
            {format(weekEnd, "d MMM", { locale: fr })}
          </span>
        </h3>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border-l-[3px] border-primary bg-card" />
            Titulaire
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

      {/* ── Desktop: 7-column grid ─────────────────────────────────── */}
      {!isMobile ? (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(dateStr) ?? [];
            const today = isToday(day);

            return (
              <div
                key={dateStr}
                className={`rounded-xl border min-h-[220px] flex flex-col transition-colors ${
                  today
                    ? "border-primary/30 bg-primary/[0.03]"
                    : "border-border bg-card"
                }`}
              >
                {/* Day header */}
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

                {/* Events */}
                <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                  {dayEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 py-6">
                      <CalendarOff className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Aucun cours</span>
                    </div>
                  )}
                  {dayEvents.map((ev, idx) => (
                    <EventCard key={ev.id} event={ev} index={idx} onOpenSession={() => navigate(`/attendance?classId=${ev.classId}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Mobile: chronological list ─────────────────────────────── */
        <div className="space-y-3">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(dateStr) ?? [];
            const today = isToday(day);
            if (dayEvents.length === 0 && !today) return null;

            return (
              <div key={dateStr}>
                <div className={`flex items-center gap-2 mb-2 ${today ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider ${
                    today ? "bg-primary text-primary-foreground px-2 py-0.5 rounded-full" : ""
                  }`}>
                    {format(day, "EEEE d MMM", { locale: fr })}
                  </div>
                  {today && <span className="text-[10px] text-primary">Aujourd'hui</span>}
                </div>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-2">Aucun cours</p>
                ) : (
                  <div className="space-y-2">
                    {dayEvents.map((ev, idx) => (
                      <EventCard key={ev.id} event={ev} index={idx} onOpenSession={() => navigate(`/attendance?classId=${ev.classId}`)} mobile />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Event Card ─────────────────────────────────────────────────────────
function EventCard({
  event: ev,
  index,
  onOpenSession,
  mobile,
}: {
  event: CalendarEvent;
  index: number;
  onOpenSession: () => void;
  mobile?: boolean;
}) {
  const isPast = isBefore(ev.end, new Date());

  // ── Holiday / fermeture ──────────────────────────────────────────
  if (ev.type === "holiday") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className={`rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 ${mobile ? "" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          <Palmtree className="h-3.5 w-3.5 text-destructive/70" />
          <p className="text-xs font-medium text-destructive">{ev.title}</p>
        </div>
        <p className="text-[10px] text-destructive/60 mt-0.5">
          {(ev.meta?.calendarType as string) === "holiday" ? "École fermée" : (ev.meta?.calendarType as string) === "exam" ? "Période d'examens" : "Jalon pédagogique"}
        </p>
      </motion.div>
    );
  }

  // ── Global event ─────────────────────────────────────────────────
  if (ev.type === "global_event") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="rounded-lg border border-border bg-muted/30 px-3 py-2"
      >
        <p className="text-[11px] font-medium text-muted-foreground">{ev.title}</p>
        {ev.meta?.pole && (
          <Badge variant="outline" className="text-[9px] mt-1 h-4 px-1.5">
            {ev.meta.pole as string}
          </Badge>
        )}
      </motion.div>
    );
  }

  // ── Session card ─────────────────────────────────────────────────
  const isReplacement = ev.isReplacement;
  const isCancelled = ev.status === "cancelled";
  const isCompleted = ev.status === "completed";

  const borderClass = isCancelled
    ? "border-destructive/20 bg-destructive/5 opacity-60"
    : isReplacement
    ? "border-violet-500/30 bg-violet-500/5 border-l-[3px] border-l-violet-500"
    : "border-border bg-card border-l-[3px] border-l-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-lg border px-3 py-2 transition-shadow hover:shadow-sm ${borderClass} ${
        isPast && !isCompleted ? "opacity-50" : ""
      }`}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <BookOpen className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-[11px] font-semibold leading-tight truncate">{ev.className ?? ev.title}</p>
      </div>

      {/* Subjects */}
      {ev.subjectNames.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate pl-[18px]">
          {ev.subjectNames.join(", ")}
        </p>
      )}

      {/* Time */}
      <div className="flex items-center gap-1 mt-1 pl-[18px]">
        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
        </span>
      </div>

      {/* Status badges & action */}
      <div className="flex items-center gap-1.5 mt-1.5 pl-[18px] flex-wrap">
        {isReplacement && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-violet-500/10 border-violet-500/20 text-violet-700">
            <Handshake className="h-2 w-2 mr-0.5" />
            Remplacement
          </Badge>
        )}

        {isCancelled && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-destructive/10 border-destructive/20 text-destructive">
            Fermé
          </Badge>
        )}

        {isCompleted && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 border-emerald-500/20 text-emerald-700">
            <CheckCircle2 className="h-2 w-2 mr-0.5" />
            Session Validée
          </Badge>
        )}

        {/* Action buttons */}
        {!isCancelled && isCompleted && (
          <button
            onClick={onOpenSession}
            className="inline-flex items-center gap-0.5 text-[9px] h-4 px-1.5 rounded-full border border-muted-foreground/20 bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
          >
            <Eye className="h-2 w-2" />
            Voir le bilan
          </button>
        )}

        {!isCancelled && !isCompleted && !isPast && (
          <button
            onClick={onOpenSession}
            className="inline-flex items-center gap-0.5 text-[9px] h-4 px-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
          >
            <Rocket className="h-2 w-2" />
            Ouvrir la session
          </button>
        )}
      </div>
    </motion.div>
  );
}
