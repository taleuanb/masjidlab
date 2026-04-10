
-- Add missing columns to madrasa_subject_criteria
ALTER TABLE public.madrasa_subject_criteria
  ADD COLUMN IF NOT EXISTS default_weight numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE public.madrasa_subject_criteria ENABLE ROW LEVEL SECURITY;

-- Multi-tenant policy
CREATE POLICY "Multi-tenant access"
ON public.madrasa_subject_criteria
FOR ALL
USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid()));
