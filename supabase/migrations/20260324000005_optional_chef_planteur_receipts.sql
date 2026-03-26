-- ============================================================================
-- Migration: Make chef_planteur_id optional in collection_receipts AND deliveries
-- Description: Allows importing receipts where the buyer (chef planteur) is
--              entered manually without being linked to an existing record.
-- Date: 2026-03-24
-- ============================================================================

ALTER TABLE public.collection_receipts
  ALTER COLUMN chef_planteur_id DROP NOT NULL;

ALTER TABLE public.deliveries
  ALTER COLUMN chef_planteur_id DROP NOT NULL;

COMMENT ON COLUMN public.collection_receipts.chef_planteur_id IS
  'Optional reference to chef_planteur. NULL when buyer is entered manually via chef_planteur_name.';

COMMENT ON COLUMN public.deliveries.chef_planteur_id IS
  'Optional reference to chef_planteur. NULL when buyer is entered manually.';
