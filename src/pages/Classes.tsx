import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BookOpen, Trash2, Loader2, Plus, Users, GraduationCap, Filter, Pencil, TrendingUp, Clock, CalendarDays, School } from "lucide-react";
import { ClassCard } from "@/components/madrasa/ClassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClassProgressBoard } from "@/components/ClassProgressBoard";
import GlobalCalendarView from "@/components/madrasa/GlobalCalendarView";
import { ListingLayout } from "@/components/layout/ListingLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = {
  id: string;
  nom: string;
  niveau: string | null;
  capacity_max: number | null;
  prof_id: string | null;
  salle_id: string | null;
  prof: { display_name: string } | null;
  salle: { name: string } | null;
  subjects: { id: string; name: string }[];
  scheduleSlots: { day_of_week: number; start_time: string; end_time: string; subject_ids: string[] }[];
};

interface ScheduleSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_ids: string[];
}

const DAY_LABELS: Record<number, string> = {
  0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi",
};

const Classes = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ nom: "", niveau: "", prof_id: "", salle_id: "" });
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([
    { day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] },
  ]);
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [progressClassId, setProgressClassId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const isEditing = !!editingClass;

  // ── Fetch classes with joined prof, salle, and subjects ──
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["madrasa_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("*, prof:profiles!madrasa_classes_prof_id_fkey(display_name), salle:rooms!madrasa_classes_salle_id_fkey(name)")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;

      const classIds = (data ?? []).map((c: any) => c.id);
      let subjectMap: Record<string, { id: string; name: string }[]> = {};
      let scheduleMap: Record<string, { day_of_week: number; start_time: string; end_time: string; subject_ids: string[] }[]> = {};

      if (classIds.length > 0) {
        const [linksRes, schedsRes] = await Promise.all([
          supabase.from("madrasa_class_subjects").select("class_id, subject:madrasa_subjects(id, name)").in("class_id", classIds),
          supabase.from("madrasa_schedules").select("class_id, day_of_week, start_time, end_time, subject_ids").in("class_id", classIds).order("day_of_week"),
        ]);
        for (const link of linksRes.data ?? []) {
          if (!subjectMap[link.class_id]) subjectMap[link.class_id] = [];
          if (link.subject) subjectMap[link.class_id].push(link.subject as any);
        }
        for (const s of schedsRes.data ?? []) {
          if (!scheduleMap[s.class_id]) scheduleMap[s.class_id] = [];
          scheduleMap[s.class_id].push({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, subject_ids: (s.subject_ids ?? []) as string[] });
        }
      }

      return (data ?? []).map((c: any) => ({ ...c, subjects: subjectMap[c.id] ?? [], scheduleSlots: scheduleMap[c.id] ?? [] })) as ClassRow[];
    },
  });

  // ── Reference data ──
  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_levels").select("*").eq("org_id", orgId!).order("label");
      if (error) throw error;
      return data as Tables<"madrasa_levels">[];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_subjects").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  // ── Enrollment counts per class ──
  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["madrasa_enrollment_counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("class_id")
        .eq("org_id", orgId!)
        .eq("statut", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.class_id) counts[row.class_id] = (counts[row.class_id] || 0) + 1;
      }
      return counts;
    },
  });

  // ── Fix: Fetch all active profiles in the org (teachers) ──
  const { data: teachers = [] } = useQuery({
    queryKey: ["org_profiles_teachers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as { id: string; display_name: string }[];
    },
  });

  // ── Derived: all unique subject_ids used in schedules ──
  const selectedSubjects = useMemo(() => {
    const ids = new Set<string>();
    schedules.forEach((s) => s.subject_ids.forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [schedules]);

  // ── Schedule helpers ──
  const addSlot = () => setSchedules((prev) => [...prev, { day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] }]);
  const removeSlot = (idx: number) => setSchedules((prev) => prev.filter((_, i) => i !== idx));
  const updateSlot = (idx: number, patch: Partial<ScheduleSlot>) =>
    setSchedules((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const toggleSlotSubject = (idx: number, subjectId: string) =>
    setSchedules((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, subject_ids: s.subject_ids.includes(subjectId) ? s.subject_ids.filter((id) => id !== subjectId) : [...s.subject_ids, subjectId] }
          : s
      )
    );

  // ── Mutations ──
  const saveClass = useMutation({
    mutationFn: async () => {
      if (!form.nom.trim()) throw new Error("Nom requis");

      let classId: string;

      if (isEditing) {
        classId = editingClass.id;
        const { error } = await supabase
          .from("madrasa_classes")
          .update({ nom: form.nom.trim(), niveau: form.niveau || null, prof_id: form.prof_id || null, salle_id: form.salle_id || null })
          .eq("id", classId);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("madrasa_classes")
          .insert({ nom: form.nom.trim(), niveau: form.niveau || null, prof_id: form.prof_id || null, salle_id: form.salle_id || null, org_id: orgId! })
          .select("id")
          .single();
        if (error) throw error;
        classId = created.id;
      }

      // Sync class_subjects from all schedule subject_ids
      await supabase.from("madrasa_class_subjects").delete().eq("class_id", classId);
      if (selectedSubjects.length > 0) {
        const links = selectedSubjects.map((sid) => ({ class_id: classId, subject_id: sid }));
        const { error: linkErr } = await supabase.from("madrasa_class_subjects").insert(links);
        if (linkErr) throw linkErr;
      }

      // Sync schedules: delete old, insert new
      await supabase.from("madrasa_schedules").delete().eq("class_id", classId);
      if (schedules.length > 0) {
        const rows = schedules.map((s) => ({
          class_id: classId,
          org_id: orgId!,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          subject_ids: s.subject_ids,
        }));
        const { error: schedErr } = await supabase.from("madrasa_schedules").insert(rows);
        if (schedErr) throw schedErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: isEditing ? "Classe modifiée" : "Classe créée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("madrasa_class_subjects").delete().eq("class_id", id);
      await supabase.from("madrasa_schedules").delete().eq("class_id", id);
      const { error } = await supabase.from("madrasa_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] }); toast({ title: "Classe supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ nom: "", niveau: "", prof_id: "", salle_id: "" });
    setSchedules([{ day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] }]);
    setEditingClass(null);
  };

  const openEdit = async (c: ClassRow) => {
    setEditingClass(c);
    setForm({ nom: c.nom, niveau: c.niveau ?? "", prof_id: c.prof_id ?? "", salle_id: c.salle_id ?? "" });
    // Load existing schedules for this class
    const { data: existingSchedules } = await supabase
      .from("madrasa_schedules")
      .select("*")
      .eq("class_id", c.id)
      .order("day_of_week");
    if (existingSchedules && existingSchedules.length > 0) {
      setSchedules(existingSchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject_ids: (s.subject_ids ?? []) as string[],
      })));
    } else {
      setSchedules([{ day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] }]);
    }
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <SidebarTrigger />
        </div>

        <Tabs defaultValue="liste" className="w-full">
          <TabsList>
            <TabsTrigger value="liste" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Liste des classes
            </TabsTrigger>
            <TabsTrigger value="progression" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Vue Progrès
            </TabsTrigger>
            <TabsTrigger value="planning" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Planning Global
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="mt-4">
            <ListingLayout
              title="Classes"
              count={filteredClasses.length}
              searchPlaceholder="Rechercher une classe…"
              onSearch={setSearchQuery}
              tabs={levelTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              addAction={
                <Button size="sm" className="gradient-positive border-0" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Nouvelle classe
                </Button>
              }
            >
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-56 rounded-lg" />
                  ))}
                </div>
              ) : filteredClasses.length === 0 && classes.length === 0 ? (
                <EmptyState
                  icon={School}
                  title="Aucune classe créée"
                  description="Commencez par configurer les niveaux et matières dans Configuration > Madrassa, puis créez votre première classe."
                  action={
                    <Button className="gradient-positive border-0" onClick={openCreate}>
                      <Plus className="h-4 w-4" /> Créer une classe
                    </Button>
                  }
                />
              ) : filteredClasses.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="Aucun résultat"
                  description="Aucune classe ne correspond à votre recherche ou filtre actuel."
                />
              ) : (
                <AnimatePresence mode="popLayout">
                  <motion.div
                    layout
                    className={
                      viewMode === "grid"
                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        : "grid grid-cols-1 gap-4"
                    }
                  >
                    {filteredClasses.map((c) => {
                      const scheduleDaysLabels = c.scheduleSlots.map(
                        (s) => (DAY_LABELS[s.day_of_week] ?? "").slice(0, 3)
                      );
                      const firstSlot = c.scheduleSlots[0];
                      const scheduleTime = firstSlot
                        ? `${firstSlot.start_time.slice(0, 5)} – ${firstSlot.end_time.slice(0, 5)}`
                        : "";

                      return (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ClassCard
                            id={c.id}
                            name={c.nom}
                            level={c.niveau ?? ""}
                            enrolled={enrollmentCounts[c.id] ?? 0}
                            capacityMax={c.capacity_max ?? 30}
                            teacherName={c.prof?.display_name ?? null}
                            roomName={c.salle?.name ?? null}
                            scheduleDays={scheduleDaysLabels}
                            scheduleTime={scheduleTime}
                            onClick={() => openEdit(c)}
                            onEdit={() => openEdit(c)}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </ListingLayout>
          </TabsContent>

          <TabsContent value="progression" className="mt-4 space-y-4">
            {classes.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Pas encore de données"
                description="Créez des classes pour visualiser la progression."
              />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <Select value={progressClassId || classes[0]?.id} onValueChange={setProgressClassId}>
                    <SelectTrigger className="h-9 w-[250px]">
                      <SelectValue placeholder="Sélectionner une classe…" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} {c.niveau ? `(${c.niveau})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(() => {
                  const activeId = progressClassId || classes[0]?.id;
                  const activeClass = classes.find((c) => c.id === activeId);
                  if (!activeClass) return null;
                  return (
                    <ClassProgressBoard
                      classId={activeClass.id}
                      className={activeClass.nom}
                      subjects={activeClass.subjects}
                    />
                  );
                })()}
              </>
            )}
          </TabsContent>

          <TabsContent value="planning" className="mt-4">
            <GlobalCalendarView filterNiveau={filterNiveau} filterSubjects={filterSubjects} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
            <DialogDescription>{isEditing ? `Modifiez « ${editingClass?.nom} » et son planning.` : "Créez une classe et définissez son planning."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la classe *</Label>
              <Input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex: CE1 - Groupe A" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Niveau</Label>
              <Select value={form.niveau} onValueChange={(v) => setForm((f) => ({ ...f, niveau: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                <SelectContent>{levels.map((l) => (<SelectItem key={l.id} value={l.label}>{l.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Professeur</Label>
              <Select value={form.prof_id} onValueChange={(v) => setForm((f) => ({ ...f, prof_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Assigner un professeur" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Planning des cours ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Planning des cours
                </Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addSlot}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter un créneau
                </Button>
              </div>

              {schedules.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
                  Aucun créneau. Ajoutez-en un pour définir le planning.
                </p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((slot, idx) => (
                    <Card key={idx} className="p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        {/* Day */}
                        <Select
                          value={String(slot.day_of_week)}
                          onValueChange={(v) => updateSlot(idx, { day_of_week: Number(v) })}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DAY_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Times */}
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateSlot(idx, { start_time: e.target.value })}
                          className="h-8 w-[100px] text-xs"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateSlot(idx, { end_time: e.target.value })}
                          className="h-8 w-[100px] text-xs"
                        />

                        {/* Delete */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSlot(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Subject multi-select */}
                      {subjects.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 w-full justify-start text-xs font-normal">
                              {slot.subject_ids.length === 0
                                ? "Sélectionner les matières…"
                                : `${slot.subject_ids.length} matière(s)`}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {subjects.map((s) => (
                                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-accent">
                                  <Checkbox
                                    checked={slot.subject_ids.includes(s.id)}
                                    onCheckedChange={() => toggleSlotSubject(idx, s.id)}
                                  />
                                  <span className="truncate">{s.name}</span>
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}

                      {/* Show selected subject badges */}
                      {slot.subject_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {slot.subject_ids.map((sid) => {
                            const sub = subjects.find((s) => s.id === sid);
                            return sub ? (
                              <Badge key={sid} variant="secondary" className="text-[10px] font-normal">{sub.name}</Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }} className="text-muted-foreground">Annuler</Button>
            <Button onClick={() => saveClass.mutate()} disabled={saveClass.isPending || !form.nom.trim()} className="gradient-positive border-0">
              {saveClass.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Classes;
