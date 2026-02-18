-- Table rooms (espaces/salles du complexe)
CREATE TABLE public.rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor       text NOT NULL CHECK (floor IN ('RDC','1','2','3','4','EXT')),
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'Classe',
  capacity    integer NOT NULL DEFAULT 0,
  features    text[] NOT NULL DEFAULT '{}',
  statut      text NOT NULL DEFAULT 'disponible',
  pole        text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view rooms"  ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Admins can manage rooms"  ON public.rooms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table skills_library (dictionnaire de compétences)
CREATE TABLE public.skills_library (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.skills_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view skills"  ON public.skills_library FOR SELECT USING (true);
CREATE POLICY "Admins can manage skills" ON public.skills_library FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed rooms from mock data
INSERT INTO public.rooms (floor, name, type, capacity, statut, pole, features) VALUES
  ('RDC','Salle de Prière Principale','Prière Homme',500,'occupée','Imam', ARRAY['micro','sono','clim']),
  ('RDC','Salle de Prière Femmes','Prière Femme',200,'disponible',NULL, ARRAY['clim','micro']),
  ('RDC','Parking Souterrain','Parking',50,'disponible','Parking', ARRAY[]::text[]),
  ('1','Bureau Administratif','Bureau',10,'occupée','Digital', ARRAY['wifi','clim']),
  ('1','Classe Coran 1','Classe',30,'réservée','École (Avenir)', ARRAY['wifi','vidéoprojecteur']),
  ('1','Classe Coran 2','Classe',30,'disponible','École (Avenir)', ARRAY['wifi']),
  ('2','Cuisine Centrale','Cuisine',15,'disponible','Social (ABD)', ARRAY[]::text[]),
  ('2','Salle Polyvalente','Classe',80,'réservée','Accueil', ARRAY['wifi','micro','sono','vidéoprojecteur','clim']),
  ('3','Bureau Com & Digital','Bureau',8,'disponible','Com', ARRAY['wifi','clim']),
  ('3','Salle de Réunion','Bureau',20,'disponible',NULL, ARRAY['wifi','vidéoprojecteur','clim']),
  ('4','Salle de Classe 3','Classe',25,'maintenance',NULL, ARRAY[]::text[]),
  ('4','Terrasse Événement','Classe',100,'disponible','Récolte', ARRAY['sono','micro']);

-- Seed skills
INSERT INTO public.skills_library (label) VALUES
  ('Enseignement'),('Logistique'),('Accueil'),('Sono / Micro'),('Vidéo / Photo'),
  ('Traduction'),('Médical (secourisme)'),('Cuisine'),('Communication'),('Informatique'),
  ('Conduite'),('Récolte / Collecte');
