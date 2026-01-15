-- CocoaTrack V2 - Lock Paid Delivery Fields Trigger
-- Prevents modification of critical fields (weight, price, total) on paid deliveries
-- Exception for admin and manager roles

-- ============================================================================
-- TRIGGER: LOCK PAID DELIVERY FIELDS
-- Prevents agents from modifying weight_kg, price_per_kg, or total_amount
-- on deliveries that have payment_status = 'paid'
-- Admin and manager can still modify these fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lock_paid_delivery_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $
DECLARE
  v_user_role public.user_role;
BEGIN
  -- Only check if the delivery was already paid
  IF OLD.payment_status = 'paid' THEN
    -- Get the current user's role
    v_user_role := public.get_user_role();
    
    -- Admin and manager can modify paid deliveries
    IF v_user_role IN ('admin', 'manager') THEN
      RETURN NEW;
    END IF;
    
    -- For agents and viewers, check if critical fields are being modified
    IF NEW.weight_kg IS DISTINCT FROM OLD.weight_kg THEN
      RAISE EXCEPTION 'Cannot modify weight_kg on paid delivery. Contact a manager.';
    END IF;
    
    IF NEW.price_per_kg IS DISTINCT FROM OLD.price_per_kg THEN
      RAISE EXCEPTION 'Cannot modify price_per_kg on paid delivery. Contact a manager.';
    END IF;
    
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION 'Cannot modify total_amount on paid delivery. Contact a manager.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger BEFORE UPDATE (must run before calculate_delivery_total)
-- Using a lower priority name to ensure it runs first
CREATE TRIGGER a_lock_paid_delivery_fields_trigger
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.lock_paid_delivery_fields();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.lock_paid_delivery_fields() IS 
  'Prevents modification of weight_kg, price_per_kg, and total_amount on paid deliveries. Admin and manager are exempt.';

COMMENT ON TRIGGER a_lock_paid_delivery_fields_trigger ON public.deliveries IS 
  'Enforces lock on critical fields for paid deliveries. Named with "a_" prefix to run before other triggers.';
