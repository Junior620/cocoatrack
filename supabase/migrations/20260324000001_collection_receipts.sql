-- ============================================================================
-- Migration: Collection Receipts Infrastructure
-- Description: Creates tables and storage for importing scanned collection receipts
-- Date: 2026-03-24
-- Requirements: 7.6, 7.7, 7.8, 9.1, 9.3, 12.5
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create collection_receipts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.collection_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  planteur_id UUID NOT NULL REFERENCES public.planteurs(id) ON DELETE RESTRICT,
  chef_planteur_id UUID NOT NULL REFERENCES public.chef_planteurs(id) ON DELETE RESTRICT,
  
  -- Receipt identifiers
  contract_number TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  campaign TEXT NOT NULL,
  
  -- Location hierarchy
  region TEXT,
  department TEXT,
  arrondissement TEXT,
  village TEXT,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  professional_card_number TEXT,
  
  -- Payment information
  payment_mode TEXT CHECK (payment_mode IN ('Espèces', 'Autres')),
  amount_paid NUMERIC(12, 2),
  balance NUMERIC(12, 2),
  
  -- PDF file metadata
  pdf_url TEXT NOT NULL,
  pdf_file_name TEXT NOT NULL,
  pdf_file_size INTEGER NOT NULL,
  
  -- Import metadata
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('manual', 'ocr')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_receipt_per_cooperative UNIQUE(cooperative_id, receipt_number)
);

-- Add comment
COMMENT ON TABLE public.collection_receipts IS 'Stores metadata for imported collection receipts (RECU DE COLLECTE D''ACHAT)';

-- ============================================================================
-- SECTION 2: Create receipt_deliveries junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.receipt_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_receipt_id UUID NOT NULL REFERENCES public.collection_receipts(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure each delivery is linked to only one receipt
  CONSTRAINT unique_delivery_per_receipt UNIQUE(delivery_id)
);

-- Add comment
COMMENT ON TABLE public.receipt_deliveries IS 'Links deliveries to their source collection receipts';

-- ============================================================================
-- SECTION 3: Create indexes for performance
-- ============================================================================

-- Indexes for collection_receipts
CREATE INDEX IF NOT EXISTS idx_collection_receipts_cooperative 
  ON public.collection_receipts(cooperative_id);

CREATE INDEX IF NOT EXISTS idx_collection_receipts_planteur 
  ON public.collection_receipts(planteur_id);

CREATE INDEX IF NOT EXISTS idx_collection_receipts_chef_planteur 
  ON public.collection_receipts(chef_planteur_id);

CREATE INDEX IF NOT EXISTS idx_collection_receipts_receipt_number 
  ON public.collection_receipts(receipt_number);

CREATE INDEX IF NOT EXISTS idx_collection_receipts_transaction_date 
  ON public.collection_receipts(transaction_date);

CREATE INDEX IF NOT EXISTS idx_collection_receipts_created_by 
  ON public.collection_receipts(created_by);

-- Indexes for receipt_deliveries
CREATE INDEX IF NOT EXISTS idx_receipt_deliveries_receipt 
  ON public.receipt_deliveries(collection_receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_deliveries_delivery 
  ON public.receipt_deliveries(delivery_id);

-- ============================================================================
-- SECTION 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER set_collection_receipts_updated_at
  BEFORE UPDATE ON public.collection_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 5: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.collection_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_deliveries ENABLE ROW LEVEL SECURITY;

-- collection_receipts policies

-- SELECT: Users can view receipts from their cooperative
CREATE POLICY collection_receipts_select_policy ON public.collection_receipts
  FOR SELECT
  USING (
    cooperative_id IN (
      SELECT cooperative_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- INSERT: Managers and admins can create receipts for their cooperative
CREATE POLICY collection_receipts_insert_policy ON public.collection_receipts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
      AND (cooperative_id = collection_receipts.cooperative_id OR role = 'admin')
    )
  );

-- UPDATE: Managers and admins can update receipts from their cooperative
CREATE POLICY collection_receipts_update_policy ON public.collection_receipts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
      AND (cooperative_id = collection_receipts.cooperative_id OR role = 'admin')
    )
  );

-- DELETE: Only admins can delete receipts
CREATE POLICY collection_receipts_delete_policy ON public.collection_receipts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- receipt_deliveries policies

-- SELECT: Users can view links if they can view the receipt
CREATE POLICY receipt_deliveries_select_policy ON public.receipt_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.collection_receipts 
      WHERE id = receipt_deliveries.collection_receipt_id
      AND (
        cooperative_id IN (
          SELECT cooperative_id 
          FROM public.profiles 
          WHERE id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 
          FROM public.profiles 
          WHERE id = auth.uid() 
          AND role = 'admin'
        )
      )
    )
  );

-- INSERT: Managers and admins can create links
CREATE POLICY receipt_deliveries_insert_policy ON public.receipt_deliveries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- DELETE: Only admins can delete links
CREATE POLICY receipt_deliveries_delete_policy ON public.receipt_deliveries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 6: Grant permissions
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.collection_receipts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.receipt_deliveries TO authenticated;

-- Grant sequence usage if needed
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
