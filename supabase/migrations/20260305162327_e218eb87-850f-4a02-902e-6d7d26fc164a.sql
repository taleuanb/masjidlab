-- Create invitations table for staff onboarding
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'benevole',
  org_name TEXT,
  invited_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Public can read pending invitations (needed for /join/:id page)
CREATE POLICY "Anyone can view pending invitations"
  ON public.invitations FOR SELECT
  USING (status = 'pending');

-- Admin/Responsable can create invitations for their org
CREATE POLICY "Admin or Responsable can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'responsable'))
  );

-- Admin can update/delete invitations for their org
CREATE POLICY "Admin can manage org invitations"
  ON public.invitations FOR UPDATE
  USING (
    org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can delete org invitations"
  ON public.invitations FOR DELETE
  USING (
    org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

-- Super admin full access
CREATE POLICY "Super admin full access invitations"
  ON public.invitations FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));