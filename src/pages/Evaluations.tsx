import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEvalClasses } from "@/hooks/useEvaluationData";
import { EvalClassesView } from "@/components/evaluations/EvalClassesView";
import { EvalListView } from "@/components/evaluations/EvalListView";
import { GradingGrid } from "@/components/evaluations/GradingGrid";

const Evaluations = () => {
  const { orgId } = useOrganization();
  const { data: classes = [], isLoading: loadingClasses } = useEvalClasses();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Fetch selected evaluation details
  const { data: selectedEval } = useQuery({
    queryKey: ["evaluation_detail", selectedEvalId],
    enabled: !!selectedEvalId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_evaluations")
        .select("id, title, date, max_points, total_points")
        .eq("id", selectedEvalId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Grade entry view
  if (selectedEvalId && selectedEval && selectedClassId && selectedClass) {
    return (
      <GradingGrid
        evaluation={selectedEval}
        classId={selectedClassId}
        className={selectedClass.nom}
        onBack={() => setSelectedEvalId(null)}
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
        onSelectEval={setSelectedEvalId}
      />
    );
  }

  // Class selection
  return (
    <EvalClassesView
      classes={classes}
      loading={loadingClasses}
      onSelectClass={setSelectedClassId}
    />
  );
};

export default Evaluations;
