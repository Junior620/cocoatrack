-- ============================================================================
-- CocoaTrack V2 - Planteurs name_norm Migration
-- Adds normalized name column for duplicate detection and auto-create matching
-- Requirements: 2.4
-- ============================================================================

-- ============================================================================
-- 1. Enable unaccent extension for accent-insensitive matching
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- 2. Add new columns to planteurs table
-- ============================================================================

-- name_norm: Normalized name for matching (lower, trim, unaccent)
ALTER TABLE public.planteurs 
  ADD COLUMN IF NOT EXISTS name_norm TEXT;

-- auto_created: Flag to track planteurs created via import auto-create mode
ALTER TABLE public.planteurs 
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT false;

-- created_via_import_id: Reference to the import file that created this planteur
ALTER TABLE public.planteurs 
  ADD COLUMN IF NOT EXISTS created_via_import_id UUID REFERENCES public.parcel_import_files(id);

-- ============================================================================
-- 3. Create normalization function
-- Normalizes planteur names: lowercase, trim whitespace, remove accents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_planteur_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Handle NULL or empty input
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN '';
  END IF;
  
  -- Normalize: lowercase, trim, remove accents, collapse multiple spaces
  RETURN LOWER(TRIM(REGEXP_REPLACE(unaccent(name), '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 4. Create trigger function to maintain name_norm
-- Automatically updates name_norm when name changes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_planteur_name_norm()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name_norm := public.normalize_planteur_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Create trigger on planteurs table
-- ============================================================================
DROP TRIGGER IF EXISTS planteur_name_norm_trigger ON public.planteurs;
CREATE TRIGGER planteur_name_norm_trigger
  BEFORE INSERT OR UPDATE OF name ON public.planteurs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planteur_name_norm();

-- ============================================================================
-- 6. Backfill name_norm for existing planteurs
-- ============================================================================
UPDATE public.planteurs 
SET name_norm = public.normalize_planteur_name(name) 
WHERE name_norm IS NULL;

-- ============================================================================
-- 7. Make name_norm NOT NULL after backfill
-- ============================================================================
ALTER TABLE public.planteurs 
  ALTER COLUMN name_norm SET NOT NULL;

-- ============================================================================
-- 8. Create unique index for name_norm per cooperative
-- Prevents duplicate planteurs with same normalized name in same cooperative
-- Only applies to active planteurs
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS planteurs_unique_name_norm_per_coop
  ON public.planteurs(cooperative_id, name_norm)
  WHERE is_active = true;

-- ============================================================================
-- 9. Create index for efficient name_norm lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_planteurs_name_norm 
  ON public.planteurs(name_norm);

-- ============================================================================
-- 10. Create index for auto_created planteurs
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_planteurs_auto_created 
  ON public.planteurs(auto_created) 
  WHERE auto_created = true;

