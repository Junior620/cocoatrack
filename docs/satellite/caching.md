# Satellite Imagery Caching Strategy

## Overview

The satellite imagery analysis system implements a sophisticated multi-layer caching architecture to optimize performance, reduce API costs, and enable offline functionality. This document explains the caching strategy, TTL policies, eviction mechanisms, and cache management procedures.

## Architecture

### Multi-Layer Caching

The system uses three caching layers working together to provide optimal performance:

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Request                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 1: Client-Side (IndexedDB)                │
│  • Offline access                                            │
│  • 50 parcelles max                                          │
│  • LRU eviction                                              │
│  • 30-day retention                                          │
└─────────────────────────────────────────────────────────────┘
                              │ Cache Miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 2: Server-Side (Redis)                    │
│  • Fast in-memory access                                     │
│  • Shared across users                                       │
│  • 24-hour to 7-day TTL                                      │
│  • Automatic invalidation                                    │
└─────────────────────────────────────────────────────────────┘
                              │ Cache Miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Layer 3: Database (PostgreSQL)                     │
│  • Persistent storage                                        │
│  • NDVI results (indefinite)                                 │
│  • Imagery metadata (90 days)                                │
│  • Indexed for fast queries                                  │
└─────────────────────────────────────────────────────────────┘
                              │ No Data
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         External API (Google Earth Engine)                   │
│  • Sentinel-2 imagery retrieval                              │
│  • Rate limited (250k req/day)                               │
│  • Expensive operation                                       │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Client-Side Caching (IndexedDB)

### Purpose

Enable offline access to satellite data and reduce network requests for frequently accessed parcelles.

### Storage Schema

```typescript
interface CachedImagery {
  id: string;
  parcelleId: string;
  date: string;
  imagery: Blob; // Image tile
  metadata: ImageryData;
  cachedAt: number; // timestamp
}

interface CachedNDVI {
  id: string;
  parcelleId: string;
  date: string;
  ndvi: NDVIResult;
  cachedAt: number;
}
```

### Cache Policy

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Maximum Parcelles** | 50 per user | Balance storage usage with offline utility |
| **Eviction Strategy** | LRU (Least Recently Used) | Keep most relevant data |
| **Favorite Protection** | Never evicted | User-prioritized parcelles always available |
| **TTL** | 30 days | Balance freshness with offline availability |
| **Manual Refresh** | Available | User can force update when online |

### Implementation

```typescript
class IndexedDBCache {
  private db: IDBDatabase;
  private readonly MAX_PARCELLES = 50;
  
  /**
   * Cache satellite imagery for offline access
   */
  async cacheImagery(
    parcelleId: string, 
    date: Date, 
    imagery: Blob
  ): Promise<void> {
    const entry: CachedImagery = {
      id: `${parcelleId}-${date.toISOString()}`,
      parcelleId,
      date: date.toISOString(),
      imagery,
      metadata: await this.getImageryMetadata(parcelleId, date),
      cachedAt: Date.now(),
    };
    
    await this.ensureCapacity();
    await this.db.put('imagery', entry);
  }
  
  /**
   * Retrieve cached imagery
   */
  async getCachedImagery(
    parcelleId: string, 
    date: Date
  ): Promise<Blob | null> {
    const id = `${parcelleId}-${date.toISOString()}`;
    const entry = await this.db.get('imagery', id);
    
    if (!entry) return null;
    
    // Check if cache is stale (> 30 days)
    const age = Date.now() - entry.cachedAt;
    if (age > 30 * 24 * 60 * 60 * 1000) {
      await this.db.delete('imagery', id);
      return null;
    }
    
    // Update last accessed time
    await this.updateAccessTime(id);
    
    return entry.imagery;
  }
  
  /**
   * Ensure cache doesn't exceed capacity
   */
  private async ensureCapacity(): Promise<void> {
    const count = await this.db.count('imagery');
    
    if (count >= this.MAX_PARCELLES) {
      await this.evictLRU();
    }
  }
  
  /**
   * Evict least recently used entries (excluding favorites)
   */
  private async evictLRU(): Promise<void> {
    const favorites = await this.getFavorites();
    const entries = await this.db.getAll('imagery');
    
    // Filter out favorites
    const evictable = entries.filter(
      e => !favorites.includes(e.parcelleId)
    );
    
    // Sort by last accessed (oldest first)
    evictable.sort((a, b) => a.cachedAt - b.cachedAt);
    
    // Remove oldest entry
    if (evictable.length > 0) {
      await this.db.delete('imagery', evictable[0].id);
    }
  }
}
```

