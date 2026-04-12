import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useClassStudents } from "@/hooks/useEvaluationData";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  BookOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CreateEvalWizard } from "./CreateEvalWizard";

interface Evaluation {
  id: string;
  title: string;
  date: string;
  status: string | null;
  max_points: number | null;
  subject_id: string | null;
  subject?: { name: string } | null;
  total_points: number | null;
}

interface Props {
  classId: string;
  className: string;
  onBack: () => void;
  onSelectEval: (evalId: string) => void;
  onSelectBulletins?: (evalId: string) => void;
}

// Status reference: draft | published | archived
const STATUS_CONFIG: Record<string, { label: string; variant: "secondary" | "default" | "outline"; className: string }> = {
  draft: { label: "Brouillon", variant: "secondary", className: "bg-muted text-muted-foreground" },
  "in_progress": { label: "En cours", variant: "outline", className: "border-amber-500/40 text-amber-600 bg-amber-500/10" },
  published: { label: "Publié", variant: "default", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  archived: { label: "Archivé", variant: "secondary", className: "bg-muted/60 text-muted-foreground/60" },
};

export function EvalListView({ classId, className: clsName, onBack, onSelectEval, onSelectBulletins }: Props) {
  const { orgId } = useOrganization();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: students = [] } = useClassStudents(classId);

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ["evaluations", classId],
    enabled: !!classId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_evaluations")
        .select("*, subject:madrasa_subjects(name)")
        .eq("class_id", classId)
        .eq("org_id", orgId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evaluation[];
    },
  });

  // Subject names per eval
  const { data: evalSubjectCounts = {} } = useQuery({
    queryKey: ["eval_subject_counts", classId],
    enabled: evaluations.length > 0,
    queryFn: async () => {
      const evalIds = evaluations.map((e) => e.id);
      const { data } = await supabase
        .from("madrasa_evaluation_subjects")
        .select("evaluation_id, subject:madrasa_subjects(name)")
        .in("evaluation_id", evalIds);
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        if (!map[row.evaluation_id]) map[row.evaluation_id] = [];
        if ((row.subject as any)?.name) map[row.evaluation_id].push((row.subject as any).name);
      }
      return map;
    },
  });

  // Grade counts per eval
  const { data: gradeCounts = {} } = useQuery({
    queryKey: ["eval_grade_counts", classId],
    enabled: evaluations.length > 0 && !!orgId,
    queryFn: async () => {
      const evalIds = evaluations.map((e) => e.id);
      const { data } = await supabase
        .from("madrasa_grades")
        .select("evaluation_id, student_id, score")
        .eq("org_id", orgId!)
        .in("evaluation_id", evalIds);
      const map: Record<string, { evaluated: number; avg: number | null }> = {};
      const evalStudents: Record<string, Map<string, number[]>> = {};
      for (const g of data ?? []) {
        if (!evalStudents[g.evaluation_id]) evalStudents[g.evaluation_id] = new Map();
        const sMap = evalStudents[g.evaluation_id];
        if (!sMap.has(g.student_id)) sMap.set(g.student_id, []);
        if (g.score != null) sMap.get(g.student_id)!.push(Number(g.score));
      }
      for (const [evalId, sMap] of Object.entries(evalStudents)) {
        const studentsWithScores = [...sMap.values()].filter((s) => s.length > 0);
        const allScores = studentsWithScores.flat();
        map[evalId] = {
          evaluated: studentsWithScores.length,
          avg: allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null,
        };
      }
      return map;
    },
  });

  // Group evaluations by month
  const groupedByMonth = useMemo(() => {
    const groups: { label: string; key: string; evals: Evaluation[] }[] = [];
    const map = new Map<string, Evaluation[]>();
    for (const ev of evaluations) {
      const key = format(new Date(ev.date), "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const [key, evals] of map.entries()) {
      const label = format(new Date(key + "-01"), "MMMM yyyy", { locale: fr });
      groups.push({ label: label.charAt(0).toUpperCase() + label.slice(1), key, evals });
    }
    return groups;
  }, [evaluations]);

  // Smart status: draft/published uses dynamic badge based on grade count
  const getSmartStatus = (ev: Evaluation): string => {
    const dbStatus = ev.status ?? "draft";
    if (dbStatus === "archived") return "archived";
    if (dbStatus === "draft") return "draft";
    // published → check completion
    if (dbStatus === "published") {
      const gc = gradeCounts[ev.id];
      if (!gc || gc.evaluated === 0) return "draft";
      if (gc.evaluated >= students.length && students.length > 0) return "published";
      return "in_progress";
    }
    // Legacy statuses fallback
    const gc = gradeCounts[ev.id];
    if (!gc || gc.evaluated === 0) return "draft";
    if (gc.evaluated >= students.length && students.length > 0) return "published";
    return "in_progress";
  };

  const deleteMutation = useMutation({
    mutationFn: async (evalId: string) => {
      const { error: grErr } = await supabase.from("madrasa_grades").delete().eq("evaluation_id", evalId);
      if (grErr) throw grErr;
      const { data: esRows } = await supabase.from("madrasa_evaluation_subjects").select("id").eq("evaluation_id", evalId);
      if (esRows && esRows.length > 0) {
        const esIds = esRows.map((r) => r.id);
        await supabase.from("madrasa_evaluation_criteria").delete().in("evaluation_subject_id", esIds);
      }
      await supabase.from("madrasa_evaluation_subjects").delete().eq("evaluation_id", evalId);
      await supabase.from("madrasa_evaluation_results").delete().eq("evaluation_id", evalId);
      const { error } = await supabase.from("madrasa_evaluations").delete().eq("id", evalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Évaluation supprimée");
      queryClient.invalidateQueries({ queryKey: ["evaluations", classId] });
      queryClient.invalidateQueries({ queryKey: ["eval_grade_counts", classId] });
    },
    onError: (err: any) => {
      console.error("Delete eval error:", err);
      toast.error("Erreur lors de la suppression");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (evalId: string) => {
      const { error } = await supabase
        .from("madrasa_evaluations")
        .update({ status: "archived" })
        .eq("id", evalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Évaluation archivée");
      queryClient.invalidateQueries({ queryKey: ["evaluations", classId] });
    },
    onError: () => {
      toast.error("Erreur lors de l'archivage");
    },
  });

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ClipboardCheck className="h-5 w-5 text-accent" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">{clsName}</h1>
            <p className="text-sm text-muted-foreground">
              Évaluations • {students.length} élèves inscrits
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => setDialogOpen(true)}
              className="shrink-0 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nouvel examen
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucune évaluation créée pour cette classe.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquez sur « Nouvel examen » pour commencer.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByMonth.map((group) => (
              <section key={group.key}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-[10px]">
                    {group.evals.length} examen{group.evals.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-3">
                    {group.evals.map((ev) => {
                      const subjectNames = evalSubjectCounts[ev.id] ?? [];
                      const allSubjects =
                        subjectNames.length > 0
                          ? subjectNames
                          : ev.subject?.name
                          ? [ev.subject.name]
                          : [];
                      const status = getSmartStatus(ev);
                      const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
                      const gc = gradeCounts[ev.id];
                      const evaluatedCount = gc?.evaluated ?? 0;
                      const isArchived = status === "archived";

                      return (
                        <div key={ev.id} className="relative">
                          <div
                            className={cn(
                              "absolute -left-6 top-5 h-3 w-3 rounded-full border-2 border-background z-10",
                              status === "published"
                                ? "bg-emerald-500"
                                : status === "in_progress"
                                ? "bg-amber-500"
                                : status === "archived"
                                ? "bg-muted-foreground/30"
                                : "bg-muted-foreground/40"
                            )}
                          />

                          <Card
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-md hover:border-primary/20 rounded-xl shadow-sm",
                              isArchived && "opacity-60"
                            )}
                            onClick={() => onSelectEval(ev.id)}
                          >
                            <CardContent className="py-4 px-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <p className={cn("font-semibold text-foreground truncate", isArchived && "line-through opacity-70")}>
                                      {ev.title}
                                    </p>
                                    <Badge
                                      variant={statusCfg.variant}
                                      className={cn("text-[10px] shrink-0", statusCfg.className)}
                                    >
                                      {statusCfg.label}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(ev.date), "d MMM yyyy", { locale: fr })}
                                    </span>
                                    {allSubjects.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" />
                                        {allSubjects.join(", ")}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {evaluatedCount}/{students.length} évalués
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {(status === "published" || status === "in_progress") && gc?.avg != null && (
                                    <div className="text-right">
                                      <p
                                        className={cn(
                                          "text-lg font-bold tabular-nums",
                                          gc.avg >= 10
                                            ? "text-emerald-600"
                                            : "text-destructive"
                                        )}
                                      >
                                        {gc.avg.toFixed(1)}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">/20 moy.</p>
                                    </div>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {isArchived ? (
                                        <>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSelectEval(ev.id);
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            Consulter les notes
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSelectBulletins?.(ev.id);
                                            }}
                                          >
                                            <FileText className="h-3.5 w-3.5 mr-2" />
                                            Générer les bulletins
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteTarget({ id: ev.id, title: ev.title });
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Supprimer
                                          </DropdownMenuItem>
                                        </>
                                      ) : (
                                        <>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSelectEval(ev.id);
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            Saisir les notes
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSelectBulletins?.(ev.id);
                                            }}
                                          >
                                            <FileText className="h-3.5 w-3.5 mr-2" />
                                            Générer les bulletins
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setArchiveTarget({ id: ev.id, title: ev.title });
                                            }}
                                          >
                                            <Archive className="h-3.5 w-3.5 mr-2" />
                                            Archiver
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteTarget({ id: ev.id, title: ev.title });
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Supprimer
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CreateEvalWizard
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        classId={classId}
        className={clsName}
        onCreated={(evalId) => onSelectEval(evalId)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette évaluation ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'évaluation « {deleteTarget?.title} » ainsi que toutes les notes associées seront définitivement supprimées. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette évaluation ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'évaluation « {archiveTarget?.title} » sera archivée. Les notes ne pourront plus être modifiées mais resteront consultables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) archiveMutation.mutate(archiveTarget.id);
                setArchiveTarget(null);
              }}
            >
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
