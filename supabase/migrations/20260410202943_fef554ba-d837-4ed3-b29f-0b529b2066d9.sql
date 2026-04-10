
-- Drop broken policies
DROP POLICY IF EXISTS "Strict org access for eval subjects" ON madrasa_evaluation_subjects;
DROP POLICY IF EXISTS "Strict org access for eval criteria" ON madrasa_evaluation_criteria;
DROP POLICY IF EXISTS "Manage grades based on org" ON madrasa_grades;
DROP POLICY IF EXISTS "Strict org access for evaluations" ON madrasa_evaluations;

-- Fix: madrasa_evaluation_subjects
CREATE POLICY "Multi-tenant eval subjects access"
ON madrasa_evaluation_subjects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM madrasa_evaluations e
    WHERE e.id = madrasa_evaluation_subjects.evaluation_id
      AND e.org_id = get_my_org_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM madrasa_evaluations e
    WHERE e.id = madrasa_evaluation_subjects.evaluation_id
      AND e.org_id = get_my_org_id()
  )
);

-- Fix: madrasa_evaluation_criteria
CREATE POLICY "Multi-tenant eval criteria access"
ON madrasa_evaluation_criteria
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM madrasa_evaluation_subjects es
    JOIN madrasa_evaluations e ON es.evaluation_id = e.id
    WHERE es.id = madrasa_evaluation_criteria.evaluation_subject_id
      AND e.org_id = get_my_org_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM madrasa_evaluation_subjects es
    JOIN madrasa_evaluations e ON es.evaluation_id = e.id
    WHERE es.id = madrasa_evaluation_criteria.evaluation_subject_id
      AND e.org_id = get_my_org_id()
  )
);
