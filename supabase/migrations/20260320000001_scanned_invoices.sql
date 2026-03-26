-- CocoaTrack V2 - Scanned Invoices Module
-- Implements table, RLS policies, and storage bucket for scanned invoice uploads

-- ============================================================================
-- SCANNED INVOICES TABLE
-- Stores metadata for uploaded scanned invoice files (PDF, JPEG, PNG, WEBP)
-- ============================================================================

CREATE TABLE public.scanned_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  thumbnail_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: file size must be between 1 byte and 10MB
  CONSTRAINT scanned_invoices_file_size_check 
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_scanned_invoices_invoice_id 
  ON public.scanned_invoices(invoice_id);

CREATE INDEX idx_scanned_invoices_created_by 
  ON public.scanned_invoices(created_by);

CREATE INDEX idx_scanned_invoices_created_at 
  ON public.scanned_invoices(created_at DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.scanned_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- SELECT: Managers and admins can view scanned invoices in their scope
CREATE POLICY "scanned_invoices_select_policy" ON public.scanned_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (
        public.is_admin()
        OR (
          public.is_manager_or_above() 
          AND public.can_access_cooperative(i.cooperative_id)
        )
      )
    )
  );

-- INSERT: Managers and admins can upload scanned invoices
CREATE POLICY "scanned_invoices_insert_policy" ON public.scanned_invoices
  FOR INSERT
  WITH CHECK (
    public.is_manager_or_above()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(i.cooperative_id)
      )
    )
  );

-- DELETE: Only admins can delete scanned invoices
CREATE POLICY "scanned_invoices_delete_policy" ON public.scanned_invoices
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ============================================================================

-- Note: The storage bucket must be created manually via Supabase dashboard or API
-- Bucket name: invoice-scans
-- Configuration:
--   - Public: false (private bucket)
--   - File size limit: 10MB (10485760 bytes)
--   - Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp
--
-- Path structure: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}
--
-- STORAGE POLICIES (to be configured manually in Supabase dashboard):
--
-- Policy 1: Upload (INSERT)
-- Operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression:
--   bucket_id = 'invoice-scans'
--   AND (storage.foldername(name))[1] IN (
--     SELECT cooperative_id::text
--     FROM public.invoices
--     WHERE id = (storage.foldername(name))[2]::uuid
--     AND (
--       public.is_admin()
--       OR public.can_access_cooperative(cooperative_id)
--     )
--   )
--
-- Policy 2: Download (SELECT)
-- Operation: SELECT
-- Target roles: authenticated
-- USING expression:
--   bucket_id = 'invoice-scans'
--   AND (storage.foldername(name))[1] IN (
--     SELECT cooperative_id::text
--     FROM public.invoices
--     WHERE id = (storage.foldername(name))[2]::uuid
--     AND (
--       public.is_admin()
--       OR public.can_access_cooperative(cooperative_id)
--     )
--   )
--
-- Policy 3: Delete (DELETE)
-- Operation: DELETE
-- Target roles: authenticated
-- USING expression:
--   bucket_id = 'invoice-scans'
--   AND public.is_admin()

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.scanned_invoices IS 
  'Stores metadata for uploaded scanned invoice files (PDF and images)';

COMMENT ON COLUMN public.scanned_invoices.storage_path IS 
  'Path in Supabase Storage: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}';

COMMENT ON COLUMN public.scanned_invoices.file_size_bytes IS 
  'File size in bytes (max 10MB = 10485760 bytes)';

COMMENT ON COLUMN public.scanned_invoices.mime_type IS 
  'MIME type: application/pdf, image/jpeg, image/png, or image/webp';

COMMENT ON COLUMN public.scanned_invoices.thumbnail_path IS 
  'Optional path to thumbnail image (for PDF first page preview)';

COMMENT ON POLICY "scanned_invoices_select_policy" ON public.scanned_invoices IS 
  'Managers and admins can view scanned invoices in their cooperative scope';

COMMENT ON POLICY "scanned_invoices_insert_policy" ON public.scanned_invoices IS 
  'Managers and admins can upload scanned invoices for invoices in their scope';

COMMENT ON POLICY "scanned_invoices_delete_policy" ON public.scanned_invoices IS 
  'Only admins can delete scanned invoices';
