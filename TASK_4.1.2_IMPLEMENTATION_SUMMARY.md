# Task 4.1.2 Implementation Summary: Baseline Imagery Retrieval

## Overview
Implemented baseline imagery retrieval functionality for EUDR compliance deforestation detection. The system now intelligently handles cases where exact baseline date imagery (December 31, 2020) is unavailable by searching for the closest available cloud-free imagery within ±60 days.

## Implementation Details

### 1. Enhanced `getBaselineNDVI` Method
**Location**: `lib/satellite/services/deforestation.service.ts`

**Functionality**:
- **Step 1**: Check cache for exact baseline date
- **Step 2**: If not cached, attempt to calculate NDVI for exact date
- **Step 3**: If exact date fails, search for closest available date within ±60 days
- **Step 4**: Check if NDVI is cached for the closest date
- **Step 5**: Calculate and cache NDVI for closest date if needed

**Key Features**:
- Graceful fallback when exact date imagery is unavailable
- Automatic caching of baseline NDVI for future use
- Detailed logging for debugging and monitoring
- Proper error handling with `InsufficientDataError` when no imagery is available

### 2. New `findClosestBaselineDate` Method
**Location**: `lib/satellite/services/deforestation.service.ts`

**Functionality**:
- Uses `ImageryService.getClosestDate()` to search for available imagery
- Searches within ±60 days (configurable via `BASELINE_SEARCH_WINDOW_DAYS` constant)
- Applies 20% cloud cover threshold for quality assurance
- Returns the date closest to the target baseline date

### 3. Integration with ImageryService
**Added Import**: `import { imageryService } from './imagery.service';`

The implementation leverages the existing `getClosestDate()` method from `ImageryService`, which:
- Searches for available Sentinel-2 imagery within a specified date range
- Filters by cloud cover threshold
- Returns the date closest to the target date

## Test Coverage

### New Test Suite: "Baseline Imagery Retrieval (Task 4.1.2)"
**Location**: `tests/satellite/services/deforestation.service.test.ts`

**Test Cases** (6 tests, all passing):

1. ✅ **should return cached baseline NDVI if available**
   - Verifies that cached baseline NDVI is used when available
   - Ensures no unnecessary calculations are performed

2. ✅ **should calculate baseline NDVI for exact date if not cached**
   - Tests successful calculation when exact date imagery is available
   - Verifies proper caching with `storeResult: true`

3. ✅ **should search for closest date within ±60 days if exact date unavailable**
   - Tests fallback mechanism when exact date fails
   - Verifies `imageryService.getClosestDate()` is called with correct parameters
   - Confirms NDVI calculation for closest date

4. ✅ **should use cached NDVI for closest date if available**
   - Tests optimization: uses cached NDVI for closest date without recalculation
   - Verifies efficient cache utilization

5. ✅ **should throw InsufficientDataError if no imagery available within ±60 days**
   - Tests error handling when no suitable imagery is found
   - Verifies appropriate error message with search window information

6. ✅ **should cache baseline NDVI after calculating for closest date**
   - Verifies that calculated baseline NDVI is cached for future use
   - Confirms `storeResult: true` is passed to `calculateNDVI()`

## Acceptance Criteria Verification

✅ **Add method to retrieve EUDR baseline imagery (Dec 31, 2020)**
- Implemented in `getBaselineNDVI()` method
- Defaults to EUDR baseline date (December 31, 2020)

✅ **Handle case where exact date unavailable (use closest within 60 days)**
- Implemented fallback logic in `getBaselineNDVI()`
- Uses `findClosestBaselineDate()` to search within ±60 days
- Logs the number of days from target date for transparency

✅ **Cache baseline NDVI for each parcelle**
- All calculated baseline NDVI results are cached with `storeResult: true`
- Cache is checked before calculation to avoid redundant API calls
- Works for both exact date and closest date scenarios

✅ **Acceptance: Baseline imagery retrieved and cached**
- All test cases pass (17/17 tests in deforestation service)
- TypeScript compilation successful with no errors
- Proper error handling for edge cases

## Code Quality

### Logging
- Comprehensive console logging for debugging:
  - Cache hits/misses
  - Exact date calculation attempts
  - Closest date search results
  - Days difference from target date
  - Success/failure messages

### Error Handling
- Graceful degradation when exact date fails
- Clear error messages when no imagery is available
- Proper error type (`InsufficientDataError`) for insufficient data scenarios

### Performance Optimization
- Cache-first approach minimizes API calls
- Reuses cached NDVI for closest dates
- Stores results for future use

## Integration Points

### Dependencies
- `ndviService`: For NDVI calculation and caching
- `imageryService`: For finding closest available imagery dates
- Supabase: For database caching (via `ndviService`)

### Constants
- `EUDR_BASELINE_DATE`: December 31, 2020
- `BASELINE_SEARCH_WINDOW_DAYS`: 60 days (±60 days search window)
- `DEFORESTATION_NDVI_THRESHOLD`: 0.3 (30% vegetation loss)
- `DEFORESTATION_AREA_THRESHOLD`: 0.5 hectares

## Usage Example

```typescript
import { deforestationService } from './lib/satellite/services/deforestation.service';

// Detect deforestation for a parcelle
const result = await deforestationService.detectDeforestation(
  'parcelle-123',
  parcelleGeometry,
  5.5, // Surface area in hectares
  {
    baselineDate: new Date('2020-12-31'), // Optional, defaults to EUDR baseline
    currentDate: new Date(), // Optional, defaults to today
    storeEvents: true, // Store detected events in database
  }
);

if (result.detected) {
  console.log('Deforestation detected!');
  console.log('Baseline NDVI:', result.baselineNDVI);
  console.log('Current NDVI:', result.currentNDVI);
  console.log('NDVI change:', result.ndviChange);
  console.log('Affected area:', result.affectedAreaHectares, 'ha');
}
```

## Next Steps

This implementation completes Task 4.1.2. The next task (Task 4.1.3) will implement alert creation functionality, which will use the baseline imagery retrieval implemented here.

## Files Modified

1. `lib/satellite/services/deforestation.service.ts`
   - Enhanced `getBaselineNDVI()` method with fallback logic
   - Added `findClosestBaselineDate()` helper method
   - Added import for `imageryService`

2. `tests/satellite/services/deforestation.service.test.ts`
   - Added new test suite: "Baseline Imagery Retrieval (Task 4.1.2)"
   - Added 6 comprehensive test cases
   - Added mock for `imageryService`

## Test Results

```
✓ tests/satellite/services/deforestation.service.test.ts (17 tests) 25ms
  ✓ DeforestationService (17)
    ✓ detectDeforestation (6)
    ✓ getAlerts (3)
    ✓ acknowledgeAlert (1)
    ✓ disputeAlert (1)
    ✓ Baseline Imagery Retrieval (Task 4.1.2) (6)
      ✓ getBaselineNDVI (6)

Test Files  1 passed (1)
Tests  17 passed (17)
```

All tests pass successfully! ✅
