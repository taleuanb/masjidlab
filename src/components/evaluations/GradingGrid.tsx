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
  Ban,
  Lightbulb,
  PlusCircle,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ReportCard } from "./ReportCard";

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

  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(false);
  const [bulletinStudentId, setBulletinStudentId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

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

  const flatCriteria = useMemo(
    () => subjectGroups.flatMap((sg) => sg.criteria),
    [subjectGroups]
  );

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

  const classAverage = useMemo(() => {
    const scores = students
      .map((s) => getWeightedAverage(s.id))
      .filter((s) => s !== null) as number[];
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [students, getWeightedAverage]);

  const doSave = useCallback(
    async (currentGrades: typeof grades) => {
      if (!orgId || criteria.length === 0) return;
      setSaving(true);
      setSynced(false);
      try {
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
              // Skip invalid scores
              const cr = flatCriteria.find((c) => c.id === crId);
              if (cr && numScore > cr.max_score) continue;
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
          const { error } = await supabase
            .from("madrasa_grades")
            .upsert(rows, { onConflict: "student_id,criteria_id,evaluation_id" });
          if (error) throw error;
        }

        setSynced(true);
        queryClient.invalidateQueries({ queryKey: ["grades", evaluation.id] });
      } catch (e: unknown) {
        console.error("Grade save error:", e);
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        const userMsg = msg.includes("violates")
          ? "Donnée invalide — vérifiez les notes saisies."
          : msg.includes("network") || msg.includes("fetch")
          ? "Erreur de connexion — réessayez."
          : `Erreur de sauvegarde : ${msg}`;
        toast({
          title: "Erreur",
          description: userMsg,
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [orgId, criteria, flatCriteria, evaluation.id, queryClient, toast]
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
        if (inp.selectionStart === inp.value.length && criterionIdx < maxCol) {
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
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {evaluation.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {clsName} •{" "}
              {format(new Date(evaluation.date), "d MMMM yyyy", { locale: fr })} •{" "}
              {students.length} élèves
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {synced && !saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" /> Synchronisé
              </span>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…
              </span>
            )}
            <Button onClick={handleManualSave} disabled={saving} size="sm" variant="outline">
              <Save className="h-4 w-4 mr-1" /> Forcer la synchro
            </Button>
          </div>
        </div>

        {/* Class average */}
        {classAverage !== null && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-muted/30">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Moyenne de classe</span>
            <span className="text-lg font-bold text-foreground">
              {classAverage.toFixed(2)}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">/20</span>
            </span>
          </div>
        )}

        {/* Tip banner */}
        <Alert className="border-border bg-muted/20">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-xs text-muted-foreground">
            <strong>Astuce Pro :</strong> Utilisez les flèches du clavier pour naviguer et «Entrée» pour passer à l'élève suivant. Les notes sont sauvegardées instantanément.
          </AlertDescription>
        </Alert>

        {/* Grid */}
        {students.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucun élève inscrit</p>
              <p className="text-xs text-muted-foreground">Aucun élève n'est inscrit dans cette classe.</p>
            </CardContent>
          </Card>
        ) : criteria.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucun critère défini</p>
              <p className="text-xs text-muted-foreground">Ajoutez des critères pour commencer la saisie des notes.</p>
              <Button variant="outline" size="sm" className="mt-2">
                <PlusCircle className="h-4 w-4 mr-1" /> Ajouter des critères
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-auto border">
            <Table ref={gridRef} className="text-sm">
              <TableHeader className="sticky top-0 z-10">
                {/* Level 1: Subject groups */}
                <TableRow className="border-b bg-muted/40">
                  <TableHead className="w-[180px] sticky left-0 z-20 bg-muted/40 border-r" />
                  {subjectGroups.map((sg, sgIdx) => {
                    const subMax = sg.criteria.reduce((sum, c) => sum + c.max_score, 0);
                    return (
                      <TableHead
                        key={sg.subject_id}
                        colSpan={sg.criteria.length}
                        className={cn(
                          "text-center text-xs font-semibold py-2 tracking-wide text-muted-foreground",
                          sgIdx < subjectGroups.length - 1 && "border-r-2 border-border"
                        )}
                      >
                        {sg.subject_name}
                        <span className="ml-1.5 font-normal opacity-60">
                          coeff {sg.weight} • /{subMax}
                        </span>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-[80px] text-center border-l-2 border-border bg-muted/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Moy.
                  </TableHead>
                </TableRow>

                {/* Level 2: Criteria */}
                <TableRow className="bg-background border-b">
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground w-[180px] sticky left-0 bg-background z-20 border-r font-medium">
                    Élève
                  </TableHead>
                  {subjectGroups.map((sg, sgIdx) =>
                    sg.criteria.map((cr, crLocalIdx) => (
                      <TableHead
                        key={cr.id}
                        className={cn(
                          "text-[11px] uppercase tracking-wider text-muted-foreground text-center w-[80px] py-1.5 font-medium",
                          crLocalIdx > 0 && "border-l border-border/50",
                          crLocalIdx === sg.criteria.length - 1 &&
                            sgIdx < subjectGroups.length - 1 &&
                            "border-r-2 border-border"
                        )}
                      >
                        <span className="block truncate">{cr.label}</span>
                        <span className="text-[10px] font-normal opacity-50">/{cr.max_score}</span>
                      </TableHead>
                    ))
                  )}
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-center w-[80px] font-bold border-l-2 border-border bg-muted/60">
                    /20
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
                            "hover:bg-muted/20 transition-colors",
                            isAbsent && "opacity-50",
                            sIdx % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          <TableCell className="font-medium sticky left-0 z-10 bg-background text-xs py-1.5 border-r whitespace-nowrap">
                            {s.prenom} {s.nom}
                          </TableCell>
                          {subjectGroups.map((sg, sgIdx) =>
                            sg.criteria.map((cr, crLocalIdx) => {
                              const crIdx = globalCrIdx++;
                              const val = grades[s.id]?.[cr.id] ?? "";
                              const isAbs = val === ABSENT_MARKER;
                              const numVal = Number(val);
                              const isInvalid =
                                !isAbs &&
                                val !== "" &&
                                (isNaN(numVal) || numVal < 0 || numVal > cr.max_score);

                              return (
                                <TableCell
                                  key={cr.id}
                                  className={cn(
                                    "text-center p-0",
                                    crLocalIdx > 0 && "border-l border-border/30",
                                    crLocalIdx === sg.criteria.length - 1 &&
                                      sgIdx < subjectGroups.length - 1 &&
                                      "border-r-2 border-border"
                                  )}
                                >
                                  {isAbs ? (
                                    <span className="text-[11px] font-semibold text-destructive">
                                      ABS
                                    </span>
                                  ) : (
                                    <div className="relative">
                                      <Input
                                        data-cell={`${sIdx}-${crIdx}`}
                                        type="number"
                                        min={0}
                                        max={cr.max_score}
                                        step={0.5}
                                        value={val}
                                        onChange={(e) =>
                                          handleGradeChange(s.id, cr.id, e.target.value)
                                        }
                                        onKeyDown={(e) => handleKeyDown(e, sIdx, crIdx)}
                                        className={cn(
                                          "h-7 w-full text-center text-xs rounded-none border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                          isInvalid && "ring-1 ring-destructive bg-destructive/5"
                                        )}
                                        placeholder="—"
                                      />
                                      {isInvalid && (
                                        <span className="absolute -bottom-4 left-0 right-0 text-[9px] text-destructive text-center whitespace-nowrap z-20">
                                          Max {cr.max_score}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })
                          )}
                          <TableCell className="text-center font-bold text-xs py-1.5 border-l-2 border-border bg-muted/30">
                            {isAbsent ? (
                              <span className="text-[11px] text-destructive">ABS</span>
                            ) : avg !== null ? (
                              <span
                                className={cn(
                                  "tabular-nums",
                                  avg >= 10 ? "text-foreground" : "text-destructive"
                                )}
                              >
                                {avg.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {isAbsent ? (
                          <ContextMenuItem onClick={() => handleClearAbsent(s.id)}>
                            Retirer l'absence
                          </ContextMenuItem>
                        ) : (
                          <ContextMenuItem onClick={() => handleMarkAbsent(s.id)}>
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
      </div>
    </main>
  );
}