-- Allow org owner to update their own organization (needed for SetupPlan to update chosen_plan)
CREATE POLICY "Owner can update own org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());