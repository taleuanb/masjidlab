import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SessionReportDrawer } from "@/components/SessionReportDrawer";

type StatusType = "present" | "absent" | "late" | "excused";

const STATUS_COLORS: Record<StatusType, string> = {
  present: "bg-secondary",             // emerald
  absent: "bg-destructive",
  late: "bg-[hsl(var(--amber-warm))]",
  excused: "bg-accent",                // cyan
};

const STATUS_LABELS: Record<StatusType, string> = {
  present: "Présent",
  absent: "Absent",
  late: "Retard",
  excused: "Excusé",
};

export function AttendanceHistory() {
  const { orgId } = useOrganization();
  const [month, setMonth] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ["attendance-history-classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId!)
        .order("nom");
      return data ?? [];
    },
  });

  // Auto-select first class
  const effectiveClassId = selectedClassId === "all" && classes.length > 0 ? classes[0].id : selectedClassId;

  // Days in selected month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const dateFrom = format(startOfMonth(month), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(month), "yyyy-MM-dd");

  // Fetch enrollments + attendance data
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-history-grid", orgId, effectiveClassId, dateFrom, dateTo],
    enabled: !!orgId && !!effectiveClassId && effectiveClassId !== "all",
    queryFn: async () => {
      // Get enrolled students
      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("id, student:madrasa_students!madrasa_enrollments_student_id_fkey(id, prenom, nom)")
        .eq("class_id", effectiveClassId)
        .eq("org_id", orgId!)
        .eq("statut", "Actif");

      if (!enrollments || enrollments.length === 0) return { students: [], records: [] };

      const enrollmentIds = enrollments.map((e: any) => e.id);

      // Get attendance records for the month
      const { data: records } = await supabase
        .from("madrasa_attendance")
        .select("enrollment_id, date, status, notes, created_at")
        .in("enrollment_id", enrollmentIds)
        .eq("org_id", orgId!)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      const students = enrollments
        .map((e: any) => ({
          enrollment_id: e.id,
          prenom: e.student?.prenom ?? "",
          nom: e.student?.nom ?? "",
        }))
        .sort((a: any, b: any) => a.nom.localeCompare(b.nom));

      return { students, records: records ?? [] };
    },
  });

  // Build a lookup: enrollment_id -> date_str -> record
  const grid = useMemo(() => {
    const map = new Map<string, Map<string, { status: StatusType; notes: string | null; created_at: string }>>();
    if (!data?.records) return map;
    for (const r of data.records) {
      if (!map.has(r.enrollment_id)) map.set(r.enrollment_id, new Map());
      map.get(r.enrollment_id)!.set(r.date, {
        status: r.status as StatusType,
        notes: r.notes,
        created_at: r.created_at ?? "",
      });
    }
    return map;
  }, [data]);

  // Completion rate: how many class-days have at least 1 attendance record
  const completionRate = useMemo(() => {
    if (!data?.students || data.students.length === 0) return { done: 0, total: 0 };
    // Only count weekdays (Mon-Sat for madrasa, excluding Sun)
    const schoolDays = daysInMonth.filter((d) => d.getDay() !== 0 && d <= new Date());
    const total = schoolDays.length;
    let done = 0;
    for (const day of schoolDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const hasRecord = data.students.some((s: any) => grid.get(s.enrollment_id)?.has(dateStr));
      if (hasRecord) done++;
    }
    return { done, total };
  }, [data, daysInMonth, grid]);

  const navigateMonth = (dir: number) => {
    setMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-card border rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold px-2 min-w-[130px] text-center capitalize text-foreground">
              <CalendarDays className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              {format(month, "MMMM yyyy", { locale: fr })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={effectiveClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[200px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Classe…" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom} {c.niveau ? `(${c.niveau})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Completion badge */}
          {completionRate.total > 0 && (
            <div className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-3 py-1 font-medium">
              <span className="text-secondary font-bold">{completionRate.done}</span>/{completionRate.total} appels effectués
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          {(["present", "absent", "late", "excused"] as StatusType[]).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLORS[s])} />
              {STATUS_LABELS[s]}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-muted border border-border" />
            Non saisi
          </div>
        </div>

        {/* Data Grid */}
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !data?.students || data.students.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Aucun élève inscrit dans cette classe.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="sticky left-0 z-10 bg-primary px-3 py-2 text-left font-semibold min-w-[140px]">
                    Élève
                  </th>
                  {daysInMonth.map((day) => {
                    const isWeekend = day.getDay() === 0;
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "px-0.5 py-2 text-center font-medium min-w-[26px]",
                          isWeekend && "opacity-30"
                        )}
                      >
                        <div className="leading-tight">
                          <div className="text-[9px] uppercase">
                            {format(day, "EEE", { locale: fr }).charAt(0)}
                          </div>
                          <div>{format(day, "d")}</div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-semibold min-w-[40px]">%</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student: any, idx: number) => {
                  const studentGrid = grid.get(student.enrollment_id);
                  let totalDays = 0;
                  let presentDays = 0;

                  return (
                    <tr
                      key={student.enrollment_id}
                      className={cn(
                        "border-t border-border/50 hover:bg-muted/30 transition-colors",
                        idx % 2 === 0 && "bg-muted/10"
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium text-foreground whitespace-nowrap">
                        {student.prenom} {student.nom}
                      </td>
                      {daysInMonth.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const record = studentGrid?.get(dateStr);
                        const isWeekend = day.getDay() === 0;
                        const isFuture = day > new Date();

                        if (record && !isWeekend) {
                          totalDays++;
                          if (record.status === "present" || record.status === "late") presentDays++;
                        }

                        if (isWeekend || isFuture) {
                          return (
                            <td key={dateStr} className="px-0.5 py-1.5 text-center">
                              <span className="inline-block h-3.5 w-3.5" />
                            </td>
                          );
                        }

                        if (!record) {
                          return (
                            <td key={dateStr} className="px-0.5 py-1.5 text-center">
                              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-muted/50 border border-border/30" />
                            </td>
                          );
                        }

                        return (
                          <td key={dateStr} className="px-0.5 py-1.5 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "inline-block h-3.5 w-3.5 rounded-sm cursor-default transition-transform hover:scale-125",
                                    STATUS_COLORS[record.status]
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                <p className="font-semibold">{STATUS_LABELS[record.status]}</p>
                                <p className="text-muted-foreground">
                                  {format(parseISO(dateStr), "EEEE d MMMM", { locale: fr })}
                                </p>
                                {record.notes && (
                                  <p className="mt-1 italic text-muted-foreground">"{record.notes}"</p>
                                )}
                                {record.created_at && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Saisi le {format(new Date(record.created_at), "dd/MM à HH:mm")}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold">
                        {totalDays > 0 ? (
                          <span
                            className={cn(
                              "text-xs",
                              (presentDays / totalDays) >= 0.8
                                ? "text-secondary"
                                : (presentDays / totalDays) >= 0.5
                                ? "text-[hsl(var(--amber-warm))]"
                                : "text-destructive"
                            )}
                          >
                            {Math.round((presentDays / totalDays) * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
