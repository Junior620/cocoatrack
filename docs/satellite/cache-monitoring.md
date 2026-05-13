# Cache Monitoring

This document describes the cache monitoring system for the satellite imagery feature.

## Overview

The cache monitoring system tracks performance metrics for both local (Supabase) and Redis caches, generates alerts when thresholds are exceeded, and provides visibility into cache health.

## Features

### 1. Metrics Collection

The monitoring system collects the following metrics:

**Local Cache (Supabase)**:
- Total number of cache entries
- Total size in bytes
- Number of unique parcelles cached
- Breakdown by data type (imagery, NDVI, bands)
- Oldest and newest cache entries

**Redis Cache**:
- Cache hits
- Cache misses
- Errors
- Hit rate percentage
- Availability status

**Combined Metrics**:
- Overall hit rate
- Total memory usage
- Memory usage percentage

### 2. Alert Generation

The system generates alerts when thresholds are exceeded:

| Alert Type | Threshold | Severity |
|------------|-----------|----------|
| Low Hit Rate | < 50% | Warning |
| Very Low Hit Rate | < 30% | Critical |
| High Memory | > 80% of 500MB | Warning |
| Critical Memory | > 95% of 500MB | Critical |
| Redis Unavailable | N/A | Warning |

**Alert Cooldown**: Alerts of the same type are throttled with a 15-minute cooldown to prevent spam.

### 3. Performance Logging

The system logs cache metrics at 5-minute intervals, storing up to 24 hours of history (288 entries).

Each log entry includes:
- Timestamp
- Hit rate
- Memory usage in bytes
- Request count
- Active alerts

### 4. Health Status

The system provides an overall health status:

- **Healthy**: No alerts, hit rate above threshold
- **Degraded**: Warning alerts present or hit rate below threshold
- **Critical**: Critical alerts present

## Usage

### Starting Monitoring

Monitoring is automatically started when the application initializes:

```typescript
import { initializeCacheMonitoring } from '@/lib/satellite/jobs/cache-monitoring.job';

// Start monitoring on app startup
initializeCacheMonitoring();
```

### Accessing Metrics via API

**Endpoint**: `GET /api/satellite/cache/metrics`

**Authentication**: Admin only

**Query Parameters**:
- `includeHistory` (boolean): Include performance history (default: false)
- `historyLimit` (number): Limit history entries (default: 50)

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/satellite/cache/metrics?includeHistory=true&historyLimit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "metrics": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "localCache": {
      "totalEntries": 150,
      "totalSizeBytes": 75000000,
      "uniqueParcelles": 30,
      "entriesByType": {
        "imagery": 60,
        "ndvi": 60,
        "bands": 30
      },
      "oldestEntry": "2024-01-01T00:00:00.000Z",
      "newestEntry": "2024-01-15T10:00:00.000Z"
    },
    "redisCache": {
      "hits": 1200,
      "misses": 300,
      "errors": 0,
      "hitRate": 80,
      "isAvailable": true
    },
    "combined": {
      "totalHitRate": 80,
      "totalMemoryBytes": 75000000,
      "memoryUsagePercent": 15
    },
    "alerts": []
  },
  "health": {
    "status": "healthy",
    "hitRate": 80,
    "memoryUsage": 15,
    "activeAlerts": 0,
    "redisAvailable": true
  },
  "history": [
    {
      "timestamp": "2024-01-15T10:25:00.000Z",
      "hitRate": 78,
      "memoryBytes": 74000000,
      "requestCount": 1450,
      "alerts": []
    }
  ]
}
```

### Resetting Statistics

**Endpoint**: `POST /api/satellite/cache/metrics/reset`

**Authentication**: Admin only

**Example Request**:
```bash
curl -X POST "https://your-domain.com/api/satellite/cache/metrics/reset" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Programmatic Access

```typescript
import { getCacheMonitor } from '@/lib/satellite/services/cache-monitor.service';

// Get current metrics
const cacheMonitor = getCacheMonitor();
const metrics = await cacheMonitor.getMetrics();

// Get health summary
const health = await cacheMonitor.getHealthSummary();

// Get performance history
const history = cacheMonitor.getPerformanceHistory(50);

// Clear history
cacheMonitor.clearHistory();

// Reset alert cooldowns
cacheMonitor.resetAlertCooldowns();
```

