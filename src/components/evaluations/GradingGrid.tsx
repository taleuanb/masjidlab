import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useEvalCriteria,
  useClassStudents,
  useEvalGrades,
  type EvalCriterionWithSubject,
} from "@/hooks/useEvaluationData";
import {
  ArrowLeft,
  Save,
  BarChart3,
  Loader2,
  CheckCircle,
  BookOpen,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Evaluation {
  id: string;
  title: string;
  date: string;
}

interface Props {
  evaluation: Evaluation;
  classId: string;
  className: string;
  onBack: () => void;
}

const DEBOUNCE_MS = 500;
const ABSENT_MARKER = "ABS";

// Distinct subject header colors for visual grouping
const SUBJECT_COLORS = [
  "bg-primary/10 text-primary",
  "bg-secondary/20 text-secondary-foreground",
  "bg-accent/15 text-accent-foreground",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
];

export function GradingGrid({
  evaluation,
  classId,
  className: clsName,
  onBack,
}: Props) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: criteria = [], isLoading: loadingCriteria } = useEvalCriteria(evaluation.id);
  const { data: students = [], isLoading: loadingStudents } = useClassStudents(classId);
  const { data: existingGrades = [] } = useEvalGrades(evaluation.id);

  // grades[studentId][criterionId] = string value or "ABS"
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  // Group criteria by subject
  const subjectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        subject_id: string;
        subject_name: string;
        weight: number;
        criteria: EvalCriterionWithSubject[];
      }
    >();
    for (const c of criteria) {
      const key = c.subject_id || "ungrouped";
      if (!map.has(key)) {
        map.set(key, {
          subject_id: c.subject_id,
          subject_name: c.subject_name || "Critères",
          weight: c.weight ?? 1,
          criteria: [],
        });
      }
      map.get(key)!.criteria.push(c);
    }
    return Array.from(map.values());
  }, [criteria]);

  // Flat list of criteria for keyboard navigation
  const flatCriteria = useMemo(
    () => subjectGroups.flatMap((sg) => sg.criteria),
    [subjectGroups]
  );

  // Initialize grades from existing data
  useEffect(() => {
    if (students.length === 0 || criteria.length === 0) return;
    const map: Record<string, Record<string, string>> = {};
    for (const s of students) {
      map[s.id] = {};
      for (const cr of criteria) {
        const existing = existingGrades.find(
          (g) => g.student_id === s.id && g.criteria_id === cr.id
        );
        if (existing?.score === null && existing?.comment === "ABS") {
          map[s.id][cr.id] = ABSENT_MARKER;
        } else {
          map[s.id][cr.id] =
            existing?.score != null ? String(existing.score) : "";
        }
      }
    }
    setGrades(map);
    setSynced(true);
  }, [students, criteria, existingGrades]);

  // Weighted average /20 for a student
  const getWeightedAverage = useCallback(
    (studentId: string) => {
      const sg = grades[studentId];
      if (!sg) return null;

      let weightedSum = 0;
      let weightedMaxSum = 0;
      let hasAny = false;

      for (const group of subjectGroups) {
        const groupWeight = group.weight;
        for (const cr of group.criteria) {
          const val = sg[cr.id];
          if (val === ABSENT_MARKER || val === "" || val === undefined) continue;
          const num = Number(val);
          if (isNaN(num)) continue;
          const crWeight = cr.weight ?? 1;
          weightedSum += num * crWeight * groupWeight;
          weightedMaxSum += cr.max_score * crWeight * groupWeight;
          hasAny = true;
        }
      }

      if (!hasAny || weightedMaxSum === 0) return null;
      return (weightedSum / weightedMaxSum) * 20;
    },
    [grades, subjectGroups]
  );

  // Subject sub-total
  const getSubjectTotal = useCallback(
    (studentId: string, subjectCriteria: EvalCriterionWithSubject[]) => {
      const sg = grades[studentId];
      if (!sg) return null;
      let total = 0;
      let hasAny = false;
      for (const cr of subjectCriteria) {
        const val = sg[cr.id];
        if (val === ABSENT_MARKER || val === "" || val === undefined) continue;
        const num = Number(val);
        if (!isNaN(num)) {
          total += num;
          hasAny = true;
        }
      }
      return hasAny ? total : null;
    },
    [grades]
  );

  const classAverage = useMemo(() => {
    const scores = students
      .map((s) => getWeightedAverage(s.id))
      .filter((s) => s !== null) as number[];
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [students, getWeightedAverage]);

  // Upsert save
  const doSave = useCallback(
    async (currentGrades: typeof grades) => {
      if (!orgId || criteria.length === 0) return;
      setSaving(true);
      setSynced(false);
      try {
        // Delete all existing grades then insert — simulates upsert atomically
        await supabase
          .from("madrasa_grades")
          .delete()
          .eq("evaluation_id", evaluation.id)
          .eq("org_id", orgId);

        const rows: {
          evaluation_id: string;
          student_id: string;
          org_id: string;
          score: number | null;
          criteria_id: string;
          comment: string | null;
        }[] = [];

        for (const [studentId, crGrades] of Object.entries(currentGrades)) {
          for (const [crId, scoreStr] of Object.entries(crGrades)) {
            if (scoreStr === ABSENT_MARKER) {
              rows.push({
                evaluation_id: evaluation.id,
                student_id: studentId,
                org_id: orgId,
                score: null,
                criteria_id: crId,
                comment: "ABS",
              });
            } else {
              const numScore = scoreStr === "" ? null : Number(scoreStr);
              if (numScore === null || isNaN(numScore)) continue;
              rows.push({
                evaluation_id: evaluation.id,
                student_id: studentId,
                org_id: orgId,
                score: numScore,
                criteria_id: crId,
                comment: null,
              });
            }
          }
        }

        if (rows.length > 0) {
          const { error } = await supabase.from("madrasa_grades").insert(rows);
          if (error) throw error;
        }

        setSynced(true);
        queryClient.invalidateQueries({ queryKey: ["grades", evaluation.id] });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        toast({
          title: "Erreur de sauvegarde",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [orgId, criteria, evaluation.id, queryClient, toast]
  );

  const scheduleSave = useCallback(
    (nextGrades: typeof grades) => {
      setSynced(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSave(nextGrades), DEBOUNCE_MS);
    },
    [doSave]
  );

  const handleGradeChange = useCallback(
    (studentId: string, criterionId: string, value: string) => {
      setGrades((prev) => {
        const next = {
          ...prev,
          [studentId]: { ...prev[studentId], [criterionId]: value },
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const handleMarkAbsent = useCallback(
    (studentId: string) => {
      setGrades((prev) => {
        const next = { ...prev };
        next[studentId] = { ...prev[studentId] };
        for (const cr of flatCriteria) {
          next[studentId][cr.id] = ABSENT_MARKER;
        }
        scheduleSave(next);
        return next;
      });
    },
    [flatCriteria, scheduleSave]
  );

  const handleClearAbsent = useCallback(
    (studentId: string) => {
      setGrades((prev) => {
        const next = { ...prev };
        next[studentId] = { ...prev[studentId] };
        for (const cr of flatCriteria) {
          if (next[studentId][cr.id] === ABSENT_MARKER) {
            next[studentId][cr.id] = "";
          }
        }
        scheduleSave(next);
        return next;
      });
    },
    [flatCriteria, scheduleSave]
  );

  const handleManualSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave(grades);
  };

  // Focus helper
  const focusCell = (row: number, col: number) => {
    const el = gridRef.current?.querySelector(
      `[data-cell="${row}-${col}"]`
    ) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIdx: number,
    criterionIdx: number
  ) => {
    const maxRow = students.length - 1;
    const maxCol = flatCriteria.length - 1;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (studentIdx < maxRow) focusCell(studentIdx + 1, criterionIdx);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (criterionIdx > 0) focusCell(studentIdx, criterionIdx - 1);
          else if (studentIdx > 0) focusCell(studentIdx - 1, maxCol);
        } else {
          if (criterionIdx < maxCol) focusCell(studentIdx, criterionIdx + 1);
          else if (studentIdx < maxRow) focusCell(studentIdx + 1, 0);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (studentIdx > 0) focusCell(studentIdx - 1, criterionIdx);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (studentIdx < maxRow) focusCell(studentIdx + 1, criterionIdx);
        break;
      case "ArrowLeft":
        if (
          (e.target as HTMLInputElement).selectionStart === 0 &&
          criterionIdx > 0
        ) {
          e.preventDefault();
          focusCell(studentIdx, criterionIdx - 1);
        }
        break;
      case "ArrowRight": {
        const inp = e.target as HTMLInputElement;
        if (
          inp.selectionStart === inp.value.length &&
          criterionIdx < maxCol
        ) {
          e.preventDefault();
          focusCell(studentIdx, criterionIdx + 1);
        }
        break;
      }
    }
  };

  const isLoading = loadingCriteria || loadingStudents;

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4 max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {evaluation.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {clsName} •{" "}
              {format(new Date(evaluation.date), "d MMMM yyyy", {
                locale: fr,
              })}{" "}
              • {students.length} élèves
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {synced && !saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />{" "}
                Synchronisé
              </span>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…
              </span>
            )}
            <Button onClick={handleManualSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-1" /> Enregistrer
            </Button>
          </div>
        </div>

        {/* Average KPI */}
        {classAverage !== null && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Moyenne de la classe
                </p>
                <p className="text-2xl font-bold text-primary">
                  {classAverage.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / 20
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid */}
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun élève inscrit dans cette classe.
          </p>
        ) : criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun critère défini pour cette évaluation.
          </p>
        ) : (
          <Card className="overflow-auto">
            <Table ref={gridRef}>
              <TableHeader className="sticky top-0 z-10 bg-background">
                {/* Level 1: Subject groups */}
                <TableRow className="border-b-0">
                  <TableHead className="w-[180px] sticky left-0 bg-background z-20 border-r" />
                  {subjectGroups.map((sg, sgIdx) => {
                    const colorClass =
                      SUBJECT_COLORS[sgIdx % SUBJECT_COLORS.length];
                    const subMax = sg.criteria.reduce(
                      (sum, c) => sum + c.max_score,
                      0
                    );
                    return (
                      <TableHead
                        key={sg.subject_id}
                        colSpan={sg.criteria.length}
                        className={cn(
                          "text-center text-xs font-semibold border-l border-r py-1.5",
                          colorClass
                        )}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <BookOpen className="h-3 w-3" />
                          {sg.subject_name}
                          <span className="font-normal opacity-70">
                            (coeff {sg.weight} • /{subMax})
                          </span>
                        </span>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-[80px] text-center border-l" />
                </TableRow>

                {/* Level 2: Criteria */}
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs uppercase text-muted-foreground w-[180px] sticky left-0 bg-muted/40 z-20 border-r">
                    Élève
                  </TableHead>
                  {subjectGroups.map((sg) =>
                    sg.criteria.map((cr) => (
                      <TableHead
                        key={cr.id}
                        className="text-xs text-muted-foreground text-center w-[90px] py-1 border-l"
                      >
                        <span className="block truncate">{cr.label}</span>
                        <span className="text-[10px] font-normal">
                          /{cr.max_score}
                        </span>
                      </TableHead>
                    ))
                  )}
                  <TableHead className="text-xs uppercase text-muted-foreground text-center w-[80px] font-bold border-l">
                    Moy.
                    <div className="text-[10px] font-normal">/20</div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {students.map((s, sIdx) => {
                  const avg = getWeightedAverage(s.id);
                  const isAbsent = flatCriteria.every(
                    (cr) => grades[s.id]?.[cr.id] === ABSENT_MARKER
                  );
                  let globalCrIdx = 0;

                  return (
                    <ContextMenu key={s.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          className={cn(
                            "hover:bg-muted/20",
                            isAbsent && "bg-muted/10 opacity-60"
                          )}
                        >
                          <TableCell className="font-medium sticky left-0 bg-background z-10 text-sm py-1 border-r whitespace-nowrap">
                            {s.prenom} {s.nom}
                          </TableCell>
                          {subjectGroups.map((sg) =>
                            sg.criteria.map((cr) => {
                              const crIdx = globalCrIdx++;
                              const val = grades[s.id]?.[cr.id] ?? "";
                              const isAbs = val === ABSENT_MARKER;
                              const numVal = Number(val);
                              const isInvalid =
                                !isAbs &&
                                val !== "" &&
                                (isNaN(numVal) ||
                                  numVal < 0 ||
                                  numVal > cr.max_score);
                              const isFilled =
                                !isAbs && val !== "" && !isNaN(numVal);

                              return (
                                <TableCell
                                  key={cr.id}
                                  className="text-center p-0.5 border-l"
                                >
                                  {isAbs ? (
                                    <span className="text-xs font-semibold text-destructive">
                                      ABS
                                    </span>
                                  ) : (
                                    <Input
                                      data-cell={`${sIdx}-${crIdx}`}
                                      type="number"
                                      min={0}
                                      max={cr.max_score}
                                      step={0.5}
                                      value={val}
                                      onChange={(e) =>
                                        handleGradeChange(
                                          s.id,
                                          cr.id,
                                          e.target.value
                                        )
                                      }
                                      onKeyDown={(e) =>
                                        handleKeyDown(e, sIdx, crIdx)
                                      }
                                      className={cn(
                                        "h-7 w-14 text-center mx-auto text-sm border-transparent bg-transparent focus:border-primary focus:bg-background transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                        isInvalid &&
                                          "border-destructive bg-destructive/5",
                                        isFilled &&
                                          !isInvalid &&
                                          "text-foreground font-medium"
                                      )}
                                      placeholder="—"
                                    />
                                  )}
                                </TableCell>
                              );
                            })
                          )}
                          <TableCell className="text-center font-bold text-foreground py-1 border-l">
                            {isAbsent ? (
                              <span className="text-xs text-destructive">
                                ABS
                              </span>
                            ) : avg !== null ? (
                              <span
                                className={cn(
                                  avg >= 10
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                                )}
                              >
                                {avg.toFixed(2)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {isAbsent ? (
                          <ContextMenuItem
                            onClick={() => handleClearAbsent(s.id)}
                          >
                            Retirer l'absence
                          </ContextMenuItem>
                        ) : (
                          <ContextMenuItem
                            onClick={() => handleMarkAbsent(s.id)}
                          >
                            <Ban className="h-3.5 w-3.5 mr-2" />
                            Marquer absent
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Keyboard shortcuts hint */}
        <p className="text-[11px] text-muted-foreground text-center">
          Navigation : <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Entrée</kbd> ↓ •{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Tab</kbd> → •{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Flèches</kbd> libre •{" "}
          Clic droit pour marquer absent
        </p>
      </div>
    </main>
  );
}
