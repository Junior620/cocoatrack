# Cache Management Architecture

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │ CacheManagementPanel │      │ CacheStatusIndicator │    │
│  │                      │      │                      │    │
│  │ - Statistics Display │      │ - Status Icon        │    │
│  │ - Clear Buttons      │      │ - Color Coding       │    │
│  │ - Refresh Button     │      │ - Tooltip            │    │
│  └──────────┬───────────┘      └──────────┬───────────┘    │
│             │                               │                │
│             └───────────┬───────────────────┘                │
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────────┐                        │
│              │ useCacheManagement  │                        │
│              │                     │                        │
│              │ - State Management  │                        │
│              │ - Cache Operations  │                        │
│              │ - Statistics        │                        │
│              └──────────┬──────────┘                        │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────┐
│                         ▼                                     │
│                  ┌──────────────┐                           │
│                  │ CacheService │                           │
│                  │              │                           │
│                  │ - Store      │                           │
│                  │ - Retrieve   │                           │
│                  │ - Evict LRU  │                           │
│                  │ - Statistics │                           │
│                  └──────┬───────┘                           │
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────────┐                        │
│              │ Supabase Database   │                        │
│              │                     │                        │
│              │ satellite_cache_    │                        │
│              │ metadata table      │                        │
│              └─────────────────────┘                        │
│                                                               │
│                    Data Layer                                │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Fetching Cache Statistics

```
User Action
    │
    ▼
CacheManagementPanel
    │
    ├─► useCacheManagement.refreshStats()
    │       │
    │       ▼
    │   CacheService.getCacheStats()
    │       │
    │       ▼
    │   Database Query
    │       │
    │       ▼
    │   Calculate Statistics
    │       │
    │       ▼
    └─► Update UI with Stats
```

### 2. Clearing Cache

```
User Clicks "Clear All"
    │
    ▼
Confirmation Dialog
    │
    ├─► User Confirms
    │       │
    │       ▼
    │   useCacheManagement.clearAllCache()
    │       │
    │       ▼
    │   CacheService.evictLRU(all)
    │       │
    │       ▼
    │   Delete from Database
    │       │
    │       ▼
    │   Refresh Statistics
    │       │
    │       ▼
    └─► Update UI
```

### 3. Checking Cache Status

```
CacheStatusIndicator Mounts
    │
    ▼
useCacheManagement.getCacheStatus(parcelleId)
    │
    ▼
CacheService.getParcelleCache(parcelleId)
    │
    ▼
Database Query
    │
    ▼
Analyze Cache Entries
    │
    ├─► Check Expiration
    ├─► Check Last Access
    └─► Determine Status
        │
        ▼
    Return: 'cached' | 'stale' | 'not-cached'
        │
        ▼
    Update Indicator UI
```

## State Management

### useCacheManagement Hook State

```typescript
{
  stats: CacheStats | null,
  loading: boolean,
  error: string | null,
  cacheHitRate: number
}
```

### CacheStats Structure

```typescript
{
  totalEntries: number,
  totalSizeBytes: number,
  uniqueParcelles: number,
  entriesByType: {
    imagery: number,
    ndvi: number,
    bands: number
  },
  oldestEntry: Date | null,
  newestEntry: Date | null
}
```

### Cache Status States

```
┌─────────────┐
│  Not Cached │ ◄─── No entries or all expired
└──────┬──────┘
       │
       │ Data cached
       ▼
┌─────────────┐
│   Cached    │ ◄─── Fresh data (< 24 hours)
└──────┬──────┘
       │
       │ Time passes (> 24 hours)
       ▼
┌─────────────┐
│    Stale    │ ◄─── Old data (> 24 hours)
└──────┬──────┘
       │
       │ Expires or cleared
       ▼
┌─────────────┐
│  Not Cached │
└─────────────┘
```

## LRU Eviction Algorithm