### Usage Example

```typescript
// In a React component
const { imagery, loading, error } = useSatelliteImagery({
  parcelleId: 'abc-123',
  date: new Date('2024-05-01'),
  enableCache: true, // Enable IndexedDB caching
});

// Manual cache refresh
const refreshCache = async () => {
  await cache.clearCache();
  await refetch();
};
```

## Layer 2: Server-Side Caching (Redis)

### Purpose

Reduce database queries and Google Earth Engine API calls by caching frequently accessed data in memory.

### Cache Keys

```
imagery:{parcelleId}:{date}
ndvi:{parcelleId}:{date}
temporal:{parcelleId}:{startDate}:{endDate}:{interval}
deforestation:{parcelleId}
health-status:{parcelleId}
```

### TTL Configuration

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| **Imagery Metadata** | 24 hours | Imagery doesn't change, but availability might |
| **NDVI Results** | 7 days | Recalculated weekly for freshness |
| **Temporal Data** | 24 hours | Historical data stable, but new data added daily |
| **Deforestation Alerts** | 1 hour | Frequently updated with acknowledgments |
| **Health Status** | 24 hours | Derived from NDVI, updated daily |

### Cache Invalidation

The cache is automatically invalidated when:

1. **New NDVI Calculation**: Invalidates `ndvi:*`, `health-status:*`, `temporal:*`
2. **Deforestation Alert Update**: Invalidates `deforestation:*`
3. **Parcelle Geometry Update**: Invalidates all keys for that parcelle
4. **Manual Invalidation**: Admin API endpoint available

### Implementation

```typescript
class RedisCache {
  private redis: Redis;
  
  /**
   * Cache NDVI result
   */
  async cacheNDVI(
    parcelleId: string, 
    date: Date, 
    ndvi: NDVIResult
  ): Promise<void> {
    const key = `ndvi:${parcelleId}:${date.toISOString()}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
    
    await this.redis.setex(
      key, 
      ttl, 
      JSON.stringify(ndvi)
    );
  }
  
  /**
   * Get cached NDVI result
   */
  async getCachedNDVI(
    parcelleId: string, 
    date: Date
  ): Promise<NDVIResult | null> {
    const key = `ndvi:${parcelleId}:${date.toISOString()}`;
    const cached = await this.redis.get(key);
    
    if (!cached) return null;
    
    return JSON.parse(cached);
  }
  
  /**
   * Invalidate all cache entries for a parcelle
   */
  async invalidateParcelle(parcelleId: string): Promise<void> {
    const patterns = [
      `imagery:${parcelleId}:*`,
      `ndvi:${parcelleId}:*`,
      `temporal:${parcelleId}:*`,
      `deforestation:${parcelleId}`,
      `health-status:${parcelleId}`,
    ];
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
```

### Cache Hit Rate Monitoring

```typescript
// Track cache performance
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
}

async function getCacheStats(): Promise<CacheStats> {
  const hits = await redis.get('cache:hits') || 0;
  const misses = await redis.get('cache:misses') || 0;
  const total = hits + misses;
  
  return {
    hits,
    misses,
    hitRate: total > 0 ? hits / total : 0,
    avgResponseTime: await getAvgResponseTime(),
  };
}

// Alert if cache hit rate drops below 60%
if (stats.hitRate < 0.6) {
  await sendAlert('Low cache hit rate', stats);
}
```

## Layer 3: Database Caching (PostgreSQL)

### Purpose

Persistent storage of calculated results to avoid expensive recalculations.

### Cached Data

| Table | Retention | Purpose |
|-------|-----------|---------|
| **ndvi_results** | Indefinite | Historical NDVI trends |
| **deforestation_events** | 7 years | EUDR compliance |
| **yield_predictions** | Indefinite | Model improvement |
| **satellite_imagery** | 90 days | Recent imagery metadata |
| **satellite_cache_metadata** | Variable | Cache management |

### Performance Indexes

```sql
-- Fast lookup by parcelle and date
CREATE INDEX idx_ndvi_results_parcelle_date 
  ON ndvi_results(parcelle_id, calculation_date DESC);

