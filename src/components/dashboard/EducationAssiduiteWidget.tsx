import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";

export function EducationAssiduiteWidget() {
  const { orgId } = useOrganization();
  const navigate = useNavigate();
  const { isTeacher, profileId, teacherClassIds } = useTeacherScope();

  const { data, isLoading } = useQuery({
    queryKey: ["edu-assiduite-radial", orgId, isTeacher, profileId],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    queryFn: async () => {
      let query = supabase
        .from("madrasa_attendance")
        .select("status")
        .eq("org_id", orgId!);

      if (isTeacher && teacherClassIds.length > 0) {
        query = query.in("class_id", teacherClassIds);
      }

      const { data: records } = await query;
      const total = records?.length ?? 0;
      if (total === 0) return { rate: 0, present: 0, absent: 0, late: 0, excused: 0, total: 0 };

      const present = records!.filter((r) => r.status === "present").length;
      const absent = records!.filter((r) => r.status === "absent").length;
      const late = records!.filter((r) => r.status === "late").length;
      const excused = records!.filter((r) => r.status === "excused").length;

      return { rate: Math.round(((present + late) / total) * 100), present, absent, late, excused, total };
    },
  });

  // Weekly completion rate
  const { data: weeklyCompletion } = useQuery({
    queryKey: ["edu-weekly-completion", orgId, isTeacher, profileId],
    enabled: !!orgId && (!isTeacher || teacherClassIds.length > 0),
    queryFn: async () => {
      const now = new Date();
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

      let classQuery = supabase.from("madrasa_classes").select("id").eq("org_id", orgId!);
      if (isTeacher) classQuery = classQuery.eq("prof_id", profileId!);
      const { data: classes } = await classQuery;

      const totalClasses = classes?.length ?? 0;
      if (totalClasses === 0) return null;

      const schoolDays: string[] = [];
      const d = new Date(weekStart);
      const today = new Date();
      while (d <= today && d <= new Date(weekEnd)) {
        if (d.getDay() !== 0) schoolDays.push(format(d, "yyyy-MM-dd"));
        d.setDate(d.getDate() + 1);
      }

      const expectedCalls = totalClasses * schoolDays.length;
      if (expectedCalls === 0) return null;

      const targetClassIds = classes!.map((c) => c.id);
      const { data: records } = await supabase
        .from("madrasa_attendance")
        .select("enrollment_id, date, madrasa_enrollments!madrasa_attendance_enrollment_id_fkey(class_id)")
        .eq("org_id", orgId!)
        .gte("date", weekStart)
        .lte("date", weekEnd);

      const uniqueClassDays = new Set<string>();
      for (const r of records ?? []) {
        const classId = (r as any).madrasa_enrollments?.class_id;
        if (classId && targetClassIds.includes(classId)) uniqueClassDays.add(`${classId}-${r.date}`);
      }

      return { done: uniqueClassDays.size, total: expectedCalls };
    },
  });

  if (isLoading) return <Skeleton className="h-52 rounded-xl" />;
  if (!data) return null;

  const { rate } = data;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const rateColor = rate >= 80 ? "hsl(var(--secondary))" : rate >= 50 ? "hsl(var(--accent))" : "hsl(var(--destructive))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card h-full flex flex-col items-center cursor-pointer hover:border-secondary/50 transition-colors"
      onClick={() => navigate("/appel")}
    >
      <div className="flex items-center justify-between w-full mb-4">
        <div>
          <h3 className="text-base font-semibold">
            {isTeacher ? "Assiduité de mes élèves" : "Assiduité"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{data.total} relevés enregistrés</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Radial chart */}
      <div className="relative">
        <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <motion.circle
            cx="65" cy="65" r={radius}
            fill="none"
            stroke={rateColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{rate}%</span>
          <span className="text-[10px] text-muted-foreground">présence</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-4 gap-2 w-full mt-4 text-center">
        {[
          { label: "Présent", value: data.present, cls: "text-secondary" },
          { label: "Retard", value: data.late, cls: "text-accent-foreground" },
          { label: "Excusé", value: data.excused, cls: "text-muted-foreground" },
          { label: "Absent", value: data.absent, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label}>
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly completion */}
      {weeklyCompletion && (
        <div className="w-full mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" />
              Appels cette semaine
            </span>
            <span className="font-bold text-foreground">
              {weeklyCompletion.done}/{weeklyCompletion.total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${weeklyCompletion.total > 0 ? (weeklyCompletion.done / weeklyCompletion.total) * 100 : 0}%` }}
              transition={{ duration: 0.8, delay: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
