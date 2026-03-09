-- ============================================================================
-- SCRIPT À APPLIQUER DANS SUPABASE SQL EDITOR
-- Corrige les politiques RLS pour l'import de planteurs
-- ============================================================================

-- 1. Supprimer les anciennes politiques
DROP POLICY IF EXISTS "planteur_imports_select" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_insert" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_update" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_delete" ON public.planteur_import_files;

-- 2. Créer les nouvelles politiques simplifiées
-- Les utilisateurs peuvent voir leurs propres imports
CREATE POLICY "planteur_imports_select" 
  ON public.planteur_import_files 
  FOR SELECT
  USING (created_by = auth.uid());

-- Les utilisateurs peuvent créer des imports
CREATE POLICY "planteur_imports_insert" 
  ON public.planteur_import_files 
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Les utilisateurs peuvent modifier leurs propres imports
CREATE POLICY "planteur_imports_update" 
  ON public.planteur_import_files 
  FOR UPDATE
  USING (created_by = auth.uid());

-- Les utilisateurs peuvent supprimer leurs propres imports
CREATE POLICY "planteur_imports_delete" 
  ON public.planteur_import_files 
  FOR DELETE
  USING (created_by = auth.uid());

-- 3. S'assurer que RLS est activé
ALTER TABLE public.planteur_import_files ENABLE ROW LEVEL SECURITY;

-- 4. Accorder les permissions nécessaires
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planteur_import_files TO authenticated;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
-- Exécutez cette requête pour vérifier que les politiques sont bien créées :
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'planteur_import_files';
