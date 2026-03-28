import React, { useState, useMemo } from "react";
import {
  Search, Users, LayoutDashboard, Heart, CalendarDays, MapPin, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
  roomName: string | null;
  scheduleDays: number[];
  scheduleSlots: { day: number; start: string; end: string }[];
}

/* ── Data hooks ── */

function usePlacementData(orgId: string | null) {
  // 1. Unplaced enrollments (en_attente) with student + level info
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

  // 2. Classes with level, room, enrolled count
  const classesQuery = useQuery({
    queryKey: ["placement_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [classesRes, enrollCountRes, schedulesRes] = await Promise.all([
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
          .select("class_id")
          .eq("org_id", orgId!)
          .eq("statut", "place"),
        supabase
          .from("madrasa_schedules")
          .select("class_id, day_of_week, start_time, end_time")
          .eq("org_id", orgId!),
      ]);

      if (classesRes.error) throw classesRes.error;

      // Count enrollments per class
      const countMap = new Map<string, number>();
      (enrollCountRes.data ?? []).forEach((e: any) => {
        if (e.class_id) countMap.set(e.class_id, (countMap.get(e.class_id) ?? 0) + 1);
      });

      // Group schedules per class
      const schedMap = new Map<string, { day: number; start: string; end: string }[]>();
      (schedulesRes.data ?? []).forEach((s: any) => {
        const arr = schedMap.get(s.class_id) ?? [];
        arr.push({ day: s.day_of_week, start: s.start_time, end: s.end_time });
        schedMap.set(s.class_id, arr);
      });

      return (classesRes.data ?? []).map((c: any): StudioClass => {
        const slots = schedMap.get(c.id) ?? [];
        return {
          id: c.id,
          nom: c.nom,
          levelId: c.level_id,
          levelLabel: c.madrasa_levels?.label ?? null,
          cycleName: c.madrasa_levels?.madrasa_cycles?.nom ?? null,
          capacityMax: c.capacity_max ?? 15,
          enrolledCount: countMap.get(c.id) ?? 0,
          roomName: c.rooms?.name ?? null,
          scheduleDays: [...new Set(slots.map((s) => s.day))],
          scheduleSlots: slots,
        };
      });
    },
  });

  // 3. Levels for filter dropdown
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

/* ── Sub-components ── */

function StudentCard({
  student, isSelected, onSelect,
}: {
  student: PoolStudent;
  isSelected: boolean;
  onSelect: (s: PoolStudent | null) => void;
}) {
  return (
    <Card
      className={cn(
        "mb-2 cursor-pointer transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "hover:border-primary/40",
      )}
      onClick={() => onSelect(isSelected ? null : student)}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm truncate">
            {student.prenom} {student.nom}
          </p>
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

        {/* Level */}
        {student.levelLabel && (
          <Badge variant="secondary" className="text-[10px]">
            {student.levelLabel}
          </Badge>
        )}

        {/* Preferred days */}
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

function ClassCard({
  cls, isHighlighted,
}: {
  cls: StudioClass;
  isHighlighted: boolean;
}) {
  const pct = cls.capacityMax > 0 ? Math.round((cls.enrolledCount / cls.capacityMax) * 100) : 0;
  const remaining = Math.max(0, cls.capacityMax - cls.enrolledCount);
  const isFull = remaining === 0;

  // Format schedule display
  const scheduleLabel = cls.scheduleSlots
    .sort((a, b) => a.day - b.day)
    .map((s) => `${DAY_LABELS[s.day]} ${s.start.slice(0, 5)}-${s.end.slice(0, 5)}`)
    .join(" · ");

  return (
    <Card className={cn(
      "flex flex-col transition-all duration-200",
      isHighlighted && "border-primary ring-2 ring-primary/20 shadow-lg",
      isFull && "opacity-60",
    )}>
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

        {/* Drop zone */}
        <div className={cn(
          "border-2 border-dashed rounded-lg flex items-center justify-center py-5 text-xs select-none mt-auto",
          isHighlighted
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-muted-foreground/25 text-muted-foreground",
          isFull && "border-destructive/30 text-destructive",
        )}>
          <span className="opacity-70">
            {isFull
              ? "Classe complète"
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
  const { poolQuery, classesQuery, levelsQuery } = usePlacementData(orgId);

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<PoolStudent | null>(null);

  const pool = poolQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const levels = levelsQuery.data ?? [];
  const isLoading = poolQuery.isLoading || classesQuery.isLoading;

  // Filter students
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

  // Determine which classes match selected student
  const highlightedClassIds = useMemo(() => {
    if (!selectedStudent) return new Set<string>();
    const ids = new Set<string>();
    for (const cls of classes) {
      // Level match
      const levelMatch = !selectedStudent.levelId || !cls.levelId || selectedStudent.levelId === cls.levelId;
      // Day match (intersection of student preferred days and class schedule days)
      const dayMatch =
        selectedStudent.preferredDays.length === 0 ||
        cls.scheduleDays.length === 0 ||
        selectedStudent.preferredDays.some((d) => cls.scheduleDays.includes(d));
      // Not full
      const hasSpace = cls.enrolledCount < cls.capacityMax;
      if (levelMatch && dayMatch && hasSpace) ids.add(cls.id);
    }
    return ids;
  }, [selectedStudent, classes]);

  /* Global stats */
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
              <StudentCard
                key={s.enrollmentId}
                student={s}
                isSelected={selectedStudent?.enrollmentId === s.enrollmentId}
                onSelect={setSelectedStudent}
              />
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
            {selectedStudent && (
              <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                Sélectionné : {selectedStudent.prenom} {selectedStudent.nom}
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
              <ClassCard
                key={cls.id}
                cls={cls}
                isHighlighted={highlightedClassIds.has(cls.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
