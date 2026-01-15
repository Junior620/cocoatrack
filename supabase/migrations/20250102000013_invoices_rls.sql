-- CocoaTrack V2 - Invoices RLS Policies and Triggers
-- Implements RLS policies for invoices (manager+ only) and invoice code generation

-- ============================================================================
-- ENABLE RLS ON INVOICES TABLE
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INVOICE CODE GENERATION
-- Format: INV-YYYYMM-XXXX (4 digits, monthly reset)
-- Uses table-based counter with SELECT FOR UPDATE for concurrency safety
-- ============================================================================

-- Invoice code counters table (monthly reset)
CREATE TABLE IF NOT EXISTS public.invoice_code_counters (
  month TEXT PRIMARY KEY, -- Format: YYYYMM
  counter INTEGER NOT NULL DEFAULT 0
);

-- Function to get next monthly sequence number (atomic, concurrency-safe)
CREATE OR REPLACE FUNCTION public.next_monthly_invoice_seq(p_month TEXT)
RETURNS INTEGER
SET search_path = public
AS $
DECLARE
  v_seq INTEGER;
BEGIN
  -- Insert or update the counter atomically
  INSERT INTO public.invoice_code_counters (month, counter)
  VALUES (p_month, 1)
  ON CONFLICT (month) DO UPDATE 
    SET counter = public.invoice_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  
  RETURN v_seq;
END;
$ LANGUAGE plpgsql;

-- Function to generate unique invoice code
CREATE OR REPLACE FUNCTION public.generate_invoice_code()
RETURNS TEXT
SET search_path = public
AS $
DECLARE
  v_month TEXT := to_char(current_date, 'YYYYMM');
  v_seq INTEGER;
BEGIN
  v_seq := public.next_monthly_invoice_seq(v_month);
  RETURN 'INV-' || v_month || '-' || lpad(v_seq::text, 4, '0');
END;
$ LANGUAGE plpgsql;

-- Trigger function to set invoice code on INSERT
CREATE OR REPLACE FUNCTION public.set_invoice_code()
RETURNS TRIGGER
SET search_path = public
AS $
BEGIN
  -- Only generate code if not provided
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_invoice_code();
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on INSERT
CREATE TRIGGER set_invoice_code_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_code();

-- ============================================================================
-- INVOICES RLS POLICIES
-- Only managers and admins can access invoices
-- ============================================================================

-- SELECT: Managers and admins can view invoices
CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT
  USING (
    CASE
      -- Admin can see all invoices
      WHEN public.is_admin() THEN true
      -- Manager can see invoices in their cooperative
      WHEN public.is_manager_or_above() 
        AND public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  );

-- INSERT: Managers and admins can create invoices
CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT
  WITH CHECK (
    -- Must be manager or above
    public.is_manager_or_above()
    -- Must set created_by to current user
    AND created_by = auth.uid()
    -- The cooperative must be in user's scope (or admin)
    AND (
      public.is_admin()
      OR cooperative_id = public.get_user_cooperative_id()
    )
  );

-- UPDATE: Managers and admins can update invoices
CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE
  USING (
    CASE
      -- Admin can update any invoice
      WHEN public.is_admin() THEN true
      -- Manager can update invoices in their cooperative
      WHEN public.is_manager_or_above() 
        AND public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  )
  WITH CHECK (
    -- Ensure the invoice stays in user's scope
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.is_manager_or_above() THEN
        cooperative_id = public.get_user_cooperative_id()
      ELSE false
    END
  );

-- DELETE: Only admin can delete invoices
CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- INVOICE-DELIVERY LINK TABLE
-- Links invoices to their associated deliveries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invoice_id, delivery_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_invoice_deliveries_invoice ON public.invoice_deliveries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_deliveries_delivery ON public.invoice_deliveries(delivery_id);

-- Enable RLS on invoice_deliveries
ALTER TABLE public.invoice_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_deliveries (same as invoices)
CREATE POLICY "invoice_deliveries_select_policy" ON public.invoice_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (
        public.is_admin()
        OR (public.is_manager_or_above() AND public.can_access_cooperative(i.cooperative_id))
      )
    )
  );

CREATE POLICY "invoice_deliveries_insert_policy" ON public.invoice_deliveries
  FOR INSERT
  WITH CHECK (
    public.is_manager_or_above()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(i.cooperative_id)
      )
    )
  );

CREATE POLICY "invoice_deliveries_delete_policy" ON public.invoice_deliveries
  FOR DELETE
  USING (
    public.is_admin()
    OR (
      public.is_manager_or_above()
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
        AND public.can_access_cooperative(i.cooperative_id)
        AND i.status = 'draft'
      )
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.next_monthly_invoice_seq(TEXT) IS 
  'Returns the next sequence number for invoice codes on a given month (atomic, concurrency-safe)';

COMMENT ON FUNCTION public.generate_invoice_code() IS 
  'Generates a unique invoice code in format INV-YYYYMM-XXXX';

COMMENT ON FUNCTION public.set_invoice_code() IS 
  'Trigger function to auto-generate invoice code on INSERT';

COMMENT ON POLICY "invoices_select_policy" ON public.invoices IS 
  'Managers and admins can view invoices in their scope';

COMMENT ON POLICY "invoices_insert_policy" ON public.invoices IS 
  'Managers and admins can create invoices for their cooperative';

COMMENT ON POLICY "invoices_update_policy" ON public.invoices IS 
  'Managers and admins can update invoices in their cooperative';

COMMENT ON POLICY "invoices_delete_policy" ON public.invoices IS 
  'Only admin can delete invoices';

COMMENT ON TABLE public.invoice_deliveries IS 
  'Links invoices to their associated deliveries';
