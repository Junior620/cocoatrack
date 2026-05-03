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

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters (malformed UUID, invalid date format, etc.) |
| `UNAUTHORIZED` | 401 | Authentication required or JWT token invalid |
| `FORBIDDEN` | 403 | User does not have permission to access the requested parcelle |
| `IMAGERY_UNAVAILABLE` | 404 | No imagery found matching the specified criteria |
| `CLOUD_COVER_EXCEEDED` | 422 | Available imagery exceeds cloud cover threshold |
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

## Future Endpoints

The following endpoints are planned for future releases:

- `GET /api/satellite/ndvi` - Calculate and retrieve NDVI values
- `GET /api/satellite/temporal` - Temporal analysis with historical data
- `GET /api/satellite/deforestation` - Deforestation detection and alerts
- `POST /api/satellite/export/kml` - Export parcelle data as KML
- `GET /api/satellite/yield-prediction` - ML-based yield predictions
- `POST /api/satellite/certification-report` - Generate EUDR compliance reports

---

## Support

For API support, please contact:
- **Technical Issues**: dev@cocoatrack.com
- **Documentation**: docs@cocoatrack.com
- **Rate Limit Increases**: api@cocoatrack.com

---

## Changelog

### Version 1.0.0 (2024-05-03)
- Initial release
- GET /api/satellite/imagery endpoint
- Authentication and authorization
- Rate limiting (100 req/min)
- Cloud cover filtering
- Multi-tier caching
- Comprehensive error handling
