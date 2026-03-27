
-- Drop the old admin-only policy
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;

-- Create a new policy allowing admin AND responsable to manage rooms within their org
CREATE POLICY "Org admins can manage rooms"
ON public.rooms
FOR ALL
TO authenticated
USING (
  org_id = get_my_org_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'responsable'::app_role)
  )
)
WITH CHECK (
  org_id = get_my_org_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'responsable'::app_role)
  )
);
