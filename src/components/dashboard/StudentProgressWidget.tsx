import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GraduationCap, UserCheck, Target, Star, Lightbulb, Calendar, History, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ChildHistorySheet } from "./ChildHistorySheet";
import { useParentData } from "@/hooks/useParentData";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LatestSession {
  subjectName: string;
  lessonDate: string;
  dataJson: Record<string, any>;
}

interface GoalInfo {
  targetValue: number;
  currentPosition: number;
  unitLabel: string;
  subjectName: string;
}

interface StudentStats {
  id: string;
  prenom: string;
  nom: string;
  averageScore: number | null;
  attendanceRate: number;
  latestSession: LatestSession | null;
  goal: GoalInfo | null;
}

function ReadOnlyStars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function AchievementBadge({ latestSession, goal }: { latestSession: LatestSession | null; goal: GoalInfo | null }) {
  // Check if last session has a star rating >= 4
  const hasHighRating = (() => {
    if (!latestSession?.dataJson) return false;
    for (const [key, val] of Object.entries(latestSession.dataJson)) {
      if (key === "todo_next" || key === "position_actuelle" || key === "mastery_validated") continue;
      const num = Number(val);
      if (!isNaN(num) && num >= 4 && num <= 5) return true;
    }
    return false;
  })();

  // Check mastery validated
  const masteryValidated = latestSession?.dataJson?.mastery_validated === true;

  // Check goal reached
  const goalReached = goal && goal.targetValue > 0 && goal.currentPosition >= goal.targetValue;

  if (goalReached) {
    return (
      <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px] h-5 px-2 gap-1">
        <Award className="h-3 w-3" />
        Objectif atteint 🎉
      </Badge>
    );
  }

  if (masteryValidated) {
    return (
      <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px] h-5 px-2 gap-1">
        <Award className="h-3 w-3" />
        Maîtrise validée ✓
      </Badge>
    );
  }

  if (hasHighRating) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5 px-2 gap-1">
        <Star className="h-3 w-3 fill-amber-400" />
        Félicitations !
      </Badge>
    );
  }

  return null;
}

