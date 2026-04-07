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
      // Fetch classes
      const { data: classes, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      const list = classes ?? [];
      const classIds = list.map((c) => c.id);
      if (classIds.length === 0) return [] as ClassWithEvalStats[];

      // Subjects
      const { data: links } = await supabase
        .from("madrasa_class_subjects")
        .select("class_id, subject:madrasa_subjects(id, name)")
        .in("class_id", classIds);

      const subjectMap: Record<string, { id: string; name: string }[]> = {};
      for (const link of links ?? []) {
        if (!subjectMap[link.class_id]) subjectMap[link.class_id] = [];
        if (link.subject) subjectMap[link.class_id].push(link.subject as any);
      }

      // Eval count per class
      const { data: evals } = await supabase
        .from("madrasa_evaluations")
        .select("id, class_id")
        .eq("org_id", orgId!)
        .in("class_id", classIds);

      const evalCountMap: Record<string, number> = {};
      for (const ev of evals ?? []) {
        evalCountMap[ev.class_id] = (evalCountMap[ev.class_id] || 0) + 1;
      }

      // Grades for averages
      const evalIds = (evals ?? []).map((e) => e.id);
      let avgMap: Record<string, number | null> = {};
      if (evalIds.length > 0) {
        const { data: grades } = await supabase
          .from("madrasa_grades")
          .select("score, evaluation_id")
          .eq("org_id", orgId!)
          .in("evaluation_id", evalIds);

        // Map eval_id -> class_id
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

      // Student counts
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

export function useEvalCriteria(evaluationId: string | null) {
  return useQuery({
    queryKey: ["eval_criteria", evaluationId],
    enabled: !!evaluationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_evaluation_criteria")
        .select("id, label, max_score, weight")
        .eq("evaluation_id", evaluationId!);
      if (error) throw error;
      return (data ?? []) as { id: string; label: string; max_score: number; weight: number | null }[];
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
