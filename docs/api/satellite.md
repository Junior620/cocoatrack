# Satellite Imagery API Documentation

## Overview

The Satellite Imagery API provides access to satellite imagery analysis capabilities for cocoa parcelles in CocoaTrack. The API leverages Google Earth Engine and Sentinel-2 satellite imagery to deliver NDVI analysis, deforestation detection, and temporal vegetation monitoring.

**Base URL**: `/api/satellite`

**Authentication**: All endpoints require Supabase JWT authentication via session cookies or Authorization header.

**Rate Limiting**: 100 requests per minute per user. Rate limit information is included in response headers.

---

## Endpoints

### GET /api/satellite/imagery

Retrieve satellite imagery for a specific parcelle with optional date and cloud cover filtering.

#### Authentication

**Required**: Yes (Supabase JWT)

Users can only access imagery for parcelles they have permission to view, enforced through Row Level Security (RLS) policies.

#### Request

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parcelleId` | UUID | Yes | - | Unique identifier of the parcelle |
| `date` | ISO 8601 | No | Most recent | Acquisition date for imagery (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ) |
| `cloudCoverThreshold` | Number | No | 20 | Maximum acceptable cloud cover percentage (0-100) |

**Query Parameter Details**:

- **parcelleId**: Must be a valid UUID format. The user must have access to this parcelle.
- **date**: If omitted, returns the most recent available imagery. Accepts formats:
  - `YYYY-MM-DD` (e.g., `2024-05-03`)
  - Full ISO 8601 (e.g., `2024-05-03T12:00:00Z`)
- **cloudCoverThreshold**: Filters imagery to exclude scenes with cloud cover exceeding this percentage. Tropical regions typically use 20% as default.

#### Response

**Success Response** (200 OK):

```json
{
  "imagery": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "acquisitionDate": "2024-05-03T10:30:00Z",
    "cloudCoverPercent": 15.5,
    "satelliteSource": "sentinel-2",
    "tileUrl": "https://storage.supabase.co/satellite-tiles/...",
    "bounds": [-10.5, 5.2, -10.4, 5.3],
    "resolutionMeters": 10,
    "createdAt": "2024-05-03T11:00:00Z"
  },
  "cached": true,
  "cacheAge": 3600000
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `imagery.id` | UUID | Unique identifier for this imagery record |
| `imagery.parcelleId` | UUID | Parcelle identifier |
| `imagery.acquisitionDate` | ISO 8601 | Date and time when satellite captured the imagery |
| `imagery.cloudCoverPercent` | Number | Cloud cover percentage (0-100) |
| `imagery.satelliteSource` | String | Satellite source (always "sentinel-2") |
| `imagery.tileUrl` | String | URL to the imagery tile in Supabase Storage |
| `imagery.bounds` | Array | GeoJSON bounding box [minLon, minLat, maxLon, maxLat] |
| `imagery.resolutionMeters` | Number | Spatial resolution in meters (typically 10-20m) |
| `imagery.createdAt` | ISO 8601 | Timestamp when record was created |
| `cached` | Boolean | Whether data was served from cache |
| `cacheAge` | Number | Age of cached data in milliseconds (if cached) |

#### Error Responses

**400 Bad Request** - Invalid request parameters:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": {
    "field": "parcelleId",
    "message": "Invalid parcelle ID format. Must be a valid UUID"
  }
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication required. Please log in to access satellite imagery."
}
```

**403 Forbidden** - User cannot access this parcelle:

```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this parcelle."
}
```

**404 Not Found** - Imagery not found:

```json
{
  "error": "IMAGERY_UNAVAILABLE",
  "message": "Satellite imagery is unavailable for the requested date",
  "details": {
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "requestedDate": "2024-05-03",
    "reason": "No cloud-free imagery available within threshold"
  }
}
```

**429 Too Many Requests** - Rate limit exceeded:

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

**500 Internal Server Error** - Server error:

```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred while retrieving satellite imagery"
}
```

#### Rate Limiting Headers

All responses include rate limiting information:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per minute (100) |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when rate limit resets |

#### Example Requests

**cURL**:

```bash
# Get most recent imagery for a parcelle
curl -X GET "https://cocoatrack.com/api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get imagery for a specific date with custom cloud cover threshold
curl -X GET "https://cocoatrack.com/api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=2024-05-03&cloudCoverThreshold=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript (fetch)**:

```javascript
// Get most recent imagery
const response = await fetch(
  '/api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000',
  {
    method: 'GET',
    credentials: 'include', // Include session cookies
  }
);

if (response.ok) {
  const data = await response.json();
  console.log('Imagery:', data.imagery);
  console.log('Cached:', data.cached);
} else {
  const error = await response.json();
  console.error('Error:', error.message);
}

// Get imagery for specific date
const response = await fetch(
  '/api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=2024-05-03&cloudCoverThreshold=30',
  {
    method: 'GET',
    credentials: 'include',
  }
);
```

**TypeScript (with types)**:

```typescript
import type { ImageryResponse } from '@/lib/satellite/types';

async function getImagery(
  parcelleId: string,
  date?: string,
  cloudCoverThreshold?: number
): Promise<ImageryResponse> {
  const params = new URLSearchParams({ parcelleId });
  if (date) params.append('date', date);
  if (cloudCoverThreshold !== undefined) {
    params.append('cloudCoverThreshold', cloudCoverThreshold.toString());
  }

  const response = await fetch(`/api/satellite/imagery?${params}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Usage
try {
  const data = await getImagery(
    '123e4567-e89b-12d3-a456-426614174000',
    '2024-05-03',
    30
  );
  console.log('Acquisition date:', data.imagery.acquisitionDate);
  console.log('Cloud cover:', data.imagery.cloudCoverPercent);
} catch (error) {
  console.error('Failed to fetch imagery:', error);
}
```

---

## Data Types

### ImageryData

Represents satellite imagery metadata and access information.

```typescript
interface ImageryData {
  id: string;                      // UUID
  parcelleId: string;              // UUID
  acquisitionDate: Date;           // ISO 8601
  cloudCoverPercent: number;       // 0-100
  satelliteSource: 'sentinel-2';   // Literal type
  tileUrl: string;                 // URL to Supabase Storage
  bounds: GeoJSON.BBox;            // [minLon, minLat, maxLon, maxLat]
  resolutionMeters: number;        // Typically 10-20
  createdAt: Date;                 // ISO 8601
}
```

### ImageryResponse

API response wrapper for imagery data.

```typescript
interface ImageryResponse {
  imagery: ImageryData;
  cached: boolean;
  cacheAge?: number;  // milliseconds, present if cached=true
}
```

### NDVIResult

Represents calculated NDVI values and health status for a parcelle.

```typescript
interface NDVIResult {
  id: string;                      // UUID
  parcelleId: string;              // UUID
  imageryId: string | null;        // UUID or null
  calculationDate: Date;           // ISO 8601
  meanNDVI: number;                // -1 to 1
  minNDVI: number;                 // -1 to 1
  maxNDVI: number;                 // -1 to 1
  stdDevNDVI: number;              // Standard deviation
  healthStatus: HealthStatus;      // 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  ndviRasterUrl: string | null;    // URL to NDVI visualization (optional)
  createdAt: Date;                 // ISO 8601
}

type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
```

### HealthStatusData

Represents health status with trend analysis.

```typescript
interface HealthStatusData {
  parcelleId: string;              // UUID
  healthStatus: HealthStatus;      // Current health status
  meanNDVI: number;                // -1 to 1
  lastCalculationDate: Date;       // ISO 8601
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changeRate: number;            // NDVI units per month
    dataPoints: number;            // Number of data points used
  } | null;                        // null if insufficient data
  recommendation: string;          // Actionable recommendation
  cached: boolean;                 // Always true for this endpoint
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters (malformed UUID, invalid date format, etc.) |
| `UNAUTHORIZED` | 401 | Authentication required or JWT token invalid |
| `FORBIDDEN` | 403 | User does not have permission to access the requested parcelle |
| `PARCELLE_NOT_FOUND` | 404 | Parcelle with specified ID does not exist |
| `IMAGERY_UNAVAILABLE` | 404 | No imagery found matching the specified criteria |
| `NDVI_NOT_FOUND` | 404 | No NDVI data available for the parcelle (calculate NDVI first) |
| `INSUFFICIENT_DATA` | 422 | Insufficient data for NDVI calculation (no cloud-free imagery) |
| `CLOUD_COVER_EXCEEDED` | 422 | Available imagery exceeds cloud cover threshold |
| `CALCULATION_ERROR` | 500 | Error occurred during NDVI calculation |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests, rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `AUTHENTICATION_FAILED` | 500 | Google Earth Engine authentication failed |

---

## Caching Behavior

The satellite imagery API implements a multi-tier caching strategy to optimize performance and reduce external API calls:

### Cache Tiers

1. **Database Cache**: NDVI results and metadata (indefinite retention)
2. **Storage Cache**: Imagery tiles in Supabase Storage (90-day retention)
3. **Client Cache**: IndexedDB for offline access (50 parcelles max, LRU eviction)

### Cache TTL

- **Imagery tiles**: 24 hours
- **NDVI results**: Indefinite (recalculated on demand)
- **Metadata**: Indefinite

### Cache Headers

Responses include cache status information:

```json
{
  "cached": true,
  "cacheAge": 3600000  // milliseconds since cached
}
```

### Cache Invalidation

Cache is automatically invalidated when:
- New imagery is available for a parcelle
- User explicitly requests fresh data (future feature)
- Cache entry exceeds TTL

---

## Cloud Cover Filtering

The API automatically filters imagery based on cloud cover to ensure analysis quality:

### Default Behavior

- **Default threshold**: 20% (suitable for tropical regions like Cameroon)
- **Filtering**: Excludes scenes with cloud cover exceeding threshold
- **Fallback**: If no imagery meets threshold within 30 days, returns least cloudy available imagery with warning

### Cloud Masking

For imagery with partial cloud cover:
- Cloud pixels are masked and excluded from NDVI calculations
- Affected area percentage is reported
- Analysis marked as "partial coverage" if >30% of parcelle is cloud-covered

### Dry Season Priority

For baseline deforestation analysis (EUDR compliance):
- System prioritizes dry season imagery (November-March)
- Reduces cloud cover issues in tropical regions
- Improves baseline accuracy

---

## Authorization

### Authentication Methods

1. **Session Cookies** (recommended for web applications):
   ```javascript
   fetch('/api/satellite/imagery?parcelleId=...', {
     credentials: 'include'
   });
   ```

