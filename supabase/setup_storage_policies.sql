-- CocoaTrack V2 - Storage Policies Setup for invoice-scans bucket
-- 
-- This script creates the storage policies for the invoice-scans bucket.
-- Run this in the Supabase SQL Editor after creating the bucket.
--
-- IMPORTANT: The bucket 'invoice-scans' must be created first via the dashboard:
--   - Name: invoice-scans
--   - Public: false (private)
--   - File size limit: 10MB (10485760 bytes)

-- ============================================================================
-- CLEANUP (Optional - only if you need to recreate the policies)
-- ============================================================================

-- Uncomment these lines if you need to drop existing policies:
-- DROP POLICY IF EXISTS "Allow authenticated users to upload to their cooperative folder" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated users to download from their cooperative folder" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow only admins to delete files" ON storage.objects;

-- ============================================================================
-- POLICY 1: UPLOAD (INSERT)
-- ============================================================================

-- This policy allows authenticated users (managers and admins) to upload files
-- to the invoice-scans bucket, but only to folders within their cooperative.
--
-- Path structure: {cooperative_id}/{invoice_id}/{uuid}_{filename}
--
-- Requirements: 5.1, 5.5, 7.2

CREATE POLICY "Allow authenticated users to upload to their cooperative folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-scans'
  AND (storage.foldername(name))[1] IN (
    SELECT cooperative_id::text
    FROM public.invoices
    WHERE id = (storage.foldername(name))[2]::uuid
    AND (
      public.is_admin()
      OR public.can_access_cooperative(cooperative_id)
    )
  )
);

COMMENT ON POLICY "Allow authenticated users to upload to their cooperative folder" ON storage.objects IS
  'Allows managers and admins to upload scanned invoices to their cooperative folder';

-- ============================================================================
-- POLICY 2: DOWNLOAD (SELECT)
-- ============================================================================

-- This policy allows authenticated users (managers and admins) to download files
-- from the invoice-scans bucket, but only from folders within their cooperative.
--
-- Requirements: 4.1, 5.2, 5.5

CREATE POLICY "Allow authenticated users to download from their cooperative folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-scans'
  AND (storage.foldername(name))[1] IN (
    SELECT cooperative_id::text
    FROM public.invoices
    WHERE id = (storage.foldername(name))[2]::uuid
    AND (
      public.is_admin()
      OR public.can_access_cooperative(cooperative_id)
    )
  )
);

COMMENT ON POLICY "Allow authenticated users to download from their cooperative folder" ON storage.objects IS
  'Allows managers and admins to download scanned invoices from their cooperative folder';

-- ============================================================================
-- POLICY 3: DELETE (DELETE)
-- ============================================================================

-- This policy allows only admins to delete files from the invoice-scans bucket.
-- Managers cannot delete files, only admins can.
--
-- Requirements: 6.1

CREATE POLICY "Allow only admins to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-scans'
  AND public.is_admin()
);

COMMENT ON POLICY "Allow only admins to delete files" ON storage.objects IS
  'Allows only admins to delete scanned invoices';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify that the policies were created successfully
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'INSERT' THEN 'Upload'
    WHEN cmd = 'SELECT' THEN 'Download'
    WHEN cmd = 'DELETE' THEN 'Delete'
    ELSE cmd
  END as description
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Allow authenticated users to upload to their cooperative folder',
    'Allow authenticated users to download from their cooperative folder',
    'Allow only admins to delete files'
  )
ORDER BY cmd;

-- Expected output:
-- ┌────────────────────────────────────────────────────────────┬───────────┬─────────────┐
-- │ policyname                                                 │ operation │ description │
-- ├────────────────────────────────────────────────────────────┼───────────┼─────────────┤
-- │ Allow only admins to delete files                          │ DELETE    │ Delete      │
-- │ Allow authenticated users to upload to their cooperativ... │ INSERT    │ Upload      │
-- │ Allow authenticated users to download from their cooper... │ SELECT    │ Download    │
-- └────────────────────────────────────────────────────────────┴───────────┴─────────────┘

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. These policies work in conjunction with the RLS policies on the
--    scanned_invoices table to provide defense in depth.
--
-- 2. The policies use the storage.foldername() function to extract the
--    cooperative_id and invoice_id from the file path.
--
-- 3. The policies rely on the following helper functions:
--    - public.is_admin(): Returns true if the current user is an admin
--    - public.can_access_cooperative(uuid): Returns true if the current user
--      has access to the specified cooperative
--
-- 4. If these helper functions don't exist, you need to create them first.
--    They should already exist if you've applied the previous migrations.
--
-- 5. The bucket 'invoice-scans' must be created manually via the Supabase
--    dashboard before running this script.

-- ============================================================================
-- TESTING
-- ============================================================================

-- To test the policies, you can use the following SQL queries:

-- Test 1: Check if a user can upload to their cooperative folder
-- (Replace USER_ID and COOPERATIVE_ID with actual values)
/*
SELECT 
  public.is_admin() as is_admin,
  public.can_access_cooperative('COOPERATIVE_ID'::uuid) as can_access
FROM auth.users
WHERE id = 'USER_ID'::uuid;
*/

-- Test 2: List all storage policies for the invoice-scans bucket
/*
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual::text LIKE '%invoice-scans%' OR with_check::text LIKE '%invoice-scans%')
ORDER BY policyname;
*/

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you get an error like "function storage.foldername does not exist",
-- it means the storage schema is not properly set up. This should not happen
-- in a standard Supabase project.

-- If you get an error like "function public.is_admin does not exist",
-- you need to create the helper functions first. Check your previous migrations.

-- If uploads/downloads fail with "new row violates row-level security policy",
-- check that:
-- 1. The user is authenticated
-- 2. The user has the correct role (manager or admin)
-- 3. The user has access to the cooperative
-- 4. The file path follows the correct structure: {cooperative_id}/{invoice_id}/{filename}

