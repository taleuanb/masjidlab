
-- Function to clone global default permissions (org_id IS NULL) for a new organization
CREATE OR REPLACE FUNCTION public.clone_default_permissions(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.role_permissions (org_id, role, module, parent_key, enabled, can_view, can_edit, can_delete)
  SELECT
    p_org_id,
    rp.role,
    rp.module,
    rp.parent_key,
    rp.enabled,
    rp.can_view,
    rp.can_edit,
    rp.can_delete
  FROM public.role_permissions rp
  WHERE rp.org_id IS NULL
  ON CONFLICT DO NOTHING;
END;
$$;
