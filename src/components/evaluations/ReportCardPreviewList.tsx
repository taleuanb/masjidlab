import { ArrowLeft, FileText, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClassStudents } from "@/hooks/useEvaluationData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useState } from "react";
import { ReportCard } from "./ReportCard";

interface Props {
  evalId: string;
  evalTitle: string;
  classId: string;
  className: string;
  onBack: () => void;
}

export function ReportCardPreviewList({ evalId, evalTitle, classId, className: clsName, onBack }: Props) {
  const { orgId } = useOrganization();
  const { data: students = [], isLoading } = useClassStudents(classId);
  const [previewStudent, setPreviewStudent] = useState<{ id: string; nom: string; prenom: string } | null>(null);

  // Fetch grades & subjects for the selected student's report card
  const { data: reportData } = useQuery({
    queryKey: ["report_card_data", evalId, previewStudent?.id],
    enabled: !!previewStudent && !!orgId,
    queryFn: async () => {
      const studentId = previewStudent!.id;

      // Get evaluation details
      const { data: evalData } = await supabase
        .from("madrasa_evaluations")
        .select("title, date")
        .eq("id", evalId)
        .single();

      // Get evaluation subjects with criteria
      const { data: evalSubjects } = await supabase
        .from("madrasa_evaluation_subjects")
        .select("id, subject_id, subject:madrasa_subjects(name), weight")
        .eq("evaluation_id", evalId);

      // Get grades for this student
      const { data: grades } = await supabase
        .from("madrasa_grades")
        .select("criteria_id, score")
        .eq("evaluation_id", evalId)
        .eq("student_id", studentId)
        .eq("org_id", orgId!);

      // Get criteria for evaluation subjects
      const esIds = (evalSubjects ?? []).map((es) => es.id);
      const { data: criteria } = await supabase
        .from("madrasa_evaluation_criteria")
        .select("id, evaluation_subject_id, max_score, weight")
        .in("evaluation_subject_id", esIds.length > 0 ? esIds : ["__none__"]);

      // Build subject scores
      const subjectScores: { subject_name: string; score: number; max_score: number; normalized: number }[] = [];
      for (const es of evalSubjects ?? []) {
        const subjectCriteria = (criteria ?? []).filter((c) => c.evaluation_subject_id === es.id);
        const maxScore = subjectCriteria.reduce((s, c) => s + c.max_score, 0);
        const studentScore = subjectCriteria.reduce((s, c) => {
          const g = (grades ?? []).find((g) => g.criteria_id === c.id);
          return s + (g?.score ?? 0);
        }, 0);
        const normalized = maxScore > 0 ? (studentScore / maxScore) * 20 : 0;
        subjectScores.push({
          subject_name: (es.subject as any)?.name ?? "—",
          score: studentScore,
          max_score: maxScore,
          normalized: Math.round(normalized * 100) / 100,
        });
      }

      const avg = subjectScores.length > 0
        ? subjectScores.reduce((s, ss) => s + ss.normalized, 0) / subjectScores.length
        : null;

      return {
        evaluationTitle: evalData?.title ?? evalTitle,
        evaluationDate: evalData?.date ?? "",
        subjectScores,
        overallAverage: avg != null ? Math.round(avg * 100) / 100 : null,
      };
    },
  });

  if (previewStudent && reportData) {
    return (
      <ReportCard
        student={previewStudent}
        className={clsName}
        evaluationTitle={reportData.evaluationTitle}
        evaluationDate={reportData.evaluationDate}
        evaluationId={evalId}
        subjectScores={reportData.subjectScores}
        overallAverage={reportData.overallAverage}
        onBack={() => setPreviewStudent(null)}
      />
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className="h-5 w-5 text-accent" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">Bulletins — {evalTitle}</h1>
            <p className="text-sm text-muted-foreground">{clsName} • {students.length} élèves</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucun élève inscrit dans cette classe.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <Card key={s.id} className="rounded-xl shadow-sm hover:shadow-md transition-all">
                <CardContent className="py-3 px-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {s.prenom?.[0]}{s.nom?.[0]}
                    </div>
                    <p className="font-medium text-foreground truncate">
                      {s.prenom} {s.nom}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewStudent({ id: s.id, nom: s.nom, prenom: s.prenom })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Aperçu
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
