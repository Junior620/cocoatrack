# Redis Caching for Satellite Imagery Services

## Overview

The satellite imagery services implement multi-layer caching using Redis as a fast, in-memory cache layer. This document describes the Redis caching implementation, configuration, and usage.

## Architecture

### Multi-Layer Caching Strategy

The satellite imagery system uses a three-tier caching architecture:

1. **Redis Cache (Level 1)** - Fast, in-memory cache with short TTL
   - Imagery data: 7-day TTL
   - NDVI results: 24-hour TTL
   - Temporal queries: 24-hour TTL

2. **Database Cache (Level 2)** - Persistent cache in PostgreSQL
   - NDVI results stored indefinitely
   - 24-hour freshness check for cache validity

3. **Supabase Storage (Level 3)** - Long-term storage for imagery tiles
   - Imagery tiles: 90-day retention
   - NDVI rasters: 30-day retention

### Cache Flow

```
Request → Redis Cache → Database Cache → Google Earth Engine API
            ↓ hit          ↓ hit              ↓ miss
         Return         Return            Fetch & Cache
```

## Configuration

### Environment Variables

Add the following environment variable to enable Redis caching:

```bash
# Redis connection URL
REDIS_URL=redis://localhost:6379

# Or for Redis Cloud/Upstash
REDIS_URL=rediss://default:password@host:port
```

### Redis Setup Options

#### Option 1: Local Redis (Development)

```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                  # macOS

# Start Redis
redis-server

# Test connection
redis-cli ping  # Should return "PONG"
```

#### Option 2: Redis Cloud (Production)

