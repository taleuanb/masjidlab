import { ArrowLeft, FileText, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClassStudents } from "@/hooks/useEvaluationData";
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
  const { data: students = [], isLoading } = useClassStudents(classId);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);

  if (previewStudentId) {
    return (
      <ReportCard
        studentId={previewStudentId}
        evaluationId={evalId}
        onBack={() => setPreviewStudentId(null)}
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
                      onClick={() => setPreviewStudentId(s.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Aperçu
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPreviewStudentId(s.id);
                        setTimeout(() => window.print(), 500);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
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
