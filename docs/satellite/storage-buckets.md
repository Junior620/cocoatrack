# Satellite Imagery Storage Buckets

This document describes the Supabase Storage buckets used for the satellite imagery analysis feature.

## Overview

The satellite imagery feature uses four dedicated storage buckets to manage different types of files with appropriate retention policies and access controls.

## Buckets

### 1. satellite-imagery

**Purpose**: Store raw satellite imagery tiles and Sentinel-2 data

**Configuration**:
- **Privacy**: Private
- **Retention**: 90 days
- **File Size Limit**: 50MB per file
- **Allowed MIME Types**: 
  - `image/tiff`
  - `image/geotiff`
  - `image/png`
  - `image/jpeg`
  - `application/json`

**Path Structure**: `{parcelle_id}/{filename}`

**Access Control**:
- **Read**: Users with access to the parcelle (cooperative managers, agronomists, planteurs, admins)
- **Write**: Service role and internal app only

### 2. ndvi-rasters

**Purpose**: Store calculated NDVI raster images and visualization overlays

**Configuration**:
- **Privacy**: Private
- **Retention**: 30 days
- **File Size Limit**: 20MB per file
- **Allowed MIME Types**:
  - `image/tiff`
  - `image/geotiff`
  - `image/png`
  - `application/json`

**Path Structure**: `{parcelle_id}/{filename}`

**Access Control**:
- **Read**: Users with access to the parcelle
- **Write**: Service role and internal app only

### 3. kml-exports

**Purpose**: Store user-generated KML/KMZ export files

**Configuration**:
- **Privacy**: Private
- **Retention**: 7 days
- **File Size Limit**: 10MB per file
- **Allowed MIME Types**:
  - `application/vnd.google-earth.kml+xml`
  - `application/vnd.google-earth.kmz`
  - `application/xml`
  - `text/xml`

**Path Structure**: `{user_id}/{filename}`

**Access Control**:
- **Read**: File owner and admins
- **Write**: Authenticated users (own folder only)
- **Delete**: File owner and admins

### 4. certification-reports

**Purpose**: Store EUDR compliance and certification reports

**Configuration**:
- **Privacy**: Private
- **Retention**: 1 year
- **File Size Limit**: 100MB per file
- **Allowed MIME Types**:
  - `application/pdf`
  - `application/zip`

**Path Structure**: `{parcelle_id}/{filename}`

**Access Control**:
- **Read**: Users with access to the parcelle, certification auditors
- **Write**: Service role, internal app, certification auditors, admins
- **Manage**: Service role and internal app

## Retention Policies

Automatic cleanup functions are provided to enforce retention policies:

### Cleanup Functions

1. **cleanup_old_satellite_imagery()** - Runs daily, deletes files older than 90 days
2. **cleanup_old_ndvi_rasters()** - Runs daily, deletes files older than 30 days
3. **cleanup_old_kml_exports()** - Runs daily, deletes files older than 7 days
4. **cleanup_old_certification_reports()** - Runs monthly, deletes files older than 1 year

### Setting Up Automated Cleanup

To automate cleanup, set up cron jobs or scheduled functions in Supabase:

```sql
-- Example: Schedule daily cleanup (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-satellite-imagery',
  '0 2 * * *', -- Run at 2 AM daily
  $$SELECT cleanup_old_satellite_imagery()$$
);

SELECT cron.schedule(
  'cleanup-ndvi-rasters',
  '0 2 * * *',
  $$SELECT cleanup_old_ndvi_rasters()$$
);

SELECT cron.schedule(
  'cleanup-kml-exports',
  '0 2 * * *',
  $$SELECT cleanup_old_kml_exports()$$
);

SELECT cron.schedule(
  'cleanup-certification-reports',
  '0 3 1 * *', -- Run at 3 AM on the 1st of each month
  $$SELECT cleanup_old_certification_reports()$$
);
```

## Usage Examples

### Uploading Satellite Imagery (Backend)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key
);

async function uploadSatelliteImagery(
  parcelleId: string,
  imageData: Buffer,
  filename: string
) {
  const path = `${parcelleId}/${filename}`;
  
  const { data, error } = await supabase.storage
    .from('satellite-imagery')
    .upload(path, imageData, {
      contentType: 'image/tiff',
      upsert: false
    });
    
  if (error) throw error;
  return data;
}
```

### Retrieving Satellite Imagery (Frontend)

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

async function getSatelliteImageryUrl(
  parcelleId: string,
  filename: string
): Promise<string> {
  const path = `${parcelleId}/${filename}`;
  
  const { data } = await supabase.storage
    .from('satellite-imagery')
    .createSignedUrl(path, 3600); // 1 hour expiry
    
  return data?.signedUrl || '';
}
```

### Exporting KML (Frontend)

```typescript
async function exportKML(
  userId: string,
  kmlContent: string,
  filename: string
) {
  const path = `${userId}/${filename}`;
  const blob = new Blob([kmlContent], { 
    type: 'application/vnd.google-earth.kml+xml' 
  });
  
  const { data, error } = await supabase.storage
    .from('kml-exports')
    .upload(path, blob, {
      contentType: 'application/vnd.google-earth.kml+xml',
      upsert: true
    });
    
  if (error) throw error;
  
  // Get download URL
  const { data: urlData } = await supabase.storage
    .from('kml-exports')
    .createSignedUrl(path, 604800); // 7 days (matches retention)
    
  return urlData?.signedUrl;
}
```

## Storage Monitoring

### Check Bucket Usage

```sql
-- Get total storage used per bucket
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id IN (
  'satellite-imagery',
  'ndvi-rasters', 
  'kml-exports',
  'certification-reports'
)
GROUP BY bucket_id;
```

### Check Files Pending Cleanup

```sql
-- Files in satellite-imagery older than 90 days
SELECT 
  name,
  created_at,
  AGE(NOW(), created_at) as age
FROM storage.objects
WHERE bucket_id = 'satellite-imagery'
  AND created_at < NOW() - INTERVAL '90 days'
ORDER BY created_at;
```

## Troubleshooting

### Issue: Upload fails with "Policy violation"

**Solution**: Ensure you're using the service role key for backend uploads, not the anon key.

### Issue: Users can't access imagery for their parcelles

**Solution**: Verify the user has the correct role and parcelle access in the `parcelles` table and `parcelle_assignments` table.

### Issue: Storage bucket not found

**Solution**: Run the migration to create the buckets:
```bash
supabase db push
```

### Issue: Files not being cleaned up automatically

**Solution**: Verify cron jobs are set up correctly or manually run cleanup functions:
```sql
SELECT cleanup_old_satellite_imagery();
SELECT cleanup_old_ndvi_rasters();
SELECT cleanup_old_kml_exports();
SELECT cleanup_old_certification_reports();
```

## Security Considerations

1. **Never expose service role key** in frontend code
2. **Use signed URLs** with appropriate expiry times for temporary access
3. **Validate file types** before upload to prevent malicious files
4. **Monitor storage usage** to prevent abuse
5. **Audit access logs** regularly for suspicious activity

## Migration

The storage buckets are created by running the migration:

```bash
supabase db push
```

Or apply the specific migration:

```bash
supabase migration up 20260503000007_create_satellite_storage_buckets
```

## Related Documentation

- [Satellite Imagery Setup](./gee-setup.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [API Documentation](../api/satellite.md)