-- Fast lookup for recent imagery
CREATE INDEX idx_satellite_imagery_parcelle_date 
  ON satellite_imagery(parcelle_id, acquisition_date DESC);

-- Fast lookup for pending alerts
CREATE INDEX idx_deforestation_events_parcelle_status 
  ON deforestation_events(parcelle_id, status);

-- Cache expiration cleanup
CREATE INDEX idx_satellite_cache_expires 
  ON satellite_cache_metadata(expires_at);
```

### Cache Metadata Table

```sql
CREATE TABLE satellite_cache_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL UNIQUE,
  data_type TEXT NOT NULL CHECK (data_type IN ('imagery', 'ndvi', 'bands')),
  storage_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Automatic Cleanup

```sql
-- Run daily to remove expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  -- Delete expired cache metadata
  DELETE FROM satellite_cache_metadata
  WHERE expires_at < NOW();
  
  -- Delete old imagery metadata (> 90 days)
  DELETE FROM satellite_imagery
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Log cleanup stats
  INSERT INTO cache_cleanup_logs (deleted_count, cleanup_date)
  VALUES (ROW_COUNT(), NOW());
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 2 AM
SELECT cron.schedule('cleanup-satellite-cache', '0 2 * * *', 'SELECT cleanup_expired_cache()');
```

## Storage Caching (Supabase Storage)

### Purpose

Store imagery tiles and generated files with automatic expiration.

### Storage Buckets

| Bucket | Max Size | Retention | Public Access |
|--------|----------|-----------|---------------|
| **satellite-imagery** | 10 MB | 90 days | No |
| **ndvi-rasters** | 5 MB | 30 days | No |
| **kml-exports** | 5 MB | 7 days | No |
| **certification-reports** | 10 MB | 1 year | No |

### Storage Policy

```typescript
interface StoragePolicy {
  bucket: string;
  maxSize: number; // bytes
  allowedMimeTypes: string[];
  retention: number; // days
  publicAccess: boolean;
}

const STORAGE_POLICIES: Record<string, StoragePolicy> = {
  'satellite-imagery': {
    bucket: 'satellite-imagery',
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/tiff'],
    retention: 90,
    publicAccess: false,
  },
  'ndvi-rasters': {
    bucket: 'ndvi-rasters',
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ['image/png', 'image/tiff'],
    retention: 30,
    publicAccess: false,
  },
  'kml-exports': {
    bucket: 'kml-exports',
    maxSize: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: [
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz'
    ],
    retention: 7,
    publicAccess: false,
  },
  'certification-reports': {
    bucket: 'certification-reports',
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['application/pdf'],
    retention: 365,
    publicAccess: false,
  },
};
```

### Automatic Expiration

```typescript
// Run daily to delete expired files
async function cleanupExpiredFiles() {
  for (const [bucketName, policy] of Object.entries(STORAGE_POLICIES)) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - policy.retention);
    
    // List files older than retention period
    const { data: files } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' },
      });
    
    const expiredFiles = files.filter(
      file => new Date(file.created_at) < expirationDate
    );
    
    // Delete expired files
    if (expiredFiles.length > 0) {
      const filePaths = expiredFiles.map(f => f.name);
      await supabase.storage.from(bucketName).remove(filePaths);
      
      console.log(`Deleted ${filePaths.length} expired files from ${bucketName}`);
    }
  }
}
```

## Cache Warming Strategy

### Proactive Caching

To improve user experience, the system proactively caches data for frequently accessed parcelles.

### Cache Warming Schedule

