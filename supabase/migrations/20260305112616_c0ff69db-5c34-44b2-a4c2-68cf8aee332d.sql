
-- Security definer function for onboarding: creates org, links profile, assigns role
-- This bypasses RLS since new users can't manage their own roles
CREATE OR REPLACE FUNCTION public.handle_onboarding(
  p_name text,
  p_city text,
  p_postal_code text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_plan text DEFAULT 'starter'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Create the organization
  INSERT INTO public.organizations (name, city, postal_code, phone, siret, status, subscription_plan, chosen_plan, owner_id)
  VALUES (p_name, p_city, p_postal_code, p_phone, NULLIF(p_siret, ''), 'pending', p_plan, p_plan, v_user_id)
  RETURNING id INTO v_org_id;

  -- 2. Link user profile to org
  UPDATE public.profiles
  SET org_id = v_org_id
  WHERE user_id = v_user_id;

  -- 3. Remove existing non-super_admin roles for this user
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role != 'super_admin';

  -- 4. Assign responsable role
  INSERT INTO public.user_roles (user_id, role, org_id)
  VALUES (v_user_id, 'responsable', v_org_id);

  -- 5. Clone default permissions
  PERFORM public.clone_default_permissions(v_org_id);

  RETURN v_org_id;
END;
$$;
