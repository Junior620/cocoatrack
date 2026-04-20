-- ============================================================================
-- Make deliveries.warehouse_id nullable
-- ============================================================================
-- Issue: Receipt imports don't specify a warehouse, but warehouse_id is NOT NULL
-- in the deliveries table, causing insert failures.
--
-- Solution: Allow NULL warehouse_id for deliveries that are not yet assigned
-- to a warehouse (e.g., from receipt imports).
-- ============================================================================

-- Make warehouse_id nullable in deliveries table
ALTER TABLE public.deliveries 
  ALTER COLUMN warehouse_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN public.deliveries.warehouse_id IS 
  'Warehouse ID. Can be NULL for deliveries not yet assigned to a warehouse.';
