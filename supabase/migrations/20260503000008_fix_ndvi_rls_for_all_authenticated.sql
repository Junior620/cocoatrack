-- ============================================================================
-- Migration: Fix NDVI RLS for All Authenticated Users
-- Description: Allow all authenticated users to insert/update NDVI results
--              This is a temporary fix for development. In production, you may
--              want to restrict this to specific roles.
-- Date: 2026-05-03
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS ndvi_results_insert ON public.ndvi_results;
DROP POLICY IF EXISTS ndvi_results_update ON public.ndvi_results;

-- Create more permissive INSERT policy for all authenticated users
-- Users can insert NDVI results for parcelles they have access to
CREATE POLICY ndvi_results_insert_authenticated ON public.ndvi_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      -- Case 1: Assigned parcelle - access via planteur.cooperative_id
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      -- Case 2: Orphan parcelle - access via import_file.cooperative_id
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- Create more permissive UPDATE policy for all authenticated users
-- Users can update NDVI results for parcelles they have access to
CREATE POLICY ndvi_results_update_authenticated ON public.ndvi_results
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = ndvi_results.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- Add comments
COMMENT ON POLICY ndvi_results_insert_authenticated ON public.ndvi_results IS 
  'All authenticated users can insert NDVI results for parcelles they have access to';

COMMENT ON POLICY ndvi_results_update_authenticated ON public.ndvi_results IS 
  'All authenticated users can update NDVI results for parcelles they have access to';

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration removes the is_agent_or_above() check from NDVI policies.
-- This allows all authenticated users (including viewers/planteurs) to 
-- insert and update NDVI results for parcelles they can access.
--
-- Rationale:
-- - NDVI calculation is triggered by user actions (viewing parcelle details)
-- - The calculation itself is automated and doesn't require special permissions
-- - Access control is still enforced via parcelle access checks
--
-- For production, you may want to:
-- 1. Restore the is_agent_or_above() check, OR
-- 2. Create a service role function with SECURITY DEFINER to bypass RLS

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
