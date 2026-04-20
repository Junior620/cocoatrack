-- ============================================================================
-- Make deliveries.cooperative_id nullable
-- ============================================================================
-- Issue: Receipt imports without a cooperative fail because cooperative_id
-- is NOT NULL in the deliveries table.
--
-- Solution: Allow NULL cooperative_id for deliveries that are not associated
-- with a specific cooperative (e.g., direct planteur deliveries).
-- ============================================================================

-- Make cooperative_id nullable in deliveries table
ALTER TABLE public.deliveries 
  ALTER COLUMN cooperative_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN public.deliveries.cooperative_id IS 
  'Cooperative ID. Can be NULL for deliveries not associated with a cooperative.';

-- Note: The dashboard_aggregates trigger already handles NULL cooperative_id
-- (see migration 20260420000001_fix_dashboard_aggregates_null_cooperative.sql)