```
Cache Limit Reached (50 parcelles)
    │
    ▼
Get All Cache Entries
    │
    ▼
Group by Parcelle ID
    │
    ▼
Sort by Last Accessed (oldest first)
    │
    ▼
Filter Out Favorite Parcelles
    │
    ▼
Select N Oldest Parcelles
    │
    ▼
Delete All Entries for Selected Parcelles
    │
    ▼
Update Statistics
```

## Cache Health Indicators

```
Parcelles Cached    Status          Color       Action
─────────────────────────────────────────────────────────
0 - 39              Healthy         Green       None
40 - 47             Near Limit      Yellow      Monitor
48 - 50             At Capacity     Red         Clear or Evict
```

## Integration Points

### 1. Admin Dashboard

```
Admin Dashboard
    │
    ├─► CacheManagementPanel (full details)
    │       │
    │       ├─► View Statistics
    │       ├─► Clear All Cache
    │       ├─► Clear Expired
    │       └─► Monitor Health
    │
    └─► System Monitoring
```

### 2. Parcelle Detail Page

```
Parcelle Detail Page
    │
    ├─► Header
    │       │
    │       └─► CacheStatusIndicator (large, with label)
    │
    ├─► Satellite Data Section
    │       │
    │       └─► CacheManagementPanel (parcelle-specific)
    │
    └─► Actions
            │
            └─► Clear This Parcelle Cache
```

### 3. Parcelle List

```
Parcelle List
    │
    └─► For Each Parcelle
            │
            ├─► Parcelle Name
            ├─► Parcelle Info
            └─► CacheStatusIndicator (small)
```

## Performance Considerations

### Auto-Refresh Strategy

```
Component Mounts
    │
    ▼
Initial Fetch
    │
    ▼
Set Interval (30 seconds)
    │
    ├─► Fetch Statistics
    │       │
    │       ▼
    │   Update UI
    │       │
    │       ▼
    └─► Wait 30 seconds ──┐
                          │
                          └─► Loop
```

### Optimization Techniques

1. **Debouncing**: Prevent rapid successive cache operations
2. **Memoization**: Cache statistics calculations
3. **Lazy Loading**: Load cache info only when needed
4. **Batch Operations**: Group multiple cache operations
5. **Background Processing**: Use async operations for large clears

## Error Handling

```
Cache Operation
    │
    ├─► Success
    │       │
    │       ├─► Update State
    │       ├─► Refresh Stats
    │       └─► Show Success (optional)
    │
    └─► Error
            │
            ├─► Log Error
            ├─► Set Error State
            ├─► Show Error Message
            └─► Maintain Previous State
```

## Security Considerations

1. **Authentication**: All cache operations require authenticated user
2. **Authorization**: Only authorized users can clear cache
3. **Confirmation**: Destructive operations require confirmation
4. **Audit Logging**: Cache operations are logged for audit trail
5. **Rate Limiting**: Prevent abuse of cache operations

## Monitoring and Metrics

### Key Metrics to Track

1. **Cache Hit Rate**: Percentage of successful cache retrievals
2. **Cache Size**: Total bytes stored
3. **Eviction Rate**: Frequency of LRU evictions
4. **Average Age**: Average age of cached entries
5. **Clear Operations**: Frequency of manual cache clears

### Health Indicators

```
Metric              Healthy     Warning     Critical
─────────────────────────────────────────────────────
Hit Rate            > 70%       40-70%      < 40%
Parcelles Cached    < 40        40-47       48-50
Eviction Rate       < 5/day     5-10/day    > 10/day
Average Age         < 7 days    7-14 days   > 14 days
```

## Future Enhancements

1. **Cache Warming**: Pre-load frequently accessed parcelles
2. **Predictive Eviction**: ML-based prediction of cache needs
3. **Tiered Caching**: Multiple cache levels (memory, disk, cloud)
4. **Cache Sharing**: Share cache across users for common parcelles
5. **Compression**: Compress cached data to save space
6. **Analytics**: Detailed cache usage analytics and reporting
