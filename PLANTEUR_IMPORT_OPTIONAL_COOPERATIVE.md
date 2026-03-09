# Planteur Import - Optional Cooperative Fix

## Problem
Users are getting "Vous n'avez pas accès à cet import" error when trying to parse uploaded CSV files, even though they uploaded the file themselves.

## Root Cause Analysis

The error occurs at line 123 of `v2/app/api/planteurs/import/[id]/parse/route.ts`:

```typescript
if (importFile.created_by !== user.id) {
  return createErrorResponse('UNAUTHORIZED', 'Vous n\'avez pas accès à cet import', undefined, 403);
}
```

This suggests that `importFile.created_by` doesn't match the current `user.id`.

## Possible Causes

1. **User ID mismatch**: The user who uploaded the file has a different ID than the current user
2. **Auth session issue**: The user's session changed between upload and parse
3. **Database issue**: The `created_by` field wasn't set correctly during upload

## Debugging Steps

### 1. Check the import record in Supabase

Run this query in Supabase SQL Editor:

```sql
-- Check recent import records
SELECT 
  id,
  filename,
  created_by,
  cooperative_id,
  import_status,
  created_at
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Check current user ID

Add this to your browser console on the import page:

```javascript
// Get current user from Supabase
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user ID:', user?.id);
```

### 3. Compare the IDs

Compare the `created_by` from the database with the current user ID. If they don't match, that's the issue.

## Solutions

### Solution 1: Delete old imports and re-upload

If the user ID changed (e.g., you logged in with a different account), delete the old import records:

```sql
-- Delete import records created by old user
DELETE FROM planteur_import_files
WHERE created_by = 'OLD_USER_ID';
```

Then re-upload the CSV file with the current user account.

### Solution 2: Update existing import records

If you want to keep the existing imports, update the `created_by` field:

```sql
-- Update import records to current user
UPDATE planteur_import_files
SET created_by = 'CURRENT_USER_ID'
WHERE created_by = 'OLD_USER_ID';
```

Replace `CURRENT_USER_ID` with your actual user ID from step 2 above.

### Solution 3: Add additional access control (if needed)

If you want to allow users to access imports from their cooperative (not just their own), modify the access control logic:

```typescript
// In parse/route.ts and execute/route.ts, replace the access check with:

// Check if user created the import OR belongs to the same cooperative
const hasAccess = 
  importFile.created_by === user.id || 
  (importFile.cooperative_id && importFile.cooperative_id === profile?.cooperative_id);

if (!hasAccess) {
  return createErrorResponse('UNAUTHORIZED', 'Vous n\'avez pas accès à cet import', undefined, 403);
}
```

## Verification

After applying a solution, test the flow:

1. Upload a CSV file
2. Immediately try to parse it
3. Verify no "Vous n'avez pas accès à cet import" error

## Code Changes Summary

All three API routes have been updated to support optional cooperative:

### ✅ Upload Route (`upload/route.ts`)
- Made `cooperative_id` optional (can be null)
- Files without cooperative stored in `unassigned/` folder
- Removed check requiring user to have cooperative

### ✅ Parse Route (`parse/route.ts`)
- Access control: Only checks if user created the import
- Uses import's `cooperative_id` for duplicate detection (may be null)
- No longer requires user to have a cooperative

### ✅ Execute Route (`execute/route.ts`)
- Access control: Only checks if user created the import
- Allows execution even if import has no cooperative
- Planteurs created without cooperative can be assigned later

## Database Migrations Applied

1. `20260308000003_planteur_import_optional_cooperative.sql` - Made `cooperative_id` nullable
2. `20260309000001_fix_planteur_import_rls.sql` - Simplified RLS policies

Both migrations have been manually applied in Supabase SQL Editor.


## Troubleshooting

### Problem: Import succeeds but planteurs not visible in UI

**Cause**: RLS (Row Level Security) policies don't allow access to planteurs with NULL cooperative_id

**Solution**: Apply the RLS fix migration

1. Open Supabase SQL Editor
2. Run the script in `v2/APPLY_PLANTEURS_RLS_FIX.sql`
3. Verify with `v2/CHECK_PLANTEURS_IMPORT.sql`

**What the fix does**:
- Updates SELECT policy to allow users to see their own planteurs (via `created_by`) even with NULL cooperative
- Updates INSERT policy to allow creating planteurs with NULL cooperative
- Updates UPDATE policy to allow updating planteurs with NULL cooperative
- Updates DELETE policy to allow deleting planteurs with NULL cooperative

### Problem: Planteurs created but not showing in database queries

**Diagnosis**: Run `v2/CHECK_PLANTEURS_IMPORT.sql` to check:
1. Import file status and summary
2. Recently created planteurs
3. Planteurs with NULL cooperative_id
4. Audit logs for import operations
5. RLS policies status

### Problem: Frontend shows empty list after import

**Possible causes**:
1. RLS policies blocking access (apply RLS fix above)
2. Frontend filtering by cooperative (check filter logic)
3. Cache issue (hard refresh browser)

**Solution**:
1. Apply RLS fix: `v2/APPLY_PLANTEURS_RLS_FIX.sql`
2. Check browser console for errors
3. Verify API response in Network tab
4. Hard refresh (Ctrl+Shift+R)
