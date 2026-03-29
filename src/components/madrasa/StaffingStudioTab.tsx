import React, { useState, useMemo, useCallback } from "react";
import {
  Search, Users, GraduationCap, CalendarDays, X, AlertTriangle, GripVertical, Filter,
} from "lucide-react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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

/* ── Types ── */
interface Teacher {
  id: string;
  displayName: string;
  specialties: string[];
  classCount: number;
}

interface StaffClass {
  id: string;
  nom: string;
  levelLabel: string | null;
  cycleName: string | null;
  profId: string | null;
  profName: string | null;
  capacityMax: number;
  enrolledCount: number;
  roomName: string | null;
  scheduleDays: { day: number; start: string; end: string }[];
}

/* ── Schedule conflict helper ── */
function hasScheduleConflict(
  classSchedule: StaffClass["scheduleDays"],
  teacherClassIds: string[],
  allClasses: StaffClass[],
): boolean {
  if (classSchedule.length === 0) return false;
  const teacherSlots = allClasses
    .filter((c) => teacherClassIds.includes(c.id))
    .flatMap((c) => c.scheduleDays);

  for (const slot of classSchedule) {
    for (const ts of teacherSlots) {
      if (slot.day === ts.day && slot.start < ts.end && slot.end > ts.start) {
        return true;
      }
    }
  }
  return false;
}

/* ── Specialty match helper ── */
function isSpecialtyMatch(specialties: string[], cls: StaffClass): boolean {
  if (specialties.length === 0) return false;
  const lower = specialties.map((s) => s.toLowerCase());
  const targets = [cls.nom, cls.levelLabel, cls.cycleName].filter(Boolean).map((s) => s!.toLowerCase());
  return lower.some((spec) => targets.some((t) => t.includes(spec) || spec.includes(t)));
}

