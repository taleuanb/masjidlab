import React, { useState, useMemo } from "react";
import {
  Search, Users, GraduationCap, CalendarDays, X, UserMinus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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

export function StaffingStudioTab() {
  const { orgId } = useOrganization();
  const qc = useQueryClient();
  const [searchTeacher, setSearchTeacher] = useState("");

  // ── Fetch teachers (profiles with teacher_specialties) ──
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

  // ── Fetch classes with joins ──
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

  // ── Derived: teachers with class counts ──
  const teachersList: Teacher[] = useMemo(() => {
    // Only show profiles that have specialties or are already assigned as prof
    const assignedProfIds = new Set(classes.filter(c => c.profId).map(c => c.profId!));
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

  // ── Filtered teachers ──
  const filteredTeachers = useMemo(() => {
    if (!searchTeacher.trim()) return teachersList;
    const q = searchTeacher.toLowerCase();
    return teachersList.filter(t => t.displayName.toLowerCase().includes(q));
  }, [teachersList, searchTeacher]);

  // ── Assign / Unassign teacher mutation ──
  const assignTeacher = useMutation({
    mutationFn: async ({ classId, profId }: { classId: string; profId: string | null }) => {
      const { error } = await supabase
        .from("madrasa_classes")
        .update({ prof_id: profId })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffing-classes", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      toast({ title: "Affectation mise à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const isLoading = teachersLoading || classesLoading;

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* ── Teacher Pool (25%) ── */}
      <div className="w-1/4 min-w-[240px] flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Pool Enseignants</h3>
          <Badge variant="secondary" className="text-xs ml-auto">{teachersList.length}</Badge>
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

        <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTeacher ? "Aucun enseignant trouvé." : "Aucun enseignant avec des spécialités configurées."}
              </div>
            ) : (
              filteredTeachers.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} classes={classes} onAssign={(classId) => assignTeacher.mutate({ classId, profId: teacher.id })} />
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
              {classes.map((cls) => (
                <ClassStaffCard
                  key={cls.id}
                  cls={cls}
                  onUnassign={() => assignTeacher.mutate({ classId: cls.id, profId: null })}
                  isPending={assignTeacher.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

/* ── Teacher Card ── */
function TeacherCard({ teacher, classes, onAssign }: {
  teacher: Teacher;
  classes: StaffClass[];
  onAssign: (classId: string) => void;
}) {
  const unassignedClasses = classes.filter(c => !c.profId);

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{teacher.displayName}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {teacher.classCount} classe{teacher.classCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {teacher.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {teacher.specialties.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Class Staffing Card ── */
function ClassStaffCard({ cls, onUnassign, isPending }: {
  cls: StaffClass;
  onUnassign: () => void;
  isPending: boolean;
}) {
  const pct = cls.capacityMax > 0 ? Math.min(100, Math.round((cls.enrolledCount / cls.capacityMax) * 100)) : 0;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">{cls.nom}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cls.levelLabel && (
                <Badge variant="outline" className="text-[10px]">{cls.levelLabel}</Badge>
              )}
              {cls.cycleName && (
                <span className="text-[10px] text-muted-foreground">({cls.cycleName})</span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {cls.enrolledCount}/{cls.capacityMax}
          </span>
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
        {cls.roomName && (
          <p className="text-[11px] text-muted-foreground">🏫 {cls.roomName}</p>
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
        ) : (
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-md p-3 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Aucun enseignant assigné</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
