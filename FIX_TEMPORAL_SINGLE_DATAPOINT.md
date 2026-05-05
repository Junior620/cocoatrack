# Fix: Temporal Analysis with Single Data Point

## Problem

The temporal analysis API was returning a 422 error when a parcelle had only 1 NDVI data point:

```
Error [InsufficientDataError]: Insufficient data points for trend analysis. Required: 2, Available: 1
```

This occurred because:
1. The `getNDVITrend()` method requires at least 2 data points to calculate a linear regression trend
2. When only 1 data point exists, it throws an `InsufficientDataError`
3. This error was not caught, causing the entire temporal analysis to fail

## Root Cause

The `calculateTemporalStatistics()` method was calling `getNDVITrend()` without handling the case where insufficient data exists for trend calculation. While you cannot calculate a meaningful trend with only 1 data point, you can still provide useful temporal analysis (timeline, average NDVI, etc.).

## Solution

Made trend calculation optional when insufficient data points exist:

### 1. Updated Type Definition

**File**: `lib/satellite/types/index.ts`

Changed `TemporalAnalysisSummary.trend` from required to optional:

```typescript
export interface TemporalAnalysisSummary {
  timeline: TemporalDataPoint[];
  trend: NDVITrend | null; // null when insufficient data points for trend calculation
  significantChanges: number;
  averageNDVI: number;
  averageCloudCover: number;
}
```

### 2. Updated Service Method

**File**: `lib/satellite/services/ndvi.service.ts`

Modified `calculateTemporalStatistics()` to catch `InsufficientDataError` and set `trend` to `null`:

```typescript
// Step 2: Calculate overall trend (improving, stable, declining)
// This uses linear regression on the NDVI values over time
// Note: Trend calculation requires at least 2 data points
let trend: import('../types').NDVITrend | null = null;

try {
  trend = await this.getNDVITrend(
    parcelleId,
    startDate,
    endDate,
    options.supabase // Pass authenticated Supabase client
  );
} catch (error) {
  // If insufficient data for trend calculation, set trend to null
  // This is expected when there's only 1 data point
  if (error instanceof InsufficientDataError) {
    console.log(`[calculateTemporalStatistics] Insufficient data for trend calculation: ${error.message}`);
    trend = null;
  } else {
    // Re-throw other errors
    throw error;
  }
}
```

### 3. Updated API Route

**File**: `app/api/satellite/temporal/route.ts`

Modified response preparation to handle `null` trend:

```typescript
trend: summary.trend ? {
  trend: summary.trend.trend,
  changeRate: summary.trend.changeRate,
  dataPoints: summary.trend.dataPoints,
  startDate: summary.trend.startDate.toISOString(),
  endDate: summary.trend.endDate.toISOString(),
  startNDVI: summary.trend.startNDVI,
  endNDVI: summary.trend.endNDVI,
} : null, // null when insufficient data for trend calculation
```

### 4. Frontend Already Handles This

**File**: `components/satellite/TemporalDataChart.tsx`

The frontend component already calculates its own trend locally and handles single data points gracefully:

```typescript
function calculateTrend(timeline: TemporalDataPoint[]): {
  trend: 'improving' | 'stable' | 'declining';
  change: number;
} {
  if (timeline.length < 2) {
    return { trend: 'stable', change: 0 };
  }
  // ... rest of calculation
}
```

## Result

Now when a parcelle has only 1 NDVI data point:

1. ✅ The API returns 200 OK (instead of 422 error)
2. ✅ The response includes:
   - Timeline with the single data point
   - `trend: null` (indicating insufficient data for trend calculation)
   - Average NDVI (same as the single data point)
   - Average cloud cover
   - Significant changes count (0, since you need 2 points to detect changes)
3. ✅ The frontend displays the data correctly with "Stable" trend indicator

## Example Response

For a parcelle with 1 data point (2026-05-03, NDVI=0.5225):

```json
{
  "success": true,
  "data": {
    "parcelleId": "2f2389d3-c8b4-4b27-bef6-7363db0e5da9",
    "startDate": "2025-05-05T00:00:00.000Z",
    "endDate": "2026-05-05T00:00:00.000Z",
    "interval": "monthly",
    "summary": {
      "timeline": [
        {
          "date": "2026-05-05T00:00:00.000Z",
          "ndvi": 0.5225,
          "cloudCover": 0,
          "healthStatus": "good",
          "hasSignificantChange": false
        }
      ],
      "trend": null,
      "significantChanges": 0,
      "averageNDVI": 0.5225,
      "averageCloudCover": 0
    }
  },
  "cached": false
}
```

## Testing

To test this fix:

1. Navigate to a parcelle with only 1 NDVI data point
2. The temporal analysis section should load successfully (no 422 error)
3. The chart should display the single data point
4. The trend indicator should show "Stable" (frontend fallback)

## Files Modified

- `lib/satellite/types/index.ts` - Made `trend` optional in `TemporalAnalysisSummary`
- `lib/satellite/services/ndvi.service.ts` - Added error handling for insufficient data in `calculateTemporalStatistics()`
- `app/api/satellite/temporal/route.ts` - Handle `null` trend in response preparation

## Related Issues

This fix addresses the same underlying issue as the previous fix for parcelles with 2 data points but different dates (e.g., 2026-05-03 and 2026-05-04 when expecting 2026-05-05). Both fixes ensure that temporal analysis works gracefully with limited data.
