import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardCheck, ClipboardList, Loader2, Check, ChevronLeft, Users, AlertTriangle,
  UserCheck, UserX, Clock, ArrowLeft, History, MessageCircle, CheckCircle2, CalendarClock, PlayCircle, Handshake,
  Send, ExternalLink, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttendanceHistory } from "@/components/AttendanceHistory";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";
import { WA_DEFAULT_ABSENCE_TEMPLATE, WA_DEFAULT_SESSION_REPORT } from "@/components/madrasa/CommunicationsTab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface ClassInfo {
  id: string;
  nom: string;
  niveau: string | null;
  studentCount: number;
}

interface ScheduledCourse {
  scheduleId: string;
  classInfo: ClassInfo;
  startTime: string;
  endTime: string;
  profId: string | null;
  profName: string | null;
}

interface StudentRow {
  enrollment_id: string;
  student_id: string;
  prenom: string;
  nom: string;
  niveau: string | null;
  absenceCount: number;
}

interface AttendanceEntry {
  enrollment_id: string;
  status: AttendanceStatus;
}

/** Convert JS getDay() (0=Sun) to our DB day_of_week (1=Mon..7=Sun) */
function jsDayToDbDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: React.ElementType; cls: string; activeCls: string }> = {
  present: { label: "Présent", icon: UserCheck, cls: "border-border text-muted-foreground", activeCls: "bg-green-500 text-white border-green-500" },
  absent:  { label: "Absent",  icon: UserX,     cls: "border-border text-muted-foreground", activeCls: "bg-destructive text-destructive-foreground border-destructive" },
  late:    { label: "Retard",  icon: Clock,      cls: "border-border text-muted-foreground", activeCls: "bg-amber-500 text-white border-amber-500" },
  excused: { label: "Excusé",  icon: Check,      cls: "border-border text-muted-foreground", activeCls: "bg-blue-500 text-white border-blue-500" },
};

