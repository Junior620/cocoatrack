-- CocoaTrack V2 - Backfill Dashboard Aggregates
-- This migration backfills the dashboard_aggregates table from existing deliveries
-- Run this AFTER the trigger is created to populate historical data
-- Requirements: 6.1

-- ============================================================================
-- BACKFILL FUNCTION
-- Populates dashboard_aggregates from existing deliveries data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.backfill_dashboard_aggregates()
RETURNS TABLE (
  cooperative_id UUID,
  period_date DATE,
  total_deliveries BIGINT,
  total_weight_kg NUMERIC,
  total_amount_xaf BIGINT
) AS $$
BEGIN
  -- Clear existing aggregates (in case of re-run)
  DELETE FROM public.dashboard_aggregates;
  
  -- Insert aggregated data from deliveries
  INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
  SELECT 
    d.cooperative_id,
    d.delivered_at::date AS period_date,
    COUNT(*)::integer AS total_deliveries,
    COALESCE(SUM(d.weight_kg), 0) AS total_weight_kg,
    COALESCE(SUM(d.total_amount), 0) AS total_amount_xaf
  FROM public.deliveries d
  GROUP BY d.cooperative_id, d.delivered_at::date
  ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    total_weight_kg = EXCLUDED.total_weight_kg,
    total_amount_xaf = EXCLUDED.total_amount_xaf,
    updated_at = NOW();
  
  -- Return the results for verification
  RETURN QUERY
  SELECT 
    da.cooperative_id,
    da.period_date,
    da.total_deliveries::bigint,
    da.total_weight_kg,
    da.total_amount_xaf
  FROM public.dashboard_aggregates da
  ORDER BY da.cooperative_id, da.period_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION FUNCTION
-- Compares aggregates with actual delivery data to verify integrity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_dashboard_aggregates()
RETURNS TABLE (
  cooperative_id UUID,
  period_date DATE,
  aggregate_deliveries INTEGER,
  actual_deliveries BIGINT,
  aggregate_weight NUMERIC,
  actual_weight NUMERIC,
  aggregate_amount BIGINT,
  actual_amount BIGINT,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH actual_data AS (
    SELECT 
      d.cooperative_id,
      d.delivered_at::date AS period_date,
      COUNT(*) AS total_deliveries,
      COALESCE(SUM(d.weight_kg), 0) AS total_weight_kg,
      COALESCE(SUM(d.total_amount), 0) AS total_amount_xaf
    FROM public.deliveries d
    GROUP BY d.cooperative_id, d.delivered_at::date
  )
  SELECT 
    COALESCE(da.cooperative_id, ad.cooperative_id) AS cooperative_id,
    COALESCE(da.period_date, ad.period_date) AS period_date,
    da.total_deliveries AS aggregate_deliveries,
    ad.total_deliveries AS actual_deliveries,
    da.total_weight_kg AS aggregate_weight,
    ad.total_weight_kg AS actual_weight,
    da.total_amount_xaf AS aggregate_amount,
    ad.total_amount_xaf AS actual_amount,
    (
      COALESCE(da.total_deliveries, 0) = COALESCE(ad.total_deliveries, 0)
      AND COALESCE(da.total_weight_kg, 0) = COALESCE(ad.total_weight_kg, 0)
      AND COALESCE(da.total_amount_xaf, 0) = COALESCE(ad.total_amount_xaf, 0)
    ) AS is_valid
  FROM public.dashboard_aggregates da
  FULL OUTER JOIN actual_data ad 
    ON da.cooperative_id = ad.cooperative_id 
    AND da.period_date = ad.period_date
  ORDER BY cooperative_id, period_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- EXECUTE BACKFILL
-- Run the backfill to populate existing data
-- ============================================================================

SELECT * FROM public.backfill_dashboard_aggregates();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.backfill_dashboard_aggregates() IS 
'Backfills dashboard_aggregates table from existing deliveries. Safe to re-run - clears and repopulates.';

COMMENT ON FUNCTION public.verify_dashboard_aggregates() IS 
'Verifies dashboard_aggregates integrity by comparing with actual delivery data. Returns is_valid=false for mismatches.';
