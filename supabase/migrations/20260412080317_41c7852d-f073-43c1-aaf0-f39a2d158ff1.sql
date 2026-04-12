-- Add unique constraint on (evaluation_id, student_id) for upsert support
ALTER TABLE public.madrasa_evaluation_results
ADD CONSTRAINT uq_eval_results_eval_student UNIQUE (evaluation_id, student_id);