const Attendance = () => {
  const queryClient = useQueryClient();
  const { orgId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const autoSelectClassId = searchParams.get("class");
  const autoSelectDone = useRef(false);

  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [openingScheduleId, setOpeningScheduleId] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [entries, setEntries] = useState<Map<string, AttendanceStatus>>(new Map());
  const [existingAttendance, setExistingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState(3);
  const [reportStudent, setReportStudent] = useState<{ id: string; prenom: string; nom: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [completedReports, setCompletedReports] = useState<Set<string>>(new Set());
  const [notifiedAbsences, setNotifiedAbsences] = useState<Set<string>>(new Set());
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayDbDay = jsDayToDbDay(new Date().getDay());

  // ── Fetch today's scheduled courses for entire org ──
  const { data: allCourses = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ["today_schedules", orgId, user?.id, todayDbDay],
    enabled: !!orgId && !!user,
    queryFn: async () => {
      // Get user's profile id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!profile) return [];

      // Fetch schedules for today's day_of_week
      const { data: schedules, error: schedErr } = await supabase
        .from("madrasa_schedules")
        .select("id, day_of_week, start_time, end_time, class_id")
        .eq("org_id", orgId!)
        .eq("day_of_week", todayDbDay);
      if (schedErr) throw schedErr;
      if (!schedules || schedules.length === 0) return [];

      // Fetch classes for those schedules
      const classIds = [...new Set(schedules.map((s) => s.class_id))];
      const { data: classData } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau, prof_id")
        .eq("org_id", orgId!)
        .in("id", classIds);
      const classMap = new Map((classData ?? []).map((c: any) => [c.id, c]));

      // Fetch prof display names
      const profIds = [...new Set((classData ?? []).map((c: any) => c.prof_id).filter(Boolean))];
      const profNameMap = new Map<string, string>();
      if (profIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", profIds);
        for (const p of profs ?? []) {
          profNameMap.set(p.id, p.display_name);
        }
      }

      // Count enrolled students per class
      const countMap: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("org_id", orgId!)
          .eq("statut", "Actif");
        for (const e of enrollments ?? []) {
          countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1;
        }
      }

      // Build result sorted by start_time (include ALL courses)
      const courses: (ScheduledCourse & { _profileId: string })[] = schedules
        .filter((s) => classMap.has(s.class_id))
        .map((s) => {
          const cls = classMap.get(s.class_id)!;
          return {
            scheduleId: s.id,
            classInfo: {
              id: cls.id,
              nom: cls.nom,
              niveau: cls.niveau,
              studentCount: countMap[cls.id] ?? 0,
            },
            startTime: (s.start_time as string).slice(0, 5),
            endTime: (s.end_time as string).slice(0, 5),
            profId: cls.prof_id ?? null,
            profName: cls.prof_id ? profNameMap.get(cls.prof_id) ?? null : null,
            _profileId: profile.id,
          };
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      return courses;
    },
  });

  // Split into my courses vs other teachers' courses
  const myProfileId = allCourses[0]?._profileId ?? null;
  const scheduledCourses = useMemo(() => allCourses.filter((c) => c.profId === myProfileId || !c.profId), [allCourses, myProfileId]);
  const otherCourses = useMemo(() => allCourses.filter((c) => c.profId && c.profId !== myProfileId), [allCourses, myProfileId]);

  // ── Pre-check which classes already have a session today ──
  const scheduledClassIds = useMemo(() => allCourses.map((c) => c.classInfo.id), [allCourses]);
  const { data: existingSessionsMap = new Map<string, string>() } = useQuery({
    queryKey: ["today_sessions_check", orgId, today, scheduledClassIds],
    enabled: !!orgId && scheduledClassIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_sessions")
        .select("id, class_id")
        .eq("org_id", orgId!)
        .eq("date", today)
        .in("class_id", scheduledClassIds);
      const map = new Map<string, string>();
      for (const s of data ?? []) {
        map.set(s.class_id, s.id);
      }
      return map;
    },
  });


  // ── Fetch settings threshold + absence template ──
  const { data: madrasaSettings } = useQuery({
    queryKey: ["madrasa_settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_settings")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (madrasaSettings?.attendance_threshold) setThreshold(madrasaSettings.attendance_threshold);
  }, [madrasaSettings]);


  const generateAbsenceMessage = useCallback((studentPrenom: string) => {
    const rawTpl = (madrasaSettings as Record<string, unknown> | null)?.["whatsapp_absence_template"] as string | null;
    const tpl = rawTpl || WA_DEFAULT_ABSENCE_TEMPLATE;
    const dateStr = format(new Date(), "d MMMM yyyy", { locale: fr });
    const message = tpl
      .replace(/\[PRENOM\]/g, studentPrenom)
      .replace(/\[DATE\]/g, dateStr);
    return encodeURIComponent(message);
  }, [madrasaSettings]);

  // ── Select class → load students & existing attendance ──
  const handleSelectClass = useCallback(async (cls: ClassInfo) => {
    if (!orgId) return;
    setSelectedClass(cls);
    setLoadingStudents(true);
    setSaved(false);

    try {
      // Get enrolled students
      const { data: enrollData, error: enrollErr } = await supabase
        .from("madrasa_enrollments")
        .select("id, student:madrasa_students!madrasa_enrollments_student_id_fkey(id, prenom, nom, niveau)")
        .eq("class_id", cls.id)
        .eq("org_id", orgId)
        .eq("statut", "Actif");

      if (enrollErr) throw enrollErr;

      const enrollments = (enrollData ?? []).map((e: any) => ({
        enrollment_id: e.id,
        student_id: e.student?.id ?? "",
        prenom: e.student?.prenom ?? "",
        nom: e.student?.nom ?? "",
        niveau: e.student?.niveau ?? null,
        absenceCount: 0,
      }));

      // Count total absences for each enrollment (for threshold warning)
      if (enrollments.length > 0) {
        const enrollIds = enrollments.map((e) => e.enrollment_id);
        const { data: absences } = await supabase
          .from("madrasa_attendance")
          .select("enrollment_id")
          .in("enrollment_id", enrollIds)
          .eq("status", "absent")
          .eq("org_id", orgId);

        const absMap: Record<string, number> = {};
        for (const a of absences ?? []) {
          absMap[a.enrollment_id] = (absMap[a.enrollment_id] ?? 0) + 1;
        }
        for (const e of enrollments) {
          e.absenceCount = absMap[e.enrollment_id] ?? 0;
        }
      }

      // Check existing attendance for today
      const enrollIds = enrollments.map((e) => e.enrollment_id);
      const initEntries = new Map<string, AttendanceStatus>();

      if (enrollIds.length > 0) {
        const { data: existing } = await supabase
          .from("madrasa_attendance")
          .select("enrollment_id, status")
          .in("enrollment_id", enrollIds)
          .eq("date", today)
          .eq("org_id", orgId);

        if (existing && existing.length > 0) {
          setExistingAttendance(true);
          for (const a of existing) {
            initEntries.set(a.enrollment_id, a.status as AttendanceStatus);
          }
        } else {
          setExistingAttendance(false);
        }
      }

      // Default all to present if no existing data
      for (const e of enrollments) {
        if (!initEntries.has(e.enrollment_id)) {
          initEntries.set(e.enrollment_id, "present");
        }
      }

      setStudents(enrollments.sort((a, b) => a.nom.localeCompare(b.nom)));
      setEntries(initEntries);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoadingStudents(false);
    }
  }, [orgId, today, toast]);

  // ── JIT Session creation / retrieval ──
  const handleOpenSession = useCallback(async (course: ScheduledCourse) => {
    if (!orgId || !user) return;
    setOpeningScheduleId(course.scheduleId);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new Error("Profil introuvable");

      const { data: existing } = await supabase
        .from("madrasa_sessions")
        .select("id")
        .eq("class_id", course.classInfo.id)
        .eq("date", today)
        .eq("org_id", orgId)
        .maybeSingle();

      let sessionId: string;

      if (existing) {
        sessionId = existing.id;
      } else {
        const { data: newSession, error: insertErr } = await supabase
          .from("madrasa_sessions")
          .insert({
            org_id: orgId,
            class_id: course.classInfo.id,
            schedule_id: course.scheduleId,
            actual_teacher_id: profile.id,
            date: today,
            status: "completed",
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        sessionId = newSession.id;
      }

      setActiveSessionId(sessionId);
      queryClient.invalidateQueries({ queryKey: ["today_sessions_check"] });
      handleSelectClass(course.classInfo);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setOpeningScheduleId(null);
    }
  }, [orgId, user, today, queryClient, toast, handleSelectClass]);

  // ── Auto-select class from URL param (?class=ID) ──
  useEffect(() => {
    if (autoSelectDone.current || !autoSelectClassId || !allCourses.length || loadingSchedules) return;
    const match = allCourses.find((c) => c.classInfo.id === autoSelectClassId);
    if (match) {
      autoSelectDone.current = true;
      const existingSessionId = existingSessionsMap.get(match.classInfo.id);
      if (existingSessionId) {
        setActiveSessionId(existingSessionId);
      }
      handleSelectClass(match.classInfo);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("class");
        return next;
      }, { replace: true });
    }
  }, [autoSelectClassId, allCourses, loadingSchedules, existingSessionsMap, handleSelectClass, setSearchParams]);


  const studentIds = useMemo(() => students.map((s) => s.student_id), [students]);
  const { data: todayProgressIds = [] } = useQuery({
    queryKey: ["today_progress_ids", orgId, selectedClass?.id, today],
    enabled: !!orgId && !!selectedClass && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("student_id")
        .eq("org_id", orgId!)
        .eq("class_id", selectedClass!.id)
        .eq("lesson_date", today)
        .in("student_id", studentIds);
      return (data ?? []).map((r) => r.student_id);
    },
  });

  // Merge DB progress with session-saved reports
  const allCompletedReports = useMemo(() => {
    const set = new Set(completedReports);
    for (const id of todayProgressIds) set.add(id);
    return set;
  }, [completedReports, todayProgressIds]);

  // ── Toggle status ──
  const setStatus = (enrollmentId: string, status: AttendanceStatus) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(enrollmentId, status);
      return next;
    });
  };

  // ── Summary ──
  const summary = useMemo(() => {
    let present = 0, absent = 0, late = 0, excused = 0;
    entries.forEach((s) => {
      if (s === "present") present++;
      else if (s === "absent") absent++;
      else if (s === "late") late++;
      else excused++;
    });
    return { present, absent, late, excused, total: entries.size };
  }, [entries]);

  // ── Save ──
  const handleSave = async () => {
    if (!orgId || !selectedClass) return;
    setSaving(true);
    try {
      const enrollIds = Array.from(entries.keys());

      if (existingAttendance) {
        // Update existing
        for (const [enrollId, status] of entries) {
          await supabase
            .from("madrasa_attendance")
            .update({ status, session_id: activeSessionId })
            .eq("enrollment_id", enrollId)
            .eq("date", today)
            .eq("org_id", orgId);
        }
      } else {
        // Insert new
        const rows = Array.from(entries).map(([enrollment_id, status]) => ({
          enrollment_id,
          status,
          date: today,
          org_id: orgId,
          session_id: activeSessionId,
        }));
        const { error } = await supabase.from("madrasa_attendance").insert(rows);
        if (error) throw error;
      }

      setSaved(true);
      setExistingAttendance(true);
      toast({
        title: existingAttendance ? "Appel mis à jour ✅" : "Appel enregistré ✅",
        description: `${summary.present} présent(s), ${summary.absent} absent(s), ${summary.late} retard(s)`,
      });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Close session mutation ──
  const generateSessionMessage = useCallback(() => {
    const rawTpl = (madrasaSettings as Record<string, unknown> | null)?.["session_report_template"] as string | null;
    const tpl = rawTpl || WA_DEFAULT_SESSION_REPORT;
    const dateStr = format(new Date(), "d MMMM yyyy", { locale: fr });

    // Find current course info
    const currentCourse = allCourses.find((c) => c.classInfo.id === selectedClass?.id);
    const profName = currentCourse?.profName ?? "—";

    const message = tpl
      .replace(/\{nom_classe\}/g, selectedClass?.nom ?? "—")
      .replace(/\{date\}/g, dateStr)
      .replace(/\{prof\}/g, profName)
      .replace(/\{presents\}/g, `${summary.present + summary.late}/${summary.total} élèves`)
      .replace(/\{bilan_collectif\}/g, summaryNote);

    return message;
  }, [madrasaSettings, selectedClass, allCourses, summary, summaryNote]);

  const closeSession = useMutation({
    mutationFn: async () => {
      if (!activeSessionId || !orgId) throw new Error("Aucune session active");
      if (!summaryNote.trim()) throw new Error("Le bilan est obligatoire");

      const { error } = await (supabase.from("madrasa_sessions") as any)
        .update({
          summary_note: summaryNote.trim(),
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activeSessionId)
        .eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: async () => {
      const message = generateSessionMessage();
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        // clipboard might not be available
      }
      setSessionCompleted(true);
      setCloseDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["today_sessions_check"] });
      toast({
        title: "Bilan enregistré et copié ! ✅",
        description: "Le message a été copié dans le presse-papier.",
      });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Class selection view ──
  if (!selectedClass) {
    return (
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Faire l'appel</h1>
              <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
            </div>
          </div>

          <Tabs defaultValue="appel" className="w-full">
            <TabsList>
              <TabsTrigger value="appel" className="gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Appel du jour
              </TabsTrigger>
              <TabsTrigger value="historique" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historique
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appel" className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarClock className="h-4 w-4 text-primary" />
                Mes cours prévus aujourd'hui
              </div>

              {loadingSchedules ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-9 w-full rounded-md" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : scheduledCourses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <CalendarClock className="h-10 w-10 mx-auto opacity-30 mb-3" />
                    <p className="font-medium">Vous n'avez aucun cours prévu aujourd'hui.</p>
                    <p className="text-xs mt-1">Vérifiez le planning ou contactez l'administrateur.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {scheduledCourses.map((course) => (
                    <Card
                      key={course.scheduleId}
                      className="hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{course.classInfo.nom}</span>
                          {course.classInfo.niveau && (
                            <Badge variant="outline" className="text-[10px]">{course.classInfo.niveau}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {course.startTime} – {course.endTime}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {course.classInfo.studentCount} élève{course.classInfo.studentCount > 1 ? "s" : ""}
                          </span>
                        </div>
                        {(() => {
                          const hasSession = existingSessionsMap.has(course.classInfo.id);
                          const isOpening = openingScheduleId === course.scheduleId;
                          return (
                            <Button
                              className="w-full"
                              disabled={isOpening}
                              onClick={() => handleOpenSession(course)}
                            >
                              {isOpening ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                              ) : hasSession ? (
                                <PlayCircle className="h-4 w-4 mr-1.5" />
                              ) : (
                                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                              )}
                              {isOpening ? "Ouverture…" : hasSession ? "Reprendre la session" : "Ouvrir la session"}
                            </Button>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── Remplacer un collègue ── */}
              {!loadingSchedules && otherCourses.length > 0 && (
                <Accordion type="single" collapsible className="mt-2">
                  <AccordionItem value="remplacement" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                        Remplacer un collègue
                        <Badge variant="outline" className="ml-1 text-[10px]">{otherCourses.length}</Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {otherCourses.map((course) => (
                          <Card
                            key={course.scheduleId}
                            className="hover:border-primary/50 hover:shadow-sm transition-all"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground">{course.classInfo.nom}</span>
                                {course.classInfo.niveau && (
                                  <Badge variant="outline" className="text-[10px]">{course.classInfo.niveau}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  {course.startTime} – {course.endTime}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5" />
                                  {course.classInfo.studentCount} élève{course.classInfo.studentCount > 1 ? "s" : ""}
                                </span>
                              </div>
                              {course.profName && (
                                <p className="text-xs text-muted-foreground">
                                  Enseignant : <span className="font-medium text-foreground">{course.profName}</span>
                                </p>
                              )}
                              {(() => {
                                const hasSession = existingSessionsMap.has(course.classInfo.id);
                                const isOpening = openingScheduleId === course.scheduleId;
                                return (
                                  <Button
                                    className="w-full"
                                    variant="outline"
                                    disabled={isOpening}
                                    onClick={() => handleOpenSession(course)}
                                  >
                                    {isOpening ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    ) : hasSession ? (
                                      <PlayCircle className="h-4 w-4 mr-1.5" />
                                    ) : (
                                      <Handshake className="h-4 w-4 mr-1.5" />
                                    )}
                                    {isOpening ? "Ouverture…" : hasSession ? "Reprendre la session" : "Ouvrir cette session (Remplacement)"}
                                  </Button>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </TabsContent>

            <TabsContent value="historique" className="mt-4">
              <AttendanceHistory />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    );
  }

  // ── Roll Call view ──
  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => { setSelectedClass(null); setActiveSessionId(null); setSaved(false); setSessionCompleted(false); }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {selectedClass.nom}
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{todayLabel}</p>
          </div>
          {existingAttendance && (
            <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-700 border-amber-400/30 text-[10px] shrink-0">
              Déjà enregistré
            </Badge>
          )}
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-green-500/10 border border-green-400/20 p-2 text-center">
            <p className="text-lg font-bold text-green-700">{summary.present}</p>
            <p className="text-[10px] text-green-600">Présents</p>
          </div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-center">
            <p className="text-lg font-bold text-destructive">{summary.absent}</p>
            <p className="text-[10px] text-destructive">Absents</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-400/20 p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{summary.late}</p>
            <p className="text-[10px] text-amber-600">Retards</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-400/20 p-2 text-center">
            <p className="text-lg font-bold text-blue-600">{summary.excused}</p>
            <p className="text-[10px] text-blue-600">Excusés</p>
          </div>
        </div>

        {loadingStudents ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun élève inscrit dans cette classe.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {students.map((s) => {
              const current = entries.get(s.enrollment_id) ?? "present";
              const overThreshold = s.absenceCount >= threshold;

              return (
                <div
                  key={s.enrollment_id}
                  onClick={() => {
                    setReportStudent({ id: s.student_id, prenom: s.prenom, nom: s.nom });
                    setReportOpen(true);
                  }}
                  className={cn(
                    "rounded-xl border bg-card p-3 transition-all cursor-pointer hover:border-brand-cyan/40 hover:shadow-sm",
                    current === "absent" && "border-destructive/30 bg-destructive/5",
                    current === "late" && "border-amber-400/30 bg-amber-500/5",
                    allCompletedReports.has(s.student_id) && "border-brand-emerald/50 bg-brand-emerald/5",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="font-medium text-sm text-foreground flex-1 truncate">
                      {s.prenom} {s.nom}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {overThreshold && (
                        <span className="flex items-center gap-1 text-amber-600 text-[10px] font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {s.absenceCount} abs.
                        </span>
                      )}
                      {current === "absent" && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {notifiedAbsences.has(s.student_id) ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="h-7 px-2 text-[10px] text-muted-foreground bg-muted/50 border-border"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Notifié
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                  onClick={() => {
                                    window.open(`https://wa.me/?text=${generateAbsenceMessage(s.prenom)}`, "_blank");
                                    setNotifiedAbsences((prev) => new Set(prev).add(s.student_id));
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  Notifier
                                </Button>
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {notifiedAbsences.has(s.student_id)
                                ? "Notification d'absence déjà envoyée"
                                : "Envoyer une notification d'absence via WhatsApp"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={current !== "present" && current !== "late"}
                                className={cn(
                                  "h-7 px-2 text-xs font-medium gap-1",
                                  current !== "present" && current !== "late"
                                    ? "text-muted-foreground/40 opacity-40 cursor-not-allowed"
                                    : allCompletedReports.has(s.student_id)
                                      ? "text-brand-emerald hover:text-brand-emerald/80"
                                      : "text-brand-cyan hover:text-brand-cyan/80"
                                )}
                                onClick={(e) => { e.stopPropagation(); setReportStudent({ id: s.student_id, prenom: s.prenom, nom: s.nom }); setReportOpen(true); }}
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                {allCompletedReports.has(s.student_id) ? "Suivi ✓" : "Saisir le suivi"}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {current !== "present" && current !== "late"
                              ? "L'élève doit être présent pour saisir un suivi"
                              : allCompletedReports.has(s.student_id)
                                ? "Suivi déjà saisi pour cette séance"
                                : "Ouvrir le carnet de suivi pédagogique"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map((status) => {
                      const config = STATUS_CONFIG[status];
                      const Icon = config.icon;
                      const isActive = current === status;

                      return (
                        <button
                          key={status}
                          onClick={() => setStatus(s.enrollment_id, status)}
                          className={cn(
                            "flex flex-col items-center gap-0.5 rounded-lg border py-2.5 px-1 text-[10px] font-medium transition-all active:scale-95",
                            isActive ? config.activeCls : config.cls,
                            "min-h-[52px]"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session completed banner */}
      {sessionCompleted && (
        <div className="rounded-lg border border-brand-emerald/30 bg-brand-emerald/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-emerald">
            <CheckCircle className="h-4 w-4" />
            Séance terminée avec succès
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              const msg = generateSessionMessage();
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Ouvrir WhatsApp
          </Button>
        </div>
      )}

      {/* Fixed bottom CTA */}
      {students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur-sm p-4 md:pl-[calc(var(--sidebar-width,280px)+1rem)]">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{summary.total}</span> élèves •{" "}
              <span className="text-green-600">{summary.present}P</span> /{" "}
              <span className="text-destructive">{summary.absent}A</span> /{" "}
              <span className="text-amber-600">{summary.late}R</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || saved}
                size="lg"
                className="min-w-[140px]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : saved ? (
                  <Check className="h-4 w-4 mr-1.5" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 mr-1.5" />
                )}
                {saved ? "Enregistré ✓" : existingAttendance ? "Mettre à jour" : "Valider l'appel"}
              </Button>
              {sessionCompleted ? (
                <Button
                  variant="outline"
                  size="lg"
                  disabled
                  className="text-brand-emerald border-brand-emerald/30"
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Séance clôturée
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!activeSessionId}
                  onClick={() => { setSummaryNote(""); setCloseDialogOpen(true); }}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Terminer & Partager
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close Session Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bilan de la séance</DialogTitle>
            <DialogDescription>
              Saisissez un résumé global pour les parents (objectifs atteints, comportement général...).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="summary-note">Note collective <span className="text-destructive">*</span></Label>
            <Textarea
              id="summary-note"
              className="min-h-[140px]"
              placeholder="Ex: Révision de la sourate Al-Mulk, versets 1 à 10. Bonne participation générale."
              value={summaryNote}
              onChange={(e) => setSummaryNote(e.target.value)}
            />
            <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Aperçu du message</p>
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {generateSessionMessage()}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => closeSession.mutate()}
              disabled={closeSession.isPending || !summaryNote.trim()}
            >
              {closeSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Valider et copier le bilan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Report Drawer */}
      <SessionReportDrawer
        open={reportOpen}
        onOpenChange={setReportOpen}
        student={reportStudent}
        classId={selectedClass?.id ?? ""}
        activeSessionId={activeSessionId}
        studentsList={students.map((s) => ({ id: s.student_id, prenom: s.prenom, nom: s.nom }))}
        onStudentChange={(s) => setReportStudent(s)}
        onReportSaved={(studentId) => {
          setCompletedReports((prev) => new Set(prev).add(studentId));
          queryClient.invalidateQueries({ queryKey: ["today_progress_ids"] });
        }}
      />
    </main>
  );
};

export default Attendance;
