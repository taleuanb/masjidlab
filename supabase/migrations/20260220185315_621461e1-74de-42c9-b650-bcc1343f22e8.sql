DROP FUNCTION IF EXISTS public.get_effective_permissions(uuid, text);

CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_org_id uuid, p_role text)
 RETURNS TABLE(module text, can_view boolean, enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(o.module, g.module) AS module,
    COALESCE(o.can_view, g.can_view, false) AS can_view,
    COALESCE(o.enabled, g.enabled, false) AS enabled
  FROM
    (SELECT rp.module, rp.can_view, rp.enabled FROM role_permissions rp WHERE rp.org_id IS NULL AND rp.role::text = p_role) AS g
  FULL OUTER JOIN
    (SELECT rp.module, rp.can_view, rp.enabled FROM role_permissions rp WHERE rp.org_id = p_org_id AND rp.role::text = p_role) AS o
  ON g.module = o.module;
$function$;

NOTIFY pgrst, 'reload schema';