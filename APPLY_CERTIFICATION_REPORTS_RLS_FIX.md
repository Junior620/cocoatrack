# Fix Certification Reports Storage RLS

## Problem
The `certification-reports` bucket has restrictive RLS policies that prevent authenticated users from uploading reports.

## Solution Options

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to **Storage** in Supabase Dashboard
2. Click on `certification-reports` bucket
3. Go to **Policies** tab
4. Delete these policies:
   - "Service role and auditors can create certification reports"
   - "Service role can manage certification reports"

5. Create new policy for **INSERT**:
   - Click "New Policy"
   - Select "For INSERT operations"
   - Name: `Authenticated users can upload certification reports`
   - Policy definition:
     ```sql
     bucket_id = 'certification-reports' AND auth.role() = 'authenticated'
     ```
   - Click "Save"

6. Create new policy for **SELECT**:
   - Click "New Policy"
   - Select "For SELECT operations"
   - Name: `Users can read certification reports`
   - Policy definition:
     ```sql
     bucket_id = 'certification-reports' AND auth.role() = 'authenticated'
     ```
   - Click "Save"

### Option 2: Via SQL (if you have sufficient permissions)

Run this in Supabase SQL Editor:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Service role and auditors can create certification reports" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage certification reports" ON storage.objects;

-- Create new policies
CREATE POLICY "Authenticated users can upload certification reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can read certification reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certification-reports'
  AND auth.role() = 'authenticated'
);
```

### Option 3: Temporary Workaround - Make Bucket Public

If you need a quick fix for testing:

1. Go to **Storage** > `certification-reports`
2. Click **Settings**
3. Toggle "Public bucket" to ON
4. Click "Save"

**Note:** This makes all reports publicly accessible. Use only for testing!

## Verification

After applying the fix, test by generating a certification report from the parcelle detail page.

The upload should succeed and you should receive a signed URL to download the PDF.