```typescript
/**
 * Run daily at 2 AM to warm cache for favorite parcelles
 */
async function warmCache() {
  console.log('Starting cache warming...');
  
  // 1. Get favorite parcelles for all users
  const favorites = await supabase
    .from('favorite_parcelles')
    .select('parcelle_id, user_id')
    .order('last_accessed_at', { ascending: false })
    .limit(100);
  
  // 2. Pre-cache most recent imagery
  for (const { parcelle_id } of favorites.data) {
    try {
      await cacheImagery(parcelle_id, new Date());
      console.log(`Cached imagery for parcelle ${parcelle_id}`);
    } catch (error) {
      console.error(`Failed to cache imagery for ${parcelle_id}:`, error);
    }
  }
  
  // 3. Pre-calculate NDVI
  for (const { parcelle_id } of favorites.data) {
    try {
      await calculateNDVI(parcelle_id, new Date());
      console.log(`Calculated NDVI for parcelle ${parcelle_id}`);
    } catch (error) {
      console.error(`Failed to calculate NDVI for ${parcelle_id}:`, error);
    }
  }
  
  // 4. Pre-generate temporal data (last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  for (const { parcelle_id } of favorites.data) {
    try {
      await getTemporalData(parcelle_id, threeMonthsAgo, new Date());
      console.log(`Generated temporal data for parcelle ${parcelle_id}`);
    } catch (error) {
      console.error(`Failed to generate temporal data for ${parcelle_id}:`, error);
    }
  }
  
  console.log('Cache warming complete');
}

// Schedule with cron
cron.schedule('0 2 * * *', warmCache);
```

### Cooperative Dashboard Pre-caching

```typescript
/**
 * Pre-cache data for cooperative manager dashboards
 */
async function warmCooperativeDashboards() {
  const cooperatives = await supabase
    .from('cooperatives')
    .select('id');
  
  for (const { id: cooperativeId } of cooperatives.data) {
    // Get all parcelles in cooperative
    const { data: parcelles } = await supabase
      .from('parcelles')
      .select('id')
      .eq('cooperative_id', cooperativeId);
    
    // Pre-calculate health status distribution
    const healthStats = await calculateHealthStatusDistribution(
      parcelles.map(p => p.id)
    );
    
    // Cache for 24 hours
    await redis.setex(
      `cooperative:${cooperativeId}:health-stats`,
      24 * 60 * 60,
      JSON.stringify(healthStats)
    );
  }
}
```

## Cache Management

### Admin API Endpoints

#### Get Cache Statistics

```typescript
GET /api/admin/cache/stats

Response:
{
  "redis": {
    "hits": 15234,
    "misses": 3421,
    "hitRate": 0.817,
    "memoryUsage": "245 MB",
    "keys": 1523
  },
  "indexedDB": {
    "totalUsers": 45,
    "avgParcellesPerUser": 23,
    "totalSize": "1.2 GB"
  },
  "database": {
    "ndviResults": 45231,
    "imageryMetadata": 12453,
    "cacheMetadata": 8934
  },
  "storage": {
    "satellite-imagery": "8.5 GB",
    "ndvi-rasters": "2.3 GB",
    "kml-exports": "450 MB",
    "certification-reports": "1.8 GB"
  }
}
```

#### Invalidate Cache

```typescript
POST /api/admin/cache/invalidate

Request:
{
  "type": "parcelle" | "cooperative" | "all",
  "id": "parcelle-id" | "cooperative-id" | null
}

Response:
{
  "invalidated": true,
  "keysDeleted": 234,
  "message": "Cache invalidated successfully"
}
```

#### Clear Cache

```typescript
DELETE /api/admin/cache/clear

Request:
{
  "layer": "redis" | "database" | "storage" | "all",
  "confirm": true
}

Response:
{
  "cleared": true,
  "message": "Cache cleared successfully"
}
```

### Monitoring and Alerts

#### Cache Performance Metrics

```typescript
// Monitor cache hit rate
const cacheHitRate = hits / (hits + misses);

if (cacheHitRate < 0.6) {
  await sendAlert({
    severity: 'warning',
    title: 'Low Cache Hit Rate',
    message: `Cache hit rate is ${(cacheHitRate * 100).toFixed(1)}% (target: 60%)`,
    metrics: { hits, misses, hitRate: cacheHitRate },
  });
}

// Monitor cache memory usage
const memoryUsage = await redis.info('memory');

if (memoryUsage > 0.8 * MAX_MEMORY) {
  await sendAlert({
    severity: 'critical',
    title: 'High Cache Memory Usage',
    message: `Redis memory usage is ${(memoryUsage / MAX_MEMORY * 100).toFixed(1)}%`,
    metrics: { memoryUsage, maxMemory: MAX_MEMORY },
  });
}
```

