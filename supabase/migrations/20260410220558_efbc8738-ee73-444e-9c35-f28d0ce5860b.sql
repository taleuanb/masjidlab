CREATE UNIQUE INDEX IF NOT EXISTS uq_grades_student_criteria_eval 
ON public.madrasa_grades (student_id, criteria_id, evaluation_id);