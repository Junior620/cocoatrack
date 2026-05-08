-- Migration: Update Satellite Imagery Storage Bucket MIME Types
-- Description: Add support for KML/KMZ and other satellite data formats
-- Date: 2026-05-08

-- Update the satellite-imagery bucket to support additional MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/geotiff',
  'text/xml',
  'application/xml',
  'application/vnd.google-earth.kml+xml',
  'application/vnd.google-earth.kmz',
  'application/json',
  'application/geo+json',
  'text/csv',
  'application/pdf'
]::text[]
WHERE id = 'satellite-imagery';

-- Increase file size limit to 50MB to accommodate larger exports
UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50MB
WHERE id = 'satellite-imagery';
