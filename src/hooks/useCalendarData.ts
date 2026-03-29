import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { addDays, format, getDay, isWithinInterval, parseISO } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────
export type CalendarEventType = "session" | "holiday" | "global_event";
export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: CalendarEventType;
  status: CalendarEventStatus;
  classId: string | null;
  className: string | null;
  classNiveau: string | null;
  isReplacement: boolean;
  actualTeacherId: string | null;
  actualTeacherName: string | null;
  assignedTeacherId: string | null;
  assignedTeacherName: string | null;
  scheduleId: string | null;
  sessionId: string | null;
  subjectNames: string[];
  /** Room name resolved from class → salle_id → rooms */
  roomName: string | null;
  meta?: Record<string, unknown>;
}

export interface UseCalendarDataOptions {
  /** Inclusive start of the date range */
  startDate: Date;
  /** Inclusive end of the date range */
  endDate: Date;
  /** Filter by a specific teacher profile ID */
  teacherId?: string | null;
  /** Filter by a specific class ID */
  classId?: string | null;
  /** Include global_event items from `events` table */
  includeGlobalEvents?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────
function dateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Convert JS getDay (0=Sun) to our DB convention (0=Sun kept as-is) */
function jsDay(dbDay: number): number {
  return dbDay;
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useCalendarData(options: UseCalendarDataOptions) {
  const { orgId } = useOrganization();
  const {
    startDate,
    endDate,
    teacherId,
    classId,
    includeGlobalEvents = false,
  } = options;

  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // ── 1. Schedules + Classes ───────────────────────────────────────────
  const schedulesQuery = useQuery({
    queryKey: ["cal-schedules", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_schedules")
        .select("id, day_of_week, start_time, end_time, subject_ids, class_id")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const classesQuery = useQuery({
    queryKey: ["cal-classes", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau, prof_id")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Profiles (teacher name resolution) ───────────────────────────────
  const profilesQuery = useQuery({
    queryKey: ["cal-profiles", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── 2. Subjects (for label resolution) ───────────────────────────────
  const subjectsQuery = useQuery({
    queryKey: ["cal-subjects", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects")
        .select("id, name")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── 3. Calendar (holidays / exams / pedagogical) ─────────────────────
  const calendarQuery = useQuery({
    queryKey: ["cal-holidays", orgId, startStr, endStr],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_calendar")
        .select("id, title, type, start_date, end_date, affects_classes")
        .eq("org_id", orgId!)
        .lte("start_date", endStr)
        .gte("end_date", startStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── 4. Sessions (real data) ──────────────────────────────────────────
  const sessionsQuery = useQuery({
    queryKey: ["cal-sessions", orgId, startStr, endStr],
    enabled: !!orgId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_sessions")
        .select("id, class_id, schedule_id, date, actual_teacher_id, status")
        .eq("org_id", orgId!)
        .gte("date", startStr)
        .lte("date", endStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── 5. Global events (optional) ──────────────────────────────────────
  const globalEventsQuery = useQuery({
    queryKey: ["cal-global-events", orgId, startStr, endStr],
    enabled: !!orgId && includeGlobalEvents,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, titre, description, date, pole")
        .eq("org_id", orgId!)
        .gte("date", startStr)
        .lte("date", endStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Merge logic ──────────────────────────────────────────────────────
  const events: CalendarEvent[] = useMemo(() => {
    const schedules = schedulesQuery.data ?? [];
    const classes = classesQuery.data ?? [];
    const subjects = subjectsQuery.data ?? [];
    const profiles = profilesQuery.data ?? [];
    const holidays = calendarQuery.data ?? [];
    const sessions = sessionsQuery.data ?? [];
    const globalEvents = globalEventsQuery.data ?? [];

    // Look-ups
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    const profileMap = new Map(profiles.map((p) => [p.id, p.display_name]));

    // Index sessions by "classId|date" for O(1) lookup
    const sessionIndex = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      sessionIndex.set(`${s.class_id}|${s.date}`, s);
    }

    // Holiday intervals for quick check
    const holidayIntervals = holidays
      .filter((h) => h.affects_classes)
      .map((h) => ({
        start: parseISO(h.start_date),
        end: parseISO(h.end_date),
      }));

    const isHoliday = (d: Date): boolean =>
      holidayIntervals.some((iv) => isWithinInterval(d, iv));

    const result: CalendarEvent[] = [];
    const allDays = dateRange(startDate, endDate);

    // ── Project schedules onto dates ───────────────────────────────────
    for (const sched of schedules) {
      const cls = classMap.get(sched.class_id);
      if (!cls) continue;

      // Apply optional filters
      if (classId && sched.class_id !== classId) continue;
      if (teacherId && cls.prof_id !== teacherId) continue;

      const subjectNames = (sched.subject_ids ?? [])
        .map((sid: string) => subjectMap.get(sid))
        .filter(Boolean) as string[];

      for (const day of allDays) {
        if (getDay(day) !== jsDay(sched.day_of_week)) continue;

        const dateStr = format(day, "yyyy-MM-dd");
        const session = sessionIndex.get(`${sched.class_id}|${dateStr}`);
        const onHoliday = isHoliday(day);

        const [sh, sm] = sched.start_time.split(":").map(Number);
        const [eh, em] = sched.end_time.split(":").map(Number);
        const startDt = new Date(day);
        startDt.setHours(sh, sm, 0, 0);
        const endDt = new Date(day);
        endDt.setHours(eh, em, 0, 0);

        let status: CalendarEventStatus = "scheduled";
        if (onHoliday) status = "cancelled";
        else if (session) status = (session.status === "completed" ? "completed" : "scheduled");

        const isReplacement =
          !!session &&
          !!cls.prof_id &&
          session.actual_teacher_id !== cls.prof_id;

        result.push({
          id: session?.id ?? `${sched.id}_${dateStr}`,
          title: `${cls.nom}${subjectNames.length ? ` — ${subjectNames.join(", ")}` : ""}`,
          start: startDt,
          end: endDt,
          type: "session",
          status,
          classId: sched.class_id,
          className: cls.nom,
          classNiveau: cls.niveau ?? null,
          isReplacement,
          actualTeacherId: session?.actual_teacher_id ?? null,
          actualTeacherName: session?.actual_teacher_id ? (profileMap.get(session.actual_teacher_id) ?? null) : null,
          assignedTeacherId: cls.prof_id,
          assignedTeacherName: cls.prof_id ? (profileMap.get(cls.prof_id) ?? null) : null,
          scheduleId: sched.id,
          sessionId: session?.id ?? null,
          subjectNames,
        });
      }
    }

    // ── Holiday events ─────────────────────────────────────────────────
    for (const h of holidays) {
      result.push({
        id: h.id,
        title: h.title,
        start: parseISO(h.start_date),
        end: parseISO(h.end_date),
        type: "holiday",
        status: "cancelled",
        classId: null,
        className: null,
        classNiveau: null,
        isReplacement: false,
        actualTeacherId: null,
        actualTeacherName: null,
        assignedTeacherId: null,
        assignedTeacherName: null,
        scheduleId: null,
        sessionId: null,
        subjectNames: [],
        meta: { calendarType: h.type, affectsClasses: h.affects_classes },
      });
    }

    // ── Global events ──────────────────────────────────────────────────
    if (includeGlobalEvents) {
      for (const ev of globalEvents) {
        const d = parseISO(ev.date);
        result.push({
          id: ev.id,
          title: ev.titre,
          start: d,
          end: d,
          type: "global_event",
          status: "scheduled",
          classId: null,
          className: null,
          classNiveau: null,
          isReplacement: false,
          actualTeacherId: null,
          actualTeacherName: null,
          assignedTeacherId: null,
          assignedTeacherName: null,
          scheduleId: null,
          sessionId: null,
          subjectNames: [],
          meta: { pole: ev.pole, description: ev.description },
        });
      }
    }

    // Sort chronologically
    result.sort((a, b) => a.start.getTime() - b.start.getTime());
    return result;
  }, [
    schedulesQuery.data,
    classesQuery.data,
    subjectsQuery.data,
    profilesQuery.data,
    calendarQuery.data,
    sessionsQuery.data,
    globalEventsQuery.data,
    startDate,
    endDate,
    teacherId,
    classId,
    includeGlobalEvents,
  ]);

  const isLoading =
    schedulesQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    profilesQuery.isLoading ||
    calendarQuery.isLoading ||
    sessionsQuery.isLoading ||
    (includeGlobalEvents && globalEventsQuery.isLoading);

  return { events, isLoading };
}
