
-- Drop the recursive policy
DROP POLICY IF EXISTS "Allow users to see members of their org" ON public.profiles;

-- Recreate it using auth.uid() directly joined with a security definer function
-- to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Recreate policy using the function instead of a subquery on profiles
CREATE POLICY "Allow users to see members of their org"
ON public.profiles
FOR SELECT
USING (org_id = public.get_my_org_id());
