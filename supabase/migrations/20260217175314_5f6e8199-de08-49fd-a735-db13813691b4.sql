-- 1. Create poles table
CREATE TABLE public.poles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  description text,
  responsable_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view poles" ON public.poles FOR SELECT USING (true);
CREATE POLICY "Admins can manage poles" ON public.poles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type text NOT NULL CHECK (type IN ('Lieu', 'Matériel')),
  pole_id uuid REFERENCES public.poles(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'Disponible' CHECK (statut IN ('Disponible', 'Réservé', 'Maintenance')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Admins can manage assets" ON public.assets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add pole_id to profiles
ALTER TABLE public.profiles ADD COLUMN pole_id uuid REFERENCES public.poles(id) ON DELETE SET NULL;

-- 4. Seed test data
INSERT INTO public.poles (id, nom, description) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Imamat', 'Gestion des prières, conférences et enseignements religieux'),
  ('b2222222-2222-2222-2222-222222222222', 'École', 'Cours de Coran, arabe et activités éducatives'),
  ('c3333333-3333-3333-3333-333333333333', 'Logistique', 'Gestion du matériel, salles et infrastructure');

INSERT INTO public.assets (nom, type, pole_id, statut, description) VALUES
  ('Salle de Prière Principale', 'Lieu', 'a1111111-1111-1111-1111-111111111111', 'Disponible', 'Capacité 500 personnes — RDC'),
  ('Vidéoprojecteur Epson', 'Matériel', 'b2222222-2222-2222-2222-222222222222', 'Disponible', 'Vidéoprojecteur HD pour les classes'),
  ('Sono portable JBL', 'Matériel', 'c3333333-3333-3333-3333-333333333333', 'Réservé', 'Sono portable pour événements extérieurs');