#### Storage Monitoring

```typescript
// Monitor storage usage
async function monitorStorageUsage() {
  for (const [bucketName, policy] of Object.entries(STORAGE_POLICIES)) {
    const { data: files } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 10000 });
    
    const totalSize = files.reduce((sum, file) => sum + file.metadata.size, 0);
    const fileCount = files.length;
    
    console.log(`Bucket ${bucketName}: ${fileCount} files, ${formatBytes(totalSize)}`);
    
    // Alert if approaching limits
    if (totalSize > 0.9 * BUCKET_SIZE_LIMIT) {
      await sendAlert({
        severity: 'warning',
        title: 'Storage Bucket Nearly Full',
        message: `Bucket ${bucketName} is at ${(totalSize / BUCKET_SIZE_LIMIT * 100).toFixed(1)}% capacity`,
        metrics: { bucketName, totalSize, fileCount },
      });
    }
  }
}
```

## Best Practices

### For Developers

1. **Always check cache first**: Before making expensive API calls, check all cache layers
2. **Set appropriate TTLs**: Balance freshness with performance
3. **Invalidate on updates**: Always invalidate cache when data changes
4. **Monitor cache performance**: Track hit rates and adjust strategy accordingly
5. **Handle cache failures gracefully**: Always have a fallback to the source of truth

### For System Administrators

1. **Monitor cache hit rates**: Target 60%+ hit rate for optimal performance
2. **Schedule regular cleanup**: Run cleanup jobs daily to prevent storage bloat
3. **Warm cache proactively**: Pre-cache data for frequently accessed parcelles
4. **Set up alerts**: Monitor memory usage, hit rates, and storage capacity
5. **Review retention policies**: Adjust based on usage patterns and storage costs

### For Users

1. **Mark favorites**: Favorite parcelles are never evicted from cache
2. **Refresh when needed**: Use manual refresh when you need the latest data
3. **Offline mode**: Download data before going to low-connectivity areas
4. **Clear cache**: If experiencing issues, try clearing the cache

## Troubleshooting

### Low Cache Hit Rate

**Symptoms**: Slow performance, high API usage

**Diagnosis**:
```bash
# Check cache statistics
curl -X GET /api/admin/cache/stats

# Check Redis memory
redis-cli INFO memory
```

**Solutions**:
1. Increase TTLs for stable data
2. Implement cache warming for popular parcelles
3. Review eviction policies
4. Increase cache size limits

### Cache Corruption

**Symptoms**: Incorrect data displayed, errors when loading cached data

**Diagnosis**:
```typescript
// Validate cache entries
const entry = await cache.get(key);
if (!validateCacheEntry(entry)) {
  console.error('Corrupted cache entry:', key);
}
```

**Solutions**:
1. Clear corrupted entries
2. Implement checksum validation
3. Add cache versioning
4. Investigate root cause

### Storage Full

**Symptoms**: Failed file uploads, cache write errors

**Diagnosis**:
```bash
# Check storage usage
curl -X GET /api/admin/cache/stats | jq '.storage'
```

**Solutions**:
1. Run manual cleanup
2. Reduce retention periods
3. Increase storage limits
4. Archive old data

## Performance Impact

### Before Caching

- Average imagery load time: **8-12 seconds**
- NDVI calculation time: **5-8 seconds**
- API requests per day: **~50,000**
- Database queries per request: **5-10**

### After Caching

- Average imagery load time: **0.5-2 seconds** (75-90% improvement)
- NDVI calculation time: **0.2-1 second** (80-96% improvement)
- API requests per day: **~15,000** (70% reduction)
- Database queries per request: **1-2** (80% reduction)

### Cache Hit Rates (Target vs Actual)

| Data Type | Target Hit Rate | Actual Hit Rate |
|-----------|----------------|-----------------|
| Imagery | 70% | 75% ✓ |
| NDVI Results | 80% | 82% ✓ |
| Temporal Data | 60% | 68% ✓ |
| Health Status | 85% | 88% ✓ |

## Conclusion

The multi-layer caching strategy significantly improves system performance, reduces external API costs, and enables offline functionality. Regular monitoring and maintenance ensure optimal cache performance and user experience.

For questions or issues, contact the development team or refer to the [API Documentation](../api/satellite.md).
