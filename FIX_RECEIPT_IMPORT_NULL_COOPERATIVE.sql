-- ============================================================================
-- FIX: Receipt Import Without Cooperative
-- ============================================================================
-- This script fixes the error when importing collection receipts without
-- a cooperative: "null value in column 'cooperative_id' of relation 
-- 'dashboard_aggregates' violates not-null constraint"
--
-- Apply this script in Supabase SQL Editor to fix the issue.
-- ============================================================================

-- ============================================================================
-- PART 1: Fix dashboard_aggregates trigger to handle NULL cooperative_id
-- ============================================================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS delivery_update_aggregates ON public.deliveries;

-- Recreate the function with NULL check
CREATE OR REPLACE FUNCTION public.update_dashboard_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_old_day DATE;
  v_new_day DATE;
  v_old_coop_id UUID;
  v_new_coop_id UUID;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_day := OLD.delivered_at::date;
    v_old_coop_id := OLD.cooperative_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_day := NEW.delivered_at::date;
    v_new_coop_id := NEW.cooperative_id;
  END IF;

  -- Skip aggregation if cooperative_id is NULL
  IF TG_OP = 'DELETE' THEN
    -- Only aggregate if old cooperative exists
    IF v_old_coop_id IS NOT NULL THEN
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries - 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
        updated_at = NOW();
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Only aggregate if new cooperative exists
    IF v_new_coop_id IS NOT NULL THEN
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries + 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
        updated_at = NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Handle case where cooperative changes or is NULL
    IF v_old_coop_id IS NOT NULL AND v_new_coop_id IS NOT NULL THEN
      -- Both cooperatives exist
      IF v_old_day != v_new_day OR v_old_coop_id != v_new_coop_id THEN
        -- Date or cooperative changed
        INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
        VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
        ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
          total_deliveries = dashboard_aggregates.total_deliveries - 1,
          total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
          total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
          updated_at = NOW();
        
        INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
        VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
        ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
          total_deliveries = dashboard_aggregates.total_deliveries + 1,
          total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
          total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
          updated_at = NOW();
      ELSE
        -- Only weight or amount changed
        UPDATE public.dashboard_aggregates SET
          total_weight_kg = total_weight_kg + (NEW.weight_kg - OLD.weight_kg),
          total_amount_xaf = total_amount_xaf + (NEW.total_amount - OLD.total_amount),
          updated_at = NOW()
        WHERE cooperative_id = v_new_coop_id AND period_date = v_new_day;
        
        IF NOT FOUND THEN
          INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
          VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount);
        END IF;
      END IF;
    ELSIF v_old_coop_id IS NOT NULL AND v_new_coop_id IS NULL THEN
      -- Cooperative removed, decrement old
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries - 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
        updated_at = NOW();
    ELSIF v_old_coop_id IS NULL AND v_new_coop_id IS NOT NULL THEN
      -- Cooperative added, increment new
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries + 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
        updated_at = NOW();
    END IF;
    -- If both are NULL, do nothing
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER delivery_update_aggregates 
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries 
  FOR EACH ROW EXECUTE FUNCTION public.update_dashboard_aggregates();

-- Add comment
COMMENT ON FUNCTION public.update_dashboard_aggregates() IS 
  'Updates dashboard_aggregates table when deliveries are inserted, updated, or deleted. Skips aggregation for deliveries without a cooperative.';

-- ============================================================================
-- PART 2: Make deliveries.cooperative_id nullable
-- ============================================================================

ALTER TABLE public.deliveries 
  ALTER COLUMN cooperative_id DROP NOT NULL;

COMMENT ON COLUMN public.deliveries.cooperative_id IS 
  'Cooperative ID. Can be NULL for deliveries not associated with a cooperative.';

-- ============================================================================
-- PART 3: Make deliveries.warehouse_id nullable
-- ============================================================================

ALTER TABLE public.deliveries 
  ALTER COLUMN warehouse_id DROP NOT NULL;

COMMENT ON COLUMN public.deliveries.warehouse_id IS 
  'Warehouse ID. Can be NULL for deliveries not yet assigned to a warehouse.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the changes
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deliveries'
  AND column_name IN ('cooperative_id', 'warehouse_id');

-- Expected result:
-- cooperative_id | YES | uuid
-- warehouse_id   | YES | uuid

SELECT '✓ Fix applied successfully!' as status;
