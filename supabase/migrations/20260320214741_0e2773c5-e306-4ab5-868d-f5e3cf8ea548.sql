
CREATE TABLE public.madrasa_student_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.madrasa_students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.madrasa_subjects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  target_value numeric NOT NULL DEFAULT 0,
  current_position numeric NOT NULL DEFAULT 0,
  unit_label text NOT NULL DEFAULT 'Versets',
  academic_year text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, subject_id, academic_year)
);

ALTER TABLE public.madrasa_student_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_student_goals
  FOR ALL USING (
    org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

CREATE TRIGGER update_student_goals_updated_at
  BEFORE UPDATE ON public.madrasa_student_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
