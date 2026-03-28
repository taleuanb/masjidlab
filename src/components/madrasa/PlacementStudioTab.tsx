import React, { useState, useMemo } from "react";
import {
  Search, Users, LayoutDashboard, Heart, CalendarDays, MapPin, X, GripVertical,
} from "lucide-react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/* ── Day helpers ── */

const DAY_LABELS: Record<number, string> = {
  0: "Dim", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam",
};

const DAY_FILTER_OPTIONS = [
  { value: "all", label: "Tous les jours" },
  { value: "0", label: "Dimanche" },
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
];

/* ── Types ── */

interface PoolStudent {
  enrollmentId: string;
  studentId: string;
  nom: string;
  prenom: string;
  genre: string | null;
  age: number | null;
  levelId: string | null;
  levelLabel: string | null;
  cycleName: string | null;
  familyId: string | null;
  preferredDays: number[];
  preferredTimeSlot: string | null;
  siblingPriority: boolean;
}

interface StudioClass {
  id: string;
  nom: string;
  levelId: string | null;
  levelLabel: string | null;
  cycleName: string | null;
  capacityMax: number;
  enrolledCount: number;
  enrolledStudents: PlacedStudent[];
  roomName: string | null;
  scheduleDays: number[];
  scheduleSlots: { day: number; start: string; end: string }[];
}

interface PlacedStudent {
  enrollmentId: string;
  studentId: string;
  nom: string;
  prenom: string;
  genre: string | null;
  age: number | null;
}

/* ── Data hooks ── */

