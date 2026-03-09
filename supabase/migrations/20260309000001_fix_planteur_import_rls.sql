-- ============================================================================
-- CocoaTrack V2 - Fix RLS Policies for Planteur Imports
-- Allows users to access their own imports regardless of cooperative status
-- ============================================================================

-- ============================================================================
-- 1. Drop existing policies
-- ============================================================================
DROP POLICY IF EXISTS "planteur_imports_select" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_insert" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_update" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_delete" ON public.planteur_import_files;

-- ============================================================================
-- 2. Create new simplified policies
-- ============================================================================

-- Policy: Users can view their own imports OR imports from their cooperative
CREATE POLICY "planteur_imports_select" 
  ON public.planteur_import_files 
  FOR SELECT
  USING (
    -- User's own imports (regardless of cooperative)
    created_by = auth.uid()
  );

-- Policy: Users can create imports (with or without cooperative)
CREATE POLICY "planteur_imports_insert" 
  ON public.planteur_import_files 
  FOR INSERT
  WITH CHECK (
    -- User must be the creator
    created_by = auth.uid()
  );

-- Policy: Users can update their own imports
CREATE POLICY "planteur_imports_update" 
  ON public.planteur_import_files 
  FOR UPDATE
  USING (
    -- User's own imports
    created_by = auth.uid()
  );

-- Policy: Users can delete their own imports
CREATE POLICY "planteur_imports_delete" 
  ON public.planteur_import_files 
  FOR DELETE
  USING (
    -- User's own imports
    created_by = auth.uid()
  );

-- ============================================================================
-- 3. Ensure RLS is enabled
-- ============================================================================
ALTER TABLE public.planteur_import_files ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Grant necessary permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planteur_import_files TO authenticated;
