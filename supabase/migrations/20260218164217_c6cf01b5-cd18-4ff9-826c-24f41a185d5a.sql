-- Add manager_id and target_staff columns to poles table
ALTER TABLE public.poles
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_staff integer NOT NULL DEFAULT 0;
