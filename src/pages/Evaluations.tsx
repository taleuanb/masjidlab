import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEvalClasses } from "@/hooks/useEvaluationData";
import { EvalClassesView } from "@/components/evaluations/EvalClassesView";
import { EvalListView } from "@/components/evaluations/EvalListView";
import { GradingGrid } from "@/components/evaluations/GradingGrid";
import { ReportCardPreviewList } from "@/components/evaluations/ReportCardPreviewList";

type ViewMode = "grading" | "bulletins";

const Evaluations = () => {
  const { orgId } = useOrganization();
  const { data: classes = [], isLoading: loadingClasses } = useEvalClasses();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grading");

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const { data: selectedEval } = useQuery({
    queryKey: ["evaluation_detail", selectedEvalId],
    enabled: !!selectedEvalId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_evaluations")
        .select("id, title, date, status")
        .eq("id", selectedEvalId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Report card preview list
  if (selectedEvalId && selectedEval && selectedClassId && selectedClass && viewMode === "bulletins") {
    return (
      <ReportCardPreviewList
        evalId={selectedEvalId}
        evalTitle={selectedEval.title}
        classId={selectedClassId}
        className={selectedClass.nom}
        onBack={() => { setSelectedEvalId(null); setViewMode("grading"); }}
      />
    );
  }

  // Grade entry view
  if (selectedEvalId && selectedEval && selectedClassId && selectedClass) {
    return (
      <GradingGrid
        evaluation={selectedEval}
        classId={selectedClassId}
        className={selectedClass.nom}
        onBack={() => setSelectedEvalId(null)}
        readOnly={selectedEval.status === "archived"}
      />
    );
  }

  // Evaluations list per class
  if (selectedClassId && selectedClass) {
    return (
      <EvalListView
        classId={selectedClassId}
        className={selectedClass.nom}
        onBack={() => setSelectedClassId(null)}
        onSelectEval={(evalId) => { setSelectedEvalId(evalId); setViewMode("grading"); }}
        onSelectBulletins={(evalId) => { setSelectedEvalId(evalId); setViewMode("bulletins"); }}
      />
    );
  }

  return (
    <EvalClassesView
      classes={classes}
      loading={loadingClasses}
      onSelectClass={setSelectedClassId}
    />
  );
};

export default Evaluations;