2. **Authorization Header** (for API clients):
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://cocoatrack.com/api/satellite/imagery?parcelleId=..."
   ```

### Access Control

Access to satellite imagery is controlled through Supabase Row Level Security (RLS) policies:

- **Cooperative Managers**: Can access imagery for all parcelles in their cooperative
- **Agronomists**: Can access imagery for assigned parcelles
- **Planteurs**: Can access imagery for their own parcelles
- **Certification Auditors**: Can access imagery for parcelles under audit
- **Internal App**: Full access to all parcelles

### Permission Errors

If a user attempts to access imagery for a parcelle they don't have permission to view:

```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this parcelle."
}
```

---

## Performance Considerations

### Response Times

- **Cache hit**: < 100ms
- **Cache miss (database)**: < 500ms
- **Fresh imagery retrieval**: 2-5 seconds (depends on Google Earth Engine API)

### Optimization Tips

1. **Use date parameter**: Requesting specific dates improves cache hit rate
2. **Batch requests**: For multiple parcelles, consider implementing client-side request queuing
3. **Offline-first**: Cache imagery locally for offline access in low-connectivity areas
4. **Monitor rate limits**: Check `X-RateLimit-Remaining` header to avoid hitting limits

### Concurrent Requests

- **Supported**: Up to 50 concurrent users
- **Rate limit**: 100 requests/minute per user
- **Queuing**: Requests exceeding limits are queued automatically

---

## Best Practices

### 1. Error Handling

Always implement comprehensive error handling:

```typescript
async function fetchImagery(parcelleId: string) {
  try {
    const response = await fetch(
      `/api/satellite/imagery?parcelleId=${parcelleId}`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.error) {
        case 'IMAGERY_UNAVAILABLE':
          // Show fallback UI or cached data
          console.warn('No recent imagery available');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          // Implement exponential backoff
          const retryAfter = error.retryAfter || 60;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return fetchImagery(parcelleId); // Retry
        case 'UNAUTHORIZED':
          // Redirect to login
          window.location.href = '/login';
          break;
        default:
          // Show generic error message
          console.error('Unexpected error:', error.message);
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}
```

### 2. Rate Limit Management

Monitor rate limits and implement backoff:

```typescript
async function fetchWithRateLimit(url: string) {
  const response = await fetch(url, { credentials: 'include' });
  
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
  
  if (remaining < 10) {
    console.warn(`Rate limit low: ${remaining} requests remaining`);
    // Implement request throttling
  }
  
  if (response.status === 429) {
    const retryAfter = (reset * 1000) - Date.now();
    console.warn(`Rate limited. Retry after ${retryAfter}ms`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    return fetchWithRateLimit(url); // Retry
  }
  
  return response;
}
```

### 3. Caching Strategy

Implement client-side caching for offline support:

```typescript
// Using IndexedDB for offline caching
async function getImageryWithCache(parcelleId: string) {
  // Try cache first
  const cached = await getCachedImagery(parcelleId);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return { ...cached.data, cached: true };
  }
  
  // Fetch fresh data
  try {
    const response = await fetch(
      `/api/satellite/imagery?parcelleId=${parcelleId}`,
      { credentials: 'include' }
    );
    
    if (response.ok) {
      const data = await response.json();
      await cacheImagery(parcelleId, data);
      return data;
    }
  } catch (error) {
    // Network error - return cached data if available
    if (cached) {
      console.warn('Using stale cache due to network error');
      return { ...cached.data, cached: true, stale: true };
    }
    throw error;
  }
}
```

### 4. Loading States

Provide clear feedback during data loading:

```typescript
function ImageryViewer({ parcelleId }: { parcelleId: string }) {
  const [imagery, setImagery] = useState<ImageryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadImagery() {
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchImagery(parcelleId);
        setImagery(data?.imagery || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load imagery');
      } finally {
        setLoading(false);
      }
    }

    loadImagery();
  }, [parcelleId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!imagery) return <NoDataMessage />;

  return <ImageryMap imagery={imagery} />;
}
```

---

## POST /api/satellite/ndvi

Calculate NDVI (Normalized Difference Vegetation Index) for a specific parcelle and date. This endpoint retrieves Sentinel-2 imagery, calculates NDVI values, stores the results in the database, and returns comprehensive vegetation health metrics.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only calculate NDVI for parcelles they have permission to view.

### Request

**Body Parameters** (JSON):

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parcelleId` | UUID | Yes | - | Unique identifier of the parcelle |
| `date` | ISO 8601 | No | Most recent | Date for NDVI calculation (YYYY-MM-DD) |
| `forceRecalculate` | Boolean | No | false | Force recalculation even if cached result exists |

**Request Body Example**:

```json
{
  "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2024-05-03",
  "forceRecalculate": false
}
```

**Body Parameter Details**:

- **parcelleId**: Must be a valid UUID format. The user must have access to this parcelle.
- **date**: If omitted, uses the most recent available imagery. Format: `YYYY-MM-DD`
- **forceRecalculate**: Set to `true` to bypass cache and recalculate NDVI. Useful when:
  - New imagery is available
  - Previous calculation had errors
  - Testing or validation purposes

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "imageryId": "660e8400-e29b-41d4-a716-446655440001",
    "calculationDate": "2024-05-03T00:00:00Z",
    "meanNDVI": 0.65,
    "minNDVI": 0.42,
    "maxNDVI": 0.83,
    "stdDevNDVI": 0.08,
    "healthStatus": "good",
    "ndviRasterUrl": "https://storage.supabase.co/ndvi-rasters/...",
    "createdAt": "2024-05-03T12:00:00Z"
  },
  "cached": false,
  "processingTime": 2345
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `data.id` | UUID | Unique identifier for this NDVI result |
| `data.parcelleId` | UUID | Parcelle identifier |
| `data.imageryId` | UUID \| null | Reference to source satellite imagery |
| `data.calculationDate` | ISO 8601 | Date of the imagery used for calculation |
| `data.meanNDVI` | Number | Mean NDVI value across the parcelle (-1 to 1) |
| `data.minNDVI` | Number | Minimum NDVI value found in the parcelle |
| `data.maxNDVI` | Number | Maximum NDVI value found in the parcelle |
| `data.stdDevNDVI` | Number | Standard deviation of NDVI values |
| `data.healthStatus` | String | Classified health status: "excellent", "good", "fair", "poor", or "critical" |
| `data.ndviRasterUrl` | String \| null | URL to NDVI raster visualization (optional) |
| `data.createdAt` | ISO 8601 | Timestamp when NDVI was calculated |
| `cached` | Boolean | Whether result was served from cache (false if newly calculated) |
| `processingTime` | Number | Processing time in milliseconds (only present if newly calculated) |

**NDVI Calculation Details**:

The NDVI is calculated using the formula:

```
NDVI = (NIR - Red) / (NIR + Red)
```

Where:
- **NIR** = Sentinel-2 Band 8 (Near-Infrared, 842nm)
- **Red** = Sentinel-2 Band 4 (Red, 665nm)

**Health Status Classification**:

| Status | NDVI Range | Interpretation |
|--------|------------|----------------|
| `excellent` | 0.7 - 1.0 | Dense, healthy vegetation with high chlorophyll content |
| `good` | 0.6 - 0.7 | Healthy vegetation with good coverage |
| `fair` | 0.5 - 0.6 | Moderate vegetation, may need attention |
| `poor` | 0.3 - 0.5 | Sparse vegetation, intervention recommended |
| `critical` | 0.0 - 0.3 | Very sparse or stressed vegetation, immediate action needed |

### Error Responses

**400 Bad Request** - Invalid request parameters:

```json
{
  "success": false,
  "error": "Invalid request parameters",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "parcelleId",
    "message": "Invalid parcelle ID format. Must be a valid UUID"
  }
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - Access denied:

```json
{
  "success": false,
  "error": "You do not have permission to access this parcelle",
  "code": "FORBIDDEN"
}
```

**404 Not Found** - Parcelle not found:

```json
{
  "success": false,
  "error": "Parcelle not found",
  "code": "PARCELLE_NOT_FOUND"
}
```

**422 Unprocessable Entity** - Insufficient data for calculation:

```json
{
  "success": false,
  "error": "Insufficient data for NDVI calculation",
  "code": "INSUFFICIENT_DATA",
  "details": {
    "reason": "No cloud-free imagery available for the specified date",
    "availableDates": ["2024-04-28", "2024-05-08"]
  }
}
```

**429 Too Many Requests** - Rate limit exceeded:

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

**500 Internal Server Error**:

```json
{
  "success": false,
  "error": "Failed to calculate NDVI",
  "code": "CALCULATION_ERROR",
  "details": {
    "message": "Error processing satellite bands"
  }
}
```

### Caching Behavior

NDVI results are cached indefinitely in the database:

- **Cache Key**: `(parcelleId, calculationDate)` - unique constraint
- **Cache Hit**: Returns existing result immediately (< 100ms)
- **Cache Miss**: Calculates NDVI from satellite imagery (2-5 seconds)
- **Force Recalculate**: Bypasses cache and recalculates (use `forceRecalculate: true`)

**Cache Invalidation**:
- NDVI results are never automatically invalidated
- Use `forceRecalculate: true` to update existing results
- Useful when new imagery becomes available or calculation errors occurred

### Example Usage

**cURL**:

```bash
# Calculate NDVI for most recent imagery
curl -X POST "https://cocoatrack.com/api/satellite/ndvi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000"
  }'

# Calculate NDVI for specific date
curl -X POST "https://cocoatrack.com/api/satellite/ndvi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-05-03"
  }'

# Force recalculation
curl -X POST "https://cocoatrack.com/api/satellite/ndvi" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2024-05-03",
    "forceRecalculate": true
  }'
