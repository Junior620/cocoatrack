-- ============================================================================
-- Fix invoice code counter RLS issue
-- ============================================================================
-- Problem: next_monthly_invoice_seq function is blocked by RLS when trying
-- to INSERT/UPDATE invoice_code_counters table
--
-- Solution: Add SECURITY DEFINER to the function so it bypasses RLS
-- ============================================================================

-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.next_monthly_invoice_seq(p_month TEXT)
RETURNS INTEGER
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
AS $$
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
$$ LANGUAGE plpgsql;

-- Also update generate_invoice_code to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_invoice_code()
RETURNS TEXT
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_month TEXT := to_char(current_date, 'YYYYMM');
  v_seq INTEGER;
BEGIN
  v_seq := public.next_monthly_invoice_seq(v_month);
  RETURN 'INV-' || v_month || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON FUNCTION public.next_monthly_invoice_seq(TEXT) IS 
  'Returns the next sequence number for invoice codes on a given month (atomic, concurrency-safe). SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION public.generate_invoice_code() IS 
  'Generates a unique invoice code in format INV-YYYYMM-XXXX. SECURITY DEFINER to bypass RLS.';
