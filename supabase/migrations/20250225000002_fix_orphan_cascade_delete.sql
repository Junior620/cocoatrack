-- CocoaTrack V2 - Fix Orphan Parcelles Cascade Delete
-- When deleting an import file, orphan parcelles should be deleted automatically
-- This prevents the constraint violation when trying to delete import files

-- ============================================================================
-- Update the foreign key constraint on import_file_id
-- Change from ON DELETE SET NULL to ON DELETE CASCADE for orphan parcelles
-- ============================================================================

-- First, we need to drop the existing foreign key constraint
ALTER TABLE public.parcelles
  DROP CONSTRAINT IF EXISTS parcelles_import_file_id_fkey;

-- Recreate the foreign key with CASCADE delete
-- This will automatically delete orphan parcelles when their import file is deleted
ALTER TABLE public.parcelles
  ADD CONSTRAINT parcelles_import_file_id_fkey
  FOREIGN KEY (import_file_id)
  REFERENCES public.parcel_import_files(id)
  ON DELETE CASCADE;

-- Note: This CASCADE only affects orphan parcelles (planteur_id IS NULL)
-- because the constraint parcelles_orphan_requires_import ensures that
-- orphan parcelles MUST have an import_file_id.
-- 
-- Assigned parcelles (planteur_id IS NOT NULL) can have import_file_id = NULL,
-- so they won't be affected by this cascade.
