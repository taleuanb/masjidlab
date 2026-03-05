
ALTER TABLE public.madrasa_class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant class subjects access"
ON public.madrasa_class_subjects FOR ALL TO authenticated
USING (
  class_id IN (
    SELECT id FROM public.madrasa_classes
    WHERE org_id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid())
  )
);