function usePlacementData(orgId: string | null) {
  const poolQuery = useQuery({
    queryKey: ["placement_pool", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select(`
          id, student_id, level_id, preferences,
          madrasa_students!madrasa_enrollments_student_id_fkey(nom, prenom, gender, age, family_id),
          madrasa_levels!madrasa_enrollments_level_id_fkey(label, madrasa_cycles(nom))
        `)
        .eq("org_id", orgId!)
        .eq("statut", "en_attente");
      if (error) throw error;
      return (data ?? []).map((e: any): PoolStudent => {
        const prefs = (e.preferences as any) ?? {};
        const days: number[] = Array.isArray(prefs.days) ? prefs.days : [];
        return {
          enrollmentId: e.id,
          studentId: e.student_id,
          nom: e.madrasa_students?.nom ?? "",
          prenom: e.madrasa_students?.prenom ?? "",
          genre: e.madrasa_students?.gender ?? null,
          age: e.madrasa_students?.age ?? null,
          levelId: e.level_id,
          levelLabel: e.madrasa_levels?.label ?? null,
          cycleName: e.madrasa_levels?.madrasa_cycles?.nom ?? null,
          familyId: e.madrasa_students?.family_id ?? null,
          preferredDays: days,
          preferredTimeSlot: prefs.time_slot ?? null,
          siblingPriority: prefs.sibling_priority === true,
        };
      });
    },
  });

  const classesQuery = useQuery({
    queryKey: ["placement_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [classesRes, enrollRes, schedulesRes] = await Promise.all([
        supabase
          .from("madrasa_classes")
          .select(`
            id, nom, level_id, capacity_max,
            madrasa_levels!madrasa_classes_level_id_fkey(label, madrasa_cycles(nom)),
            rooms:salle_id(name)
          `)
          .eq("org_id", orgId!),
        supabase
          .from("madrasa_enrollments")
          .select(`
            id, class_id, student_id,
            madrasa_students!madrasa_enrollments_student_id_fkey(nom, prenom, gender, age)
          `)
          .eq("org_id", orgId!)
          .eq("statut", "place"),
        supabase
          .from("madrasa_schedules")
          .select("class_id, day_of_week, start_time, end_time")
          .eq("org_id", orgId!),
      ]);

      if (classesRes.error) throw classesRes.error;

      const enrollMap = new Map<string, PlacedStudent[]>();
      (enrollRes.data ?? []).forEach((e: any) => {
        if (!e.class_id) return;
        const arr = enrollMap.get(e.class_id) ?? [];
        arr.push({
          enrollmentId: e.id,
          studentId: e.student_id,
          nom: e.madrasa_students?.nom ?? "",
          prenom: e.madrasa_students?.prenom ?? "",
          genre: e.madrasa_students?.gender ?? null,
          age: e.madrasa_students?.age ?? null,
        });
        enrollMap.set(e.class_id, arr);
      });

      const schedMap = new Map<string, { day: number; start: string; end: string }[]>();
      (schedulesRes.data ?? []).forEach((s: any) => {
        const arr = schedMap.get(s.class_id) ?? [];
        arr.push({ day: s.day_of_week, start: s.start_time, end: s.end_time });
        schedMap.set(s.class_id, arr);
      });

      return (classesRes.data ?? []).map((c: any): StudioClass => {
        const slots = schedMap.get(c.id) ?? [];
        const students = enrollMap.get(c.id) ?? [];
        return {
          id: c.id,
          nom: c.nom,
          levelId: c.level_id,
          levelLabel: c.madrasa_levels?.label ?? null,
          cycleName: c.madrasa_levels?.madrasa_cycles?.nom ?? null,
          capacityMax: c.capacity_max ?? 15,
          enrolledCount: students.length,
          enrolledStudents: students,
          roomName: c.rooms?.name ?? null,
          scheduleDays: [...new Set(slots.map((s) => s.day))],
          scheduleSlots: slots,
        };
      });
    },
  });

  const levelsQuery = useQuery({
    queryKey: ["placement_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_levels")
        .select("id, label, madrasa_cycles(nom)")
        .eq("org_id", orgId!)
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  return { poolQuery, classesQuery, levelsQuery };
}

/* ── Draggable Student Card ── */

function DraggableStudentCard({ student }: { student: PoolStudent }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.enrollmentId}`,
    data: { type: "student", student },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-2 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:border-primary/40",
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <p className="font-semibold text-sm truncate">
              {student.prenom} {student.nom}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {student.siblingPriority && (
              <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            )}
            {student.genre && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  student.genre === "M"
                    ? "bg-sky-500/10 text-sky-700 border-sky-400/30"
                    : "bg-pink-500/10 text-pink-700 border-pink-400/30",
                )}
              >
                {student.genre === "M" ? "G" : "F"}
              </Badge>
            )}
            {student.age != null && (
              <span className="text-[11px] text-muted-foreground">{student.age}a</span>
            )}
          </div>
        </div>
        {student.levelLabel && (
          <Badge variant="secondary" className="text-[10px]">
            {student.levelLabel}
          </Badge>
        )}
        {student.preferredDays.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
            {student.preferredDays.map((d) => (
              <Badge key={d} variant="outline" className="text-[9px] px-1 py-0 font-normal">
                {DAY_LABELS[d] ?? d}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Overlay Card (shown while dragging) ── */

function DragOverlayCard({ student }: { student: PoolStudent }) {
  return (
    <Card className="w-64 shadow-2xl border-primary ring-2 ring-primary/30 rotate-2">
      <CardContent className="p-3 space-y-1">
        <p className="font-semibold text-sm">
          {student.prenom} {student.nom}
        </p>
        {student.levelLabel && (
          <Badge variant="secondary" className="text-[10px]">
            {student.levelLabel}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Droppable Class Card ── */

function DroppableClassCard({
  cls,
  isOver,
  isCompatible,
  activeStudent,
  onUnplace,
}: {
  cls: StudioClass;
  isOver: boolean;
  isCompatible: boolean;
  activeStudent: PoolStudent | null;
  onUnplace: (enrollmentId: string) => void;
}) {
  const { setNodeRef, isOver: localIsOver } = useDroppable({
    id: `class-${cls.id}`,
    data: { type: "class", classId: cls.id },
  });

  const pct = cls.capacityMax > 0 ? Math.round((cls.enrolledCount / cls.capacityMax) * 100) : 0;
  const remaining = Math.max(0, cls.capacityMax - cls.enrolledCount);
  const isFull = remaining === 0;

  const scheduleLabel = cls.scheduleSlots
    .sort((a, b) => a.day - b.day)
    .map((s) => `${DAY_LABELS[s.day]} ${s.start.slice(0, 5)}-${s.end.slice(0, 5)}`)
    .join(" · ");

  const showHighlight = activeStudent && isCompatible && !isFull;
  const showWarning = isOver && isFull;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "flex flex-col transition-all duration-200",
        showHighlight && "border-primary ring-2 ring-primary/20 shadow-lg",
        isOver && !isFull && "border-primary ring-2 ring-primary/40 shadow-xl bg-primary/5",
        showWarning && "border-destructive ring-2 ring-destructive/30",
        isFull && !isOver && "opacity-60",
      )}
    >
      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold truncate">{cls.nom}</CardTitle>
          {cls.levelLabel && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {cls.levelLabel}
            </Badge>
          )}
        </div>
        {scheduleLabel && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {scheduleLabel}
          </p>
        )}
        {cls.roomName && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {cls.roomName}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col gap-3 flex-1">
        {/* Gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{cls.enrolledCount}/{cls.capacityMax} élèves</span>
            <span>{pct}%</span>
          </div>
          <Progress
            value={pct}
            className="h-2"
            style={{
              "--progress-color":
                pct >= 90
                  ? "hsl(var(--destructive))"
                  : pct >= 70
                    ? "hsl(38 92% 50%)"
                    : "hsl(var(--brand-emerald))",
            } as React.CSSProperties}
          />
        </div>

        {/* Placed students chips */}
        {cls.enrolledStudents.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cls.enrolledStudents.map((s) => (
              <Badge
                key={s.enrollmentId}
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 gap-1 group hover:border-destructive/50"
              >
                {s.prenom} {s.nom.charAt(0)}.
                <button
                  onClick={(e) => { e.stopPropagation(); onUnplace(s.enrollmentId); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                  title="Retirer de la classe"
                >
                  <X className="h-3 w-3 text-destructive hover:text-destructive/80" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div className={cn(
          "border-2 border-dashed rounded-lg flex items-center justify-center py-4 text-xs select-none mt-auto transition-colors",
          isOver && !isFull && "border-primary bg-primary/10 text-primary font-medium",
          isOver && isFull && "border-destructive bg-destructive/10 text-destructive font-medium",
          !isOver && showHighlight && "border-primary/50 bg-primary/5 text-primary",
          !isOver && !showHighlight && "border-muted-foreground/25 text-muted-foreground",
        )}>
          <span className="opacity-70">
            {isOver && isFull
              ? "⛔ Classe complète"
              : isFull
                ? "Classe complète"
                : isOver
                  ? "✓ Relâcher pour placer"
                  : `Glisser un élève ici (${remaining} place${remaining > 1 ? "s" : ""})`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main component ── */

export function PlacementStudioTab() {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { poolQuery, classesQuery, levelsQuery } = usePlacementData(orgId);

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [activeStudent, setActiveStudent] = useState<PoolStudent | null>(null);
  const [overClassId, setOverClassId] = useState<string | null>(null);

  const pool = poolQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const levels = levelsQuery.data ?? [];
  const isLoading = poolQuery.isLoading || classesQuery.isLoading;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /* ── Mutations ── */

  const placeMutation = useMutation({
    mutationFn: async ({ enrollmentId, classId }: { enrollmentId: string; classId: string }) => {
      const { error } = await supabase
        .from("madrasa_enrollments")
        .update({ class_id: classId })
        .eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placement_pool", orgId] });
      queryClient.invalidateQueries({ queryKey: ["placement_classes", orgId] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur de placement", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["placement_pool", orgId] });
      queryClient.invalidateQueries({ queryKey: ["placement_classes", orgId] });
    },
  });

  const unplaceMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from("madrasa_enrollments")
        .update({ class_id: null })
        .eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placement_pool", orgId] });
      queryClient.invalidateQueries({ queryKey: ["placement_classes", orgId] });
      toast({ title: "Élève retiré", description: "L'élève a été replacé dans le vivier." });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  /* ── Filter students ── */

  const filteredStudents = useMemo(() => {
    return pool.filter((s) => {
      const q = search.toLowerCase();
      if (q && !`${s.prenom} ${s.nom}`.toLowerCase().includes(q)) return false;
      if (levelFilter !== "all" && s.levelId !== levelFilter) return false;
      if (dayFilter !== "all") {
        const dayNum = parseInt(dayFilter, 10);
        if (s.preferredDays.length > 0 && !s.preferredDays.includes(dayNum)) return false;
      }
      return true;
    });
  }, [pool, search, levelFilter, dayFilter]);

  /* ── Compatible classes for active dragged student ── */

  const compatibleClassIds = useMemo(() => {
    if (!activeStudent) return new Set<string>();
    const ids = new Set<string>();
    for (const cls of classes) {
      const levelMatch = !activeStudent.levelId || !cls.levelId || activeStudent.levelId === cls.levelId;
      const dayMatch =
        activeStudent.preferredDays.length === 0 ||
        cls.scheduleDays.length === 0 ||
        activeStudent.preferredDays.some((d) => cls.scheduleDays.includes(d));
      const hasSpace = cls.enrolledCount < cls.capacityMax;
      if (levelMatch && dayMatch && hasSpace) ids.add(cls.id);
    }
    return ids;
  }, [activeStudent, classes]);

  /* ── DnD handlers ── */

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "student") {
      setActiveStudent(data.student as PoolStudent);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    if (overId && String(overId).startsWith("class-")) {
      setOverClassId(String(overId).replace("class-", ""));
    } else {
      setOverClassId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStudent(null);
    setOverClassId(null);

    if (!over || !String(over.id).startsWith("class-")) return;

    const studentData = active.data.current;
    if (studentData?.type !== "student") return;

    const student = studentData.student as PoolStudent;
    const classId = String(over.id).replace("class-", "");
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;

    // Check capacity
    if (targetClass.enrolledCount >= targetClass.capacityMax) {
      toast({ title: "Classe complète", description: `${targetClass.nom} a atteint sa capacité maximale.`, variant: "destructive" });
      return;
    }

    // Warn on level mismatch
    if (student.levelId && targetClass.levelId && student.levelId !== targetClass.levelId) {
      toast({
        title: "⚠️ Niveaux différents",
        description: `${student.prenom} (${student.levelLabel}) → ${targetClass.nom} (${targetClass.levelLabel}). Placement autorisé.`,
      });
    }

    // Optimistic update
    queryClient.setQueryData(["placement_pool", orgId], (old: PoolStudent[] | undefined) =>
      (old ?? []).filter((s) => s.enrollmentId !== student.enrollmentId)
    );
    queryClient.setQueryData(["placement_classes", orgId], (old: StudioClass[] | undefined) =>
      (old ?? []).map((c) =>
        c.id === classId
          ? {
              ...c,
              enrolledCount: c.enrolledCount + 1,
              enrolledStudents: [
                ...c.enrolledStudents,
                {
                  enrollmentId: student.enrollmentId,
                  studentId: student.studentId,
                  nom: student.nom,
                  prenom: student.prenom,
                  genre: student.genre,
                  age: student.age,
                },
              ],
            }
          : c
      )
    );

    placeMutation.mutate({ enrollmentId: student.enrollmentId, classId });

    toast({ title: "✓ Élève placé", description: `${student.prenom} ${student.nom} → ${targetClass.nom}` });
  };

  const handleDragCancel = () => {
    setActiveStudent(null);
    setOverClassId(null);
  };

  const handleUnplace = (enrollmentId: string) => {
    // Find student info for optimistic update
    let found: PlacedStudent | null = null;
    let fromClassId: string | null = null;
    for (const cls of classes) {
      const s = cls.enrolledStudents.find((e) => e.enrollmentId === enrollmentId);
      if (s) { found = s; fromClassId = cls.id; break; }
    }

    if (found && fromClassId) {
      // Optimistic: remove from class, add back to pool
      queryClient.setQueryData(["placement_classes", orgId], (old: StudioClass[] | undefined) =>
        (old ?? []).map((c) =>
          c.id === fromClassId
            ? {
                ...c,
                enrolledCount: c.enrolledCount - 1,
                enrolledStudents: c.enrolledStudents.filter((s) => s.enrollmentId !== enrollmentId),
              }
            : c
        )
      );
    }

    unplaceMutation.mutate(enrollmentId);
  };

  /* ── Global stats ── */

  const totalCapacity = classes.reduce((s, c) => s + c.capacityMax, 0);
  const totalEnrolled = classes.reduce((s, c) => s + c.enrolledCount, 0);
  const globalPct = totalCapacity ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;
  const totalAvailable = totalCapacity - totalEnrolled;

  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 min-h-[400px]">
        <div className="w-full lg:w-1/4 space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
        {/* ── Left: Student Pool ── */}
        <div className="w-full lg:w-1/4 shrink-0 flex flex-col rounded-xl border bg-card">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Élèves à placer</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {filteredStudents.length}
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  {levels.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label} {l.madrasa_cycles?.nom ? `(${l.madrasa_cycles.nom})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Jour préféré" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_FILTER_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1 p-3">
            {filteredStudents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                {pool.length === 0
                  ? "Aucun élève en attente de placement."
                  : "Aucun élève ne correspond aux filtres."}
              </p>
            ) : (
              filteredStudents.map((s) => (
                <DraggableStudentCard key={s.enrollmentId} student={s} />
              ))
            )}
          </ScrollArea>
        </div>

        {/* ── Right: Class Grid ── */}
        <div className="flex-1 flex flex-col gap-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Studio de placement</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Places disponibles :</span>
                <Badge variant="outline" className="font-semibold">{totalAvailable}</Badge>
              </div>
              <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Remplissage global</span>
                <Progress value={globalPct} className="h-2 flex-1" />
                <span className="text-xs font-medium">{globalPct}%</span>
              </div>
              {activeStudent && (
                <Badge className="bg-primary/10 text-primary border-primary/30 text-xs animate-pulse">
                  En déplacement : {activeStudent.prenom} {activeStudent.nom}
                </Badge>
              )}
            </CardContent>
          </Card>

          {classes.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Aucune classe configurée.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <DroppableClassCard
                  key={cls.id}
                  cls={cls}
                  isOver={overClassId === cls.id}
                  isCompatible={compatibleClassIds.has(cls.id)}
                  activeStudent={activeStudent}
                  onUnplace={handleUnplace}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeStudent ? <DragOverlayCard student={activeStudent} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
