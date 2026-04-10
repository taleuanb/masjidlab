import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface ClassWithEvalStats {
  id: string;
  nom: string;
  niveau: string | null;
  subjects: { id: string; name: string }[];
  evalCount: number;
  classAverage: number | null;
  studentCount: number;
}

export function useEvalClasses() {
  const { orgId } = useOrganization();

  return useQuery({
    queryKey: ["eval_classes_v2", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: classes, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      const list = classes ?? [];
      const classIds = list.map((c) => c.id);
      if (classIds.length === 0) return [] as ClassWithEvalStats[];

      const { data: links } = await supabase
        .from("madrasa_class_subjects")
        .select("class_id, subject:madrasa_subjects(id, name)")
        .in("class_id", classIds);

      const subjectMap: Record<string, { id: string; name: string }[]> = {};
      for (const link of links ?? []) {
        if (!subjectMap[link.class_id]) subjectMap[link.class_id] = [];
        if (link.subject) subjectMap[link.class_id].push(link.subject as any);
      }

      const { data: evals } = await supabase
        .from("madrasa_evaluations")
        .select("id, class_id")
        .eq("org_id", orgId!)
        .in("class_id", classIds);

      const evalCountMap: Record<string, number> = {};
      for (const ev of evals ?? []) {
        evalCountMap[ev.class_id] = (evalCountMap[ev.class_id] || 0) + 1;
      }

      const evalIds = (evals ?? []).map((e) => e.id);
      let avgMap: Record<string, number | null> = {};
      if (evalIds.length > 0) {
        const { data: grades } = await supabase
          .from("madrasa_grades")
          .select("score, evaluation_id")
          .eq("org_id", orgId!)
          .in("evaluation_id", evalIds);

        const evalToClass: Record<string, string> = {};
        for (const ev of evals ?? []) evalToClass[ev.id] = ev.class_id;

        const classScores: Record<string, number[]> = {};
        for (const g of grades ?? []) {
          if (g.score == null) continue;
          const cid = evalToClass[g.evaluation_id];
          if (!classScores[cid]) classScores[cid] = [];
          classScores[cid].push(Number(g.score));
        }
        for (const [cid, scores] of Object.entries(classScores)) {
          avgMap[cid] = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }

      const { data: enrollments } = await supabase
        .from("madrasa_enrollments")
        .select("class_id")
        .eq("org_id", orgId!)
        .eq("statut", "Actif")
        .in("class_id", classIds);

      const studentCountMap: Record<string, number> = {};
      for (const e of enrollments ?? []) {
        if (e.class_id) studentCountMap[e.class_id] = (studentCountMap[e.class_id] || 0) + 1;
      }

      return list.map((c) => ({
        ...c,
        subjects: subjectMap[c.id] ?? [],
        evalCount: evalCountMap[c.id] ?? 0,
        classAverage: avgMap[c.id] ?? null,
        studentCount: studentCountMap[c.id] ?? 0,
      })) as ClassWithEvalStats[];
    },
  });
}

export function useClassSubjects(classId: string | null) {
  const { orgId } = useOrganization();
  return useQuery({
    queryKey: ["class_subjects", classId],
    enabled: !!classId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_class_subjects")
        .select("subject_id, subject:madrasa_subjects(id, name)")
        .eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.subject).filter(Boolean) as { id: string; name: string }[];
    },
  });
}

export function useSubjectCriteria(subjectId: string | null) {
  const { orgId } = useOrganization();
  return useQuery({
    queryKey: ["subject_criteria", subjectId, orgId],
    enabled: !!subjectId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subject_criteria")
        .select("id, label, default_max_score")
        .eq("subject_id", subjectId!)
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []) as { id: string; label: string; default_max_score: number | null }[];
    },
  });
}

export interface EvalCriterionWithSubject {
  id: string;
  label: string;
  max_score: number;
  weight: number | null;
  subject_id: string;
  subject_name: string;
  evaluation_subject_id: string;
}

/**
 * Fetches criteria for an evaluation via evaluation_subjects → evaluation_criteria
 */
export function useEvalCriteria(evaluationId: string | null) {
  return useQuery({
    queryKey: ["eval_criteria_v2", evaluationId],
    enabled: !!evaluationId,
    queryFn: async () => {
      // First get evaluation_subjects
      const { data: evalSubjects, error: esErr } = await supabase
        .from("madrasa_evaluation_subjects")
        .select("id, subject_id, weight, subject:madrasa_subjects(name)")
        .eq("evaluation_id", evaluationId!);
      if (esErr) throw esErr;

      if (!evalSubjects || evalSubjects.length === 0) return [] as EvalCriterionWithSubject[];

      const esIds = evalSubjects.map((es) => es.id);
      const { data: criteria, error: crErr } = await supabase
        .from("madrasa_evaluation_criteria")
        .select("id, label, max_score, weight, evaluation_subject_id")
        .in("evaluation_subject_id", esIds);
      if (crErr) throw crErr;

      const esMap = new Map(evalSubjects.map((es) => [es.id, es]));

      return (criteria ?? []).map((c) => {
        const es = esMap.get(c.evaluation_subject_id!);
        return {
          id: c.id,
          label: c.label,
          max_score: Number(c.max_score),
          weight: c.weight ? Number(c.weight) : null,
          subject_id: es?.subject_id ?? "",
          subject_name: (es?.subject as any)?.name ?? "",
          evaluation_subject_id: c.evaluation_subject_id ?? "",
        } as EvalCriterionWithSubject;
      });
    },
  });
}

export function useClassStudents(classId: string | null) {
  const { orgId } = useOrganization();
  return useQuery({
    queryKey: ["eval_students", classId],
    enabled: !!classId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("student_id, student:madrasa_students(id, nom, prenom)")
        .eq("class_id", classId!)
        .eq("org_id", orgId!)
        .eq("statut", "Actif");
      if (error) throw error;
      return (data ?? []).map((e: any) => e.student).filter(Boolean) as { id: string; nom: string; prenom: string }[];
    },
  });
}

export function useEvalGrades(evaluationId: string | null) {
  const { orgId } = useOrganization();
  return useQuery({
    queryKey: ["grades", evaluationId],
    enabled: !!evaluationId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_grades")
        .select("*")
        .eq("evaluation_id", evaluationId!)
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEvalResults(evaluationId: string | null) {
  return useQuery({
    queryKey: ["eval_results", evaluationId],
    enabled: !!evaluationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_evaluation_results")
        .select("*")
        .eq("evaluation_id", evaluationId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}
