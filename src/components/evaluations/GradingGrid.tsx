import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEvalCriteria, useClassStudents, useEvalGrades, useEvalResults, type EvalCriterionWithSubject } from "@/hooks/useEvaluationData";
import { ArrowLeft, Save, BarChart3, Loader2, CheckCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Evaluation {
  id: string;
  title: string;
  date: string;
  max_points: number | null;
  total_points: number | null;
}

interface Props {
  evaluation: Evaluation;
  classId: string;
  className: string;
  onBack: () => void;
}

const DEBOUNCE_MS = 1500;

export function GradingGrid({ evaluation, classId, className: clsName, onBack }: Props) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: criteria = [] } = useEvalCriteria(evaluation.id);
  const { data: students = [] } = useClassStudents(classId);
  const { data: existingGrades = [] } = useEvalGrades(evaluation.id);
  const { data: evalResults = [] } = useEvalResults(evaluation.id);

  // grades[studentId][criterionId] = score string
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [sheetStudentId, setSheetStudentId] = useState<string | null>(null);
  const sheetStudent = students.find((s) => s.id === sheetStudentId);

  const totalPoints = evaluation.total_points ?? evaluation.max_points ?? 20;

  // Group criteria by subject
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subject_id: string; subject_name: string; criteria: EvalCriterionWithSubject[] }>();
    for (const c of criteria) {
      const key = c.subject_id || "ungrouped";
      if (!map.has(key)) {
        map.set(key, { subject_id: c.subject_id, subject_name: c.subject_name || "Critères", criteria: [] });
      }
      map.get(key)!.criteria.push(c);
    }
    return Array.from(map.values());
  }, [criteria]);

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
        map[s.id][cr.id] = existing?.score != null ? String(existing.score) : "";
      }
    }
    setGrades(map);
  }, [students, criteria, existingGrades]);

  const getFinalScore = useCallback((studentId: string) => {
    const studentGrades = grades[studentId];
    if (!studentGrades) return null;
    let total = 0;
    let hasAny = false;
    for (const cr of criteria) {
      const val = Number(studentGrades[cr.id]);
      if (!isNaN(val) && studentGrades[cr.id] !== "") {
        total += val;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [grades, criteria]);

  // Get subject average from view for a student
  const getSubjectGradeOn20 = useCallback((studentId: string, subjectId: string) => {
    const result = evalResults.find((r) => r.student_id === studentId && r.subject_id === subjectId);
    return result?.grade_on_20 != null ? Number(result.grade_on_20) : null;
  }, [evalResults]);

  const classAverage = useMemo(() => {
    const scores = students.map((s) => getFinalScore(s.id)).filter((s) => s !== null) as number[];
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [students, getFinalScore]);

  // Save function
  const doSave = useCallback(async (currentGrades: typeof grades) => {
    if (!orgId || criteria.length === 0) return;
    setSaving(true);
    try {
      await supabase.from("madrasa_grades").delete().eq("evaluation_id", evaluation.id).eq("org_id", orgId);

      const rows: any[] = [];
      for (const [studentId, crGrades] of Object.entries(currentGrades)) {
        for (const [crId, scoreStr] of Object.entries(crGrades)) {
          const numScore = scoreStr === "" ? null : Number(scoreStr);
          if (numScore === null || isNaN(numScore)) continue;
          rows.push({
            evaluation_id: evaluation.id,
            student_id: studentId,
            org_id: orgId,
            score: numScore,
            criteria_id: crId,
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("madrasa_grades").insert(rows);
        if (error) throw error;
      }
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["grades", evaluation.id] });
      queryClient.invalidateQueries({ queryKey: ["eval_results", evaluation.id] });
    } catch (e: any) {
      toast({ title: "Erreur de sauvegarde", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [orgId, criteria, evaluation.id, queryClient, toast]);

  const handleGradeChange = useCallback((studentId: string, criterionId: string, value: string) => {
    setGrades((prev) => {
      const next = { ...prev, [studentId]: { ...prev[studentId], [criterionId]: value } };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSave(next), DEBOUNCE_MS);
      return next;
    });
  }, [doSave]);

  const handleManualSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSave(grades);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIdx: number, criterionIdx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextRow = studentIdx + 1;
      if (nextRow < students.length) {
        const el = document.querySelector(`[data-cell="${nextRow}-${criterionIdx}"]`) as HTMLInputElement;
        el?.focus();
      }
    }
  };

  // Flat criteria list for indexing
  const flatCriteria = criteria;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{evaluation.title}</h1>
            <p className="text-sm text-muted-foreground">
              {clsName} • {format(new Date(evaluation.date), "d MMMM yyyy", { locale: fr })} • Barème /{totalPoints}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-[hsl(var(--brand-emerald))]" /> Sauvegardé
              </span>
            )}
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                <p className="text-sm font-medium text-foreground">Moyenne de la classe</p>
                <p className="text-2xl font-bold text-primary">
                  {classAverage.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {totalPoints}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grading grid */}
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun élève inscrit dans cette classe.</p>
        ) : criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun critère défini pour cette évaluation.</p>
        ) : (
          <Card className="overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                {/* Subject group header */}
                {subjectGroups.length > 1 && (
                  <TableRow className="bg-muted/20 border-b-0">
                    <TableHead className="w-[180px]" />
                    {subjectGroups.map((sg) => (
                      <TableHead
                        key={sg.subject_id}
                        colSpan={sg.criteria.length}
                        className="text-center text-xs font-semibold border-l border-border/50"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <BookOpen className="h-3 w-3" />
                          {sg.subject_name}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]" />
                  </TableRow>
                )}
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs uppercase text-muted-foreground w-[180px] sticky left-0 bg-muted/40 z-20">
                    Élève
                  </TableHead>
                  {subjectGroups.map((sg) =>
                    sg.criteria.map((cr) => (
                      <TableHead key={cr.id} className="text-xs uppercase text-muted-foreground text-center w-[100px]">
                        {cr.label}
                        <div className="text-[10px] font-normal">/{cr.max_score}</div>
                      </TableHead>
                    ))
                  )}
                  <TableHead className="text-xs uppercase text-muted-foreground text-center w-[100px] font-bold">
                    Total
                    <div className="text-[10px] font-normal">/{totalPoints}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, sIdx) => {
                  const finalScore = getFinalScore(s.id);
                  let globalCrIdx = 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:text-primary sticky left-0 bg-background z-10"
                        onClick={() => setSheetStudentId(s.id)}
                      >
                        {s.prenom} {s.nom}
                      </TableCell>
                      {subjectGroups.map((sg) =>
                        sg.criteria.map((cr) => {
                          const crIdx = globalCrIdx++;
                          const val = grades[s.id]?.[cr.id] ?? "";
                          const numVal = Number(val);
                          const isInvalid = val !== "" && (isNaN(numVal) || numVal < 0 || numVal > cr.max_score);
                          return (
                            <TableCell key={cr.id} className="text-center p-1">
                              <Input
                                data-cell={`${sIdx}-${crIdx}`}
                                type="number"
                                min={0}
                                max={cr.max_score}
                                step={0.5}
                                value={val}
                                onChange={(e) => handleGradeChange(s.id, cr.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, sIdx, crIdx)}
                                className={cn("h-8 w-16 text-center mx-auto text-sm", isInvalid && "border-destructive")}
                                placeholder="—"
                              />
                            </TableCell>
                          );
                        })
                      )}
                      <TableCell className="text-center font-bold text-foreground">
                        {finalScore !== null ? finalScore.toFixed(1) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Student detail sheet */}
      <Sheet open={!!sheetStudentId} onOpenChange={(open) => !open && setSheetStudentId(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sheetStudent ? `${sheetStudent.prenom} ${sheetStudent.nom}` : ""}</SheetTitle>
            <SheetDescription>Détail de l'évaluation</SheetDescription>
          </SheetHeader>
          {sheetStudent && (
            <div className="mt-6 space-y-5">
              {subjectGroups.map((sg) => {
                const gradeOn20 = getSubjectGradeOn20(sheetStudent.id, sg.subject_id);
                return (
                  <div key={sg.subject_id}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        {sg.subject_name}
                      </h3>
                      {gradeOn20 !== null && (
                        <Badge variant="secondary" className="text-xs">
                          {gradeOn20.toFixed(1)}/20
                        </Badge>
                      )}
                    </div>
                    {sg.criteria.map((cr) => {
                      const val = grades[sheetStudent.id]?.[cr.id] ?? "";
                      const numVal = Number(val);
                      const pct = val !== "" && !isNaN(numVal) ? Math.round((numVal / cr.max_score) * 100) : null;
                      return (
                        <div key={cr.id} className="flex items-center justify-between py-2 border-b border-border/50">
                          <div>
                            <p className="text-sm font-medium">{cr.label}</p>
                            <p className="text-xs text-muted-foreground">Barème : {cr.max_score} pts</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {val || "—"}
                              <span className="text-sm font-normal text-muted-foreground">/{cr.max_score}</span>
                            </p>
                            {pct !== null && <p className="text-xs text-muted-foreground">{pct}%</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2">
                <p className="font-semibold">Note finale</p>
                <p className="text-xl font-bold text-primary">
                  {getFinalScore(sheetStudent.id)?.toFixed(1) ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground">/{totalPoints}</span>
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
