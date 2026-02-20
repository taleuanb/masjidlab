
CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_org_id uuid, p_role text)
RETURNS TABLE(module text, can_view boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(o.module, g.module) AS module,
    COALESCE(o.can_view, g.can_view, false) AS can_view
  FROM
    (SELECT rp.module, rp.can_view FROM role_permissions rp WHERE rp.org_id IS NULL AND rp.role::text = p_role) AS g
  FULL OUTER JOIN
    (SELECT rp.module, rp.can_view FROM role_permissions rp WHERE rp.org_id = p_org_id AND rp.role::text = p_role) AS o
  ON g.module = o.module;
$$;
