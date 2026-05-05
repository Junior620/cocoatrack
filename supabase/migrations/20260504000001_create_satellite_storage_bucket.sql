-- Migration: Create Satellite Imagery Storage Bucket
-- Description: Creates a public storage bucket for satellite imagery artifacts (NDVI rasters, legends, etc.)
-- Date: 2026-05-04
-- Note: This migration only creates the bucket. Policies must be created via Supabase Dashboard.

-- ============================================================================
-- Create Storage Bucket
-- ============================================================================

-- Create public bucket for satellite imagery
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'satellite-imagery',
  'satellite-imagery',
  true, -- Public bucket for easy access
  10485760, -- 10MB file size limit
  ARRAY['image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- IMPORTANT: Manual Policy Setup Required
-- ============================================================================
-- 
-- The storage policies cannot be created via SQL due to permission restrictions.
-- Please create the following policies manually via Supabase Dashboard:
-- 
-- 1. Go to Storage → satellite-imagery → Policies
-- 
-- 2. Create policy for INSERT (Upload):
--    - Name: "Allow authenticated users to upload"
--    - Operation: INSERT
--    - Target roles: authenticated
--    - Policy definition: bucket_id = 'satellite-imagery'
-- 
-- 3. Create policy for UPDATE:
--    - Name: "Allow authenticated users to update"
--    - Operation: UPDATE
--    - Target roles: authenticated
--    - Policy definition: bucket_id = 'satellite-imagery'
-- 
-- 4. Create policy for DELETE:
--    - Name: "Allow authenticated users to delete"
--    - Operation: DELETE
--    - Target roles: authenticated
--    - Policy definition: bucket_id = 'satellite-imagery'
-- 
-- 5. Public read access should be automatically enabled for public buckets.
--    If not, create a SELECT policy:
--    - Name: "Allow public read access"
--    - Operation: SELECT
--    - Target roles: public
--    - Policy definition: bucket_id = 'satellite-imagery'
-- 
-- ============================================================================
