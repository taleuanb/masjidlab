
-- Drop the recursive policy
DROP POLICY IF EXISTS "SuperAdmin_All_Roles" ON public.user_roles;

-- Recreate using has_role() which is SECURITY DEFINER (bypasses RLS)
CREATE POLICY "SuperAdmin_All_Roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));
