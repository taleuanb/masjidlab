import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  BookOpen, Trash2, Loader2, Plus, Users, GraduationCap, Pencil, TrendingUp,
  Clock, CalendarDays, School, Search, LayoutGrid, List, Columns3, MapPin,
  MoreVertical, FileText, PhoneCall, AlertTriangle, DoorOpen, MoreHorizontal,
} from "lucide-react";
import { ClassCard } from "@/components/madrasa/ClassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClassProgressBoard } from "@/components/ClassProgressBoard";
import GlobalCalendarView from "@/components/madrasa/GlobalCalendarView";
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

const BOARD_COLUMNS = [
  { id: "planned", label: "Planifiée", color: "bg-muted" },
  { id: "active", label: "Active", color: "bg-brand-emerald/10" },
  { id: "completed", label: "Terminée", color: "bg-brand-cyan/10" },
] as const;

type ViewMode = "list" | "grid" | "kanban";

// Derive a simple status for tabs/board
function deriveClassStatus(c: ClassRow, enrolled: number): "planned" | "active" | "completed" {
  if (enrolled === 0 && !c.prof_id) return "planned";
  if (c.scheduleSlots.length === 0 && enrolled === 0) return "planned";
  return "active";
}

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
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [progressClassId, setProgressClassId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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

  // ── Fetch all active profiles in the org (teachers) ──
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

  // ── Derived: unique levels from data ──
  const uniqueLevels = useMemo(() => {
    return [...new Set(classes.map((c) => c.niveau).filter(Boolean))] as string[];
  }, [classes]);

  // ── Derived: unique subjects from data ──
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => c.subjects.forEach((s) => map.set(s.id, s.name)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  // ── Derived: filtered classes (shared across all views) ──
  const filteredClasses = useMemo(() => {
    return classes
      .filter((c) => {
        if (filterNiveau !== "all" && c.niveau !== filterNiveau) return false;
        if (filterSubject !== "all" && !c.subjects.some((s) => s.id === filterSubject)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          c.nom.toLowerCase().includes(q) ||
          (c.niveau ?? "").toLowerCase().includes(q) ||
          (c.prof?.display_name ?? "").toLowerCase().includes(q)
        );
      });
  }, [classes, filterNiveau, filterSubject, searchQuery]);

  // ── Helpers for card rendering ──
  const getScheduleInfo = (c: ClassRow) => {
    const days = c.scheduleSlots.map((s) => (DAY_LABELS[s.day_of_week] ?? "").slice(0, 3));
    const firstSlot = c.scheduleSlots[0];
    const time = firstSlot ? `${firstSlot.start_time.slice(0, 5)} – ${firstSlot.end_time.slice(0, 5)}` : "";
    return { days, time };
  };

  const getFillInfo = (enrolled: number, max: number) => {
    const rate = max > 0 ? (enrolled / max) * 100 : 0;
    const isFull = rate >= 100;
    const isWarning = rate >= 85 && !isFull;
    return { rate, isFull, isWarning };
  };

  const getEffectifBadge = (enrolled: number, max: number) => {
    const { isFull, isWarning } = getFillInfo(enrolled, max);
    if (isFull) return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">{enrolled}/{max}</Badge>;
    if (isWarning) return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">{enrolled}/{max}</Badge>;
    return <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]">{enrolled}/{max}</Badge>;
  };

  // ── Board: group by status ──
  const boardColumns = useMemo(() => {
    const grouped: Record<string, ClassRow[]> = { planned: [], active: [], completed: [] };
    filteredClasses.forEach((c) => {
      const status = deriveClassStatus(c, enrollmentCounts[c.id] ?? 0);
      grouped[status].push(c);
    });
    return grouped;
  }, [filteredClasses, enrollmentCounts]);

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

          <TabsContent value="liste" className="mt-4 space-y-5">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Classes</h1>
                <Badge variant="secondary" className="text-xs font-medium bg-muted text-muted-foreground">
                  {filteredClasses.length}
                </Badge>
              </div>
              <Button size="sm" className="gradient-positive border-0" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nouvelle classe
              </Button>
            </div>

            {/* ── Unified Toolbar ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher une classe…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>

              {/* Filter: Niveau */}
              <Select value={filterNiveau} onValueChange={setFilterNiveau}>
                <SelectTrigger className="h-9 w-full sm:w-[160px] text-sm">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  {uniqueLevels.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filter: Matière */}
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="h-9 w-full sm:w-[170px] text-sm">
                  <SelectValue placeholder="Matière" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {uniqueSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => { if (v) setViewMode(v as ViewMode); }}
                className="shrink-0 ml-auto"
              >
                <ToggleGroupItem value="grid" aria-label="Grille" className="h-9 w-9 p-0">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Liste" className="h-9 w-9 p-0">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="board" aria-label="Board" className="h-9 w-9 p-0">
                  <Columns3 className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* ── Content ── */}
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
            ) : viewMode === "grid" ? (
              /* ══════ GRID VIEW ══════ */
              <AnimatePresence mode="popLayout">
                <motion.div
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredClasses.map((c) => {
                    const { days, time } = getScheduleInfo(c);
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
                          scheduleDays={days}
                          scheduleTime={time}
                          onClick={() => openEdit(c)}
                          onEdit={() => openEdit(c)}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            ) : viewMode === "list" ? (
              /* ══════ LIST VIEW (Table, Eleves-style) ══════ */
              <div className="rounded-lg border overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Nom</TableHead>
                      <TableHead>Enseignant</TableHead>
                      <TableHead className="hidden md:table-cell">Salle</TableHead>
                      <TableHead className="hidden sm:table-cell">Niveau</TableHead>
                      <TableHead>Effectif</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((c) => {
                      const enrolled = enrollmentCounts[c.id] ?? 0;
                      const max = c.capacity_max ?? 30;
                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-muted/40 border-b"
                          onClick={() => openEdit(c)}
                        >
                          <TableCell>
                            <span className="font-semibold text-sm">{c.nom}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px] bg-muted">
                                  {c.prof?.display_name ? c.prof.display_name.charAt(0) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-foreground truncate max-w-[140px]">
                                {c.prof?.display_name ?? "Non assigné"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {c.salle?.name ?? "—"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {c.niveau || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getEffectifBadge(enrolled, max)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(c)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer cette classe ?</AlertDialogTitle>
                                        <AlertDialogDescription>Cette action supprimera la classe et ses créneaux associés.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteClass.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* ══════ BOARD VIEW (Kanban) ══════ */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {BOARD_COLUMNS.map((col) => (
                  <div key={col.id} className={`rounded-lg ${col.color} p-3 min-h-[200px]`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                      <Badge variant="outline" className="text-[10px]">
                        {boardColumns[col.id]?.length ?? 0}
                      </Badge>
                    </div>
                    <div className="space-y-2.5">
                      <AnimatePresence>
                        {(boardColumns[col.id] ?? []).map((c) => {
                          const enrolled = enrollmentCounts[c.id] ?? 0;
                          const max = c.capacity_max ?? 30;
                          const { rate, isFull, isWarning } = getFillInfo(enrolled, max);
                          const progressColor = isFull
                            ? "hsl(var(--destructive))"
                            : isWarning
                              ? "hsl(45 93% 47%)"
                              : "hsl(var(--brand-emerald, 160 84% 39%))";

                          return (
                            <motion.div
                              key={c.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Card
                                className="group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                                onClick={() => openEdit(c)}
                              >
                                <div className="p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{c.nom}</p>
                                      <p className="text-[11px] text-muted-foreground truncate">{c.prof?.display_name ?? "Non assigné"}</p>
                                    </div>
                                    {getEffectifBadge(enrolled, max)}
                                  </div>
                                  <Progress
                                    value={Math.min(rate, 100)}
                                    className="h-1"
                                    style={{ "--progress-color": progressColor } as React.CSSProperties}
                                  />
                                  {c.salle?.name && (
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      {c.salle.name}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {(boardColumns[col.id] ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6 italic">Aucune classe</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
