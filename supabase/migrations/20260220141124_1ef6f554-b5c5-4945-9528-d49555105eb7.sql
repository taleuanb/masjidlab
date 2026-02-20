-- Add tags column to profiles for member categorization (Fidèle, Donateur, Parent, Élève)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];