export function StaffingStudioTab() {
  const { orgId } = useOrganization();
  const qc = useQueryClient();
  const [searchTeacher, setSearchTeacher] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [draggedTeacherId, setDraggedTeacherId] = useState<string | null>(null);
  const [overClassId, setOverClassId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Fetch teachers ──
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["staffing-teachers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, teacher_specialties")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Fetch classes ──
  const { data: rawClasses = [], isLoading: classesLoading } = useQuery({
    queryKey: ["staffing-classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, capacity_max, prof_id, level_id, madrasa_levels(label, madrasa_cycles(nom)), profiles:prof_id(display_name), rooms:salle_id(name)")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Fetch schedules ──
  const { data: allSchedules = [] } = useQuery({
    queryKey: ["staffing-schedules", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_schedules")
        .select("class_id, day_of_week, start_time, end_time")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Fetch enrollment counts ──
  const { data: enrollmentCounts = new Map<string, number>() } = useQuery({
    queryKey: ["staffing-enrollment-counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("class_id")
        .eq("org_id", orgId!)
        .not("class_id", "is", null);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const e of data ?? []) {
        if (e.class_id) counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1);
      }
      return counts;
    },
  });

  // ── Derived: schedule map ──
  const scheduleMap = useMemo(() => {
    const map = new Map<string, { day: number; start: string; end: string }[]>();
    for (const s of allSchedules) {
      if (!map.has(s.class_id)) map.set(s.class_id, []);
      map.get(s.class_id)!.push({
        day: s.day_of_week,
        start: s.start_time?.slice(0, 5) ?? "",
        end: s.end_time?.slice(0, 5) ?? "",
      });
    }
    return map;
  }, [allSchedules]);

  // ── Derived: classes ──
  const classes: StaffClass[] = useMemo(() =>
    rawClasses.map((c: any) => ({
      id: c.id,
      nom: c.nom,
      levelLabel: (c.madrasa_levels as any)?.label ?? null,
      cycleName: (c.madrasa_levels as any)?.madrasa_cycles?.nom ?? null,
      profId: c.prof_id,
      profName: (c.profiles as any)?.display_name ?? null,
      capacityMax: c.capacity_max ?? 15,
      enrolledCount: enrollmentCounts.get(c.id) ?? 0,
      roomName: (c.rooms as any)?.name ?? null,
      scheduleDays: scheduleMap.get(c.id) ?? [],
    })),
  [rawClasses, enrollmentCounts, scheduleMap]);

  // ── Derived: teachers list ──
  const teachersList: Teacher[] = useMemo(() => {
    const assignedProfIds = new Set(classes.filter((c) => c.profId).map((c) => c.profId!));
    const profCountMap = new Map<string, number>();
    for (const c of classes) {
      if (c.profId) profCountMap.set(c.profId, (profCountMap.get(c.profId) ?? 0) + 1);
    }
    return teachers
      .filter((t: any) => {
        const hasSpecialties = t.teacher_specialties && t.teacher_specialties.length > 0;
        const isAssigned = assignedProfIds.has(t.id);
        return hasSpecialties || isAssigned;
      })
      .map((t: any) => ({
        id: t.id,
        displayName: t.display_name,
        specialties: t.teacher_specialties ?? [],
        classCount: profCountMap.get(t.id) ?? 0,
      }));
  }, [teachers, classes]);

  // ── All unique specialties for filter ──
  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    for (const t of teachersList) {
      for (const s of t.specialties) set.add(s);
    }
    return Array.from(set).sort();
  }, [teachersList]);

  // ── Filtered teachers ──
  const filteredTeachers = useMemo(() => {
    let list = teachersList;
    if (searchTeacher.trim()) {
      const q = searchTeacher.toLowerCase();
      list = list.filter((t) => t.displayName.toLowerCase().includes(q));
    }
    if (specialtyFilter !== "all") {
      list = list.filter((t) => t.specialties.some((s) => s.toLowerCase() === specialtyFilter.toLowerCase()));
    }
    return list;
  }, [teachersList, searchTeacher, specialtyFilter]);

  // ── Dragged teacher data ──
  const draggedTeacher = useMemo(
    () => (draggedTeacherId ? teachersList.find((t) => t.id === draggedTeacherId) ?? null : null),
    [draggedTeacherId, teachersList],
  );

  // ── Class IDs already assigned to dragged teacher ──
  const draggedTeacherClassIds = useMemo(
    () => (draggedTeacherId ? classes.filter((c) => c.profId === draggedTeacherId).map((c) => c.id) : []),
    [draggedTeacherId, classes],
  );

  // ── Matching & conflict per class for dragged teacher ──
  const classMatchState = useMemo(() => {
    const state = new Map<string, { match: boolean; conflict: boolean }>();
    if (!draggedTeacher) return state;
    for (const cls of classes) {
      const match = isSpecialtyMatch(draggedTeacher.specialties, cls);
      const conflict = hasScheduleConflict(cls.scheduleDays, draggedTeacherClassIds, classes);
      state.set(cls.id, { match, conflict });
    }
    return state;
  }, [draggedTeacher, classes, draggedTeacherClassIds]);

  // ── Mutation ──
  const assignTeacher = useMutation({
    mutationFn: async ({ classId, profId }: { classId: string; profId: string | null }) => {
      const { error } = await supabase.from("madrasa_classes").update({ prof_id: profId }).eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffing-classes", orgId] });
      qc.invalidateQueries({ queryKey: ["staffing-teachers", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── DnD handlers ──
  const handleDragStart = useCallback((e: DragStartEvent) => {
    setDraggedTeacherId(e.active.id as string);
  }, []);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    setOverClassId(e.over?.id as string ?? null);
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const teacherId = e.active.id as string;
    const classId = e.over?.id as string | undefined;
    if (classId && teacherId) {
      const targetClass = classes.find((c) => c.id === classId);
      const newTeacher = teachersList.find((t) => t.id === teacherId);
      const oldProfName = targetClass?.profName;

      assignTeacher.mutate({ classId, profId: teacherId }, {
        onSuccess: () => {
          if (oldProfName && newTeacher) {
            toast({
              title: "Enseignant remplacé",
              description: `${oldProfName} a été remplacé par ${newTeacher.displayName}.`,
            });
          } else if (newTeacher) {
            toast({
              title: "Enseignant assigné",
              description: `${newTeacher.displayName} affecté à ${targetClass?.nom ?? "la classe"}.`,
            });
          }
        },
      });
    }
    setDraggedTeacherId(null);
    setOverClassId(null);
  }, [assignTeacher, classes, teachersList]);

  const handleDragCancel = useCallback(() => {
    setDraggedTeacherId(null);
    setOverClassId(null);
  }, []);

  const isLoading = teachersLoading || classesLoading;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 min-h-[500px]">
        {/* ── Teacher Pool (25%) ── */}
        <div className="w-1/4 min-w-[240px] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Pool Enseignants</h3>
            <Badge variant="secondary" className="text-xs ml-auto">{filteredTeachers.length}/{teachersList.length}</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un enseignant…"
              value={searchTeacher}
              onChange={(e) => setSearchTeacher(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Specialty filter */}
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-8 text-xs">
              <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Toutes spécialités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes spécialités</SelectItem>
              {allSpecialties.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ScrollArea className="flex-1 max-h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))
              ) : filteredTeachers.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {searchTeacher || specialtyFilter !== "all" ? "Aucun enseignant trouvé." : "Aucun enseignant avec des spécialités configurées."}
                </div>
              ) : (
                filteredTeachers.map((teacher) => (
                  <DraggableTeacherCard key={teacher.id} teacher={teacher} isDragging={draggedTeacherId === teacher.id} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Class Grid (75%) ── */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Grille des Classes</h3>
            <Badge variant="secondary" className="text-xs ml-auto">{classes.length} classes</Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Aucune classe configurée. Créez des classes dans la vue Tableau.
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-2">
                {classes.map((cls) => {
                  const matchInfo = classMatchState.get(cls.id);
                  const isDragging = !!draggedTeacherId;
                  const isMatch = matchInfo?.match ?? false;
                  const hasConflict = matchInfo?.conflict ?? false;
                  const isOver = overClassId === cls.id;

                  return (
                    <DroppableClassCard
                      key={cls.id}
                      cls={cls}
                      isDragging={isDragging}
                      isMatch={isMatch}
                      hasConflict={hasConflict}
                      isOver={isOver}
                      draggedTeacher={draggedTeacher}
                      onUnassign={() => assignTeacher.mutate({ classId: cls.id, profId: null })}
                      isPending={assignTeacher.isPending}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* ── Drag Overlay ── */}
      <DragOverlay>
        {draggedTeacher && (
          <Card className="border-2 border-primary shadow-lg w-[220px] rotate-2 opacity-90">
            <CardContent className="p-3 space-y-1">
              <span className="text-sm font-medium">{draggedTeacher.displayName}</span>
              {draggedTeacher.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draggedTeacher.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Draggable Teacher Card ── */
function DraggableTeacherCard({ teacher, isDragging }: { teacher: Teacher; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: teacher.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border shadow-sm transition-all cursor-grab active:cursor-grabbing",
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md",
      )}
      {...listeners}
      {...attributes}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{teacher.displayName}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {teacher.classCount} classe{teacher.classCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        {teacher.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-5">
            {teacher.specialties.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Droppable Class Card ── */
function DroppableClassCard({
  cls, isDragging, isMatch, hasConflict, isOver, draggedTeacher, onUnassign, isPending,
}: {
  cls: StaffClass;
  isDragging: boolean;
  isMatch: boolean;
  hasConflict: boolean;
  isOver: boolean;
  draggedTeacher: Teacher | null;
  onUnassign: () => void;
  isPending: boolean;
}) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id: cls.id });
  const activeOver = isOver || dndIsOver;

  // Visual states
  const cardClasses = cn(
    "border shadow-sm transition-all duration-200",
    isDragging && isMatch && !hasConflict && "ring-2 ring-emerald-500/70 border-emerald-400 shadow-emerald-100",
    isDragging && isMatch && hasConflict && "ring-2 ring-amber-500/70 border-amber-400",
    isDragging && !isMatch && "opacity-40",
    activeOver && isMatch && !hasConflict && "ring-2 ring-emerald-500 shadow-lg shadow-emerald-200/50 scale-[1.02]",
    activeOver && hasConflict && "ring-2 ring-destructive shadow-lg",
  );

  return (
    <Card ref={setNodeRef} className={cardClasses}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">{cls.nom}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cls.levelLabel && <Badge variant="outline" className="text-[10px]">{cls.levelLabel}</Badge>}
              {cls.cycleName && <span className="text-[10px] text-muted-foreground">({cls.cycleName})</span>}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{cls.enrolledCount}/{cls.capacityMax}</span>
        </div>

        {/* Schedule */}
        {cls.scheduleDays.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {cls.scheduleDays.map((s, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                <span>{DAY_LABELS[s.day] ?? "?"} {s.start} - {s.end}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Pas de planning défini</p>
        )}

        {/* Room */}
        {cls.roomName && <p className="text-[11px] text-muted-foreground">🏫 {cls.roomName}</p>}

        {/* Conflict badge */}
        {isDragging && hasConflict && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="text-[11px] font-medium text-destructive">Conflit d'horaire</span>
          </div>
        )}

        {/* Teacher slot */}
        {cls.profId && cls.profName ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium truncate">{cls.profName}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onUnassign}
              disabled={isPending}
              title="Retirer l'enseignant"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : isDragging ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-md p-3 flex items-center justify-center transition-all",
              isMatch && !hasConflict
                ? "border-emerald-400 bg-emerald-50/50"
                : !isMatch && draggedTeacher
                  ? "border-muted-foreground/20 bg-muted/30"
                  : "border-muted-foreground/30",
            )}
          >
            <span className="text-xs text-muted-foreground">
              {isMatch && !hasConflict
                ? "✓ Déposer ici"
                : !isMatch && draggedTeacher
                  ? "Spécialité non répertoriée"
                  : "Aucun enseignant assigné"}
            </span>
          </div>
        ) : (
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-md p-3 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Aucun enseignant assigné</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
