
ALTER TABLE public.madrasa_cycles
  ADD COLUMN IF NOT EXISTS gender_restriction text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS age_min integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS age_max integer DEFAULT NULL;

COMMENT ON COLUMN public.madrasa_cycles.gender_restriction IS 'M = garçons uniquement, F = filles uniquement, NULL = mixte';
COMMENT ON COLUMN public.madrasa_cycles.age_min IS 'Âge minimum autorisé dans ce cycle';
COMMENT ON COLUMN public.madrasa_cycles.age_max IS 'Âge maximum autorisé dans ce cycle';
