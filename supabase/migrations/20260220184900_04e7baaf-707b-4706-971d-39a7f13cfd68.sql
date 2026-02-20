
-- First check actual columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'role_permissions' AND table_schema = 'public';
