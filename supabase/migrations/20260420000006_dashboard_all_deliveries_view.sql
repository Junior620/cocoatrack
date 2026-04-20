-- ============================================================================
-- Create view for dashboard metrics including NULL cooperative deliveries
-- ============================================================================
-- Problem: dashboard_aggregates doesn't include deliveries with NULL cooperative_id
-- Solution: Create a view that aggregates ALL deliveries including NULL cooperatives
-- ============================================================================

-- Create a view that shows aggregated metrics for ALL deliveries
CREATE OR REPLACE VIEW public.dashboard_all_deliveries AS
SELECT
  DATE(delivered_at) as period_date,
  cooperative_id,
  COUNT(*)::integer as total_deliveries,
  SUM(weight_kg)::numeric as total_weight_kg,
  SUM(total_amount)::bigint as total_amount_xaf
FROM public.deliveries
GROUP BY DATE(delivered_at), cooperative_id;

-- Grant SELECT permission
GRANT SELECT ON public.dashboard_all_deliveries TO authenticated;

-- Add comment
COMMENT ON VIEW public.dashboard_all_deliveries IS 
  'Aggregated delivery metrics by date and cooperative, including deliveries with NULL cooperative_id';

-- ============================================================================
-- Create RPC function to get metrics including NULL cooperative deliveries
-- ============================================================================
-- This function is used by the dashboard to get complete metrics

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_all(
  p_cooperative_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  total_deliveries BIGINT,
  total_weight_kg NUMERIC,
  total_amount_xaf BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_deliveries,
    COALESCE(SUM(d.weight_kg), 0)::NUMERIC as total_weight_kg,
    COALESCE(SUM(d.total_amount), 0)::BIGINT as total_amount_xaf
  FROM public.deliveries d
  WHERE
    (p_cooperative_id IS NULL OR d.cooperative_id = p_cooperative_id)
    AND (p_date_from IS NULL OR DATE(d.delivered_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(d.delivered_at) <= p_date_to);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant EXECUTE permission
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_all TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_dashboard_metrics_all IS 
  'Get dashboard metrics including deliveries with NULL cooperative_id. Used for "all data" view.';
