-- ============================================================================
-- Fix scanned_invoices RLS and storage policies
-- ============================================================================
-- Problem 1: created_by references auth.users instead of public.profiles
-- Problem 2: Storage bucket policies not created
--
-- Solution: 
-- 1. Change foreign key to reference profiles
-- 2. Create storage bucket and policies
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE public.scanned_invoices 
  DROP CONSTRAINT IF EXISTS scanned_invoices_created_by_fkey;

-- Add new foreign key constraint to profiles
ALTER TABLE public.scanned_invoices 
  ADD CONSTRAINT scanned_invoices_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES public.profiles(id);

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create invoice-scans bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-scans',
  'invoice-scans',
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "invoice_scans_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "invoice_scans_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "invoice_scans_delete_policy" ON storage.objects;

-- Policy 1: Upload (INSERT)
-- Managers and admins can upload files for invoices in their scope
CREATE POLICY "invoice_scans_upload_policy" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-scans'
    AND (
      public.is_admin()
      OR (
        public.is_manager_or_above()
        AND EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE (storage.foldername(name))[2]::uuid = i.id
          AND public.can_access_cooperative(i.cooperative_id)
        )
      )
    )
  );

-- Policy 2: Download (SELECT)
-- Managers and admins can download files for invoices in their scope
CREATE POLICY "invoice_scans_select_policy" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoice-scans'
    AND (
      public.is_admin()
      OR (
        public.is_manager_or_above()
        AND EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE (storage.foldername(name))[2]::uuid = i.id
          AND public.can_access_cooperative(i.cooperative_id)
        )
      )
    )
  );

-- Policy 3: Delete (DELETE)
-- Only admins can delete files
CREATE POLICY "invoice_scans_delete_policy" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'invoice-scans'
    AND public.is_admin()
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT scanned_invoices_created_by_fkey ON public.scanned_invoices IS 
  'References profiles table for user information';
