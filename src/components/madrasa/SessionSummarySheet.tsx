import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SessionSummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  className?: string | null;
  classNiveau?: string | null;
  sessionDate?: Date | null;
  teacherName?: string | null;
}

interface AttendanceRow {
  id: string;
  status: string;
  notes: string | null;
  student_id: string | null;
  madrasa_students: { prenom: string; nom: string } | null;
}

interface ProgressRow {
  student_id: string;
  data_json: Record<string, string>;
}

export function SessionSummarySheet({
  open,
  onOpenChange,
  sessionId,
  className,
  classNiveau,
  sessionDate,
  teacherName,
}: SessionSummarySheetProps) {
  const { orgId } = useOrganization();

  // Session data
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["summary-session", sessionId],
    enabled: open && !!sessionId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_sessions")
        .select("id, status, summary_note, average_rating, attendance_count, completed_at")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Attendance details with student names
  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["summary-attendance", sessionId],
    enabled: open && !!sessionId && session?.status === "completed",
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_attendance")
        .select("id, status, notes, student_id, madrasa_students(prenom, nom)")
        .eq("session_id", sessionId!);
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRow[];
    },
  });

  // Student progress for this session
  const { data: progressRows = [] } = useQuery({
    queryKey: ["summary-progress", sessionId],
    enabled: open && !!sessionId && session?.status === "completed",
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_student_progress")
        .select("student_id, data_json")
        .eq("session_id", sessionId!)
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as ProgressRow[];
    },
  });

  const progressMap = new Map(progressRows.map((p) => [p.student_id, p.data_json]));

  const isCompleted = session?.status === "completed";
  const totalStudents = attendance.length;
  const presentCount = attendance.filter(
    (a) => a.status === "present" || a.status === "late"
  ).length;
  const attendancePct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  const statusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
      case "late":
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      case "absent":
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case "excused":
        return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "present": return "Présent";
      case "late": return "Retard";
      case "absent": return "Absent";
      case "excused": return "Excusé";
      default: return status;
    }
  };

  // Extract a rating from data_json (first number field with max 5)
  const getRating = (data: Record<string, string> | undefined): number | null => {
    if (!data) return null;
    for (const [, value] of Object.entries(data)) {
      const num = Number(value);
      if (!isNaN(num) && num >= 0 && num <= 5 && value !== "" && value !== "true" && value !== "false") {
        return num;
      }
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[520px] flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-lg leading-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Bilan de Séance
          </SheetTitle>
          <SheetDescription className="space-y-1">
            <span className="block font-medium text-foreground">
              {className ?? "Classe"}
              {classNiveau && (
                <Badge variant="secondary" className="text-[10px] ml-2 font-normal">
                  {classNiveau}
                </Badge>
              )}
            </span>
            <span className="block text-xs">
              {sessionDate
                ? format(sessionDate, "EEEE d MMMM yyyy", { locale: fr })
                : "—"}
              {teacherName && ` · ${teacherName}`}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pt-4">
          {/* Loading state */}
          {loadingSession && (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          )}

          {/* Not completed state */}
          {!loadingSession && !isCompleted && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Bilan en attente
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[280px]">
                Le bilan sera disponible une fois que l'enseignant aura clôturé la séance.
              </p>
            </div>
          )}

          {/* Completed session content */}
          {!loadingSession && isCompleted && session && (
            <>
              {/* Stats block */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Note moyenne
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    ⭐ {(session.average_rating ?? 0).toFixed(1)}
                    <span className="text-sm font-normal text-muted-foreground">/5</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Présence
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    👥 {presentCount}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{totalStudents}
                    </span>
                  </p>
                  <Progress value={attendancePct} className="h-1.5" />
                </div>
              </div>

              <Separator />

              {/* Summary note */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Le Mot du Prof
                </p>
                {session.summary_note ? (
                  <div className="rounded-lg bg-muted/50 border border-border/50 p-4">
                    <p className="text-sm leading-relaxed italic text-foreground/80">
                      {session.summary_note}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/30 border border-dashed border-border p-4 text-center">
                    <p className="text-xs text-muted-foreground italic">
                      Aucun résumé collectif saisi pour cette séance.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Student detail table */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Détail des élèves
                </p>

                {loadingAttendance ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded" />
                    ))}
                  </div>
                ) : attendance.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Aucune donnée de présence enregistrée.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase tracking-wider h-8">
                            Élève
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider h-8 w-20 text-center">
                            Statut
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider h-8 w-16 text-center">
                            Note
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider h-8">
                            Remarque
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendance.map((row) => {
                          const progress = row.student_id
                            ? progressMap.get(row.student_id)
                            : undefined;
                          const rating = getRating(progress);
                          const remark =
                            progress?.["todo_next"] || row.notes || null;

                          return (
                            <TableRow key={row.id} className="text-xs">
                              <TableCell className="py-2 font-medium">
                                {row.madrasa_students
                                  ? `${row.madrasa_students.prenom} ${row.madrasa_students.nom}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {statusIcon(row.status)}
                                  <span className="text-[10px]">
                                    {statusLabel(row.status)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-center tabular-nums">
                                {rating !== null ? (
                                  <span>
                                    ⭐ {rating}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 max-w-[140px]">
                                {remark ? (
                                  <span className="text-muted-foreground truncate block text-[11px]">
                                    {remark}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
