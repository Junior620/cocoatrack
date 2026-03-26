# Collection Receipts Storage Documentation

## Overview

The `collection-receipts` storage bucket stores PDF files of scanned collection receipts (RECU DE COLLECTE D'ACHAT) imported by managers and admins.

## Bucket Configuration

- **Bucket ID**: `collection-receipts`
- **Public Access**: No (private bucket)
- **File Size Limit**: 10MB (10,485,760 bytes)
- **Allowed MIME Types**: `application/pdf` only

## Storage Path Structure

```
collection-receipts/
  {cooperative_id}/
    receipts/
      {receipt_number}/
        {uuid}_{original_filename}.pdf
```

### Path Components

1. **cooperative_id**: UUID of the cooperative (for access control and organization)
2. **receipts**: Fixed folder name for receipt PDFs
3. **receipt_number**: The receipt number from the document (e.g., "0000004")
4. **uuid**: A unique identifier to prevent filename collisions
5. **original_filename**: The original name of the uploaded file

### Example Path

```
collection-receipts/550e8400-e29b-41d4-a716-446655440000/receipts/0000004/a1b2c3d4-e5f6-7890-abcd-ef1234567890_recu_collecte.pdf
```

## Access Control Policies

### SELECT (Download)
- **Who**: All authenticated users
- **Scope**: Can download receipts from their own cooperative
- **Exception**: Admins and superadmins can download from any cooperative

### INSERT (Upload)
- **Who**: Managers, admins, and superadmins
- **Scope**: Can upload receipts to their own cooperative
- **Exception**: Admins and superadmins can upload to any cooperative
- **Validation**: File must be PDF and under 10MB

### UPDATE
- **Who**: No one
- **Reason**: Receipts are immutable once uploaded

### DELETE
- **Who**: Admins and superadmins only
- **Reason**: Deletion should be restricted to prevent accidental data loss

## Usage in Application

### Upload Example

```typescript
import { createClient } from '@/lib/supabase/client';

async function uploadReceiptPdf(
  file: File,
  cooperativeId: string,
  receiptNumber: string
): Promise<string> {
  const supabase = createClient();
  
  // Generate unique filename
  const uuid = crypto.randomUUID();
  const fileName = `${uuid}_${file.name}`;
  
  // Construct storage path
  const storagePath = `${cooperativeId}/receipts/${receiptNumber}/${fileName}`;
  
  // Upload file
  const { data, error } = await supabase.storage
    .from('collection-receipts')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false
    });
  
  if (error) throw error;
  
  // Get public URL (signed URL for private bucket)
  const { data: urlData } = supabase.storage
    .from('collection-receipts')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry
  
  return urlData.signedUrl;
}
```

### Download Example

```typescript
async function downloadReceiptPdf(pdfUrl: string): Promise<Blob> {
  const supabase = createClient();
  
  // Extract path from URL
  const path = pdfUrl.split('/collection-receipts/')[1];
  
  // Download file
  const { data, error } = await supabase.storage
    .from('collection-receipts')
    .download(path);
  
  if (error) throw error;
  
  return data;
}
```

### Get Signed URL Example

```typescript
async function getReceiptSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createClient();
  
  const { data, error } = await supabase.storage
    .from('collection-receipts')
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) throw error;
  
  return data.signedUrl;
}
```

## Database Integration

Receipt PDFs are linked to the database through the `collection_receipts` table:

```sql
-- The pdf_url column stores the full storage path
SELECT 
  id,
  receipt_number,
  pdf_url,
  pdf_file_name,
  pdf_file_size
FROM public.collection_receipts
WHERE cooperative_id = 'xxx';
```

## Validation Rules

### File Type Validation
- Must be `application/pdf` MIME type
- File extension must be `.pdf`

### File Size Validation
- Maximum size: 10MB (10,485,760 bytes)
- Enforced at both storage bucket level and application level

### Path Validation
- Cooperative ID must be a valid UUID
- Receipt number must be alphanumeric
- Filename must not contain path traversal characters

## Error Handling

### Common Errors

1. **File too large**: `"The object exceeded the maximum allowed size"`
   - Solution: Compress PDF or reduce quality before upload

2. **Invalid MIME type**: `"The object's content type is not allowed"`
   - Solution: Ensure file is a valid PDF

3. **Access denied**: `"new row violates row-level security policy"`
   - Solution: Verify user has manager/admin role and cooperative access

4. **Duplicate filename**: `"The resource already exists"`
   - Solution: Use UUID in filename to prevent collisions

## Maintenance

### Cleanup Orphaned Files

Periodically check for PDF files that don't have corresponding database records:

```sql
-- Find orphaned files (manual process, requires storage API)
-- This query finds receipts without PDF files
SELECT 
  id,
  receipt_number,
  pdf_url
FROM public.collection_receipts
WHERE NOT EXISTS (
  -- Would need to check storage.objects, but that's not directly queryable
  -- Use application-level cleanup script instead
  SELECT 1 FROM storage.objects 
  WHERE bucket_id = 'collection-receipts' 
  AND name = collection_receipts.pdf_url
);
```

### Storage Metrics

Monitor storage usage:

```sql
-- Count receipts per cooperative
SELECT 
  c.name as cooperative_name,
  COUNT(cr.id) as receipt_count,
  SUM(cr.pdf_file_size) as total_size_bytes,
  ROUND(SUM(cr.pdf_file_size) / 1024.0 / 1024.0, 2) as total_size_mb
FROM public.collection_receipts cr
JOIN public.cooperatives c ON c.id = cr.cooperative_id
GROUP BY c.id, c.name
ORDER BY total_size_bytes DESC;
```

## Security Considerations

1. **Private Bucket**: Files are not publicly accessible
2. **Signed URLs**: Use time-limited signed URLs for temporary access
3. **Cooperative Isolation**: Users can only access receipts from their cooperative
4. **Role-Based Access**: Upload restricted to managers and admins
5. **Immutability**: Receipts cannot be modified after upload
6. **Audit Trail**: All uploads tracked via `created_by` and `created_at` fields

## Related Tables

- `public.collection_receipts`: Stores receipt metadata
- `public.receipt_deliveries`: Links receipts to deliveries
- `public.deliveries`: Individual delivery records created from receipts
- `public.profiles`: User roles and cooperative access
