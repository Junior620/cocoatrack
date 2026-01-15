-- Migration: Make cooperative_id optional in parcel_import_files
-- This allows users without a cooperative to import parcelles

-- Step 1: Drop the existing unique constraint that requires cooperative_id
DROP INDEX IF EXISTS public.uniq_import_file_sha256;

-- Step 2: Make cooperative_id nullable
ALTER TABLE public.parcel_import_files 
  ALTER COLUMN cooperative_id DROP NOT NULL;

-- Step 3: Create a new unique constraint that handles null cooperative_id
-- For users with cooperative: unique per (cooperative_id, file_sha256)
-- For users without cooperative: unique per (created_by, file_sha256) where cooperative_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uniq_import_file_sha256_with_coop 
  ON public.parcel_import_files (cooperative_id, file_sha256)
  WHERE cooperative_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_import_file_sha256_without_coop 
  ON public.parcel_import_files (created_by, file_sha256)
  WHERE cooperative_id IS NULL;

-- Step 4: Update the trigger to allow null cooperative_id
CREATE OR REPLACE FUNCTION check_import_file_cooperative()
RETURNS TRIGGER AS $$
BEGIN
  -- If planteur_id is provided and cooperative_id is provided, verify planteur belongs to cooperative
  IF NEW.planteur_id IS NOT NULL AND NEW.cooperative_id IS NOT NULL THEN
    PERFORM 1 FROM public.planteurs 
    WHERE id = NEW.planteur_id 
    AND cooperative = (SELECT name FROM public.cooperatives WHERE id = NEW.cooperative_id);
    
    IF NOT FOUND THEN
      -- Allow if planteur has no cooperative set
      PERFORM 1 FROM public.planteurs WHERE id = NEW.planteur_id AND cooperative IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'planteur_id does not belong to cooperative_id';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update RLS policies to allow users without cooperative to manage their imports
DROP POLICY IF EXISTS "Users can view imports from their cooperative" ON public.parcel_import_files;
DROP POLICY IF EXISTS "Users can create imports for their cooperative" ON public.parcel_import_files;
DROP POLICY IF EXISTS "Users can update imports from their cooperative" ON public.parcel_import_files;

-- View: Users can see imports from their cooperative OR their own imports (if no cooperative)
CREATE POLICY "Users can view imports"
  ON public.parcel_import_files FOR SELECT
  USING (
    cooperative_id IN (
      SELECT cooperative_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (cooperative_id IS NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert: Users can create imports for their cooperative OR without cooperative
CREATE POLICY "Users can create imports"
  ON public.parcel_import_files FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      cooperative_id IS NULL
      OR cooperative_id IN (
        SELECT cooperative_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Update: Users can update imports from their cooperative OR their own imports
CREATE POLICY "Users can update imports"
  ON public.parcel_import_files FOR UPDATE
  USING (
    cooperative_id IN (
      SELECT cooperative_id FROM public.profiles WHERE id = auth.uid()
    )
    OR (cooperative_id IS NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
