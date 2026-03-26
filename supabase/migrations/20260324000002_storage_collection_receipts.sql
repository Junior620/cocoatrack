-- ============================================================================
-- Migration: Collection Receipts Storage
-- Description: Creates storage bucket and policies for collection receipt PDFs
-- Date: 2026-03-24
-- Requirements: 9.1, 9.3, 9.4, 9.5
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collection-receipts',
  'collection-receipts',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTION 2: Storage policies for collection-receipts bucket
-- ============================================================================

-- Policy 1: SELECT (Download) - Users can download receipts from their cooperative
CREATE POLICY "Users can download receipts from their cooperative"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'collection-receipts'
  AND (
    -- Extract cooperative_id from path: {cooperative_id}/receipts/{receipt_number}/{filename}
    (storage.foldername(name))[1] IN (
      SELECT cooperative_id::text
      FROM public.profiles
      WHERE id = auth.uid()
    )
    OR
    -- Admins can access all
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Policy 2: INSERT (Upload) - Managers and admins can upload receipts for their cooperative
CREATE POLICY "Managers and admins can upload receipts for their cooperative"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'collection-receipts'
  AND (
    -- Check user is manager or admin
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
    )
    AND (
      -- Check cooperative access
      (storage.foldername(name))[1] IN (
        SELECT cooperative_id::text
        FROM public.profiles
        WHERE id = auth.uid()
      )
      OR
      -- Admins can upload to any cooperative
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  )
);

-- Policy 3: UPDATE - Prevent updates (receipts should be immutable)
CREATE POLICY "Prevent receipt updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (false);

-- Policy 4: DELETE - Only admins can delete receipts
CREATE POLICY "Only admins can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'collection-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
