
-- Fix search_path on existing functions missing it
ALTER FUNCTION public.get_all_orgs_with_stats() SET search_path = 'public';
ALTER FUNCTION public.get_effective_permissions(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
