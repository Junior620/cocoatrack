-- ============================================================================
-- Migration: Invoice Status Tracking for Deliveries
-- Description: Adds invoice_id FK and invoice_status to deliveries table.
--              Deliveries created via receipt import are marked "not_invoiced".
--              Status auto-updates to "invoiced" when linked to an invoice.
-- Requirements: 19.1, 19.6
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add invoice_status and invoice_id columns to deliveries
-- ============================================================================

-- Enum for invoice status on a delivery
DO $$ BEGIN
  CREATE TYPE public.delivery_invoice_status AS ENUM ('not_invoiced', 'invoiced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add invoice_status column (default: not_invoiced for all existing deliveries)
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS invoice_status public.delivery_invoice_status NOT NULL DEFAULT 'not_invoiced';

-- Add invoice_id FK (nullable — NULL means not yet invoiced)
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Index for fast filtering by invoice status
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_status
  ON public.deliveries(invoice_status);

CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_id
  ON public.deliveries(invoice_id);

COMMENT ON COLUMN public.deliveries.invoice_status IS
  'Tracks whether this delivery has been included in an invoice (not_invoiced | invoiced)';

COMMENT ON COLUMN public.deliveries.invoice_id IS
  'FK to the invoice that includes this delivery, NULL if not yet invoiced';

-- ============================================================================
-- SECTION 2: Trigger — auto-update invoice_status when invoice_deliveries changes
-- ============================================================================

-- Called AFTER INSERT on invoice_deliveries: mark delivery as invoiced
CREATE OR REPLACE FUNCTION public.sync_delivery_invoice_status_on_link()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.deliveries
  SET
    invoice_status = 'invoiced',
    invoice_id     = NEW.invoice_id
  WHERE id = NEW.delivery_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_delivery_invoice_status_on_link_trigger
  AFTER INSERT ON public.invoice_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_invoice_status_on_link();

-- Called AFTER DELETE on invoice_deliveries: revert delivery to not_invoiced
CREATE OR REPLACE FUNCTION public.sync_delivery_invoice_status_on_unlink()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.deliveries
  SET
    invoice_status = 'not_invoiced',
    invoice_id     = NULL
  WHERE id = OLD.delivery_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER sync_delivery_invoice_status_on_unlink_trigger
  AFTER DELETE ON public.invoice_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_invoice_status_on_unlink();

-- ============================================================================
-- SECTION 3: Backfill existing invoice_deliveries rows
-- ============================================================================

-- Mark all deliveries that are already linked to an invoice
UPDATE public.deliveries d
SET
  invoice_status = 'invoiced',
  invoice_id     = id_link.invoice_id
FROM public.invoice_deliveries id_link
WHERE id_link.delivery_id = d.id;

-- ============================================================================
-- SECTION 4: Comments
-- ============================================================================

COMMENT ON FUNCTION public.sync_delivery_invoice_status_on_link() IS
  'Marks a delivery as invoiced when it is linked to an invoice via invoice_deliveries';

COMMENT ON FUNCTION public.sync_delivery_invoice_status_on_unlink() IS
  'Reverts a delivery to not_invoiced when it is removed from an invoice';
