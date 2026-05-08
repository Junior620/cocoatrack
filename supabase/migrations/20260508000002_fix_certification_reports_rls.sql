-- Migration: Fix certification-reports bucket RLS policies
-- Description: Allow authenticated users to upload certification reports
-- Date: 2026-05-08
-- Note: Run this in Supabase Dashboard SQL Editor with elevated permissions

BEGIN;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Service role and auditors can create certification reports" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage certification reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read certification reports" ON storage.objects;

-- Policy: Authenticated users can upload certification reports
-- This allows any authenticated user to generate reports for parcelles they have access to
-- Access control is handled at the API level
CREATE POLICY "Authenticated users can upload certification reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);

-- Policy: Users can read certification reports
-- Reports are accessible via signed URLs with expiration
CREATE POLICY "Users can read certification reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can update their certification reports
CREATE POLICY "Users can update certification reports"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete certification reports
CREATE POLICY "Users can delete certification reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);

COMMIT;
