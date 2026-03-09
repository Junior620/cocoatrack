-- ============================================================================
-- CocoaTrack V2 - Make cooperative_id optional for planteur imports
-- Allows importing planteurs without a cooperative and assigning it manually later
-- ============================================================================

-- ============================================================================
-- 1. Make cooperative_id nullable
-- ============================================================================
ALTER TABLE public.planteur_import_files 
  ALTER COLUMN cooperative_id DROP NOT NULL;

-- Update comment to reflect optional cooperative
COMMENT ON COLUMN public.planteur_import_files.cooperative_id IS 'Cooperative ID (optional - can be assigned manually after import)';

-- ============================================================================
-- 2. Update RLS Policies to handle NULL cooperative_id
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "planteur_imports_select" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_insert" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_update" ON public.planteur_import_files;
DROP POLICY IF EXISTS "planteur_imports_delete" ON public.planteur_import_files;

-- Policy: Users can view imports from their cooperative OR imports without cooperative
CREATE POLICY "planteur_imports_select" 
  ON public.planteur_import_files 
  FOR SELECT
  USING (
    -- User's own imports
    created_by = auth.uid()
    OR
    -- Imports from user's cooperative
    (
      cooperative_id IS NOT NULL
      AND cooperative_id IN (
        SELECT cooperative_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can create imports (with or without cooperative)
CREATE POLICY "planteur_imports_insert" 
  ON public.planteur_import_files 
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      -- No cooperative (will be assigned later)
      cooperative_id IS NULL
      OR
      -- User's cooperative
      cooperative_id IN (
        SELECT cooperative_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can update their own imports OR imports from their cooperative
CREATE POLICY "planteur_imports_update" 
  ON public.planteur_import_files 
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    (
      cooperative_id IS NOT NULL
      AND cooperative_id IN (
        SELECT cooperative_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can delete their own imports
CREATE POLICY "planteur_imports_delete" 
  ON public.planteur_import_files 
  FOR DELETE
  USING (
    created_by = auth.uid()
  );

-- ============================================================================
-- 3. Update index to handle NULL cooperative_id
-- ============================================================================

-- Drop old index
DROP INDEX IF EXISTS idx_planteur_imports_cooperative;

-- Create new partial index (only for non-NULL cooperative_id)
CREATE INDEX IF NOT EXISTS idx_planteur_imports_cooperative
  ON public.planteur_import_files(cooperative_id, created_at DESC)
  WHERE cooperative_id IS NOT NULL;

-- Create index for unassigned imports
CREATE INDEX IF NOT EXISTS idx_planteur_imports_unassigned
  ON public.planteur_import_files(created_at DESC)
  WHERE cooperative_id IS NULL;

