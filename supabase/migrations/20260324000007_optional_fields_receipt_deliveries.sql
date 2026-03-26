-- ============================================================================
-- Migration: Make warehouse_id and cooperative_id optional in deliveries
-- Description: Deliveries created from receipt imports don't have a warehouse.
--              cooperative_id is derived from planteur/chef_planteur by trigger.
-- Date: 2026-03-24
-- ============================================================================

ALTER TABLE public.deliveries
  ALTER COLUMN warehouse_id DROP NOT NULL,
  ALTER COLUMN cooperative_id DROP NOT NULL;

COMMENT ON COLUMN public.deliveries.warehouse_id IS
  'Optional warehouse reference. NULL for deliveries created via receipt import.';

COMMENT ON COLUMN public.deliveries.cooperative_id IS
  'Derived from chef_planteur or planteur by trigger. Optional at insert time.';
