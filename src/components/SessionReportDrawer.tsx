import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save, Notebook, ListTodo, BookOpen, ChevronRight, Flag, Footprints, History, Trophy, CheckCircle2, Copy, Target, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SchemaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  max?: number;
  options?: string[];
}

interface SessionReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; prenom: string; nom: string } | null;
  classId: string;
  subjectId?: string | null;
  onReportSaved?: (studentId: string) => void;
  forDate?: string;
}

export function SessionReportDrawer({
  open,
  onOpenChange,
  student,
  classId,
  subjectId,
  onReportSaved,
  forDate,
}: SessionReportDrawerProps) {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const targetDate = forDate ?? format(new Date(), "yyyy-MM-dd");
  const isEditMode = !!forDate;

  // ── Fetch session config ──
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["session_config", orgId, subjectId],
    enabled: open && !!orgId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("*")
        .eq("org_id", orgId!)
        .eq("subject_id", subjectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch subjects for this class (fallback picker) ──
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["class_subjects_for_report", classId],
    enabled: open && !!classId && !subjectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_class_subjects")
        .select("subject_id, subject:madrasa_subjects(id, name)")
        .eq("class_id", classId);
      return (data ?? []).map((r: any) => r.subject).filter(Boolean) as { id: string; name: string }[];
    },
  });

  const [pickedSubjectId, setPickedSubjectId] = useState<string>("");

  const { data: pickedConfig, isLoading: loadingPickedConfig } = useQuery({
    queryKey: ["session_config", orgId, pickedSubjectId],
    enabled: open && !!orgId && !!pickedSubjectId && !subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_session_configs")
        .select("*")
        .eq("org_id", orgId!)
        .eq("subject_id", pickedSubjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Fetch subject name for title ──
  const { data: subjectInfo } = useQuery({
    queryKey: ["subject_name", subjectId ?? pickedSubjectId],
    enabled: open && !!(subjectId ?? pickedSubjectId),
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_subjects")
        .select("name")
        .eq("id", (subjectId ?? pickedSubjectId)!)
        .maybeSingle();
      return data;
    },
  });

  const activeConfig = subjectId ? config : pickedConfig;
  const isLoadingActiveConfig = subjectId ? loadingConfig : loadingPickedConfig;
  const effectiveSubjectId = subjectId ?? pickedSubjectId;

  const schema: SchemaField[] = activeConfig?.form_schema_json
    ? (activeConfig.form_schema_json as unknown as SchemaField[])
    : [];

  // ── Student Goal for this subject ──
  const currentYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const { data: studentGoal, isLoading: loadingGoal } = useQuery({
    queryKey: ["student_goal", student?.id, effectiveSubjectId, currentYear],
    enabled: open && !!student?.id && !!effectiveSubjectId && !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_student_goals")
        .select("*")
        .eq("student_id", student!.id)
        .eq("subject_id", effectiveSubjectId!)
        .eq("org_id", orgId!)
        .eq("academic_year", currentYear)
        .maybeSingle();
      return data;
    },
  });

  // ── Previous session recall ──
  const { data: previousProgress, isLoading: loadingPrevious } = useQuery({
    queryKey: ["previous_progress", student?.id, classId, effectiveSubjectId],
    enabled: open && !!student?.id && !!activeConfig?.id && !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("data_json, lesson_date")
        .eq("student_id", student!.id)
        .eq("class_id", classId)
        .eq("config_id", activeConfig!.id)
        .eq("org_id", orgId!)
        .lt("lesson_date", targetDate)
        .order("lesson_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const previousData = previousProgress?.data_json
    ? (previousProgress.data_json as Record<string, string>)
    : null;

  const previousTodo = previousData?.["_todo_next"] ?? null;

  // ── Existing progress for today ──
  const { data: existingProgress } = useQuery({
    queryKey: ["student_progress", student?.id, classId, targetDate, activeConfig?.id],
    enabled: open && !!student?.id && !!activeConfig?.id && !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_student_progress")
        .select("*")
        .eq("student_id", student!.id)
        .eq("class_id", classId)
        .eq("lesson_date", targetDate)
        .eq("config_id", activeConfig!.id)
        .eq("org_id", orgId!)
        .maybeSingle();
      return data;
    },
  });

  // ── Form state ──
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [todoNext, setTodoNext] = useState("");
  const [newPosition, setNewPosition] = useState<string>("");
  const [masteryValidated, setMasteryValidated] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingProgress?.data_json) {
      const saved = existingProgress.data_json as Record<string, string>;
      setFormData(saved);
      setTodoNext(saved["_todo_next"] ?? "");
      setNewPosition(saved["_goal_position"] ?? "");
      setMasteryValidated(saved["_mastery"] === "true");
    } else {
      // ── Smart-Fill from previous session ──
      const smartFilled: Record<string, string> = {};
      if (previousData) {
        // Pre-fill "content" type fields with previous todo
        const prevTodo = previousData["_todo_next"];
        if (prevTodo) {
          const contentField = schema.find(
            (f) => f.type === "text" || f.type === "textarea"
          );
          if (contentField) smartFilled[contentField.key] = prevTodo;
        }
      }
      setFormData(smartFilled);
      setTodoNext("");
      setMasteryValidated(false);
    }
  }, [open, existingProgress, previousData, schema]);

  // Pre-fill newPosition from previous session or goal
  useEffect(() => {
    if (!open || existingProgress) return;
    if (previousData?.["_goal_position"]) {
      setNewPosition(previousData["_goal_position"]);
    } else if (studentGoal) {
      setNewPosition(String(studentGoal.current_position));
    }
  }, [open, existingProgress, previousData, studentGoal]);

  useEffect(() => {
    if (!open) {
      setPickedSubjectId("");
      setShowCelebration(false);
    }
  }, [open]);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Goal progress calculations ──
  const goalProgress = useMemo(() => {
    if (!studentGoal || studentGoal.target_value <= 0) return null;
    const current = Number(studentGoal.current_position);
    const target = Number(studentGoal.target_value);
    const newPos = newPosition ? Number(newPosition) : current;
    const currentPct = Math.min(100, Math.round((current / target) * 100));
    const newPct = Math.min(100, Math.round((newPos / target) * 100));
    return { current, target, newPos, currentPct, newPct, unit: studentGoal.unit_label };
  }, [studentGoal, newPosition]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!student || !activeConfig || !orgId) throw new Error("Données manquantes");

      for (const field of schema) {
        if (field.type === "number" && formData[field.key]) {
          const num = Number(formData[field.key]);
          if (isNaN(num) || num < 0 || (field.max && num > field.max)) {
            throw new Error(`${field.label} : valeur invalide (max ${field.max ?? "∞"})`);
          }
        }
      }

      const dataToSave = { ...formData, _todo_next: todoNext, _goal_position: newPosition, _mastery: String(masteryValidated) };

      if (existingProgress) {
        const { error } = await supabase
          .from("madrasa_student_progress")
          .update({ data_json: dataToSave, updated_at: new Date().toISOString() })
          .eq("id", existingProgress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("madrasa_student_progress")
          .insert({
            student_id: student.id,
            class_id: classId,
            lesson_date: targetDate,
            config_id: activeConfig.id,
            data_json: dataToSave,
            org_id: orgId,
          });
        if (error) throw error;
      }

      // ── Conditional goal update: mastery toggle OR score >= 4/5 ──
      const hasHighScore = schema.some(
        (f) => f.type === "number" && f.max === 5 && Number(formData[f.key] ?? 0) >= 4
      );
      const shouldUpdateGoal = masteryValidated || hasHighScore;

      if (studentGoal && newPosition && shouldUpdateGoal && Number(newPosition) !== Number(studentGoal.current_position)) {
        const { error: goalErr } = await supabase
          .from("madrasa_student_goals")
          .update({ current_position: Number(newPosition) })
          .eq("id", studentGoal.id);
        if (goalErr) throw goalErr;
      }

      // Check if goal reached for celebration
      const reachedGoal = studentGoal && shouldUpdateGoal && Number(newPosition) >= Number(studentGoal.target_value);
      return { reachedGoal };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["student_progress"] });
      queryClient.invalidateQueries({ queryKey: ["previous_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student_goal"] });
      queryClient.invalidateQueries({ queryKey: ["student_goals"] });

      if (result?.reachedGoal) {
        setShowCelebration(true);
        toast({ title: "🎉 Objectif annuel atteint !", description: `${student?.prenom} a terminé son objectif. MashaAllah !` });
        setTimeout(() => {
          if (student) onReportSaved?.(student.id);
          onOpenChange(false);
        }, 2200);
      } else {
        toast({ title: "Rapport enregistré ✅", description: `${student?.prenom} ${student?.nom}` });
        if (student) onReportSaved?.(student.id);
        onOpenChange(false);
      }
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  if (!student) return null;

  const drawerTitle = subjectInfo?.name
    ? `${student.prenom} — Suivi ${subjectInfo.name}`
    : `${student.prenom} ${student.nom} — Suivi`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-[550px] p-0">
        {/* Header + Ghost Progress */}
        <div className="shrink-0 border-b border-border">
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="flex items-center gap-2 text-brand-navy text-base">
              <Notebook className="h-4 w-4 text-brand-cyan" />
              {drawerTitle}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {format(new Date(), "d MMMM yyyy", { locale: fr })}
            </SheetDescription>
          </SheetHeader>

          {/* ── Ghost Progress Bar (pinned in header) ── */}
          {activeConfig && !loadingGoal && goalProgress && (
            <div className="px-5 pb-3 space-y-1.5">
              {/* Stats row */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-brand-navy">
                  <Flag className="h-3 w-3 text-brand-emerald" />
                  {goalProgress.target} {goalProgress.unit}
                </span>
                <span className="text-muted-foreground">
                  {goalProgress.current} → {goalProgress.newPos} {goalProgress.unit}
                </span>
              </div>

              {/* Dual-color bar */}
              <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                {/* Solid: acquired progress */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-emerald transition-all duration-300"
                  style={{ width: `${goalProgress.currentPct}%` }}
                />
                {/* Ghost: new progress being typed */}
                {goalProgress.newPct > goalProgress.currentPct && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-brand-cyan/40 transition-all duration-300"
                    style={{ width: `${goalProgress.newPct}%` }}
                  />
                )}
                {/* Solid on top (re-layer so it's visible over ghost) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-emerald transition-all duration-300"
                  style={{ width: `${goalProgress.currentPct}%` }}
                />
              </div>

              {/* Percentage label */}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {goalProgress.currentPct !== goalProgress.newPct
                    ? `${goalProgress.currentPct}% → ${goalProgress.newPct}%`
                    : `${goalProgress.currentPct}%`}
                </span>
                <span>{goalProgress.newPos} / {goalProgress.target} {goalProgress.unit}</span>
              </div>

              {/* Inline position input */}
              <div className="flex items-center gap-2 pt-0.5">
                <Label className="text-[11px] font-medium whitespace-nowrap text-brand-navy">
                  Nouvelle position
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={goalProgress.target}
                  step={1}
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="h-7 w-20 text-sm"
                  placeholder={String(goalProgress.current)}
                />
                <span className="text-[11px] text-muted-foreground">{goalProgress.unit}</span>
              </div>
            </div>
          )}
          {activeConfig && loadingGoal && (
            <div className="px-5 pb-3">
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── ZONE A: Le Miroir du Passé ── */}
          {activeConfig && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-brand-cyan" />
                  <span className="text-xs font-semibold text-brand-navy">
                    {loadingPrevious
                      ? "Chargement…"
                      : previousProgress?.lesson_date
                        ? `⏪ Rappel : Séance du ${format(new Date(previousProgress.lesson_date), "d MMM yyyy", { locale: fr })}`
                        : "Première séance pour ce sujet"}
                  </span>
                </div>
                {/* Copy previous notes button */}
                {previousData && !loadingPrevious && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-brand-cyan hover:text-brand-cyan/80 gap-1"
                    onClick={() => {
                      const copied: Record<string, string> = {};
                      schema.forEach((f) => {
                        if (previousData[f.key]) copied[f.key] = previousData[f.key];
                      });
                      setFormData((prev) => ({ ...prev, ...copied }));
                      toast({ title: "Notes copiées", description: "Les valeurs précédentes ont été reportées." });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copier
                  </Button>
                )}
              </div>
              {loadingPrevious ? (
                <Skeleton className="h-10 w-full" />
              ) : previousData ? (
                <div className="space-y-1.5">
                  {schema.map((field) => {
                    const val = previousData[field.key];
                    if (!val) return null;
                    return (
                      <div key={field.key} className="flex items-baseline gap-2 text-xs">
                        <span className="font-medium text-muted-foreground whitespace-nowrap">{field.label} :</span>
                        <span className="text-foreground">{val}{field.type === "number" && field.max ? ` / ${field.max}` : ""}</span>
                      </div>
                    );
                  })}
                  {previousData["_goal_position"] && goalProgress && (
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="font-medium text-muted-foreground whitespace-nowrap">Position :</span>
                      <span className="text-foreground">{previousData["_goal_position"]} {goalProgress.unit}</span>
                    </div>
                  )}
                  {previousTodo && (
                    <div className="mt-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 px-2.5 py-1.5">
                      <span className="text-xs font-semibold text-brand-navy flex items-center gap-1">
                        <ListTodo className="h-3 w-3 text-brand-cyan" />
                        À faire aujourd'hui
                      </span>
                      <p className="text-sm text-foreground leading-snug mt-0.5">{previousTodo}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  En attente de synchronisation…
                </p>
              )}
            </div>
          )}

          {/* ── ZONE B: Saisie du Jour ── */}
          {activeConfig && <Separator className="my-1" />}
          {activeConfig && (
            <div className="flex items-center gap-1.5 -mb-1">
              <BookOpen className="h-3.5 w-3.5 text-brand-emerald" />
              <span className="text-xs font-semibold text-brand-navy">
                📑 Saisie du jour — {format(new Date(targetDate), "d MMMM yyyy", { locale: fr })}
              </span>
            </div>
          )}

          {/* Subject picker if no subjectId */}
          {!subjectId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-brand-navy">Matière du cours</Label>
              {classSubjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune matière liée à cette classe.</p>
              ) : (
                <Select value={pickedSubjectId} onValueChange={setPickedSubjectId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Sélectionner la matière…" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Dynamic form */}
          {isLoadingActiveConfig ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !activeConfig && effectiveSubjectId ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center">
              <Notebook className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune configuration pour cette matière.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Un administrateur doit configurer les champs.
              </p>
            </div>
          ) : schema.length > 0 ? (
            <div className="space-y-3">
              {schema.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-medium">
                    {field.label}
                    {field.type === "number" && field.max && (
                      <span className="text-muted-foreground font-normal"> (/{field.max})</span>
                    )}
                  </Label>
                  {field.type === "text" && (
                    <Input
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-8 text-sm"
                      placeholder={field.label}
                    />
                  )}
                  {field.type === "number" && (
                    <Input
                      type="number"
                      min={0}
                      max={field.max}
                      step={0.5}
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={cn(
                        "h-8 w-24 text-sm",
                        formData[field.key] && field.max && Number(formData[field.key]) > field.max
                          && "border-destructive"
                      )}
                      placeholder={`/${field.max ?? ""}`}
                    />
                  )}
                  {field.type === "textarea" && (
                    <Textarea
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={2}
                      placeholder={field.label}
                      className="resize-none text-sm"
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <Select
                      value={formData[field.key] ?? ""}
                      onValueChange={(v) => updateField(field.key, v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Mastery Toggle ── */}
          {activeConfig && goalProgress && (
            <div className="flex items-center justify-between rounded-lg border border-brand-emerald/25 bg-brand-emerald/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-emerald" />
                <Label htmlFor="mastery-toggle" className="text-xs font-semibold text-brand-navy cursor-pointer">
                  Objectif validé et acquis
                </Label>
              </div>
              <Switch
                id="mastery-toggle"
                checked={masteryValidated}
                onCheckedChange={setMasteryValidated}
              />
            </div>
          )}

          {/* To Do section */}
          {activeConfig && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-brand-cyan">
                <ListTodo className="h-3.5 w-3.5" />
                À faire (prochaine séance)
              </Label>
              <Textarea
                value={todoNext}
                onChange={(e) => setTodoNext(e.target.value)}
                rows={2}
                placeholder="Ex: Réviser sourate Al-Baqara v.1-5…"
                className="resize-none text-sm"
              />
            </div>
          )}

          {/* ── Celebration overlay ── */}
          <AnimatePresence>
            {showCelebration && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                  >
                    <Trophy className="h-16 w-16 text-brand-emerald" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-brand-navy">Objectif atteint ! 🎉</h3>
                  <p className="text-sm text-muted-foreground">MashaAllah, {student?.prenom} a terminé son objectif annuel.</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer */}
        <SheetFooter className="shrink-0 border-t border-border px-5 py-3 flex flex-col gap-2">
          {isEditMode && existingProgress?.updated_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Modifié le {format(new Date(existingProgress.updated_at), "dd/MM/yyyy à HH:mm")}
            </p>
          )}
          <div className="flex flex-row gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !activeConfig}
              className="bg-brand-emerald hover:bg-brand-emerald/90 text-white gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isEditMode ? "Mettre à jour le suivi" : "Valider & Suivant"}
              {!isEditMode && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}