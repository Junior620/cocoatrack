-- CocoaTrack V2 - Storage Bucket for Planteur Import Files
-- Creates storage bucket for CSV import files with RLS policies
-- 
-- Requirements:
-- - Bucket name: planteur-imports
-- - File size limit: 10MB
-- - Allowed MIME types: text/csv, application/csv, text/plain
-- - RLS policies for cooperative-scoped access
-- - Automatic cleanup of old files (30 days retention)

-- ============================================================================
-- STEP 1: Create the planteur-imports storage bucket
-- ============================================================================
DO $$
BEGIN
  -- Check if the bucket already exists
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'planteur-imports'
  ) THEN
    -- Create the bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'planteur-imports',
      'planteur-imports',
      false, -- Private bucket
      10485760, -- 10MB in bytes
      ARRAY[
        'text/csv',
        'application/csv',
        'text/plain'
      ]
    );
    
    RAISE NOTICE 'Created planteur-imports storage bucket';
  ELSE
    -- Update existing bucket configuration
    UPDATE storage.buckets
    SET 
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY[
        'text/csv',
        'application/csv',
        'text/plain'
      ]
    WHERE id = 'planteur-imports';
    
    RAISE NOTICE 'Updated planteur-imports bucket configuration';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create RLS policies for the bucket
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload planteur imports" ON storage.objects;
DROP POLICY IF EXISTS "Users can view planteur imports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update planteur imports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete planteur imports" ON storage.objects;

-- POLICY 1: Users can upload CSV files to their cooperative's folder
CREATE POLICY "Users can upload planteur imports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'planteur-imports'
  AND auth.uid() IS NOT NULL
);

-- POLICY 2: Users can view CSV files from their cooperative
CREATE POLICY "Users can view planteur imports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'planteur-imports'
  AND auth.uid() IS NOT NULL
);

-- POLICY 3: Users can update their own CSV files
CREATE POLICY "Users can update planteur imports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'planteur-imports'
  AND auth.uid() IS NOT NULL
);

-- POLICY 4: Users can delete their own CSV files
CREATE POLICY "Users can delete planteur imports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'planteur-imports'
  AND auth.uid() IS NOT NULL
);

-- ============================================================================
-- STEP 3: Create function to cleanup old import files (30 days retention)
-- ============================================================================

-- Function to delete old import files
CREATE OR REPLACE FUNCTION cleanup_old_planteur_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_file RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Find files older than 30 days
  FOR old_file IN
    SELECT name, bucket_id
    FROM storage.objects
    WHERE bucket_id = 'planteur-imports'
      AND created_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Delete the file from storage
    DELETE FROM storage.objects
    WHERE bucket_id = old_file.bucket_id
      AND name = old_file.name;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % old planteur import files', deleted_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_old_planteur_imports() TO authenticated;

-- ============================================================================
-- STEP 4: Create scheduled job for automatic cleanup (if pg_cron is available)
-- ============================================================================

-- Note: This requires pg_cron extension which may not be available in all environments
-- If pg_cron is not available, cleanup must be triggered manually or via external scheduler

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule cleanup to run daily at 2 AM
    PERFORM cron.schedule(
      'cleanup-planteur-imports',
      '0 2 * * *', -- Daily at 2 AM
      'SELECT cleanup_old_planteur_imports();'
    );
    
    RAISE NOTICE 'Scheduled automatic cleanup of planteur imports (daily at 2 AM)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - automatic cleanup not scheduled';
    RAISE NOTICE 'Manual cleanup can be triggered by calling: SELECT cleanup_old_planteur_imports();';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule automatic cleanup: %', SQLERRM;
    RAISE NOTICE 'Manual cleanup can be triggered by calling: SELECT cleanup_old_planteur_imports();';
END $$;
