import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useClassSubjects, useClassStudents } from "@/hooks/useEvaluationData";
import { ClipboardCheck, Plus, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateEvalDialog } from "./CreateEvalDialog";

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
  const { data: subjects = [], isLoading: loadingSubjects } = useClassSubjects(classId);

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
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-[#1A2333] hover:bg-[#1A2333]/90">
            <Plus className="h-4 w-4" /> Nouvel examen
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
            {evaluations.map((ev) => (
              <Card key={ev.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelectEval(ev.id)}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(ev.date), "d MMM yyyy", { locale: fr })}
                      {ev.subject?.name && ` • ${ev.subject.name}`}
                    </p>
                  </div>
                  <Badge variant="outline">/{ev.total_points ?? ev.max_points ?? 20}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateEvalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        classId={classId}
        className={clsName}
        subjects={subjects}
        loadingSubjects={loadingSubjects}
      />
    </main>
  );
}
