-- ============================================================================
-- CocoaTrack V2 - Parcelles Orphan Support Migration
-- Allows parcelles without planteur (orphelines) for flexible import workflows
-- Requirements: 1.1, 1.2
-- ============================================================================

-- ============================================================================
-- 1. Make planteur_id nullable
-- ============================================================================
ALTER TABLE public.parcelles 
  ALTER COLUMN planteur_id DROP NOT NULL;

-- ============================================================================
-- 2. Make code nullable (orphan parcelles may not have a code yet)
-- ============================================================================
ALTER TABLE public.parcelles 
  ALTER COLUMN code DROP NOT NULL;

-- ============================================================================
-- 3. Drop existing unique constraint on (planteur_id, code)
-- ============================================================================
ALTER TABLE public.parcelles 
  DROP CONSTRAINT IF EXISTS parcelles_code_unique;

-- ============================================================================
-- 4. Add constraint: orphan parcelles MUST have import_file_id (for RLS)
-- This ensures RLS can always determine cooperative access via import_file
-- ============================================================================
ALTER TABLE public.parcelles 
  ADD CONSTRAINT parcelles_orphan_requires_import
  CHECK (planteur_id IS NOT NULL OR import_file_id IS NOT NULL);

-- ============================================================================
-- 5. Add constraint: assigned parcelles MUST have a code
-- Code is required when parcelle is assigned to a planteur
-- ============================================================================
ALTER TABLE public.parcelles 
  ADD CONSTRAINT parcelles_code_required_when_assigned
  CHECK (planteur_id IS NULL OR code IS NOT NULL);

-- ============================================================================
-- 6. Create filtered unique index for code per planteur
-- Only applies to assigned (non-orphan) active parcelles
-- ============================================================================
CREATE UNIQUE INDEX parcelles_unique_code_per_planteur
  ON public.parcelles(planteur_id, code)
  WHERE planteur_id IS NOT NULL AND is_active = true;

-- ============================================================================
-- 7. Create index for efficient orphan parcelle queries
-- Filters on planteur_id IS NULL and is_active = true
-- ============================================================================
CREATE INDEX idx_parcelles_orphan 
  ON public.parcelles(import_file_id) 
  WHERE planteur_id IS NULL AND is_active = true;

-- ============================================================================
-- 8. Update existing unique index on feature_hash to handle orphans
-- Drop old index and recreate with proper handling
-- ============================================================================
DROP INDEX IF EXISTS uniq_active_parcelle_hash;

-- For assigned parcelles: unique per planteur
-- For orphan parcelles: unique per import_file
CREATE UNIQUE INDEX uniq_active_parcelle_hash_assigned
  ON public.parcelles (planteur_id, feature_hash) 
  WHERE is_active = true AND feature_hash IS NOT NULL AND planteur_id IS NOT NULL;

CREATE UNIQUE INDEX uniq_active_parcelle_hash_orphan
  ON public.parcelles (import_file_id, feature_hash) 
  WHERE is_active = true AND feature_hash IS NOT NULL AND planteur_id IS NULL;
