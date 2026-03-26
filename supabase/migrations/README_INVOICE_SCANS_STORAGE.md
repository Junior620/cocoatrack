# Invoice Scans Storage Bucket Configuration

## Overview

This document describes the manual configuration steps required for the `invoice-scans` storage bucket in Supabase.

## Bucket Creation

The `invoice-scans` bucket must be created manually via the Supabase dashboard or API with the following configuration:

### Bucket Settings

- **Bucket name**: `invoice-scans`
- **Public**: `false` (private bucket)
- **File size limit**: `10MB` (10485760 bytes)
- **Allowed MIME types**: 
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`

## Storage Path Structure

Files are organized using the following path structure:

```
invoice-scans/
  {cooperative_id}/
    {invoice_id}/
      {uuid}_{original_filename}
```

Example:
```
invoice-scans/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    f1e2d3c4-b5a6-7890-cdef-123456789abc/
      550e8400-e29b-41d4-a716-446655440000_facture_scan.pdf
      660e8400-e29b-41d4-a716-446655440001_photo_facture.jpg
```

## Storage Policies

The following RLS policies must be configured manually in the Supabase dashboard:

### Policy 1: Upload (INSERT)

**Name**: `Managers can upload invoice scans`

**Operation**: `INSERT`

**Target roles**: `authenticated`

**WITH CHECK expression**:
```sql
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
```

### Policy 2: Download (SELECT)

**Name**: `Managers can view invoice scans`

**Operation**: `SELECT`

**Target roles**: `authenticated`

**USING expression**:
```sql
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
```

### Policy 3: Delete (DELETE)

**Name**: `Admins can delete invoice scans`

**Operation**: `DELETE`

**Target roles**: `authenticated`

**USING expression**:
```sql
bucket_id = 'invoice-scans'
AND public.is_admin()
```

## Configuration Steps

1. **Create the bucket**:
   - Go to Supabase Dashboard → Storage
   - Click "New bucket"
   - Name: `invoice-scans`
   - Set as private (uncheck "Public bucket")
   - Set file size limit to 10MB
   - Configure allowed MIME types

2. **Configure policies**:
   - Go to the `invoice-scans` bucket
   - Click "Policies" tab
   - Add the three policies listed above using the "New policy" button
   - For each policy, select the operation type and paste the corresponding SQL expression

3. **Verify configuration**:
   - Test upload with a manager account
   - Test download with a manager account
   - Test that managers cannot access other cooperatives' files
   - Test that admins can access all files
   - Test that only admins can delete files

## Security Notes

- The bucket is private by default - files are not publicly accessible
- All access is controlled via RLS policies
- Managers can only upload/view files for invoices in their cooperative
- Only admins can delete files
- File paths include cooperative_id for additional security layer
- Signed URLs (60 seconds validity) are used for downloads

## Related Files

- Migration: `v2/supabase/migrations/20260320000001_scanned_invoices.sql`
- Database table: `public.scanned_invoices`
- RLS policies: Defined in the migration file
