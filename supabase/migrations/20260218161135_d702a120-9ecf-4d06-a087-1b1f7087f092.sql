-- Add phone and has_account columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS has_account boolean NOT NULL DEFAULT false;

-- Members added via invitation who already set a password should be marked as having an account.
-- We set has_account = true for existing profiles that have an email (they were invited via Supabase Auth)
UPDATE public.profiles SET has_account = true WHERE email IS NOT NULL AND email != '';
