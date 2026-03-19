
-- 1. Table des configurations de formulaire par matière
CREATE TABLE public.madrasa_session_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.madrasa_subjects(id) ON DELETE CASCADE,
  form_schema_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, org_id)
);

ALTER TABLE public.madrasa_session_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_session_configs
  FOR ALL USING (
    org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- 2. Table des comptes rendus de séance par élève
CREATE TABLE public.madrasa_student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.madrasa_students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.madrasa_classes(id) ON DELETE CASCADE,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  config_id uuid NOT NULL REFERENCES public.madrasa_session_configs(id) ON DELETE CASCADE,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.madrasa_student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_student_progress
  FOR ALL USING (
    org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- Index pour les requêtes courantes
CREATE INDEX idx_progress_student_date ON public.madrasa_student_progress(student_id, lesson_date);
CREATE INDEX idx_progress_class_date ON public.madrasa_student_progress(class_id, lesson_date);
CREATE INDEX idx_session_configs_subject ON public.madrasa_session_configs(subject_id, org_id);
