-- The organizations table already has a 'status' column (text, default 'active').
-- We need to ensure it supports 'pending', 'active', 'suspended' values.
-- Update existing default from 'active' to 'pending' for new orgs.
ALTER TABLE public.organizations ALTER COLUMN status SET DEFAULT 'pending';