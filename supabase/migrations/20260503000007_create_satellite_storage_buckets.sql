-- Migration: Create Supabase Storage buckets for satellite imagery feature
-- Created: 2026-05-03
-- Description: Creates storage buckets for satellite imagery, NDVI rasters, KML exports, and certification reports

-- Create satellite-imagery bucket (private, 90-day retention)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'satellite-imagery',
  'satellite-imagery',
  false,
  52428800, -- 50MB limit per file
  ARRAY['image/tiff', 'image/geotiff', 'image/png', 'image/jpeg', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Create ndvi-rasters bucket (private, 30-day retention)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ndvi-rasters',
  'ndvi-rasters',
  false,
  20971520, -- 20MB limit per file
  ARRAY['image/tiff', 'image/geotiff', 'image/png', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Create kml-exports bucket (private, 7-day retention)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kml-exports',
  'kml-exports',
  false,
  10485760, -- 10MB limit per file
  ARRAY['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', 'application/xml', 'text/xml']
)
ON CONFLICT (id) DO NOTHING;

-- Create certification-reports bucket (private, 1-year retention)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certification-reports',
  'certification-reports',
  false,
  104857600, -- 100MB limit per file
  ARRAY['application/pdf', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy: Users can read satellite imagery for parcelles they have access to
CREATE POLICY "Users can read satellite imagery for accessible parcelles"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'satellite-imagery'
  AND auth.role() = 'authenticated'
  AND (
    -- Extract parcelle_id from path (format: parcelle_id/filename)
    (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM parcelles p
      LEFT JOIN planteurs pl ON pl.id = p.planteur_id
      WHERE (
        -- Users can access parcelles in their cooperative (via planteur)
        EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
          AND pr.cooperative_id = pl.cooperative_id
        )
        -- Planteurs can access their own parcelles
        OR p.planteur_id = auth.uid()
        -- Admins and internal app can access all
        OR auth.jwt() ->> 'role' IN ('admin', 'internal_app')
      )
    )
  )
);

-- Policy: Service role can insert satellite imagery
CREATE POLICY "Service role can insert satellite imagery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'satellite-imagery'
  AND (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'internal_app')
);

-- Policy: Service role can update satellite imagery
CREATE POLICY "Service role can update satellite imagery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'satellite-imagery'
  AND (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'internal_app')
);

-- Policy: Service role can delete satellite imagery
CREATE POLICY "Service role can delete satellite imagery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'satellite-imagery'
  AND (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'internal_app')
);

-- ============================================================================
-- NDVI RASTERS POLICIES
-- ============================================================================

-- Policy: Users can read NDVI rasters for accessible parcelles
CREATE POLICY "Users can read NDVI rasters for accessible parcelles"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ndvi-rasters'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM parcelles p
      LEFT JOIN planteurs pl ON pl.id = p.planteur_id
      WHERE (
        -- Users can access parcelles in their cooperative (via planteur)
        EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
          AND pr.cooperative_id = pl.cooperative_id
        )
        -- Planteurs can access their own parcelles
        OR p.planteur_id = auth.uid()
        -- Admins and internal app can access all
        OR auth.jwt() ->> 'role' IN ('admin', 'internal_app')
      )
    )
  )
);

-- Policy: Service role can manage NDVI rasters
CREATE POLICY "Service role can manage NDVI rasters"
ON storage.objects FOR ALL
USING (
  bucket_id = 'ndvi-rasters'
  AND (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'internal_app')
);

-- ============================================================================
-- KML EXPORTS POLICIES
-- ============================================================================

-- Policy: Users can read their own KML exports
CREATE POLICY "Users can read their own KML exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kml-exports'
  AND auth.role() = 'authenticated'
  AND (
    -- Path format: user_id/filename
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.jwt() ->> 'role' IN ('admin', 'internal_app')
  )
);

-- Policy: Authenticated users can create KML exports
CREATE POLICY "Authenticated users can create KML exports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kml-exports'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own KML exports
CREATE POLICY "Users can delete their own KML exports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kml-exports'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.jwt() ->> 'role' IN ('admin', 'internal_app')
  )
);

-- ============================================================================
-- CERTIFICATION REPORTS POLICIES
-- ============================================================================

-- Policy: Users can read certification reports for accessible parcelles
CREATE POLICY "Users can read certification reports for accessible parcelles"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM parcelles p
      LEFT JOIN planteurs pl ON pl.id = p.planteur_id
      WHERE (
        -- Users can access parcelles in their cooperative (via planteur)
        EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
          AND pr.cooperative_id = pl.cooperative_id
        )
        -- Planteurs can access their own parcelles
        OR p.planteur_id = auth.uid()
        -- Admins, internal app, and certification auditors can access all
        OR auth.jwt() ->> 'role' IN ('admin', 'internal_app', 'certification_auditor')
      )
    )
  )
);

-- Policy: Service role and auditors can create certification reports
CREATE POLICY "Service role and auditors can create certification reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
  AND auth.jwt() ->> 'role' IN ('service_role', 'internal_app', 'certification_auditor', 'admin')
);

-- Policy: Service role can manage certification reports
CREATE POLICY "Service role can manage certification reports"
ON storage.objects FOR ALL
USING (
  bucket_id = 'certification-reports'
  AND (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'internal_app')
);

-- ============================================================================
-- CLEANUP FUNCTIONS FOR RETENTION POLICIES
-- ============================================================================

-- Function to clean up old satellite imagery (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_satellite_imagery()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'satellite-imagery'
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Function to clean up old NDVI rasters (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_ndvi_rasters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'ndvi-rasters'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to clean up old KML exports (7-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_kml_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'kml-exports'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Function to clean up old certification reports (1-year retention)
CREATE OR REPLACE FUNCTION cleanup_old_certification_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'certification-reports'
    AND created_at < NOW() - INTERVAL '1 year';
END;
$$;

-- Grant execute permissions on cleanup functions
GRANT EXECUTE ON FUNCTION cleanup_old_satellite_imagery() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_ndvi_rasters() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_kml_exports() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_certification_reports() TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cleanup_old_satellite_imagery() IS 
'Deletes satellite imagery files older than 90 days. Should be run daily via cron job.';

COMMENT ON FUNCTION cleanup_old_ndvi_rasters() IS 
'Deletes NDVI raster files older than 30 days. Should be run daily via cron job.';

COMMENT ON FUNCTION cleanup_old_kml_exports() IS 
'Deletes KML export files older than 7 days. Should be run daily via cron job.';

COMMENT ON FUNCTION cleanup_old_certification_reports() IS 
'Deletes certification report files older than 1 year. Should be run monthly via cron job.';
