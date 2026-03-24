import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardCheck, Loader2, Check, ChevronLeft, Users, AlertTriangle,
  UserCheck, UserX, Clock, ArrowLeft, History, Notebook, MessageCircle, CheckCircle2,
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
import { WA_DEFAULT_ABSENCE_TEMPLATE } from "@/components/madrasa/CommunicationsTab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface ClassInfo {
  id: string;
  nom: string;
  niveau: string | null;
  studentCount: number;
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

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

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

  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  // ── Fetch classes for this teacher ──
  const fetchClasses = useCallback(async () => {
    if (!orgId || !user) return;
    setLoadingClasses(true);
    try {
      // Get user's profile id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      // Fetch classes where prof_id matches, or all classes if admin
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = (userRoles ?? []).map((r: any) => r.role);
      const isAdmin = roles.includes("super_admin") || roles.includes("admin") || roles.includes("responsable");

      let query = supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId);

      if (!isAdmin) {
        query = query.eq("prof_id", profile.id);
      }

      const { data: classData, error } = await query.order("nom");
      if (error) throw error;

      // Count enrolled students per class
      const classIds = (classData ?? []).map((c: any) => c.id);
      let countMap: Record<string, number> = {};

      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("org_id", orgId)
          .eq("statut", "Actif");

        for (const e of enrollments ?? []) {
          countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1;
        }
      }

      setClasses(
        (classData ?? []).map((c: any) => ({
          id: c.id,
          nom: c.nom,
          niveau: c.niveau,
          studentCount: countMap[c.id] ?? 0,
        }))
      );
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoadingClasses(false);
    }
  }, [orgId, user, toast]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

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

  // ── Fetch existing progress for today to show indicators ──
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
            .update({ status })
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

            <TabsContent value="appel" className="mt-4">
              {loadingClasses ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : classes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <ClipboardCheck className="h-10 w-10 mx-auto opacity-30 mb-3" />
                    <p className="font-medium">Aucune classe assignée</p>
                    <p className="text-xs mt-1">Demandez à l'administrateur de vous assigner une classe.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => handleSelectClass(cls)}
                      className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 hover:bg-accent/30 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{cls.nom}</span>
                        {cls.niveau && (
                          <Badge variant="outline" className="text-[10px]">{cls.niveau}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{cls.studentCount} élève{cls.studentCount > 1 ? "s" : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
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
            onClick={() => { setSelectedClass(null); setSaved(false); }}
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
                    {allCompletedReports.has(s.student_id) && (
                      <span className="flex items-center gap-1 text-brand-emerald text-[10px] font-medium shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        Suivi
                      </span>
                    )}
                    {overThreshold && (
                      <span className="flex items-center gap-1 text-amber-600 text-[10px] font-medium shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {s.absenceCount} abs.
                      </span>
                    )}
                    <span className={cn("shrink-0", allCompletedReports.has(s.student_id) ? "text-brand-emerald" : "text-muted-foreground/40")}>
                      <Notebook className="h-3.5 w-3.5" />
                    </span>
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
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              size="lg"
              className="min-w-[160px]"
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
          </div>
        </div>
      )}

      {/* Session Report Drawer */}
      <SessionReportDrawer
        open={reportOpen}
        onOpenChange={setReportOpen}
        student={reportStudent}
        classId={selectedClass?.id ?? ""}
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