```

**JavaScript (fetch)**:

```javascript
async function calculateNDVI(parcelleId, date = null, forceRecalculate = false) {
  const response = await fetch('/api/satellite/ndvi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      parcelleId,
      ...(date && { date }),
      forceRecalculate,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
try {
  const result = await calculateNDVI(
    '123e4567-e89b-12d3-a456-426614174000',
    '2024-05-03'
  );
  
  console.log('NDVI Result:', result.data);
  console.log('Mean NDVI:', result.data.meanNDVI);
  console.log('Health Status:', result.data.healthStatus);
  console.log('Cached:', result.cached);
  
  if (!result.cached) {
    console.log('Processing time:', result.processingTime, 'ms');
  }
} catch (error) {
  console.error('Failed to calculate NDVI:', error);
}
```

**TypeScript (with React hook)**:

```typescript
import { useState } from 'react';
import type { NDVIResult } from '@/lib/satellite/types';

interface CalculateNDVIParams {
  parcelleId: string;
  date?: string;
  forceRecalculate?: boolean;
}

interface CalculateNDVIResponse {
  success: boolean;
  data: NDVIResult;
  cached: boolean;
  processingTime?: number;
}

function useNDVICalculation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NDVIResult | null>(null);

  const calculate = async (params: CalculateNDVIParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data: CalculateNDVIResponse = await response.json();
      setResult(data.data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate NDVI';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { calculate, loading, error, result };
}

// Usage in component
function NDVICalculator({ parcelleId }: { parcelleId: string }) {
  const { calculate, loading, error, result } = useNDVICalculation();

  const handleCalculate = async () => {
    try {
      const response = await calculate({ parcelleId });
      console.log('NDVI calculated:', response.data);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleCalculate} disabled={loading}>
        {loading ? 'Calculating...' : 'Calculate NDVI'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {result && (
        <div className="ndvi-result">
          <h3>NDVI Result</h3>
          <p>Mean NDVI: {result.meanNDVI.toFixed(3)}</p>
          <p>Health Status: {result.healthStatus}</p>
          <p>Range: {result.minNDVI.toFixed(3)} - {result.maxNDVI.toFixed(3)}</p>
          <p>Std Dev: {result.stdDevNDVI.toFixed(3)}</p>
        </div>
      )}
    </div>
  );
}
```

**TypeScript (with error handling)**:

```typescript
async function calculateNDVIWithRetry(
  parcelleId: string,
  date?: string,
  maxRetries = 3
): Promise<CalculateNDVIResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ parcelleId, date }),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(error.error);
        }
        
        // Retry on server errors (5xx)
        lastError = new Error(error.error);
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      
      // Don't retry on network errors after last attempt
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to calculate NDVI after retries');
}
```

### Performance Considerations

**Processing Time**:
- **Cache hit**: < 100ms (database lookup)
- **Cache miss**: 2-5 seconds (includes imagery retrieval and calculation)
- **Large parcelles** (>50 hectares): Up to 10 seconds

**Optimization Tips**:
1. **Check cache first**: Use `GET /api/satellite/health-status/:parcelleId` to check if NDVI already exists
2. **Batch calculations**: For multiple parcelles, implement client-side queuing to avoid rate limits
3. **Background processing**: Consider calculating NDVI asynchronously for large cooperatives
4. **Monitor processing time**: Use the `processingTime` field to identify slow calculations

**Rate Limiting**:
- Same rate limits as other endpoints: 100 requests/minute per user
- NDVI calculations count as 2 requests (imagery retrieval + calculation)
- Consider this when implementing batch operations

### Best Practices

**1. Check Before Calculate**:

```typescript
// Check if NDVI already exists before calculating
async function ensureNDVI(parcelleId: string, date?: string) {
  try {
    // Try to get existing health status (includes NDVI)
    const healthStatus = await fetch(
      `/api/satellite/health-status/${parcelleId}`,
      { credentials: 'include' }
    );
    
    if (healthStatus.ok) {
      const data = await healthStatus.json();
      console.log('Using cached NDVI:', data.data.meanNDVI);
      return data.data;
    }
  } catch (error) {
    console.log('No cached NDVI, calculating...');
  }
  
  // Calculate if not cached
  const response = await fetch('/api/satellite/ndvi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ parcelleId, date }),
  });
  
  const result = await response.json();
  return result.data;
}
```

**2. Handle Insufficient Data**:

```typescript
async function calculateNDVIWithFallback(parcelleId: string, date: string) {
  try {
    const response = await fetch('/api/satellite/ndvi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ parcelleId, date }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (error.code === 'INSUFFICIENT_DATA') {
        // Try alternative dates
        const availableDates = error.details?.availableDates || [];
        if (availableDates.length > 0) {
          console.log('Trying alternative date:', availableDates[0]);
          return calculateNDVIWithFallback(parcelleId, availableDates[0]);
        }
      }
      
      throw new Error(error.error);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to calculate NDVI:', error);
    throw error;
  }
}
```

**3. Progress Indication**:

```typescript
function NDVICalculatorWithProgress({ parcelleId }: { parcelleId: string }) {
  const [status, setStatus] = useState<'idle' | 'calculating' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const calculate = async () => {
    setStatus('calculating');
    setProgress(0);

    // Simulate progress (actual calculation happens on server)
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 300);

    try {
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parcelleId }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error('Calculation failed');
      }

      setStatus('success');
    } catch (error) {
      clearInterval(progressInterval);
      setStatus('error');
    }
  };

  return (
    <div>
      <button onClick={calculate} disabled={status === 'calculating'}>
        Calculate NDVI
      </button>
      
      {status === 'calculating' && (
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

---

## GET /api/satellite/health-status/:parcelleId

Retrieve the current health status for a parcelle, including NDVI value, trend analysis, and recommendations.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only access health status for parcelles they have permission to view.

### Request

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parcelleId` | UUID | Yes | Unique identifier of the parcelle |

**Example Request**:

```bash
GET /api/satellite/health-status/123e4567-e89b-12d3-a456-426614174000
```

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "healthStatus": "good",
    "meanNDVI": 0.65,
    "lastCalculationDate": "2024-05-03T00:00:00Z",
    "trend": {
      "direction": "improving",
      "changeRate": 0.02,
      "dataPoints": 5
    },
    "recommendation": "Vegetation is healthy. Monitor regularly and maintain current practices.",
    "cached": true
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `parcelleId` | UUID | Parcelle identifier |
| `healthStatus` | String | Health status category: "excellent", "good", "fair", "poor", or "critical" |
| `meanNDVI` | Number | Mean NDVI value (-1 to 1) |
| `lastCalculationDate` | ISO 8601 | Date of the most recent NDVI calculation |
| `trend` | Object \| null | NDVI trend over past 3 months (null if insufficient data) |
| `trend.direction` | String | Trend direction: "improving", "stable", or "declining" |
| `trend.changeRate` | Number | Rate of change in NDVI units per month |
| `trend.dataPoints` | Number | Number of data points used for trend calculation |
| `recommendation` | String | Actionable recommendation based on health status |
| `cached` | Boolean | Whether data was served from cache (always true for this endpoint) |

**Health Status Categories**:

| Status | NDVI Range | Color | Description |
|--------|------------|-------|-------------|
| `excellent` | 0.7 - 1.0 | Dark Green | Dense, healthy vegetation |
| `good` | 0.6 - 0.7 | Green | Healthy vegetation |
| `fair` | 0.5 - 0.6 | Yellow | Moderate vegetation |
| `poor` | 0.3 - 0.5 | Orange | Sparse vegetation |
| `critical` | 0.0 - 0.3 | Red | Very sparse or stressed vegetation |

### Error Responses

**400 Bad Request** - Invalid parcelle ID:

```json
{
  "success": false,
  "error": "Invalid parcelle ID format",
  "code": "VALIDATION_ERROR"
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - Access denied:

```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

**404 Not Found** - No NDVI data available:

```json
{
  "success": false,
  "error": "No NDVI data available for this parcelle. Please calculate NDVI first.",
  "code": "NDVI_NOT_FOUND"
}
```

**500 Internal Server Error**:

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

### Caching

This endpoint implements 24-hour caching via HTTP Cache-Control headers:

```
Cache-Control: public, max-age=86400, s-maxage=86400
```

Cached responses are served from:
- Browser cache (client-side)
- CDN cache (Vercel Edge Network)
- Database cache (most recent NDVI result)

To force a fresh calculation, use the `POST /api/satellite/ndvi` endpoint with `forceRecalculate: true`.

### Example Usage

**JavaScript (fetch)**:

```javascript
async function getHealthStatus(parcelleId) {
  const response = await fetch(
    `/api/satellite/health-status/${parcelleId}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
try {
  const { data } = await getHealthStatus('123e4567-e89b-12d3-a456-426614174000');
  console.log('Health Status:', data.healthStatus);
  console.log('NDVI:', data.meanNDVI);
  console.log('Trend:', data.trend?.direction);
  console.log('Recommendation:', data.recommendation);
} catch (error) {
  console.error('Failed to fetch health status:', error);
}
```

**TypeScript (with React hook)**:

```typescript
import { useState, useEffect } from 'react';
import type { HealthStatus } from '@/lib/satellite/types';

interface HealthStatusData {
  parcelleId: string;
  healthStatus: HealthStatus;
  meanNDVI: number;
  lastCalculationDate: Date;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changeRate: number;
    dataPoints: number;
  } | null;
  recommendation: string;
  cached: boolean;
}

function useHealthStatus(parcelleId: string) {
  const [data, setData] = useState<HealthStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealthStatus() {
      try {
        const response = await fetch(
          `/api/satellite/health-status/${parcelleId}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load health status');
      } finally {
        setLoading(false);
      }
    }

    fetchHealthStatus();
  }, [parcelleId]);

  return { data, loading, error };
}

// Usage in component
function ParcelleHealthBadge({ parcelleId }: { parcelleId: string }) {
  const { data, loading, error } = useHealthStatus(parcelleId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div className="health-badge">
      <span className={`status-${data.healthStatus}`}>
        {data.healthStatus.toUpperCase()}
      </span>
      <span className="ndvi">NDVI: {data.meanNDVI.toFixed(2)}</span>
      {data.trend && (
        <span className={`trend-${data.trend.direction}`}>
          {data.trend.direction === 'improving' ? '↑' : 
           data.trend.direction === 'declining' ? '↓' : '→'}
        </span>
      )}
      <p className="recommendation">{data.recommendation}</p>
    </div>
  );
}
```

---

---

## GET /api/satellite/temporal

Retrieve temporal NDVI data for a parcelle over a specified date range. Returns a timeline of NDVI values with summary statistics including trend analysis, significant changes, and average values.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only access temporal data for parcelles they have permission to view.

### Request

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parcelleId` | UUID | Yes | - | Unique identifier of the parcelle |
| `startDate` | ISO 8601 | Yes | - | Start date for temporal analysis (YYYY-MM-DD) |
| `endDate` | ISO 8601 | Yes | - | End date for temporal analysis (YYYY-MM-DD) |
| `interval` | String | No | monthly | Time interval: 'daily', 'weekly', or 'monthly' |

**Query Parameter Details**:

- **parcelleId**: Must be a valid UUID format. The user must have access to this parcelle.
- **startDate**: Start date in ISO 8601 format (YYYY-MM-DD). Must be before or equal to endDate.
- **endDate**: End date in ISO 8601 format (YYYY-MM-DD). Must be after or equal to startDate.
- **interval**: Time interval for data points:
  - `daily`: One data point per day
  - `weekly`: One data point per week (7 days apart)
  - `monthly`: One data point per month (same day of each month)
- **Date Range Limit**: Maximum 2 years between startDate and endDate

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T00:00:00Z",
    "interval": "monthly",
    "summary": {
      "timeline": [
        {
          "date": "2024-01-01T00:00:00Z",
          "ndvi": 0.62,
          "cloudCover": 15.5,
          "healthStatus": "good",
          "hasSignificantChange": false
        },
        {
          "date": "2024-02-01T00:00:00Z",
          "ndvi": 0.58,
          "cloudCover": 22.3,
          "healthStatus": "fair",
          "hasSignificantChange": false
        },
        {
          "date": "2024-03-01T00:00:00Z",
          "ndvi": 0.42,
          "cloudCover": 18.7,
          "healthStatus": "poor",
          "hasSignificantChange": true
        }
      ],
      "trend": {
        "trend": "declining",
        "changeRate": -0.03,
        "dataPoints": 12,
        "startDate": "2024-01-01T00:00:00Z",
        "endDate": "2024-12-31T00:00:00Z",
        "startNDVI": 0.62,
        "endNDVI": 0.48
      },
      "significantChanges": 2,
      "averageNDVI": 0.55,
      "averageCloudCover": 18.2
    }
  },
  "cached": false
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `data.parcelleId` | UUID | Parcelle identifier |
| `data.startDate` | ISO 8601 | Start date of the analysis period |
| `data.endDate` | ISO 8601 | End date of the analysis period |
| `data.interval` | String | Time interval used ('daily', 'weekly', 'monthly') |
| `data.summary.timeline` | Array | Array of temporal data points |
| `data.summary.timeline[].date` | ISO 8601 | Date of the data point |
| `data.summary.timeline[].ndvi` | Number | NDVI value at this date (-1 to 1, or NaN if missing) |
| `data.summary.timeline[].cloudCover` | Number | Cloud cover percentage (0-100) |
| `data.summary.timeline[].healthStatus` | String | Health status: "excellent", "good", "fair", "poor", or "critical" |
| `data.summary.timeline[].hasSignificantChange` | Boolean | Whether NDVI changed >0.15 from previous point |
| `data.summary.trend` | Object | Overall trend analysis using linear regression |
| `data.summary.trend.trend` | String | Trend direction: "improving", "stable", or "declining" |
| `data.summary.trend.changeRate` | Number | Rate of change in NDVI units per month |
| `data.summary.trend.dataPoints` | Number | Number of data points used for trend calculation |
| `data.summary.trend.startNDVI` | Number | NDVI value at start of period |
| `data.summary.trend.endNDVI` | Number | NDVI value at end of period |
| `data.summary.significantChanges` | Number | Count of significant changes (NDVI change > 0.15) |
| `data.summary.averageNDVI` | Number | Mean NDVI across all valid data points |
| `data.summary.averageCloudCover` | Number | Mean cloud cover across all data points |
| `cached` | Boolean | Whether data was served from cache (future feature) |

