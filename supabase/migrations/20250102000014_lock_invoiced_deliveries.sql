-- CocoaTrack V2 - Lock Invoiced Deliveries
-- Prevents modification of deliveries that have been included in an invoice
-- Business Rule: Option A - Block modification of invoiced deliveries

-- ============================================================================
-- TRIGGER: LOCK INVOICED DELIVERY FIELDS
-- Prevents modification of critical fields on deliveries that are part of an invoice
-- Exception: Admin can still modify (for corrections)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lock_invoiced_delivery_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_is_invoiced BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Check if this delivery is part of any invoice
  SELECT EXISTS (
    SELECT 1 FROM public.invoice_deliveries id
    JOIN public.invoices i ON i.id = id.invoice_id
    WHERE id.delivery_id = OLD.id
    AND i.status != 'draft'  -- Only lock if invoice is sent or paid
  ) INTO v_is_invoiced;
  
  -- If not invoiced, allow all changes
  IF NOT v_is_invoiced THEN
    RETURN NEW;
  END IF;
  
  -- Get user role
  v_user_role := public.get_user_role();
  
  -- Admin can modify anything
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- For invoiced deliveries, check if critical fields are being modified
  IF NEW.weight_kg != OLD.weight_kg 
     OR NEW.price_per_kg != OLD.price_per_kg 
     OR NEW.total_amount != OLD.total_amount
     OR NEW.planteur_id != OLD.planteur_id
     OR NEW.chef_planteur_id != OLD.chef_planteur_id
     OR NEW.delivered_at != OLD.delivered_at THEN
    RAISE EXCEPTION 'Cannot modify critical fields on invoiced delivery. This delivery is part of a finalized invoice. Contact an administrator for corrections.';
  END IF;
  
  -- Allow non-critical field changes (notes, quality_grade, payment_status)
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on UPDATE
CREATE TRIGGER lock_invoiced_delivery_fields_trigger
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.lock_invoiced_delivery_fields();

-- ============================================================================
-- TRIGGER: PREVENT DELETE OF INVOICED DELIVERIES
-- Prevents deletion of deliveries that are part of an invoice
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_invoiced_delivery_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_is_invoiced BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Check if this delivery is part of any invoice
  SELECT EXISTS (
    SELECT 1 FROM public.invoice_deliveries
    WHERE delivery_id = OLD.id
  ) INTO v_is_invoiced;
  
  -- If not invoiced, allow delete
  IF NOT v_is_invoiced THEN
    RETURN OLD;
  END IF;
  
  -- Get user role
  v_user_role := public.get_user_role();
  
  -- Admin can delete anything
  IF v_user_role = 'admin' THEN
    RETURN OLD;
  END IF;
  
  -- Prevent deletion of invoiced deliveries
  RAISE EXCEPTION 'Cannot delete invoiced delivery. This delivery is part of an invoice. Contact an administrator.';
END;
$ LANGUAGE plpgsql;

-- Apply trigger on DELETE
CREATE TRIGGER prevent_invoiced_delivery_delete_trigger
  BEFORE DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_invoiced_delivery_delete();

-- ============================================================================
-- FUNCTION: CHECK IF DELIVERY IS INVOICED
-- Helper function to check if a delivery is part of any invoice
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_delivery_invoiced(p_delivery_id UUID)
RETURNS BOOLEAN
SET search_path = public
AS $
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.invoice_deliveries
    WHERE delivery_id = p_delivery_id
  );
END;
$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: GET INVOICE FOR DELIVERY
-- Returns the invoice ID for a delivery, or NULL if not invoiced
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_delivery_invoice_id(p_delivery_id UUID)
RETURNS UUID
SET search_path = public
AS $
BEGIN
  RETURN (
    SELECT invoice_id FROM public.invoice_deliveries
    WHERE delivery_id = p_delivery_id
    LIMIT 1
  );
END;
$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.lock_invoiced_delivery_fields() IS 
  'Prevents modification of critical fields on deliveries that are part of a finalized invoice';

COMMENT ON FUNCTION public.prevent_invoiced_delivery_delete() IS 
  'Prevents deletion of deliveries that are part of any invoice';

COMMENT ON FUNCTION public.is_delivery_invoiced(UUID) IS 
  'Returns TRUE if the delivery is part of any invoice';

COMMENT ON FUNCTION public.get_delivery_invoice_id(UUID) IS 
  'Returns the invoice ID for a delivery, or NULL if not invoiced';