## Configuration

### Thresholds

Thresholds are configured in `lib/satellite/services/cache-monitor.service.ts`:

```typescript
// Minimum acceptable cache hit rate (50%)
const MIN_HIT_RATE_THRESHOLD = 50;

// Interval for logging cache metrics (5 minutes)
const METRICS_LOG_INTERVAL = 5 * 60 * 1000;

// Maximum memory usage threshold (500 MB)
const MAX_MEMORY_THRESHOLD = 500 * 1024 * 1024;
```

### Alert Cooldown

Alert cooldown period is configured in the `CacheMonitorService` class:

```typescript
private alertCooldown = 15 * 60 * 1000; // 15 minutes
```

## Monitoring Best Practices

### 1. Regular Review

- Review cache metrics daily via the API endpoint
- Monitor for consistent low hit rates (< 50%)
- Watch for memory usage trends approaching the threshold

### 2. Alert Response

**Low Hit Rate Alerts**:
- Investigate query patterns - are users requesting uncached data?
- Check if cache TTLs are too short
- Consider increasing cache size limits
- Review cache warming job effectiveness

**High Memory Alerts**:
- Trigger manual cache eviction if needed
- Review cache retention policies
- Consider increasing the memory threshold
- Check for memory leaks in cache service

**Redis Unavailable Alerts**:
- Check Redis connection configuration
- Verify Redis server is running
- Review Redis logs for errors
- System will fall back to local cache only

### 3. Performance Optimization

- Aim for hit rate > 70% for optimal performance
- Keep memory usage < 60% of threshold for headroom
- Monitor request patterns to optimize cache warming
- Review and adjust cache TTLs based on data freshness needs

## Troubleshooting

### Low Hit Rate

**Symptoms**: Hit rate consistently below 50%

**Possible Causes**:
- Cache TTLs too short
- Users requesting unique/uncached data
- Cache warming not effective
- Cache eviction too aggressive

**Solutions**:
1. Increase cache TTLs in service configurations
2. Implement more aggressive cache warming
3. Increase cache size limits
4. Review and optimize query patterns

### High Memory Usage

**Symptoms**: Memory usage > 80% of threshold

**Possible Causes**:
- Too many parcelles cached
- Large imagery files
- Cache not evicting properly
- Memory leak

**Solutions**:
1. Reduce cache size limit (MAX_CACHED_PARCELLES)
2. Implement more aggressive LRU eviction
3. Compress cached imagery
4. Review cache service for memory leaks

### Redis Connection Issues

**Symptoms**: Redis unavailable alerts

**Possible Causes**:
- Redis server down
- Network connectivity issues
- Configuration errors
- Authentication failures

**Solutions**:
1. Verify REDIS_URL environment variable
2. Check Redis server status
3. Review Redis logs
4. Test connection manually
5. System will gracefully fall back to local cache

## Integration with Existing Systems

The cache monitoring system integrates with:

1. **Cache Service** (`lib/satellite/services/cache.service.ts`): Monitors local Supabase cache
2. **Redis Cache Service** (`lib/satellite/services/redis-cache.service.ts`): Monitors Redis cache
3. **Background Jobs**: Automatic monitoring on app startup
4. **Admin API**: Exposes metrics to administrators

## Future Enhancements

Potential improvements for the cache monitoring system:

1. **Dashboard UI**: Visual dashboard for cache metrics
2. **Email Alerts**: Send email notifications for critical alerts
3. **Slack Integration**: Post alerts to Slack channels
4. **Metrics Export**: Export metrics to external monitoring systems (Prometheus, Datadog)
5. **Predictive Alerts**: ML-based prediction of cache issues before they occur
6. **Auto-Scaling**: Automatically adjust cache size based on usage patterns
7. **Cost Tracking**: Track API costs and cache savings

## Related Documentation

- [Caching Strategy](./caching.md)
- [Redis Cache Service](../api/satellite.md#redis-cache)
- [Performance Optimization](./performance.md)
