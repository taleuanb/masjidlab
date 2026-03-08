
-- 1. Drop global unique constraint on nom (if exists)
ALTER TABLE public.poles DROP CONSTRAINT IF EXISTS poles_nom_key;

-- 2. Add composite unique constraint (nom, org_id)
ALTER TABLE public.poles ADD CONSTRAINT poles_nom_org_unique UNIQUE (nom, org_id);

-- 3. Add core_type column
ALTER TABLE public.poles ADD COLUMN IF NOT EXISTS core_type text;

-- 4. Backfill core_type from existing nom values
UPDATE public.poles SET core_type = CASE
  WHEN lower(nom) LIKE '%educ%' OR lower(nom) LIKE '%école%' OR lower(nom) LIKE '%madrasa%' OR lower(nom) LIKE '%avenir%' THEN 'education'
  WHEN lower(nom) LIKE '%financ%' OR lower(nom) LIKE '%récolte%' OR lower(nom) LIKE '%recolte%' OR lower(nom) LIKE '%trésor%' THEN 'finance'
  WHEN lower(nom) LIKE '%social%' OR lower(nom) LIKE '%abd%' OR lower(nom) LIKE '%solidar%' THEN 'social'
  WHEN lower(nom) LIKE '%com%' OR lower(nom) LIKE '%digital%' OR lower(nom) LIKE '%newsletter%' THEN 'comms'
  WHEN lower(nom) LIKE '%logist%' OR lower(nom) LIKE '%opérat%' OR lower(nom) LIKE '%parking%' OR lower(nom) LIKE '%mainten%' THEN 'operations'
  WHEN lower(nom) LIKE '%person%' OR lower(nom) LIKE '%rh%' OR lower(nom) LIKE '%staff%' THEN 'gestion-rh'
  WHEN lower(nom) LIKE '%imam%' OR lower(nom) LIKE '%accueil%' THEN 'admin'
  ELSE lower(regexp_replace(nom, '[^a-zA-Z0-9]', '-', 'g'))
END
WHERE core_type IS NULL;
