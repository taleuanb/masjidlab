import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useClassStudents } from "@/hooks/useEvaluationData";
import { ClipboardCheck, Plus, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateEvalWizard } from "./CreateEvalWizard";

interface Evaluation {
  id: string;
  title: string;
  date: string;
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
}

export function EvalListView({ classId, className: clsName, onBack, onSelectEval }: Props) {
  const { orgId } = useOrganization();
  const [dialogOpen, setDialogOpen] = useState(false);

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

  // Count subjects per evaluation
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ClipboardCheck className="h-5 w-5 text-accent" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">{clsName}</h1>
            <p className="text-sm text-muted-foreground">Évaluations • {students.length} élèves inscrits</p>
          </div>
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

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucune évaluation créée pour cette classe.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.map((ev) => {
              const subjectNames = evalSubjectCounts[ev.id] ?? [];
              return (
                <Card key={ev.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelectEval(ev.id)}>
                  <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ev.date), "d MMM yyyy", { locale: fr })}
                        {subjectNames.length > 0 && ` • ${subjectNames.join(", ")}`}
                        {subjectNames.length === 0 && ev.subject?.name && ` • ${ev.subject.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {subjectNames.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {subjectNames.length} matière{subjectNames.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      <Badge variant="outline">/{ev.total_points ?? ev.max_points ?? 20}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
    </main>
  );
}
