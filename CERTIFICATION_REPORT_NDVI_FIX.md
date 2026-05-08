# Certification Report NDVI Bug Fix

## Issue
When generating a certification report with the "Tendance NDVI" option enabled, the API crashed with:

```
TypeError: Cannot read properties of undefined (reading 'toFixed')
at app/api/satellite/reports/certification/route.ts:794:46
```

## Root Cause
The `fetchNDVITrend` function was trying to access database columns using camelCase property names (`meanNDVI`, `calculationDate`, `healthStatus`), but the actual database columns use snake_case naming (`mean_ndvi`, `calculation_date`, `health_status`).

When the code tried to access `result.meanNDVI`, it returned `undefined`, causing the error when calling `.toFixed(3)` on it.

## Database Schema
From `supabase/migrations/20260503000002_create_ndvi_results.sql`:

```sql
CREATE TABLE IF NOT EXISTS ndvi_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL,
  calculation_date TIMESTAMPTZ NOT NULL,
  mean_ndvi DECIMAL(5,4) NOT NULL,
  health_status TEXT NOT NULL,
  ...
);
```

## Fix Applied
Modified the `fetchNDVITrend` function in `app/api/satellite/reports/certification/route.ts` to correctly access database columns using snake_case:

**Before:**
```typescript
const ndviResults = (data || []) as NDVIResult[];

return ndviResults.map((result, index) => {
  // ...
  return {
    date: new Date(result.calculationDate),  // ❌ undefined
    ndvi: result.meanNDVI,                    // ❌ undefined
    healthStatus: result.healthStatus,        // ❌ undefined
    // ...
  };
});
```

**After:**
```typescript
const ndviResults = (data || []) as any[];

return ndviResults.map((result, index) => {
  // Access database columns with snake_case
  const meanNDVI = result.mean_ndvi;           // ✅ correct
  const calculationDate = result.calculation_date; // ✅ correct
  const healthStatus = result.health_status;   // ✅ correct
  
  // ...
  return {
    date: new Date(calculationDate),
    ndvi: meanNDVI,
    healthStatus: healthStatus,
    // ...
  };
});
```

## Testing
- ✅ Build completed successfully
- ✅ No TypeScript errors
- ✅ Ready to test report generation with NDVI trend section

## Files Modified
- `app/api/satellite/reports/certification/route.ts` (lines 265-285)

## Next Steps
Test the certification report generation with all optional sections enabled:
1. ✅ Imagerie avant/après
2. ✅ Tendance NDVI (now fixed)
3. ✅ Prédiction de rendement

The report should now successfully generate with all sections included.
