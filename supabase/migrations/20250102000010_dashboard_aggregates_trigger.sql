-- CocoaTrack V2 - Dashboard Aggregates Trigger
-- This migration creates the trigger to maintain dashboard_aggregates table
-- Requirements: 6.1

-- ============================================================================
-- TRIGGER FUNCTION: update_dashboard_aggregates
-- Maintains real-time aggregates for fast dashboard queries
-- Handles INSERT, UPDATE, DELETE with proper delta calculations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_dashboard_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_old_day DATE;
  v_new_day DATE;
  v_old_coop_id UUID;
  v_new_coop_id UUID;
BEGIN
  -- Determine the day and cooperative for old/new records
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_day := OLD.delivered_at::date;
    v_old_coop_id := OLD.cooperative_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_day := NEW.delivered_at::date;
    v_new_coop_id := NEW.cooperative_id;
  END IF;

  -- Handle DELETE: subtract from aggregates
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries - 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
      updated_at = NOW();
    RETURN OLD;
  END IF;

  -- Handle INSERT: add to aggregates
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries + 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
      updated_at = NOW();
    RETURN NEW;
  END IF;

  -- Handle UPDATE: check if day or cooperative changed
  IF TG_OP = 'UPDATE' THEN
    -- If day or cooperative changed, we need to move the record between aggregates
    IF v_old_day != v_new_day OR v_old_coop_id != v_new_coop_id THEN
      -- Remove from old aggregate
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries - 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
        updated_at = NOW();
      
      -- Add to new aggregate
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries + 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
        updated_at = NOW();
    ELSE
      -- Same day and cooperative, just update the delta
      UPDATE public.dashboard_aggregates SET
        total_weight_kg = total_weight_kg + (NEW.weight_kg - OLD.weight_kg),
        total_amount_xaf = total_amount_xaf + (NEW.total_amount - OLD.total_amount),
        updated_at = NOW()
      WHERE cooperative_id = v_new_coop_id AND period_date = v_new_day;
      
      -- If no row was updated (shouldn't happen normally), insert it
      IF NOT FOUND THEN
        INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
        VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Apply to deliveries table
-- ============================================================================

CREATE TRIGGER delivery_update_aggregates
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_dashboard_aggregates();

-- ============================================================================
-- RLS POLICIES for dashboard_aggregates
-- ============================================================================

ALTER TABLE public.dashboard_aggregates ENABLE ROW LEVEL SECURITY;

-- Admin can see all aggregates
CREATE POLICY "Admins can view all dashboard aggregates"
ON public.dashboard_aggregates FOR SELECT
USING (public.get_user_role() = 'admin');

-- Manager/Agent/Viewer can see their cooperative's aggregates
CREATE POLICY "Users can view own cooperative dashboard aggregates"
ON public.dashboard_aggregates FOR SELECT
USING (
  public.get_user_role() IN ('manager', 'agent', 'viewer')
  AND cooperative_id = public.get_user_cooperative_id()
);

-- No direct INSERT/UPDATE/DELETE - only triggers can modify
-- (No policies = denied by default for these operations)

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION public.update_dashboard_aggregates() IS 
'Maintains dashboard_aggregates table in real-time. Handles INSERT (+delta), DELETE (-delta), and UPDATE (handles day/cooperative changes).';

COMMENT ON TABLE public.dashboard_aggregates IS 
'Pre-computed daily aggregates for fast dashboard queries. Updated automatically by triggers on deliveries table.';
