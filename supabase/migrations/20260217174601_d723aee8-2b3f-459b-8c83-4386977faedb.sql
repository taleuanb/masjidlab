-- Allow admins to update any replacement request (for approval/rejection)
CREATE POLICY "Admins can update replacement requests"
ON public.replacement_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any event (for reassigning to replacement)
CREATE POLICY "Admins can update events"
ON public.events
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));