function StudentCard({ s, onHistoryClick }: { s: StudentStats; onHistoryClick: () => void }) {
  const goalPct = s.goal && s.goal.targetValue > 0
    ? Math.round((s.goal.currentPosition / s.goal.targetValue) * 100)
    : null;

  const starFields: { label: string; value: number }[] = [];
  const todoNext = s.latestSession?.dataJson?.todo_next as string | undefined;
  if (s.latestSession?.dataJson) {
    for (const [key, val] of Object.entries(s.latestSession.dataJson)) {
      if (key === "todo_next" || key === "position_actuelle" || key === "mastery_validated") continue;
      const num = Number(val);
      if (!isNaN(num) && num >= 0 && num <= 5) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        starFields.push({ label, value: num });
      }
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      {/* Name + achievement */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-brand-navy">{s.prenom} {s.nom}</p>
        <AchievementBadge latestSession={s.latestSession} goal={s.goal} />
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <GraduationCap className="h-3 w-3" /> Moyenne
            </span>
            <span className="font-bold text-foreground">
              {s.averageScore !== null ? `${s.averageScore}%` : "—"}
            </span>
          </div>
          <Progress
            value={s.averageScore ?? 0}
            className="h-2 w-full [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-secondary"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <UserCheck className="h-3 w-3" /> Assiduité
            </span>
            <span className="font-bold text-foreground">{s.attendanceRate}%</span>
          </div>
          <Progress
            value={s.attendanceRate}
            className="h-2 w-full [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-secondary"
          />
        </div>
      </div>

      {/* Annual Goal */}
      {s.goal && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3 w-3 text-brand-emerald" />
              <span className="font-medium">Objectif Annuel — {s.goal.subjectName}</span>
            </div>
            <Progress value={goalPct ?? 0} className="h-2 w-full [&>div]:bg-brand-emerald" />
            <p className="text-xs font-semibold text-brand-navy">
              {s.goal.currentPosition} / {s.goal.targetValue} {s.goal.unitLabel}{" "}
              <span className="text-muted-foreground font-normal">({goalPct}%)</span>
            </p>
          </div>
        </>
      )}

      {/* Latest Session */}
      {s.latestSession && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">
                {s.latestSession.subjectName} —{" "}
                {format(new Date(s.latestSession.lessonDate), "d MMM yyyy", { locale: fr })}
              </span>
            </div>

            {starFields.length > 0 && (
              <div className="space-y-1">
                {starFields.map((sf) => (
                  <div key={sf.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{sf.label}</span>
                    <ReadOnlyStars value={sf.value} />
                  </div>
                ))}
              </div>
            )}

            {todoNext && (
              <div className="rounded-md bg-brand-cyan/10 px-3 py-2.5 mt-1 flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-brand-cyan mt-0.5 shrink-0" />
                <p className="text-xs text-brand-navy">
                  <span className="font-semibold">À préparer :</span> {todoNext}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* History button */}
      <Button variant="outline" className="w-full mt-1 text-brand-navy" onClick={onHistoryClick}>
        <History className="h-3.5 w-3.5 mr-1.5" />
        Voir l'historique détaillé
      </Button>
    </div>
  );
}

export function StudentProgressWidget() {
  const { orgId } = useOrganization();
  const { role } = useRole();
  const isParentRole = role === "Parent d'élève";
  const { data: students } = useParentData();
  const studentIds = (students ?? []).map((s) => s.id);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [activeChildIndex, setActiveChildIndex] = useState(0);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["student-progress-enriched", orgId, studentIds],
    enabled: !!orgId && studentIds.length > 0,
    queryFn: async (): Promise<StudentStats[]> => {
      const results: StudentStats[] = [];

      for (const student of students ?? []) {
        const { data: grades } = await supabase
          .from("madrasa_grades")
          .select("score, madrasa_evaluations(max_points)")
          .eq("org_id", orgId!)
          .eq("student_id", student.id);

        let averageScore: number | null = null;
        if (grades && grades.length > 0) {
          const validGrades = grades.filter((g) => g.score !== null);
          if (validGrades.length > 0) {
            const totalPct = validGrades.reduce((sum, g) => {
              const max = (g.madrasa_evaluations as any)?.max_points ?? 20;
              return sum + ((g.score ?? 0) / max) * 100;
            }, 0);
            averageScore = Math.round(totalPct / validGrades.length);
          }
        }

        const { data: enrollments } = await supabase
          .from("madrasa_enrollments")
          .select("id")
          .eq("org_id", orgId!)
          .eq("student_id", student.id);

        let attendanceRate = 100;
        if (enrollments && enrollments.length > 0) {
          const enrollmentIds = enrollments.map((e) => e.id);
          const { data: attendance } = await supabase
            .from("madrasa_attendance")
            .select("status")
            .eq("org_id", orgId!)
            .in("enrollment_id", enrollmentIds);

          if (attendance && attendance.length > 0) {
            const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
            attendanceRate = Math.round((present / attendance.length) * 100);
          }
        }

        let latestSession: LatestSession | null = null;
        const { data: progressRows } = await supabase
          .from("madrasa_student_progress")
          .select("lesson_date, data_json, madrasa_session_configs(madrasa_subjects(name))")
          .eq("org_id", orgId!)
          .eq("student_id", student.id)
          .order("lesson_date", { ascending: false })
          .limit(1);

        if (progressRows && progressRows.length > 0) {
          const row = progressRows[0];
          const cfg = row.madrasa_session_configs as any;
          latestSession = {
            subjectName: cfg?.madrasa_subjects?.name ?? "Matière",
            lessonDate: row.lesson_date,
            dataJson: (row.data_json as Record<string, any>) ?? {},
          };
        }

        let goal: GoalInfo | null = null;
        const { data: goals } = await supabase
          .from("madrasa_student_goals")
          .select("target_value, current_position, unit_label, madrasa_subjects(name)")
          .eq("org_id", orgId!)
          .eq("student_id", student.id)
          .eq("academic_year", "2025-2026")
          .limit(1);

        if (goals && goals.length > 0) {
          const g = goals[0];
          goal = {
            targetValue: Number(g.target_value),
            currentPosition: Number(g.current_position),
            unitLabel: g.unit_label,
            subjectName: (g.madrasa_subjects as any)?.name ?? "Matière",
          };
        }

        results.push({
          id: student.id,
          prenom: student.prenom,
          nom: student.nom,
          averageScore,
          attendanceRate,
          latestSession,
          goal,
        });
      }

      return results;
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const hasMultipleChildren = (stats?.length ?? 0) > 1;
  // For multi-child: show tabs/selector
  const displayedStats = hasMultipleChildren
    ? stats ? [stats[activeChildIndex]] : []
    : stats ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {isParentRole ? "Suivi de mon enfant" : "Suivi Scolaire"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Progression, notes & dernière séance</p>
        </div>
        <GraduationCap className="h-4 w-4 text-accent" />
      </div>

      {/* Multi-child selector */}
      {hasMultipleChildren && stats && (
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activeChildIndex === 0}
            onClick={() => setActiveChildIndex((i) => i - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex gap-1.5 overflow-x-auto">
            {stats.map((s, i) => (
              <Button
                key={s.id}
                variant={i === activeChildIndex ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-3 shrink-0"
                onClick={() => setActiveChildIndex(i)}
              >
                {s.prenom}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activeChildIndex === (stats.length - 1)}
            onClick={() => setActiveChildIndex((i) => i + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!displayedStats || displayedStats.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <GraduationCap className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground italic">
            Le voyage éducatif commence.<br />Les résultats apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className={hasMultipleChildren ? "" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          {displayedStats.map((s) => (
            <StudentCard
              key={s.id}
              s={s}
              onHistoryClick={() => setSelectedChildId(s.id)}
            />
          ))}
        </div>
      )}

      <ChildHistorySheet
        childId={selectedChildId}
        childName={
          stats?.find((s) => s.id === selectedChildId)
            ? `${stats.find((s) => s.id === selectedChildId)!.prenom} ${stats.find((s) => s.id === selectedChildId)!.nom}`
            : ""
        }
        onClose={() => setSelectedChildId(null)}
      />
    </motion.div>
  );
}
