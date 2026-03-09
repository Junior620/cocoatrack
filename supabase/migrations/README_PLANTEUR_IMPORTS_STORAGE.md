# Planteur Imports Storage Bucket Setup

## Overview

This document describes the storage bucket configuration for the planteur CSV import feature.

## Migration File

**File:** `20260308000002_storage_planteur_imports.sql`

This migration creates:
1. Storage bucket named `planteur-imports`
2. RLS policies for authenticated users
3. Cleanup function for old files (30-day retention)
4. Scheduled job for automatic cleanup (if pg_cron is available)

## Bucket Configuration

- **Name:** `planteur-imports`
- **Public:** `false` (private bucket)
- **File Size Limit:** 10MB (10,485,760 bytes)
- **Allowed MIME Types:**
  - `text/csv`
  - `application/csv`
  - `text/plain`

## RLS Policies

The migration creates four policies for authenticated users:

1. **Upload Policy:** Users can upload CSV files
2. **Select Policy:** Users can view CSV files
3. **Update Policy:** Users can update CSV files
4. **Delete Policy:** Users can delete CSV files

All policies require:
- `bucket_id = 'planteur-imports'`
- `auth.uid() IS NOT NULL` (authenticated user)

## Automatic Cleanup

### Cleanup Function

The migration creates a function `cleanup_old_planteur_imports()` that:
- Deletes files older than 30 days
- Can be called manually: `SELECT cleanup_old_planteur_imports();`
- Returns void and logs the number of deleted files

### Scheduled Cleanup (Optional)

If the `pg_cron` extension is available, the migration schedules automatic cleanup:
- **Schedule:** Daily at 2:00 AM
- **Job Name:** `cleanup-planteur-imports`
- **Command:** `SELECT cleanup_old_planteur_imports();`

If `pg_cron` is not available, the migration will log a notice and skip scheduling.

## Running the Migration

### Automatic (Recommended)

The migration will run automatically when you:

```bash
# Reset the database (runs all migrations)
npm run db:reset

# Or run pending migrations only
npm run db:migrate
```

### Manual Setup (If Migration Fails)

If the migration fails due to permissions or other issues, you can set up the bucket manually:

1. **Go to Supabase Dashboard** → Storage
2. **Create Bucket:**
   - Name: `planteur-imports`
   - Public: No (private)
   - File size limit: 10485760 (10MB)
   - Allowed MIME types: `text/csv`, `application/csv`, `text/plain`

3. **Create Policies** (Storage → Policies):

   **Policy 1: Upload**
   ```sql
   CREATE POLICY "Users can upload planteur imports"
   ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (bucket_id = 'planteur-imports' AND auth.uid() IS NOT NULL);
   ```

   **Policy 2: Select**
   ```sql
   CREATE POLICY "Users can view planteur imports"
   ON storage.objects FOR SELECT TO authenticated
   USING (bucket_id = 'planteur-imports' AND auth.uid() IS NOT NULL);
   ```

   **Policy 3: Update**
   ```sql
   CREATE POLICY "Users can update planteur imports"
   ON storage.objects FOR UPDATE TO authenticated
   USING (bucket_id = 'planteur-imports' AND auth.uid() IS NOT NULL);
   ```

   **Policy 4: Delete**
   ```sql
   CREATE POLICY "Users can delete planteur imports"
   ON storage.objects FOR DELETE TO authenticated
   USING (bucket_id = 'planteur-imports' AND auth.uid() IS NOT NULL);
   ```

4. **Create Cleanup Function** (SQL Editor):
   ```sql
   CREATE OR REPLACE FUNCTION cleanup_old_planteur_imports()
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     old_file RECORD;
     deleted_count INTEGER := 0;
   BEGIN
     FOR old_file IN
       SELECT name, bucket_id
       FROM storage.objects
       WHERE bucket_id = 'planteur-imports'
         AND created_at < NOW() - INTERVAL '30 days'
     LOOP
       DELETE FROM storage.objects
       WHERE bucket_id = old_file.bucket_id
         AND name = old_file.name;
       
       deleted_count := deleted_count + 1;
     END LOOP;
     
     RAISE NOTICE 'Cleaned up % old planteur import files', deleted_count;
   END;
   $$;

   GRANT EXECUTE ON FUNCTION cleanup_old_planteur_imports() TO authenticated;
   ```

## Verification

To verify the bucket is set up correctly:

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'planteur-imports';

-- Check policies exist
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%planteur imports%';

-- Check cleanup function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'cleanup_old_planteur_imports';
```

## Troubleshooting

### Issue: Bucket creation fails

**Cause:** Insufficient permissions or bucket already exists

**Solution:** 
- Check if bucket already exists in Supabase Dashboard
- Verify database user has permissions to create storage buckets
- Try manual setup (see above)

### Issue: Policies not created

**Cause:** RLS not enabled on storage.objects or permission issues

**Solution:**
- Ensure RLS is enabled: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`
- Create policies manually (see above)

### Issue: Cleanup function not scheduled

**Cause:** pg_cron extension not available

**Solution:**
- This is expected in most Supabase hosted environments
- Set up external scheduler (cron job, GitHub Actions, etc.) to call the function
- Or trigger cleanup manually when needed

## Maintenance

### Manual Cleanup

To manually trigger cleanup of old files:

```sql
SELECT cleanup_old_planteur_imports();
```

### Check Old Files

To see files that will be deleted:

```sql
SELECT name, created_at, 
       NOW() - created_at AS age
FROM storage.objects
WHERE bucket_id = 'planteur-imports'
  AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at;
```

### Adjust Retention Period

To change the 30-day retention period, modify the cleanup function:

```sql
CREATE OR REPLACE FUNCTION cleanup_old_planteur_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_file RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR old_file IN
    SELECT name, bucket_id
    FROM storage.objects
    WHERE bucket_id = 'planteur-imports'
      AND created_at < NOW() - INTERVAL '60 days' -- Changed from 30 to 60 days
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = old_file.bucket_id
      AND name = old_file.name;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % old planteur import files', deleted_count;
END;
$$;
```

## Related Files

- Migration: `v2/supabase/migrations/20260308000002_storage_planteur_imports.sql`
- Import Files Table: `v2/supabase/migrations/20260308000001_planteur_import_files.sql`
- API Upload Endpoint: `v2/app/api/planteurs/import/upload/route.ts`
- Design Document: `.kiro/specs/planteurs-csv-import/design.md`
