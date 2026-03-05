
-- Add chosen_plan column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'chosen_plan'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN chosen_plan text DEFAULT 'starter';
  END IF;
END $$;

-- Add address, phone, email, logo_url columns for identity tab
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='address') THEN
    ALTER TABLE public.organizations ADD COLUMN address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='phone') THEN
    ALTER TABLE public.organizations ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='contact_email') THEN
    ALTER TABLE public.organizations ADD COLUMN contact_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='logo_url') THEN
    ALTER TABLE public.organizations ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='city') THEN
    ALTER TABLE public.organizations ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='postal_code') THEN
    ALTER TABLE public.organizations ADD COLUMN postal_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='siret') THEN
    ALTER TABLE public.organizations ADD COLUMN siret text;
  END IF;
END $$;

-- RLS: allow authenticated users to insert their own org (for onboarding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Authenticated can create org'
  ) THEN
    CREATE POLICY "Authenticated can create org"
    ON public.organizations FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Members can view their org'
  ) THEN
    CREATE POLICY "Members can view their org"
    ON public.organizations FOR SELECT TO authenticated
    USING (id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Super admin can view all orgs'
  ) THEN
    CREATE POLICY "Super admin can view all orgs"
    ON public.organizations FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Super admin can update all orgs'
  ) THEN
    CREATE POLICY "Super admin can update all orgs"
    ON public.organizations FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Admin can update own org'
  ) THEN
    CREATE POLICY "Admin can update own org"
    ON public.organizations FOR UPDATE TO authenticated
    USING (id IN (SELECT org_id FROM public.profiles WHERE user_id = auth.uid()) AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Enable RLS on organizations if not already
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
