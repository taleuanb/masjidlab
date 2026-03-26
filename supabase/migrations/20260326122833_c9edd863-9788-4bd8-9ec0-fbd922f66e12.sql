ALTER TABLE public.madrasa_sessions 
  ADD COLUMN IF NOT EXISTS summary_note text,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;