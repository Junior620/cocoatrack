# Satellite Data Cache Management

This document describes the cache management system for satellite imagery data in CocoaTrack.

## Overview

The satellite data cache management system provides:
- **Client-side caching** of satellite imagery, NDVI results, and band data
- **LRU (Least Recently Used) eviction** when cache limit is reached
- **Cache statistics** and monitoring
- **User-friendly UI** for cache management
- **Cache status indicators** for individual parcelles

## Architecture

### Components

1. **CacheService** (`lib/satellite/services/cache.service.ts`)
   - Core cache management logic
   - Database operations for cache metadata
   - LRU eviction algorithm
   - Cache statistics calculation

2. **useCacheManagement Hook** (`hooks/satellite/useCacheManagement.ts`)
   - React hook for cache management state
   - Provides cache statistics and operations
   - Auto-refresh capability

3. **CacheManagementPanel Component** (`components/satellite/CacheManagementPanel.tsx`)
   - Full-featured cache management UI
   - Displays statistics and controls
   - Clear cache operations

4. **CacheStatusIndicator Component** (`components/satellite/CacheStatusIndicator.tsx`)
   - Inline cache status display
   - Shows cached/stale/not-cached status
   - Multiple size variants

## Cache Configuration

### Limits

- **Maximum cached parcelles**: 50
- **Retention periods**:
  - Imagery: 90 days
  - NDVI results: 30 days
  - Band data: 30 days

### Cache Status

- **Cached**: Data is fresh and recently accessed (< 24 hours)
- **Stale**: Data exists but not accessed in 24+ hours
- **Not Cached**: No cached data available

## Usage

### Basic Cache Management Panel

```tsx
import { CacheManagementPanel } from '@/components/satellite';

function AdminPage() {
  return (
    <div>
      <h1>Cache Management</h1>
      <CacheManagementPanel />
    </div>
  );
}
```

### Parcelle-Specific Cache Management

```tsx
import { CacheManagementPanel } from '@/components/satellite';

function ParcelleDetailPage({ parcelleId }: { parcelleId: string }) {
  return (
    <div>
      <h1>Parcelle Details</h1>
      <CacheManagementPanel
        parcelleId={parcelleId}
        onCacheCleared={() => {
          // Refresh parcelle data
          console.log('Cache cleared for parcelle');
        }}
      />
    </div>
  );
}
```

### Cache Status Indicator

```tsx
import { CacheStatusIndicator } from '@/components/satellite';

function ParcelleListItem({ parcelle }: { parcelle: Parcelle }) {
  return (
    <div className="flex items-center justify-between">
      <span>{parcelle.name}</span>
      <CacheStatusIndicator
        parcelleId={parcelle.id}
        size="sm"
        showLabel
      />
    </div>
  );
}
```

### Using the Hook Directly

```tsx
import { useCacheManagement } from '@/hooks/satellite/useCacheManagement';

function CustomCacheComponent() {
  const {
    stats,
    loading,
    clearAllCache,
    cacheHitRate,
  } = useCacheManagement({
    autoFetch: true,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Total Entries: {stats?.totalEntries}</p>
      <p>Cache Hit Rate: {cacheHitRate}%</p>
      <button onClick={clearAllCache}>Clear Cache</button>
    </div>
  );
}
```

## Cache Operations

### Clear All Cache

Removes all cached satellite data for all parcelles.

```tsx
const { clearAllCache } = useCacheManagement();

await clearAllCache();
```

### Clear Parcelle Cache

Removes cached data for a specific parcelle.

```tsx
const { clearParcelleCache } = useCacheManagement();

await clearParcelleCache('parcelle-id');
```

### Clear Expired Cache

Removes only expired cache entries.

```tsx
const { clearExpiredCache } = useCacheManagement();

const count = await clearExpiredCache();
console.log(`Cleared ${count} expired entries`);
```

### Get Cache Status

Check cache status for a specific parcelle.

```tsx
const { getCacheStatus } = useCacheManagement();

const status = await getCacheStatus('parcelle-id');
// Returns: 'cached' | 'stale' | 'not-cached'
```

## Cache Statistics

The cache management system provides the following statistics:

