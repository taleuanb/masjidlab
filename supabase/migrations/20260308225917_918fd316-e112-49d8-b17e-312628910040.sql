
-- Table de configuration des widgets du dashboard (gérée par le Super Admin)
CREATE TABLE IF NOT EXISTS public.saas_widget_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key text NOT NULL UNIQUE,
  label text NOT NULL,
  required_plans text[] NOT NULL DEFAULT '{starter,pro,elite}',
  allowed_roles text[] NOT NULL DEFAULT '{}',
  required_pole text,
  priority integer NOT NULL DEFAULT 500,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.saas_widget_configs ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (nécessaire pour le dashboard)
CREATE POLICY "Anyone can read widget configs"
  ON public.saas_widget_configs
  FOR SELECT
  USING (true);

-- Seul le super_admin peut modifier
CREATE POLICY "Super admin can manage widget configs"
  ON public.saas_widget_configs
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed avec les widgets existants du registre
INSERT INTO public.saas_widget_configs (widget_key, label, required_plans, allowed_roles, required_pole, priority, is_enabled) VALUES
  ('org-kpis',          'KPIs Organisation',       '{starter,pro,elite}', '{super_admin,admin,responsable}',                    NULL,        1000, true),
  ('edu-assiduité',     'Assiduité (Madrassa)',     '{starter,pro,elite}', '{super_admin,admin,responsable,enseignant}',         'education', 900,  true),
  ('edu-effectifs',     'Effectifs Élèves',         '{starter,pro,elite}', '{super_admin,admin,responsable,enseignant}',         'education', 890,  true),
  ('edu-inscriptions',  'Inscriptions',             '{starter,pro,elite}', '{super_admin,admin,responsable,enseignant}',         'education', 880,  true),
  ('edu-alertes',       'Alertes Présence',         '{starter,pro,elite}', '{super_admin,admin,responsable,enseignant}',         'education', 870,  true),
  ('edu-finance',       'Finance École',            '{starter,pro,elite}', '{super_admin,admin,responsable}',                    'education', 860,  true),
  ('rooms-occupancy',   'Occupation des Salles',    '{pro,elite}',         '{super_admin,admin,responsable}',                    'logistics', 700,  true),
  ('events-timeline',   'Timeline Événements',      '{pro,elite}',         '{super_admin,admin,responsable,enseignant}',         'logistics', 690,  true),
  ('finance-overview',  'Vue Finance',              '{pro,elite}',         '{super_admin,admin,responsable}',                    'finance',   500,  true),
  ('assets-inventory',  'Inventaire Actifs',        '{pro,elite}',         '{super_admin,admin,responsable}',                    'logistics', 490,  true)
ON CONFLICT (widget_key) DO NOTHING;
