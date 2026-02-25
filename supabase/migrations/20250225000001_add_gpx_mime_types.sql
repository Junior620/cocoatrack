-- CocoaTrack V2 - Add GPX support to parcelle imports
-- Adds support for GPX (GPS eXchange Format) file uploads
-- 
-- GPX files can have various MIME types:
-- - application/gpx+xml (standard)
-- - application/xml (generic XML)
-- - text/xml (text-based XML)
-- - application/octet-stream (binary fallback)

-- ============================================================================
-- STEP 1: Update file_type CHECK constraint to include 'gpx'
-- ============================================================================
ALTER TABLE public.parcel_import_files
  DROP CONSTRAINT IF EXISTS parcel_import_files_file_type_check;

ALTER TABLE public.parcel_import_files
  ADD CONSTRAINT parcel_import_files_file_type_check
  CHECK (file_type IN ('shapefile_zip', 'kml', 'kmz', 'geojson', 'gpx'));

-- ============================================================================
-- STEP 2: Update source CHECK constraint in parcelles table to include 'gpx'
-- ============================================================================
ALTER TABLE public.parcelles
  DROP CONSTRAINT IF EXISTS parcelles_source_check;

ALTER TABLE public.parcelles
  ADD CONSTRAINT parcelles_source_check
  CHECK (source IN ('manual', 'shapefile', 'kml', 'geojson', 'gpx'));

-- ============================================================================
-- STEP 3: Update the parcelle-imports bucket to allow GPX MIME types
-- ============================================================================
-- Note: This requires supabase_storage_admin role
DO $$
BEGIN
  -- Check if the bucket exists
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'parcelle-imports'
  ) THEN
    -- Update allowed MIME types to include GPX formats
    -- The allowed_mime_types column is a text array
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz',
      'application/geo+json',
      'application/json',
      'application/gpx+xml',
      'application/xml',
      'text/xml',
      'application/octet-stream'
    ]
    WHERE id = 'parcelle-imports';
    
    RAISE NOTICE 'Updated parcelle-imports bucket to allow GPX MIME types';
  ELSE
    RAISE NOTICE 'Bucket parcelle-imports does not exist - skipping MIME type update';
  END IF;
END $$;