- **Total Entries**: Number of cached items
- **Total Size**: Total cache size in bytes
- **Unique Parcelles**: Number of parcelles with cached data
- **Entries by Type**: Breakdown by imagery, NDVI, and bands
- **Cache Age**: Oldest and newest cache entries
- **Cache Hit Rate**: Percentage of cache utilization (0-100%)

## LRU Eviction

When the cache reaches its limit (50 parcelles), the system automatically evicts the least recently used parcelles to make room for new data.

### Eviction Rules

1. Parcelles are ranked by last access time
2. Oldest accessed parcelles are evicted first
3. Favorite parcelles are protected from eviction
4. All cache entries for a parcelle are evicted together

### Manual Eviction

You can manually trigger eviction:

```tsx
import { getCacheService } from '@/lib/satellite/services/cache.service';

const cacheService = getCacheService();

// Evict 5 oldest parcelles
const result = await cacheService.evictLRU(5);

console.log(`Evicted ${result.evictedCount} parcelles`);
console.log(`Freed ${result.freedBytes} bytes`);
```

## Best Practices

### 1. Monitor Cache Usage

Regularly check cache statistics to ensure optimal performance:

```tsx
<CacheManagementPanel showDetails />
```

### 2. Clear Expired Cache Periodically

Set up periodic cleanup of expired entries:

```tsx
useEffect(() => {
  const interval = setInterval(async () => {
    await clearExpiredCache();
  }, 24 * 60 * 60 * 1000); // Daily

  return () => clearInterval(interval);
}, []);
```

### 3. Show Cache Status to Users

Help users understand data freshness:

```tsx
<CacheStatusIndicator
  parcelleId={parcelleId}
  showLabel
  showTooltip
/>
```

### 4. Clear Cache After Updates

Clear cache when parcelle data changes:

```tsx
async function updateParcelle(parcelleId: string, data: any) {
  await updateParcelleAPI(parcelleId, data);
  await clearParcelleCache(parcelleId);
}
```

## Troubleshooting

### Cache Not Updating

If cache appears stale:

1. Check cache expiration dates
2. Manually clear the cache
3. Verify cache service is running
4. Check database connectivity

### High Cache Usage

If cache is frequently at capacity:

1. Review cache retention periods
2. Consider increasing cache limit
3. Implement more aggressive eviction
4. Clear expired entries more frequently

### Performance Issues

If cache operations are slow:

1. Check database indexes on `satellite_cache_metadata`
2. Monitor cache size and entry count
3. Consider implementing cache warming
4. Review LRU eviction frequency

## API Reference

### CacheService Methods

- `storeCache(options)` - Store a cache entry
- `getCache(cacheKey)` - Retrieve a cache entry
- `deleteCache(cacheKey)` - Delete a cache entry
- `evictLRU(count, favoriteParcelles)` - Evict least recently used entries
- `getCacheStats()` - Get cache statistics
- `getParcelleCache(parcelleId)` - Get all cache entries for a parcelle
- `clearExpiredCache()` - Remove expired entries
- `clearParcelleCache(parcelleId)` - Remove all entries for a parcelle

### useCacheManagement Hook

Returns:
- `stats` - Cache statistics object
- `loading` - Loading state
- `error` - Error message
- `refreshStats()` - Refresh statistics
- `clearAllCache()` - Clear all cache
- `clearParcelleCache(id)` - Clear parcelle cache
- `clearExpiredCache()` - Clear expired entries
- `getParcelleCacheInfo(id)` - Get parcelle cache info
- `getCacheStatus(id)` - Get cache status
- `cacheHitRate` - Cache hit rate percentage

## Database Schema

### satellite_cache_metadata Table

```sql
CREATE TABLE satellite_cache_metadata (
  id UUID PRIMARY KEY,
  parcelle_id UUID REFERENCES parcelles(id),
  cache_key TEXT UNIQUE NOT NULL,
  data_type TEXT CHECK (data_type IN ('imagery', 'ndvi', 'bands')),
  storage_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  last_accessed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

## Related Documentation

- [Satellite Imagery Overview](./satellite-imagery.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [API Documentation](../api/satellite.md)