1. Sign up for [Redis Cloud](https://redis.com/try-free/) or [Upstash](https://upstash.com/)
2. Create a new Redis database
3. Copy the connection URL
4. Add to environment variables

#### Option 3: Docker (Development)

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 redis:7-alpine

# Verify
docker ps
```

## Cache Keys

### Imagery Cache Keys

Format: `imagery:{parcelleId}:{date}`

Example: `imagery:123e4567-e89b-12d3-a456-426614174000:2024-01-15`

**TTL**: 7 days (604,800 seconds)

### NDVI Cache Keys

Format: `ndvi:{parcelleId}:{date}`

Example: `ndvi:123e4567-e89b-12d3-a456-426614174000:2024-01-15`

**TTL**: 24 hours (86,400 seconds)

### Temporal Query Cache Keys

Format: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`

Example: `temporal:123e4567-e89b-12d3-a456-426614174000:2024-01-01:2024-12-31:monthly`

**TTL**: 24 hours (86,400 seconds)

### Invalidation Keys

Format: `ndvi_invalidation:{parcelleId}`

Example: `ndvi_invalidation:123e4567-e89b-12d3-a456-426614174000`

**TTL**: 30 days (2,592,000 seconds)

## Usage

### ImageryService with Redis Caching

The `ImageryService` automatically uses Redis caching:

```typescript
import { imageryService } from '@/lib/satellite/services/imagery.service';

// First call - cache miss, fetches from GEE
const imagery1 = await imageryService.getImagery(
  'parcelle-123',
  geometry,
  new Date('2024-01-15')
);

// Second call - cache hit, returns from Redis
const imagery2 = await imageryService.getImagery(
  'parcelle-123',
  geometry,
  new Date('2024-01-15')
);
```

### NDVIService with Redis Caching

The `NDVIService` implements two-level caching:

```typescript
import { ndviService } from '@/lib/satellite/services/ndvi.service';

// First call - cache miss, calculates NDVI
const ndvi1 = await ndviService.calculateNDVI(
  'parcelle-123',
  geometry,
  new Date('2024-01-15')
);

// Second call - Redis cache hit
const ndvi2 = await ndviService.calculateNDVI(
  'parcelle-123',
  geometry,
  new Date('2024-01-15')
);
```

### Cache Invalidation

When new NDVI data is calculated, all related caches are invalidated:

```typescript
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';

// Invalidate all caches for a parcelle
await redisCacheService.invalidateParcelleCache('parcelle-123');

// This affects:
// - NDVI cache for this parcelle
// - Temporal query caches for this parcelle
```

### Manual Cache Operations

```typescript
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';

// Get cache statistics
const stats = redisCacheService.getCacheStats();
console.log('Hit rate:', stats.hitRate, '%');
console.log('Total hits:', stats.hits);
console.log('Total misses:', stats.misses);

// Check if Redis is available
if (redisCacheService.isAvailable()) {
  console.log('Redis is connected');
} else {
  console.log('Redis is not available, using fallback');
}

// Clear all temporal caches (admin operation)
const deleted = await redisCacheService.clearAllTemporalCaches();
console.log('Cleared', deleted, 'cache entries');

// Reset statistics
redisCacheService.resetStats();
```

## Graceful Degradation

The Redis caching implementation includes graceful degradation:

1. **Redis Not Configured**: If `REDIS_URL` is not set, caching is disabled and services work normally without Redis
2. **Connection Failures**: If Redis connection fails, services fall back to database cache
3. **Cache Errors**: If cache operations fail, the error is logged but doesn't break the service

Example logs:

```
[Redis Cache] REDIS_URL not configured, caching disabled
[Redis Cache] Connection error: ECONNREFUSED
[Redis Cache] Error retrieving cached data: timeout
```

## Performance Benefits

### Without Redis

- NDVI calculation: ~2-3 seconds (includes GEE API call)
- Temporal query: ~5-10 seconds (multiple database queries)

### With Redis

- NDVI calculation (cached): ~50-100ms (Redis lookup)
- Temporal query (cached): ~100-200ms (Redis lookup)

**Performance improvement**: 20-50x faster for cached requests

## Monitoring

### Cache Hit Rate

Monitor cache effectiveness:

```typescript
const stats = redisCacheService.getCacheStats();
const hitRate = stats.hitRate;

if (hitRate < 50) {
  console.warn('Low cache hit rate:', hitRate, '%');
  // Consider:
  // - Increasing TTL
  // - Pre-warming cache
  // - Analyzing access patterns
}
```

### Cache Size

Monitor Redis memory usage:

```bash
# Connect to Redis
redis-cli

# Check memory usage
INFO memory

# Check number of keys
DBSIZE

# List all cache keys
KEYS imagery:*
KEYS ndvi:*
KEYS temporal:*
```

### Recommended Alerts

Set up alerts for:

- Cache hit rate < 50%
- Redis connection failures
- Memory usage > 80%
- High error rate in cache operations

## Best Practices

### 1. Cache Warming

Pre-warm cache for frequently accessed parcelles:

```typescript
// Background job to pre-cache favorite parcelles
async function warmCache(parcelleIds: string[]) {
  for (const parcelleId of parcelleIds) {
    const geometry = await getParcelleGeometry(parcelleId);
    const date = new Date();
    
    // This will cache the result
    await ndviService.calculateNDVI(parcelleId, geometry, date);
  }
}
```

### 2. Cache Invalidation Strategy

Invalidate caches when data changes:

```typescript
// After NDVI calculation
await ndviService.calculateNDVI(parcelleId, geometry, date);
// Cache is automatically invalidated

// After parcelle update
await updateParcelle(parcelleId, updates);
await redisCacheService.invalidateParcelleCache(parcelleId);
```

### 3. TTL Selection

Choose appropriate TTLs based on data volatility:

- **Imagery data**: 7 days (satellite imagery doesn't change)
- **NDVI results**: 24 hours (vegetation changes slowly)
- **Temporal queries**: 24 hours (historical data is stable)

### 4. Error Handling

Always handle cache errors gracefully:

```typescript
try {
  const cached = await redisCacheService.getNDVIData(parcelleId, date);
  if (cached) {
    return cached;
  }
} catch (error) {
  console.error('Cache error:', error);
  // Fall back to database or recalculation
}
```

## Troubleshooting

### Redis Connection Issues

**Problem**: `ECONNREFUSED` or connection timeout

**Solutions**:
1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` is correct
3. Check firewall rules
4. Verify network connectivity

### High Memory Usage

**Problem**: Redis using too much memory

**Solutions**:
1. Check cache size: `redis-cli DBSIZE`
2. Reduce TTLs
3. Implement cache eviction policy
4. Increase Redis memory limit

### Low Hit Rate

**Problem**: Cache hit rate < 50%

**Solutions**:
1. Increase TTLs
2. Implement cache warming
3. Analyze access patterns
4. Check cache invalidation frequency

### Cache Inconsistency

**Problem**: Cached data doesn't match database

**Solutions**:
1. Verify invalidation logic
2. Check TTL settings
3. Clear cache: `await redisCacheService.clearAllTemporalCaches()`
4. Restart Redis

## Security Considerations

### 1. Connection Security

Use TLS for production:

```bash
# Redis Cloud/Upstash provides TLS by default
REDIS_URL=rediss://default:password@host:port
```

### 2. Access Control

Restrict Redis access:

```bash
# Redis ACL (Redis 6+)
ACL SETUSER cocoatrack on >password ~imagery:* ~ndvi:* ~temporal:* +get +set +del
```

### 3. Data Sensitivity

Be aware of cached data:

- Imagery URLs are public
- NDVI results contain parcelle IDs
- Temporal queries contain date ranges

Consider encryption for sensitive data.

## Migration Guide

### Enabling Redis on Existing System

1. **Install Redis** (see Configuration section)

2. **Add environment variable**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. **Restart application**:
   ```bash
   npm run build
   npm start
   ```

4. **Verify connection**:
   ```typescript
   import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';
   console.log('Redis available:', redisCacheService.isAvailable());
   ```

5. **Monitor performance**:
   - Check cache hit rate
   - Monitor response times
   - Verify memory usage

### Disabling Redis

To disable Redis caching:

1. Remove `REDIS_URL` from environment variables
2. Restart application
3. Services will fall back to database cache

No code changes required - graceful degradation is built-in.

## References

- [Redis Documentation](https://redis.io/docs/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Upstash Redis](https://upstash.com/docs/redis)
- [Redis Cloud](https://redis.com/redis-enterprise-cloud/overview/)