**Trend Classification**:

| Trend | Change Rate | Description |
|-------|-------------|-------------|
| `improving` | > +0.05 NDVI/month | Vegetation health is improving |
| `stable` | -0.05 to +0.05 NDVI/month | Vegetation health is stable |
| `declining` | < -0.05 NDVI/month | Vegetation health is declining |

**Significant Change Threshold**:
- A change is considered significant if the absolute NDVI difference from the previous data point exceeds 0.15 (15%)
- Significant changes typically indicate substantial vegetation changes (deforestation, disease, recovery, etc.)

### Error Responses

**400 Bad Request** - Invalid request parameters:

```json
{
  "error": "Missing required parameter: startDate",
  "code": "MISSING_START_DATE"
}
```

```json
{
  "error": "Invalid interval parameter. Must be one of: daily, weekly, monthly",
  "code": "INVALID_INTERVAL"
}
```

```json
{
  "error": "startDate must be before or equal to endDate",
  "code": "INVALID_DATE_RANGE"
}
```

```json
{
  "error": "Date range exceeds maximum allowed (2 years)",
  "code": "DATE_RANGE_TOO_LARGE"
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - Access denied:

```json
{
  "error": "You do not have permission to access this parcelle",
  "code": "FORBIDDEN"
}
```

**404 Not Found** - Parcelle not found:

```json
{
  "error": "Parcelle not found",
  "code": "PARCELLE_NOT_FOUND"
}
```

**422 Unprocessable Entity** - Insufficient data:

```json
{
  "error": "Insufficient data points for trend analysis. Required: 2, Available: 0",
  "code": "INSUFFICIENT_DATA",
  "details": {
    "requiredDataPoints": 2,
    "availableDataPoints": 0
  }
}
```

**500 Internal Server Error**:

```json
{
  "error": "Failed to retrieve temporal data",
  "code": "INTERNAL_SERVER_ERROR",
  "details": "Error message details"
}
```

### Caching Behavior

Temporal data is cached using Redis for improved performance:

- **Cache Key**: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`
- **Cache TTL**: 24 hours
- **Cache Invalidation**: Automatically invalidated when new NDVI calculation is performed for the parcelle
- **Cache Storage**: Redis (optional - gracefully falls back to no caching if Redis unavailable)
- **Cache Status**: Response includes `cached: true/false` field and `cachedAt` timestamp when data is from cache

**Cache Hit Response**:
```json
{
  "success": true,
  "data": { ... },
  "cached": true,
  "cachedAt": "2024-05-04T12:00:00.000Z"
}
```

**Cache Miss Response**:
```json
{
  "success": true,
  "data": { ... },
  "cached": false
}
```

**Configuration**:
Set `REDIS_URL` environment variable to enable caching:
```bash
REDIS_URL=redis://localhost:6379
```

If Redis is not configured, the API will function normally without caching.

### Example Usage

**cURL**:

```bash
# Get monthly temporal data for 2024
curl -X GET "https://cocoatrack.com/api/satellite/temporal?parcelleId=123e4567-e89b-12d3-a456-426614174000&startDate=2024-01-01&endDate=2024-12-31&interval=monthly" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get weekly temporal data for Q1 2024
curl -X GET "https://cocoatrack.com/api/satellite/temporal?parcelleId=123e4567-e89b-12d3-a456-426614174000&startDate=2024-01-01&endDate=2024-03-31&interval=weekly" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript (fetch)**:

```javascript
async function getTemporalData(parcelleId, startDate, endDate, interval = 'monthly') {
  const params = new URLSearchParams({
    parcelleId,
    startDate,
    endDate,
    interval,
  });

  const response = await fetch(`/api/satellite/temporal?${params}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
try {
  const result = await getTemporalData(
    '123e4567-e89b-12d3-a456-426614174000',
    '2024-01-01',
    '2024-12-31',
    'monthly'
  );
  
  console.log('Timeline:', result.data.summary.timeline);
  console.log('Trend:', result.data.summary.trend.trend);
  console.log('Average NDVI:', result.data.summary.averageNDVI);
  console.log('Significant changes:', result.data.summary.significantChanges);
} catch (error) {
  console.error('Failed to fetch temporal data:', error);
}
```

**TypeScript (with React hook)**:

```typescript
import { useState, useEffect } from 'react';
import type { TemporalDataPoint, NDVITrend } from '@/lib/satellite/types';

interface TemporalAnalysisSummary {
  timeline: TemporalDataPoint[];
  trend: NDVITrend;
  significantChanges: number;
  averageNDVI: number;
  averageCloudCover: number;
}

interface TemporalAnalysisResponse {
  success: boolean;
  data: {
    parcelleId: string;
    startDate: string;
    endDate: string;
    interval: string;
    summary: TemporalAnalysisSummary;
  };
  cached: boolean;
}

function useTemporalAnalysis(
  parcelleId: string,
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'monthly'
) {
  const [data, setData] = useState<TemporalAnalysisSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemporalData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          parcelleId,
          startDate,
          endDate,
          interval,
        });

        const response = await fetch(`/api/satellite/temporal?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        const result: TemporalAnalysisResponse = await response.json();
        setData(result.data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load temporal data');
      } finally {
        setLoading(false);
      }
    }

    fetchTemporalData();
  }, [parcelleId, startDate, endDate, interval]);

  return { data, loading, error };
}

