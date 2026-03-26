-- Delete obsolete flat-key entries where the dotted version already exists
-- This cleans up legacy keys without creating duplicates

DELETE FROM public.role_permissions WHERE module IN (
  'eleves', 'classes', 'inscriptions', 'sessions', 'evaluations', 'frais',
  'transactions', 'donateurs', 'recus',
  'planning', 'evenements', 'inventaire', 'parking', 'maintenance',
  'approbations', 'contrats', 'documents', 'structure'
);