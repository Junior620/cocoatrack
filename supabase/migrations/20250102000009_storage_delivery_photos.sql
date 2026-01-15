-- CocoaTrack V2 - Storage Configuration for Delivery Photos
-- Creates the delivery-photos bucket and storage policies

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Note: Bucket creation is typically done via Supabase dashboard or CLI
-- This migration documents the expected configuration

-- Bucket: delivery-photos
-- Public: false (private)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy: Agents and above can upload photos
-- Path convention: {cooperative_id}/{delivery_id}/{uuid}.{ext}
CREATE POLICY "delivery_photos_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos'
  AND public.is_agent_or_above()
  -- Path must start with user's cooperative_id
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- Policy: Users can view photos in their scope
CREATE POLICY "delivery_photos_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-photos'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- Policy: Managers and above can delete photos
CREATE POLICY "delivery_photos_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-photos'
  AND public.is_manager_or_above()
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text
  )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "delivery_photos_insert_policy" ON storage.objects IS 
  'Agents and above can upload photos to their cooperative folder';

COMMENT ON POLICY "delivery_photos_select_policy" ON storage.objects IS 
  'Users can view photos in their cooperative scope';

COMMENT ON POLICY "delivery_photos_delete_policy" ON storage.objects IS 
  'Managers and above can delete photos in their cooperative scope';