// Usage in component
function TemporalChart({ parcelleId }: { parcelleId: string }) {
  const { data, loading, error } = useTemporalAnalysis(
    parcelleId,
    '2024-01-01',
    '2024-12-31',
    'monthly'
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div className="temporal-chart">
      <h3>NDVI Trend: {data.trend.trend}</h3>
      <p>Average NDVI: {data.averageNDVI.toFixed(3)}</p>
      <p>Significant Changes: {data.significantChanges}</p>
      
      <div className="timeline">
        {data.timeline.map((point, index) => (
          <div key={index} className="data-point">
            <span className="date">{new Date(point.date).toLocaleDateString()}</span>
            <span className="ndvi">{point.ndvi.toFixed(3)}</span>
            <span className={`status-${point.healthStatus}`}>
              {point.healthStatus}
            </span>
            {point.hasSignificantChange && <span className="alert">⚠️</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**TypeScript (CSV Export)**:

```typescript
async function exportTemporalDataAsCSV(
  parcelleId: string,
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'monthly'
): Promise<string> {
  // Fetch temporal data
  const params = new URLSearchParams({
    parcelleId,
    startDate,
    endDate,
    interval,
  });

  const response = await fetch(`/api/satellite/temporal?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch temporal data');
  }

  const result: TemporalAnalysisResponse = await response.json();
  const timeline = result.data.summary.timeline;

  // Generate CSV
  const headers = ['Date', 'NDVI', 'Health Status', 'Cloud Cover (%)', 'Significant Change'];
  const rows = timeline.map(point => [
    new Date(point.date).toISOString().split('T')[0],
    point.ndvi.toFixed(4),
    point.healthStatus,
    point.cloudCover.toFixed(2),
    point.hasSignificantChange ? 'Yes' : 'No',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

// Usage
async function downloadTemporalCSV(parcelleId: string) {
  try {
    const csv = await exportTemporalDataAsCSV(
      parcelleId,
      '2024-01-01',
      '2024-12-31',
      'monthly'
    );

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temporal-ndvi-${parcelleId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export CSV:', error);
  }
}
```

### Performance Considerations

**Response Times**:
- **Small date range** (< 3 months): < 500ms
- **Medium date range** (3-12 months): 500ms - 2s
- **Large date range** (1-2 years): 2s - 5s

**Optimization Tips**:
1. **Use appropriate interval**: Monthly interval is faster than daily for large date ranges
2. **Limit date range**: Request only the data you need (e.g., last 6 months instead of 2 years)
3. **Cache on client**: Store temporal data in client state to avoid repeated requests
4. **Batch requests**: If analyzing multiple parcelles, implement request queuing

**Data Point Limits**:
- **Daily interval**: Maximum ~730 data points (2 years)
- **Weekly interval**: Maximum ~104 data points (2 years)
- **Monthly interval**: Maximum ~24 data points (2 years)

### Best Practices

**1. Handle Missing Data**:

```typescript
function renderTimeline(timeline: TemporalDataPoint[]) {
  return timeline.map((point, index) => {
    // Check for missing data (NaN NDVI)
    if (isNaN(point.ndvi)) {
      return (
        <div key={index} className="data-point missing">
          <span className="date">{new Date(point.date).toLocaleDateString()}</span>
          <span className="no-data">No data available</span>
        </div>
      );
    }

    return (
      <div key={index} className="data-point">
        <span className="date">{new Date(point.date).toLocaleDateString()}</span>
        <span className="ndvi">{point.ndvi.toFixed(3)}</span>
        <span className={`status-${point.healthStatus}`}>{point.healthStatus}</span>
      </div>
    );
  });
}
```

**2. Visualize Trend**:

```typescript
function TrendIndicator({ trend }: { trend: NDVITrend }) {
  const getTrendIcon = () => {
    switch (trend.trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      case 'stable':
        return '➡️';
    }
  };

  const getTrendColor = () => {
    switch (trend.trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
    }
  };

  return (
    <div className={`trend-indicator ${getTrendColor()}`}>
      <span className="icon">{getTrendIcon()}</span>
      <span className="label">{trend.trend.toUpperCase()}</span>
      <span className="rate">
        {trend.changeRate > 0 ? '+' : ''}
        {trend.changeRate.toFixed(3)} NDVI/month
      </span>
    </div>
  );
}
```

**3. Highlight Significant Changes**:

```typescript
function TimelineWithAlerts({ timeline }: { timeline: TemporalDataPoint[] }) {
  const significantChanges = timeline.filter(point => point.hasSignificantChange);

  return (
    <div>
      {significantChanges.length > 0 && (
        <div className="alerts">
          <h4>⚠️ Significant Changes Detected</h4>
          <ul>
            {significantChanges.map((point, index) => (
              <li key={index}>
                {new Date(point.date).toLocaleDateString()}: NDVI = {point.ndvi.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Render timeline */}
    </div>
  );
}
```

---

## GET /api/satellite/deforestation

Retrieve deforestation alerts for a specific parcelle with optional status filtering. This endpoint supports EUDR compliance monitoring by providing access to detected deforestation events.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only access alerts for parcelles they have permission to view, enforced through Row Level Security (RLS) policies based on user role:
- **Admin**: Can access all alerts
- **Certification Auditor**: Can access all alerts (for EUDR compliance verification)
- **Cooperative Manager**: Can access alerts for parcelles in their cooperative
- **Agronomist**: Can access alerts for parcelles they manage
- **Planteur**: Can access alerts for their own parcelles

### Request

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parcelleId` | UUID | Yes | - | Unique identifier of the parcelle |
| `status` | String | No | - | Filter by alert status: 'pending', 'acknowledged', 'disputed', or 'resolved' |

**Query Parameter Details**:

- **parcelleId**: Must be a valid UUID format. The user must have access to this parcelle.
- **status**: Optional filter to retrieve only alerts with a specific status. If omitted, returns all alerts for the parcelle.

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
        "baselineDate": "2020-12-31T00:00:00Z",
        "detectionDate": "2024-05-01T00:00:00Z",
        "baselineNDVI": 0.75,
        "currentNDVI": 0.40,
        "ndviChange": -0.35,
        "affectedAreaHectares": 1.5,
        "affectedAreaPercent": 30.0,
        "status": "pending",
        "acknowledgedBy": null,
        "acknowledgedAt": null,
        "acknowledgmentNotes": null,
        "disputedBy": null,
        "disputedAt": null,
        "disputeReason": null,
        "createdAt": "2024-05-01T10:00:00Z",
        "updatedAt": "2024-05-01T10:00:00Z"
      }
    ],
    "compliant": false,
    "summary": {
      "totalAlerts": 3,
      "pendingAlerts": 1,
      "acknowledgedAlerts": 2,
      "disputedAlerts": 0
    }
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `alerts` | Array | Array of deforestation alert objects |
| `alerts[].id` | UUID | Unique identifier for the alert |
| `alerts[].parcelleId` | UUID | Parcelle identifier |
| `alerts[].baselineDate` | ISO 8601 | EUDR baseline date (typically December 31, 2020) |
| `alerts[].detectionDate` | ISO 8601 | Date when deforestation was detected |
| `alerts[].baselineNDVI` | Number | NDVI value at baseline date |
| `alerts[].currentNDVI` | Number | NDVI value at detection date |
| `alerts[].ndviChange` | Number | NDVI change from baseline (negative indicates vegetation loss) |
| `alerts[].affectedAreaHectares` | Number | Area affected by deforestation in hectares |
| `alerts[].affectedAreaPercent` | Number | Percentage of parcelle affected by deforestation |
| `alerts[].status` | String | Alert status: "pending", "acknowledged", "disputed", or "resolved" |
| `alerts[].acknowledgedBy` | UUID \| null | User ID who acknowledged the alert |
| `alerts[].acknowledgedAt` | ISO 8601 \| null | Timestamp when alert was acknowledged |
| `alerts[].acknowledgmentNotes` | String \| null | Notes provided when acknowledging |
| `alerts[].disputedBy` | UUID \| null | User ID who disputed the alert |
| `alerts[].disputedAt` | ISO 8601 \| null | Timestamp when alert was disputed |
| `alerts[].disputeReason` | String \| null | Reason provided when disputing |
| `alerts[].createdAt` | ISO 8601 | Timestamp when alert was created |
| `alerts[].updatedAt` | ISO 8601 | Timestamp when alert was last updated |
| `compliant` | Boolean | EUDR compliance status (true if no pending/disputed alerts) |
| `summary` | Object | Summary statistics for all alerts |
| `summary.totalAlerts` | Number | Total number of alerts for the parcelle |
| `summary.pendingAlerts` | Number | Number of alerts with "pending" status |
| `summary.acknowledgedAlerts` | Number | Number of alerts with "acknowledged" status |
| `summary.disputedAlerts` | Number | Number of alerts with "disputed" status |

**EUDR Compliance Determination**:

A parcelle is considered EUDR compliant (`compliant: true`) if:
- No pending alerts exist
- No disputed alerts exist
- All alerts have been acknowledged or resolved

### Error Responses

**400 Bad Request** - Missing or invalid parameters:

```json
{
  "success": false,
  "error": "parcelleId query parameter is required",
  "code": "VALIDATION_ERROR"
}
```

```json
{
  "success": false,
  "error": "Invalid request: Invalid parcelle ID format",
  "code": "VALIDATION_ERROR"
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - User cannot access this parcelle:

```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

**500 Internal Server Error** - Server error:

```json
{
  "success": false,
  "error": "Failed to retrieve deforestation alerts",
  "code": "RETRIEVAL_ERROR"
}
```

### Example Requests

**cURL - Get All Alerts**:

```bash
curl -X GET "https://cocoatrack.com/api/satellite/deforestation?parcelleId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**cURL - Get Pending Alerts Only**:

```bash
curl -X GET "https://cocoatrack.com/api/satellite/deforestation?parcelleId=123e4567-e89b-12d3-a456-426614174000&status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript (fetch) - Get All Alerts**:

```javascript
async function getDeforestationAlerts(parcelleId, status = null) {
  const params = new URLSearchParams({ parcelleId });
  if (status) params.append('status', status);

  const response = await fetch(
    `/api/satellite/deforestation?${params}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
try {
  const result = await getDeforestationAlerts(
    '123e4567-e89b-12d3-a456-426614174000'
  );
  
  console.log('Alerts:', result.data.alerts);
  console.log('EUDR Compliant:', result.data.compliant);
  console.log('Summary:', result.data.summary);
} catch (error) {
  console.error('Failed to fetch alerts:', error);
}
```

**TypeScript (with React hook)**:

```typescript
import { useState, useEffect } from 'react';
import type { DeforestationEvent } from '@/lib/satellite/types';

interface DeforestationAlertsResponse {
  alerts: DeforestationEvent[];
  compliant: boolean;
  summary: {
    totalAlerts: number;
    pendingAlerts: number;
    acknowledgedAlerts: number;
    disputedAlerts: number;
  };
}

function useDeforestationAlerts(
  parcelleId: string,
  status?: 'pending' | 'acknowledged' | 'disputed' | 'resolved'
) {
  const [data, setData] = useState<DeforestationAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ parcelleId });
        if (status) params.append('status', status);

        const response = await fetch(
          `/api/satellite/deforestation?${params}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [parcelleId, status]);

  return { data, loading, error };
}

// Usage in component
function DeforestationAlertsList({ parcelleId }: { parcelleId: string }) {
  const { data, loading, error } = useDeforestationAlerts(parcelleId, 'pending');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  return (
    <div className="deforestation-alerts">
      <div className="compliance-badge">
        {data.compliant ? (
          <span className="compliant">✓ EUDR Compliant</span>
        ) : (
          <span className="non-compliant">⚠ EUDR Non-Compliant</span>
        )}
      </div>

      <div className="summary">
        <p>Total Alerts: {data.summary.totalAlerts}</p>
        <p>Pending: {data.summary.pendingAlerts}</p>
        <p>Acknowledged: {data.summary.acknowledgedAlerts}</p>
        <p>Disputed: {data.summary.disputedAlerts}</p>
      </div>

      <div className="alerts-list">
        {data.alerts.map((alert) => (
          <div key={alert.id} className={`alert alert-${alert.status}`}>
            <h4>Alert #{alert.id.slice(0, 8)}</h4>
            <p>Detection Date: {new Date(alert.detectionDate).toLocaleDateString()}</p>
            <p>NDVI Change: {alert.ndviChange.toFixed(3)}</p>
            <p>Affected Area: {alert.affectedAreaHectares.toFixed(2)} ha ({alert.affectedAreaPercent.toFixed(1)}%)</p>
            <p>Status: {alert.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Best Practices

**1. Check Compliance Status**:

```typescript
async function checkEUDRCompliance(parcelleId: string): Promise<boolean> {
  const response = await fetch(
    `/api/satellite/deforestation?parcelleId=${parcelleId}`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    throw new Error('Failed to check compliance');
  }

  const result = await response.json();
  return result.data.compliant;
}
```

**2. Filter by Status**:

```typescript
// Get only pending alerts that need attention
const pendingAlerts = await getDeforestationAlerts(parcelleId, 'pending');

// Get acknowledged alerts for audit trail
const acknowledgedAlerts = await getDeforestationAlerts(parcelleId, 'acknowledged');
```

**3. Monitor Alert Trends**:

```typescript
function AlertSummaryCard({ summary }: { summary: DeforestationAlertsResponse['summary'] }) {
  const totalResolved = summary.acknowledgedAlerts;
  const totalUnresolved = summary.pendingAlerts + summary.disputedAlerts;
  const resolutionRate = summary.totalAlerts > 0
    ? (totalResolved / summary.totalAlerts) * 100
    : 0;

  return (
    <div className="alert-summary">
      <h3>Deforestation Alerts Summary</h3>
      <p>Total: {summary.totalAlerts}</p>
      <p>Resolved: {totalResolved}</p>
      <p>Unresolved: {totalUnresolved}</p>
      <p>Resolution Rate: {resolutionRate.toFixed(1)}%</p>
    </div>
  );
}
```

---

## POST /api/satellite/deforestation/check

Trigger deforestation detection for a specific parcelle by comparing NDVI values between a baseline date and current date. This endpoint performs the actual deforestation analysis and creates alerts if vegetation loss exceeds the threshold.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only trigger detection for parcelles they have permission to view.

### Request

**Request Body** (JSON):

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parcelleId` | UUID | Yes | - | Unique identifier of the parcelle |
| `baselineDate` | ISO 8601 | No | 2020-12-31 | Baseline date for comparison (EUDR baseline) |
| `currentDate` | ISO 8601 | No | Today | Current date for comparison |

**Request Body Example**:

```json
{
  "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
  "baselineDate": "2020-12-31T00:00:00Z",
  "currentDate": "2024-05-03T00:00:00Z"
}
```

**Body Parameter Details**:

- **parcelleId**: Must be a valid UUID format. The user must have access to this parcelle.
- **baselineDate**: Optional. Defaults to December 31, 2020 (EUDR baseline date). Must be in ISO 8601 format.
- **currentDate**: Optional. Defaults to today's date. Must be in ISO 8601 format.

### Response

**Success Response - Deforestation Detected** (201 Created):

```json
{
  "success": true,
  "data": {
    "detected": true,
    "baselineNDVI": 0.75,
    "currentNDVI": 0.40,
    "ndviChange": -0.35,
    "affectedAreaHectares": 1.5,
    "affectedAreaPercent": 30.0,
    "alerts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
        "baselineDate": "2020-12-31T00:00:00Z",
        "detectionDate": "2024-05-03T00:00:00Z",
        "baselineNDVI": 0.75,
        "currentNDVI": 0.40,
        "ndviChange": -0.35,
        "affectedAreaHectares": 1.5,
        "affectedAreaPercent": 30.0,
        "status": "pending",
        "acknowledgedBy": null,
        "acknowledgedAt": null,
        "acknowledgmentNotes": null,
        "disputedBy": null,
        "disputedAt": null,
        "disputeReason": null,
        "createdAt": "2024-05-03T12:00:00Z",
        "updatedAt": "2024-05-03T12:00:00Z"
      }
    ],
    "message": "Deforestation detected: NDVI decreased by 0.3500 (30.0% of parcelle area affected)"
  }
}
```

**Success Response - No Deforestation** (200 OK):

```json
{
  "success": true,
  "data": {
    "detected": false,
    "baselineNDVI": 0.68,
    "currentNDVI": 0.65,
    "ndviChange": -0.03,
    "affectedAreaHectares": 0.0,
    "affectedAreaPercent": 0.0,
    "alerts": [],
    "message": "No deforestation detected"
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `detected` | Boolean | Whether deforestation was detected |
| `baselineNDVI` | Number | NDVI value at baseline date |
| `currentNDVI` | Number | NDVI value at current date |
| `ndviChange` | Number | NDVI change from baseline (negative indicates vegetation loss) |
| `affectedAreaHectares` | Number | Area affected by deforestation in hectares |
| `affectedAreaPercent` | Number | Percentage of parcelle affected by deforestation |
| `alerts` | Array | Array of created deforestation alerts (empty if no deforestation) |
| `message` | String | Human-readable description of the detection result |

**Deforestation Detection Criteria**:

Deforestation is detected when:
1. **NDVI decrease > 0.3** (30% vegetation loss)
2. **Affected area > 0.5 hectares**

These thresholds align with EUDR requirements for detecting significant vegetation loss.

### Error Responses

**400 Bad Request** - Invalid request parameters:

```json
{
  "success": false,
  "error": "Invalid request: Invalid parcelle ID format",
  "code": "VALIDATION_ERROR"
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - User cannot access this parcelle:

```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

**404 Not Found** - Parcelle not found:

```json
{
  "success": false,
  "error": "Parcelle not found or missing geometry data",
  "code": "PARCELLE_NOT_FOUND"
}
```

**503 Service Unavailable** - Insufficient satellite data:

```json
{
  "success": false,
  "error": "Insufficient satellite data available for deforestation detection",
  "code": "INSUFFICIENT_DATA"
}
```

**500 Internal Server Error** - Server error:

```json
{
  "success": false,
  "error": "Failed to detect deforestation",
  "code": "DETECTION_ERROR"
}
```

### Example Requests

**cURL - Check with Default Dates**:

```bash
curl -X POST "https://cocoatrack.com/api/satellite/deforestation/check" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**cURL - Check with Custom Dates**:

```bash
curl -X POST "https://cocoatrack.com/api/satellite/deforestation/check" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "baselineDate": "2020-12-31T00:00:00Z",
    "currentDate": "2024-05-03T00:00:00Z"
  }'
```

**JavaScript (fetch)**:

```javascript
async function checkDeforestation(parcelleId, baselineDate = null, currentDate = null) {
  const body = { parcelleId };
  if (baselineDate) body.baselineDate = baselineDate;
  if (currentDate) body.currentDate = currentDate;

  const response = await fetch('/api/satellite/deforestation/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Usage
try {
  const result = await checkDeforestation(
    '123e4567-e89b-12d3-a456-426614174000'
  );
  
  if (result.data.detected) {
    console.log('⚠ Deforestation detected!');
    console.log('NDVI Change:', result.data.ndviChange);
    console.log('Affected Area:', result.data.affectedAreaHectares, 'ha');
    console.log('Alerts created:', result.data.alerts.length);
  } else {
    console.log('✓ No deforestation detected');
  }
} catch (error) {
  console.error('Failed to check deforestation:', error);
}
```

**TypeScript (with React hook)**:

```typescript
import { useState } from 'react';
import type { DeforestationEvent } from '@/lib/satellite/types';

interface DeforestationCheckResult {
  detected: boolean;
  baselineNDVI: number;
  currentNDVI: number;
  ndviChange: number;
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  alerts: DeforestationEvent[];
  message: string;
}

function useDeforestationCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeforestationCheckResult | null>(null);

  const checkDeforestation = async (
    parcelleId: string,
    baselineDate?: string,
    currentDate?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const body: any = { parcelleId };
      if (baselineDate) body.baselineDate = baselineDate;
      if (currentDate) body.currentDate = currentDate;

      const response = await fetch('/api/satellite/deforestation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      setResult(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check deforestation';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { checkDeforestation, loading, error, result };
}

// Usage in component
function DeforestationChecker({ parcelleId }: { parcelleId: string }) {
  const { checkDeforestation, loading, error, result } = useDeforestationCheck();

  const handleCheck = async () => {
    try {
      await checkDeforestation(parcelleId);
    } catch (error) {
      console.error('Check failed:', error);
    }
  };

  return (
    <div className="deforestation-checker">
      <button onClick={handleCheck} disabled={loading}>
        {loading ? 'Checking...' : 'Check for Deforestation'}
      </button>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className={`result ${result.detected ? 'alert' : 'success'}`}>
          <h3>{result.message}</h3>
          
          <div className="metrics">
            <p>Baseline NDVI: {result.baselineNDVI.toFixed(3)}</p>
            <p>Current NDVI: {result.currentNDVI.toFixed(3)}</p>
            <p>Change: {result.ndviChange.toFixed(3)}</p>
          </div>

          {result.detected && (
            <div className="alert-details">
              <p>Affected Area: {result.affectedAreaHectares.toFixed(2)} ha</p>
              <p>Percentage: {result.affectedAreaPercent.toFixed(1)}%</p>
              <p>Alerts Created: {result.alerts.length}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Best Practices

**1. Periodic Monitoring**:

```typescript
// Check for deforestation monthly
async function scheduleDeforestationCheck(parcelleId: string) {
  const result = await checkDeforestation(parcelleId);
  
  if (result.data.detected) {
    // Send notification to cooperative manager
    await sendDeforestationNotification(parcelleId, result.data);
  }
  
  return result;
}
```

**2. Batch Checking**:

```typescript
// Check multiple parcelles
async function batchCheckDeforestation(parcelleIds: string[]) {
  const results = await Promise.allSettled(
    parcelleIds.map(id => checkDeforestation(id))
  );

  const detected = results.filter(
    r => r.status === 'fulfilled' && r.value.data.detected
  );

  console.log(`Checked ${parcelleIds.length} parcelles`);
  console.log(`Deforestation detected in ${detected.length} parcelles`);

  return results;
}
```

**3. Error Handling**:

```typescript
async function checkWithRetry(parcelleId: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await checkDeforestation(parcelleId);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## PATCH /api/satellite/deforestation/:alertId

Update the status of a deforestation alert by acknowledging or disputing it.

### Authentication

**Required**: Yes (Supabase JWT)

Users can only update alerts for parcelles they have permission to manage. Access is enforced through Row Level Security (RLS) policies based on user role:
- **Admin**: Can update all alerts
- **Certification Auditor**: Can update all alerts
- **Cooperative Manager**: Can update alerts for parcelles in their cooperative
- **Agronomist**: Can update alerts for parcelles they manage
- **Planteur**: Can update alerts for their own parcelles

### Request

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `alertId` | UUID | Yes | Unique identifier of the deforestation alert |

**Request Body**:

```json
{
  "action": "acknowledge" | "dispute",
  "notes": "string (optional for acknowledge)",
  "reason": "string (required for dispute)"
}
```

**Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | String | Yes | Action to perform: "acknowledge" or "dispute" |
| `notes` | String | No | Optional notes when acknowledging an alert |
| `reason` | String | Conditional | Required when action is "dispute". Reason for disputing the alert |

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
      "baselineDate": "2020-12-31T00:00:00Z",
      "detectionDate": "2024-05-01T00:00:00Z",
      "baselineNDVI": 0.75,
      "currentNDVI": 0.40,
      "ndviChange": -0.35,
      "affectedAreaHectares": 1.5,
      "affectedAreaPercent": 30.0,
      "status": "acknowledged",
      "acknowledgedBy": "user-123",
      "acknowledgedAt": "2024-05-04T10:30:00Z",
      "acknowledgmentNotes": "Verified deforestation. Intervention planned.",
      "disputedBy": null,
      "disputedAt": null,
      "disputeReason": null,
      "createdAt": "2024-05-01T10:00:00Z",
      "updatedAt": "2024-05-04T10:30:00Z"
    }
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `alert.id` | UUID | Unique identifier for the alert |
| `alert.parcelleId` | UUID | Parcelle identifier |
| `alert.baselineDate` | ISO 8601 | EUDR baseline date (typically December 31, 2020) |
| `alert.detectionDate` | ISO 8601 | Date when deforestation was detected |
| `alert.baselineNDVI` | Number | NDVI value at baseline date |
| `alert.currentNDVI` | Number | NDVI value at detection date |
| `alert.ndviChange` | Number | NDVI change from baseline (negative indicates vegetation loss) |
| `alert.affectedAreaHectares` | Number | Area affected by deforestation in hectares |
| `alert.affectedAreaPercent` | Number | Percentage of parcelle affected by deforestation |
| `alert.status` | String | Alert status: "pending", "acknowledged", "disputed", or "resolved" |
| `alert.acknowledgedBy` | UUID | User ID who acknowledged the alert (null if not acknowledged) |
| `alert.acknowledgedAt` | ISO 8601 | Timestamp when alert was acknowledged (null if not acknowledged) |
| `alert.acknowledgmentNotes` | String | Notes provided when acknowledging (null if not acknowledged) |
| `alert.disputedBy` | UUID | User ID who disputed the alert (null if not disputed) |
| `alert.disputedAt` | ISO 8601 | Timestamp when alert was disputed (null if not disputed) |
| `alert.disputeReason` | String | Reason provided when disputing (null if not disputed) |
| `alert.createdAt` | ISO 8601 | Timestamp when alert was created |
| `alert.updatedAt` | ISO 8601 | Timestamp when alert was last updated |

### Error Responses

**400 Bad Request** - Invalid request parameters:

```json
{
  "success": false,
  "error": "Invalid request: Action must be either \"acknowledge\" or \"dispute\"",
  "code": "VALIDATION_ERROR"
}
```

**400 Bad Request** - Missing required field:

```json
{
  "success": false,
  "error": "Invalid request: Reason is required when disputing an alert",
  "code": "VALIDATION_ERROR"
}
```

**401 Unauthorized** - Authentication required:

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden** - User cannot access this alert:

```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

**404 Not Found** - Alert not found:

```json
{
  "success": false,
  "error": "Alert not found",
  "code": "FORBIDDEN"
}
```

**500 Internal Server Error** - Server error:

```json
{
  "success": false,
  "error": "Failed to update alert status",
  "code": "UPDATE_ERROR"
}
```

### Audit Logging

All alert status updates are automatically logged in the `satellite_audit_logs` table with the following information:
- User ID who performed the action
- Parcelle ID associated with the alert
- Event type: "deforestation_acknowledged" or "deforestation_disputed"
- Event metadata including alert ID, action, notes/reason
- IP address and user agent from the request
- Timestamp of the action

### Example Requests

**cURL - Acknowledge Alert**:

```bash
curl -X PATCH "https://cocoatrack.com/api/satellite/deforestation/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "acknowledge",
    "notes": "Verified deforestation. Intervention planned for next week."
  }'
```

**cURL - Dispute Alert**:

```bash
curl -X PATCH "https://cocoatrack.com/api/satellite/deforestation/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "dispute",
    "reason": "False positive - seasonal leaf drop, not deforestation"
  }'
```

**JavaScript (fetch) - Acknowledge Alert**:

```javascript
const response = await fetch(
  '/api/satellite/deforestation/550e8400-e29b-41d4-a716-446655440000',
  {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'acknowledge',
      notes: 'Verified deforestation. Intervention planned.',
    }),
  }
);

if (response.ok) {
  const data = await response.json();
  console.log('Updated alert:', data.data.alert);
  console.log('Status:', data.data.alert.status);
} else {
  const error = await response.json();
  console.error('Error:', error.error);
}
```

**JavaScript (fetch) - Dispute Alert**:

```javascript
const response = await fetch(
  '/api/satellite/deforestation/550e8400-e29b-41d4-a716-446655440000',
  {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'dispute',
      reason: 'False positive - seasonal leaf drop, not deforestation',
    }),
  }
);

if (response.ok) {
  const data = await response.json();
  console.log('Updated alert:', data.data.alert);
  console.log('Status:', data.data.alert.status);
  console.log('Dispute reason:', data.data.alert.disputeReason);
} else {
  const error = await response.json();
  console.error('Error:', error.error);
}
```

### Usage Notes

1. **Status Transitions**: Alerts can transition from "pending" to either "acknowledged" or "disputed". Once acknowledged or disputed, the status can be changed again if needed.

2. **Audit Trail**: All status changes are logged with full audit information including user, timestamp, and reason/notes.

3. **Authorization**: Users can only update alerts for parcelles they have access to. The system enforces role-based access control.

4. **Validation**: The endpoint validates that:
   - Alert ID is a valid UUID
   - Action is either "acknowledge" or "dispute"
   - Reason is provided when disputing
   - User has access to the alert's parcelle

5. **EUDR Compliance**: Acknowledged alerts indicate that deforestation has been verified and documented. Disputed alerts indicate potential false positives that require further investigation.

---

## Support

For API support, please contact:
- **Technical Issues**: dev@cocoatrack.com
- **Documentation**: docs@cocoatrack.com
- **Rate Limit Increases**: api@cocoatrack.com

---

## Changelog

### Version 1.3.0 (2024-05-04)
- Added GET /api/satellite/temporal endpoint
- Temporal NDVI analysis with timeline and trend calculation
- Support for daily, weekly, and monthly intervals
- Significant change detection (NDVI change > 0.15)
- Linear regression-based trend analysis
- Summary statistics (average NDVI, cloud cover, change count)
- Date range validation (maximum 2 years)

### Version 1.2.0 (2024-05-03)
- Added POST /api/satellite/ndvi endpoint
- NDVI calculation with health status classification
- Support for force recalculation
- Comprehensive error handling for insufficient data
- Processing time metrics for performance monitoring

### Version 1.1.0 (2024-05-03)
- Added GET /api/satellite/health-status/:parcelleId endpoint
- Health status retrieval with NDVI value, trend, and recommendations
- 24-hour HTTP caching for health status data
- Trend analysis over past 3 months

### Version 1.0.0 (2024-05-03)
- Initial release
- GET /api/satellite/imagery endpoint
- Authentication and authorization
- Rate limiting (100 req/min)
- Cloud cover filtering
- Multi-tier caching
- Comprehensive error handling


---

## GET /api/satellite/cache

Retrieve Redis cache statistics for monitoring cache performance.

### Authentication

**Required**: No (public endpoint for monitoring)

### Request

No parameters required.

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "redis": {
      "available": true,
      "status": "connected"
    },
    "stats": {
      "hits": 150,
      "misses": 50,
      "errors": 0,
      "hitRate": 75.0,
      "total": 200
    }
  }
}
```

**Response Fields**:

- `redis.available` (boolean): Whether Redis is connected and available
- `redis.status` (string): Connection status ("connected" or "disconnected")
- `stats.hits` (number): Total number of cache hits
- `stats.misses` (number): Total number of cache misses
- `stats.errors` (number): Total number of cache errors
- `stats.hitRate` (number): Cache hit rate as percentage (0-100)
- `stats.total` (number): Total cache operations (hits + misses)

**Error Response** (500 Internal Server Error):

```json
{
  "error": "Failed to retrieve cache statistics",
  "code": "INTERNAL_SERVER_ERROR",
  "details": "Error message"
}
```

### Example Usage

**cURL**:

```bash
curl -X GET "https://cocoatrack.com/api/satellite/cache"
```

**JavaScript (fetch)**:

```javascript
const response = await fetch('/api/satellite/cache');
const data = await response.json();

console.log('Cache hit rate:', data.data.stats.hitRate + '%');
console.log('Redis status:', data.data.redis.status);
```

---

## DELETE /api/satellite/cache

Clear all temporal caches (admin operation).

### Authentication

**Required**: Yes (Supabase JWT with admin role)

Only users with the `admin` role can clear the cache.

### Request

No parameters required.

### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "All temporal caches cleared successfully",
    "deletedCount": 42
  }
}
```

**Response Fields**:

- `message` (string): Success message
- `deletedCount` (number): Number of cache entries deleted

**Error Responses**:

**401 Unauthorized**:
```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden**:
```json
{
  "error": "Admin role required to clear cache",
  "code": "FORBIDDEN"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to clear cache",
  "code": "INTERNAL_SERVER_ERROR",
  "details": "Error message"
}
```

### Example Usage

**cURL**:

```bash
curl -X DELETE "https://cocoatrack.com/api/satellite/cache" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript (fetch)**:

```javascript
const response = await fetch('/api/satellite/cache', {
  method: 'DELETE',
  credentials: 'include', // Include session cookies
});

const data = await response.json();
console.log('Deleted cache entries:', data.data.deletedCount);
```

---

## Cache Management

### Overview

The Satellite Imagery API uses Redis for caching temporal NDVI queries to improve performance and reduce database load. Caching is optional and the API gracefully falls back to direct database queries when Redis is unavailable.

### Configuration

To enable caching, set the `REDIS_URL` environment variable:

```bash
REDIS_URL=redis://localhost:6379
```

For production deployments, use a managed Redis service like:
- **Upstash** (serverless Redis)
- **Redis Cloud**
- **AWS ElastiCache**
- **Google Cloud Memorystore**

### Cache Behavior

**Temporal Data Caching**:
- **Cache Key Format**: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`
- **TTL**: 24 hours
- **Invalidation**: Automatic when new NDVI data is calculated for a parcelle
- **Graceful Fallback**: If Redis is unavailable, queries execute normally without caching

**Cache Invalidation**:
When new NDVI data is calculated for a parcelle (via POST /api/satellite/ndvi), all temporal caches for that parcelle are automatically invalidated. This ensures users always see up-to-date data.

**Invalidation Key Format**: `ndvi_invalidation:{parcelleId}`

### Monitoring Cache Performance

Use the GET /api/satellite/cache endpoint to monitor cache performance:

```javascript
const response = await fetch('/api/satellite/cache');
const { stats } = await response.json();

console.log(`Cache hit rate: ${stats.hitRate}%`);
console.log(`Total operations: ${stats.total}`);
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
```

**Recommended Hit Rate**: 60% or higher for optimal performance.

### Cache Clearing

Admins can manually clear all temporal caches using the DELETE /api/satellite/cache endpoint. This is useful for:
- Troubleshooting cache-related issues
- Forcing a refresh of all cached data
- Maintenance operations

**Note**: Cache clearing requires admin role and should be used sparingly as it will temporarily increase database load.

### Best Practices

1. **Enable Redis in Production**: Always use Redis caching in production for optimal performance
2. **Monitor Hit Rate**: Regularly check cache hit rate to ensure caching is effective
3. **Use Managed Redis**: Use a managed Redis service for reliability and automatic backups
4. **Set Connection Pooling**: Configure Redis connection pooling for high-traffic applications
5. **Handle Graceful Degradation**: The API automatically handles Redis unavailability, but monitor for errors

### Troubleshooting

**Cache Not Working**:
1. Verify `REDIS_URL` is set correctly
2. Check Redis connection with: `redis-cli ping` (should return "PONG")
3. Check application logs for Redis connection errors
4. Verify Redis is accessible from your application server

**Low Hit Rate**:
1. Check if cache is being invalidated too frequently
2. Verify TTL is appropriate (24 hours default)
3. Monitor for Redis memory issues
4. Check if queries have high variability (different date ranges)

**Cache Invalidation Issues**:
1. Verify NDVI calculation is calling invalidation
2. Check Redis logs for errors
3. Manually clear cache using DELETE /api/satellite/cache
4. Verify invalidation timestamps are being set correctly



---

## Notifications

### Health Status Change Notifications

The system automatically sends notifications when a parcelle's health status declines significantly.

#### Notification Type

**Type**: `health_status_decline`

#### Trigger Conditions

Notifications are automatically created when:
- Health status declines by **2 or more categories**
- Examples:
  - Good → Poor (2 category decline) ✅
  - Excellent → Fair (2 category decline) ✅
  - Good → Critical (3 category decline) ✅
  - Good → Fair (1 category decline) ❌ No notification
  - Poor → Good (improvement) ❌ No notification

#### Recipients

Notifications are sent to:
1. **Cooperative Managers** - All users with `manager` or `admin` role in the parcelle's cooperative
2. **Planteur (Owner)** - The farmer who owns the parcelle (if they have a user account)

#### Notification Structure

**Database Record**:

```typescript
interface HealthStatusNotification {
  id: string;                      // UUID
  user_id: string;                 // UUID - recipient
  type: 'health_status_decline';   // Notification type
  title: string;                   // French title
  body: string;                    // French description with details
  payload: {
    parcelle_id: string;           // UUID
    parcelle_name: string;         // Parcelle name
    parcelle_code: string;         // Parcelle code
    previous_status: HealthStatus; // Previous health status
    current_status: HealthStatus;  // Current health status
    mean_ndvi: number;             // Current mean NDVI value
    calculation_date: string;      // ISO 8601 date
    decline_amount: number;        // Number of categories declined
    recommendation: string;        // French recommendation text
  };
  read_at: string | null;          // ISO 8601 or null if unread
  created_at: string;              // ISO 8601
}
```

**Example Notification**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "type": "health_status_decline",
  "title": "Alerte: Déclin de santé de parcelle",
  "body": "La parcelle \"Parcelle Nord\" (Code: PN-001) a connu un déclin significatif de santé: Bon → Faible. NDVI moyen: 0.350. Recommandation: Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides).",
  "payload": {
    "parcelle_id": "789e4567-e89b-12d3-a456-426614174000",
    "parcelle_name": "Parcelle Nord",
    "parcelle_code": "PN-001",
    "previous_status": "good",
    "current_status": "poor",
    "mean_ndvi": 0.35,
    "calculation_date": "2024-05-03T00:00:00Z",
    "decline_amount": 2,
    "recommendation": "Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides)."
  },
  "read_at": null,
  "created_at": "2024-05-03T12:00:00Z"
}
```

#### Recommendations by Health Status

The notification includes context-specific recommendations in French:

| Status | Recommendation |
|--------|----------------|
| **Excellent** | Les cacaoyers sont en excellente santé. Continuez les pratiques actuelles de gestion et d'ombrage. |
| **Good** | Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d'entretien. |
| **Fair** | Santé acceptable des cacaoyers. Vérifiez l'irrigation, la fertilisation et l'ombrage. Surveillez les signes de stress. |
| **Poor** | Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides). |
| **Critical** | État critique des cacaoyers. Intervention immédiate requise. Consultez un agronome spécialisé en cacao. Vérifiez l'ombrage, l'irrigation et les maladies. |

#### Accessing Notifications

**Get User Notifications**:

```typescript
// Get all unread notifications
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .is('read_at', null)
  .order('created_at', { ascending: false });

// Get health status decline notifications
const { data: healthNotifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .eq('type', 'health_status_decline')
  .order('created_at', { ascending: false });
```

**Mark Notification as Read**:

```typescript
// Mark single notification as read
const { error } = await supabase
  .rpc('mark_notification_read', {
    p_notification_id: notificationId
  });

// Mark all notifications as read
const { error } = await supabase
  .rpc('mark_all_notifications_read');
```

**Get Unread Count**:

```typescript
// Get count of unread notifications
const { data: count } = await supabase
  .rpc('get_unread_notification_count');

console.log('Unread notifications:', count);
```

#### Implementation Details

**Database Trigger**:

The notification system uses a PostgreSQL trigger on the `ndvi_results` table:

```sql
CREATE TRIGGER trigger_notify_health_status_decline
  AFTER INSERT OR UPDATE OF health_status
  ON public.ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_health_status_decline();
```

**Automatic Notification Flow**:

1. NDVI is calculated and stored in `ndvi_results` table
2. Trigger fires on INSERT/UPDATE of `health_status` column
3. Function compares current status with previous status
4. If decline ≥ 2 categories:
   - Retrieves parcelle details
   - Gets cooperative managers
   - Gets planteur user_id
   - Creates notification for each recipient
5. Notifications appear in user's notification center

**Performance**:

- Trigger execution: < 50ms
- Notification creation: < 100ms per recipient
- No impact on NDVI calculation performance

#### Example Usage

**React Component**:

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const supabase = createClient(/* ... */);

  useEffect(() => {
    // Load unread count
    async function loadUnreadCount() {
      const { data } = await supabase
        .rpc('get_unread_notification_count');
      setUnreadCount(data || 0);
    }

    loadUnreadCount();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setUnreadCount(prev => prev + 1);
          // Show toast notification
          showToast(payload.new.title, payload.new.body);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="notification-bell">
      <BellIcon />
      {unreadCount > 0 && (
        <span className="badge">{unreadCount}</span>
      )}
    </div>
  );
}
```

**Health Status Notification Handler**:

```typescript
async function handleHealthStatusNotification(notification: HealthStatusNotification) {
  const { payload } = notification;
  
  // Extract notification details
  const {
    parcelle_id,
    parcelle_name,
    parcelle_code,
    previous_status,
    current_status,
    mean_ndvi,
    decline_amount,
    recommendation,
  } = payload;

  // Show alert to user
  alert(`
    Parcelle: ${parcelle_name} (${parcelle_code})
    Changement: ${previous_status} → ${current_status}
    NDVI: ${mean_ndvi.toFixed(3)}
    Déclin: ${decline_amount} catégories
    
    ${recommendation}
  `);

  // Navigate to parcelle detail page
  router.push(`/parcelles/${parcelle_id}`);

  // Mark notification as read
  await supabase.rpc('mark_notification_read', {
    p_notification_id: notification.id,
  });
}
```

#### Related Documentation

- [Health Status Notifications](../satellite/health-status-notifications.md) - Complete documentation
- [NDVI Calculation](../satellite/ndvi-calculation.md) - NDVI calculation details
- [Health Status Classification](../satellite/health-status-classification.md) - Health status thresholds

---

## Related Resources

### Documentation

- [Satellite Imagery Setup](../satellite/gee-setup.md)
- [NDVI Calculation](../satellite/ndvi-calculation.md)
- [Health Status Classification](../satellite/health-status-classification.md)
- [Health Status Notifications](../satellite/health-status-notifications.md)
- [Temporal Analysis](../satellite/temporal-analysis.md)
- [Deforestation Detection](../satellite/deforestation-detection.md)
- [Database Schema](../database/schema.md)

### Code Examples

- [NDVI Service](../../lib/satellite/services/ndvi.service.ts)
- [Imagery Service](../../lib/satellite/services/imagery.service.ts)
- [React Hooks](../../hooks/satellite/)
- [API Routes](../../app/api/satellite/)

### Testing

- [NDVI Service Tests](../../tests/satellite/services/ndvi.service.test.ts)
- [Health Status Notification Tests](../../tests/satellite/notifications/health-status-notifications.test.ts)
- [API Integration Tests](../../tests/api/satellite/)

---

## Support

For questions or issues with the Satellite Imagery API:

1. Check the [Troubleshooting Guide](../satellite/troubleshooting.md)
2. Review [Common Issues](../satellite/common-issues.md)
3. Contact the development team

---

## Changelog

### Version 1.4.0 (May 7, 2026)

**Added**:
- GET /api/satellite/deforestation endpoint - Retrieve deforestation alerts with EUDR compliance status
- POST /api/satellite/deforestation/check endpoint - Trigger deforestation detection for parcelles
- PATCH /api/satellite/deforestation/:alertId endpoint - Acknowledge or dispute deforestation alerts
- EUDR compliance determination based on alert status
- Deforestation alert summary statistics
- Audit logging for all alert status changes
- Support for filtering alerts by status (pending, acknowledged, disputed, resolved)
- Comprehensive error handling and validation for deforestation endpoints

**Detection Criteria**:
- NDVI decrease > 0.3 (30% vegetation loss)
- Affected area > 0.5 hectares
- Baseline date defaults to December 31, 2020 (EUDR baseline)

**Authorization**:
- Role-based access control for all deforestation endpoints
- Admin and Certification Auditor have full access
- Cooperative Managers can access alerts for their cooperative
- Agronomists can access alerts for assigned parcelles
- Planteurs can access alerts for their own parcelles

### Version 1.3.0 (May 6, 2026)

**Added**:
- Health status change notifications
- Automatic notification trigger for 2+ category declines
- French recommendations for each health status
- Notification delivery to cooperative managers and planteurs

### Version 1.2.0 (May 3, 2026)

**Added**:
- NDVI calculation endpoint
- Health status classification
- Temporal analysis support
- Redis caching for temporal queries

### Version 1.1.0 (May 3, 2026)

**Added**:
- GET /api/satellite/health-status/:parcelleId endpoint
- Health status retrieval with NDVI value, trend, and recommendations
- 24-hour HTTP caching for health status data
- Trend analysis over past 3 months

### Version 1.0.0 (April 27, 2026)

**Initial Release**:
- GET /api/satellite/imagery endpoint
- Satellite imagery retrieval
- Google Earth Engine integration
- Sentinel-2 imagery support
- Cloud cover filtering
- Basic caching
- Authentication and authorization
- Rate limiting (100 req/min)

---

## Future Endpoints

The following endpoints are planned for future releases:

- `POST /api/satellite/export/kml` - Export parcelle data as KML files for Google Earth visualization
- `GET /api/satellite/yield-prediction` - ML-based yield predictions using NDVI trends and historical data
- `POST /api/satellite/certification-report` - Generate EUDR compliance reports with before/after imagery
- `GET /api/satellite/batch/ndvi` - Batch NDVI calculation for multiple parcelles
- `POST /api/satellite/batch/deforestation` - Batch deforestation detection for cooperative-wide monitoring

---
