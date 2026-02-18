-- Add is_active column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Update RLS: inactive users should still be readable by admins but can't update themselves if inactive
-- The ban mechanism is handled via Supabase Auth, is_active is for display purposes