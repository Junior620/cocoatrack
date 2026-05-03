# Satellite Imagery API - Rate Limiting

## Overview

The satellite imagery API endpoints implement rate limiting to prevent abuse and ensure fair usage of the Google Earth Engine API resources. Rate limiting is enforced on a per-user basis with clear feedback through HTTP headers.

## Rate Limit Configuration

### Imagery Endpoint

- **Endpoint**: `GET /api/satellite/imagery`
- **Limit**: 100 requests per minute per user
- **Window**: 60 seconds (rolling window)
- **Tracking**: By user ID + IP address + endpoint

### Rate Limit Headers

All responses from the imagery endpoint include the following headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed per window | `100` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `95` |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets | `1777796665` |
| `Retry-After` | Seconds to wait before retrying (only when rate limited) | `45` |

## Response Codes

### 200 OK - Request Successful

```json
{
  "imagery": {
    "id": "...",
    "parcelleId": "...",
    "acquisitionDate": "2024-05-01T00:00:00Z",
    "cloudCoverPercent": 15.2,
    "tileUrl": "https://..."
  },
  "cached": false
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1777796665
```

### 429 Too Many Requests - Rate Limit Exceeded

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1777796665
Retry-After: 45
```

## Implementation Details

### Rate Limiting Strategy

The rate limiting implementation uses an in-memory store with the following characteristics:

1. **Per-User Tracking**: Rate limits are tracked per authenticated user ID
2. **IP-Based Fallback**: For unauthenticated requests, IP address is used
3. **Endpoint-Specific**: Each endpoint has its own rate limit counter
4. **Rolling Window**: The time window resets after 60 seconds from the first request
5. **Automatic Cleanup**: Expired entries are automatically cleaned up every minute

### Rate Limit Identifier

The rate limit identifier is constructed as:
```
{ip}:{userId}:{endpoint}
```

Example:
```
192.168.1.1:123e4567-e89b-12d3-a456-426614174000:/api/satellite/imagery
```

### Storage

**Current Implementation**: In-memory Map (suitable for single-instance deployments)

**Production Recommendation**: For multi-instance deployments, consider using:
- Redis (recommended for distributed systems)
- Upstash (serverless Redis alternative)
- Database-backed rate limiting

## Client Implementation

### JavaScript/TypeScript Example

```typescript
async function fetchSatelliteImagery(parcelleId: string) {
  const response = await fetch(
    `/api/satellite/imagery?parcelleId=${parcelleId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return fetchSatelliteImagery(parcelleId);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  // Log remaining requests
  console.log(`Remaining requests: ${remaining}`);
  
  return data;
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export function useSatelliteImagery(parcelleId: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/satellite/imagery?parcelleId=${parcelleId}`
        );

        // Extract rate limit info
        setRateLimit({
          limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
          remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
          reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
        });

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    if (parcelleId) {
      fetchData();
    }
  }, [parcelleId]);

  return { data, loading, error, rateLimit };
}
```

## Best Practices

### 1. Monitor Rate Limit Headers

Always check the `X-RateLimit-Remaining` header to avoid hitting the limit:

```typescript
if (remaining < 10) {
  console.warn('Approaching rate limit. Consider throttling requests.');
}
```

### 2. Implement Exponential Backoff

When rate limited, implement exponential backoff for retries:

```typescript
async function fetchWithBackoff(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);
    
    if (response.status !== 429) {
      return response;
    }
    
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    const backoffTime = retryAfter * Math.pow(2, i) * 1000;
    
    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }
  
  throw new Error('Max retries exceeded');
}
```

### 3. Cache Responses

Implement client-side caching to reduce API calls:

```typescript
const cache = new Map();

async function fetchWithCache(parcelleId: string) {
  const cacheKey = `imagery:${parcelleId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }
  
  const data = await fetchSatelliteImagery(parcelleId);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}
```

### 4. Batch Requests

When fetching data for multiple parcelles, batch requests to stay within limits:

```typescript
async function fetchMultipleParcelles(parcelleIds: string[]) {
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < parcelleIds.length; i += batchSize) {
    const batch = parcelleIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(id => fetchSatelliteImagery(id))
    );
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < parcelleIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

## Monitoring and Debugging

### Check Current Rate Limit Status

You can check your current rate limit status by making a request and inspecting the headers:

```bash
curl -i -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-domain.com/api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000"
```

Look for the rate limit headers in the response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1777796665
```

### Calculate Time Until Reset

```typescript
function getTimeUntilReset(resetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const seconds = resetTimestamp - now;
  
  if (seconds <= 0) {
    return 'Reset now';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}m ${remainingSeconds}s`;
}
```

## Troubleshooting

### Issue: Rate Limit Exceeded Unexpectedly

**Possible Causes:**
1. Multiple browser tabs/windows making concurrent requests
2. Automated scripts or background processes
3. Shared IP address with other users

**Solutions:**
- Implement request queuing on the client side
- Add delays between requests
- Use caching to reduce API calls

### Issue: Rate Limit Not Resetting

**Possible Causes:**
1. Server time synchronization issues
2. In-memory store not cleaning up expired entries

**Solutions:**
- Check server time is synchronized (NTP)
- Restart the application to clear the in-memory store
- Consider using Redis for persistent rate limiting

### Issue: Different Rate Limits for Same User

**Possible Causes:**
1. Requests coming from different IP addresses (VPN, mobile network)
2. Multiple user sessions

**Solutions:**
- Rate limiting is per user ID, so this should not happen
- Check that authentication is working correctly
- Verify user ID is consistent across requests

## Future Enhancements

### Planned Improvements

1. **Redis Integration**: Move to Redis for distributed rate limiting
2. **Dynamic Limits**: Adjust limits based on user role (higher limits for agronomists)
3. **Burst Allowance**: Allow short bursts above the limit
4. **Rate Limit Dashboard**: Admin interface to monitor and adjust limits
5. **Per-Endpoint Limits**: Different limits for different satellite endpoints

### Configuration Options

Future versions may support configurable rate limits via environment variables:

```env
RATE_LIMIT_IMAGERY_MAX_REQUESTS=100
RATE_LIMIT_IMAGERY_WINDOW_MS=60000
RATE_LIMIT_NDVI_MAX_REQUESTS=50
RATE_LIMIT_NDVI_WINDOW_MS=60000
```

## Related Documentation

- [Satellite Imagery API](./api-reference.md)
- [Security Middleware](../security/middleware.md)
- [Error Handling](./error-handling.md)
- [Caching Strategy](./caching.md)
