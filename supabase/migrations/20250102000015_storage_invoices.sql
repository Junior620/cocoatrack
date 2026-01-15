-- CocoaTrack V2 - Storage Bucket for Invoice PDFs
-- Creates storage bucket and policies for invoice PDF files

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Note: This needs to be run via Supabase dashboard or API
-- The bucket should be created with the following settings:
-- - Name: invoices
-- - Public: false (private bucket)
-- - File size limit: 10MB
-- - Allowed MIME types: application/pdf

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy: Managers and admins can upload invoice PDFs
CREATE POLICY "Managers can upload invoice PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.role() = 'authenticated'
  AND public.is_manager_or_above()
  -- Path must start with user's cooperative (or admin can upload anywhere)
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- Policy: Managers and admins can view invoice PDFs in their scope
CREATE POLICY "Managers can view invoice PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND auth.role() = 'authenticated'
  AND public.is_manager_or_above()
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- Policy: Managers and admins can update invoice PDFs
CREATE POLICY "Managers can update invoice PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoices'
  AND auth.role() = 'authenticated'
  AND public.is_manager_or_above()
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- Policy: Only admins can delete invoice PDFs
CREATE POLICY "Admins can delete invoice PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices'
  AND public.is_admin()
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "Managers can upload invoice PDFs" ON storage.objects IS 
  'Managers and admins can upload invoice PDFs to their cooperative folder';

COMMENT ON POLICY "Managers can view invoice PDFs" ON storage.objects IS 
  'Managers and admins can view invoice PDFs in their scope';

COMMENT ON POLICY "Managers can update invoice PDFs" ON storage.objects IS 
  'Managers and admins can update invoice PDFs in their scope';

COMMENT ON POLICY "Admins can delete invoice PDFs" ON storage.objects IS 
  'Only admins can delete invoice PDFs';
