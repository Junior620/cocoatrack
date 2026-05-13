# Cache Warming for Satellite Imagery

## Overview

The cache warming system pre-loads satellite imagery and NDVI data for frequently accessed parcelles to improve performance and user experience. It runs automatically as a background job daily at 2:00 AM UTC.

## Features

- **Automatic Scheduling**: Runs daily at 2:00 AM UTC via Vercel Cron
- **Smart Selection**: Identifies top 20 most recently accessed parcelles
- **Comprehensive Caching**: Pre-caches imagery, NDVI, and temporal data
- **Concurrency Control**: Processes parcelles in batches to avoid system overload
- **Detailed Logging**: Tracks job execution and results in audit logs

## How It Works

### 1. Favorite Parcelle Identification

The system identifies "favorite" parcelles based on recent access patterns:

- Queries `satellite_cache_metadata` table for recently accessed parcelles
- Groups by `parcelle_id` and finds most recent `last_accessed_at` timestamp
- Sorts by access time descending
- Selects top 20 parcelles

**Fallback Strategy**: If no cache metadata exists, selects 20 most recently created parcelles.

### 2. Cache Warming Operations

For each favorite parcelle, the system performs three operations:

#### a. Recent Imagery Caching
- Retrieves most recent cloud-free Sentinel-2 imagery (last 30 days)
- Applies 20% cloud cover threshold
- Caches imagery tiles in Supabase Storage
- Stores metadata in `satellite_cache_metadata` table

#### b. NDVI Calculation
- Calculates NDVI for most recent available date
- Stores result in `ndvi_results` table
- Caches in Redis for fast retrieval
- Skips raster generation to save time

#### c. Temporal Data Generation
- Queries NDVI results for last 3 months
- Generates temporal timeline with monthly intervals
- Caches timeline in Redis with 24-hour TTL
- Includes date, NDVI value, and health status for each data point

### 3. Concurrency Control

- Processes parcelles in batches of 5 concurrent operations
- Uses `Promise.allSettled` to ensure all parcelles are processed
- Continues even if individual parcelles fail

### 4. Result Logging

Job execution details are logged to `satellite_audit_logs`:
- Total duration
- Success/failure counts
- Statistics (imagery cached, NDVI cached, temporal data generated)
- Individual parcelle results

## Configuration

### Environment Variables

```bash
# Required: Secret for authenticating cron job requests
CRON_SECRET=your-random-secret-string-here

# Optional: Number of favorite parcelles to warm (default: 20)
# CACHE_WARMING_PARCELLE_COUNT=20

# Optional: Days to look back for recent imagery (default: 30)
# CACHE_WARMING_IMAGERY_DAYS=30

# Optional: Months of temporal data to generate (default: 3)
# CACHE_WARMING_TEMPORAL_MONTHS=3
```

### Vercel Cron Configuration

The job is scheduled in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/satellite/cache-warming",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule Format**: Cron expression `0 2 * * *` means:
- Minute: 0 (at the start of the hour)
- Hour: 2 (2:00 AM)
- Day of month: * (every day)
- Month: * (every month)
- Day of week: * (every day of the week)

**Result**: Runs daily at 2:00 AM UTC

## API Endpoint

### POST /api/satellite/cache-warming

Triggers the cache warming background job.

**Authentication**: Requires `CRON_SECRET` in one of:
- `Authorization` header: `Bearer your-cron-secret`
- `x-cron-secret` header: `your-cron-secret`

**Request**:
```bash
curl -X POST https://your-domain.com/api/satellite/cache-warming \
  -H "Authorization: Bearer your-cron-secret"
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Cache warming job completed",
  "result": {
    "duration": 45230,
    "totalParcelles": 20,
    "successCount": 18,
    "failureCount": 2,
    "statistics": {
      "imageryCached": 18,
      "ndviCached": 17,
      "temporalDataGenerated": 16
    },
    "startTime": "2024-01-15T02:00:00.000Z",
    "endTime": "2024-01-15T02:00:45.230Z"
  }
}
```

**Response** (Unauthorized):
```json
{
  "error": "Unauthorized. Invalid or missing CRON_SECRET."
}
```

### GET /api/satellite/cache-warming

Returns information about the endpoint (does not trigger the job).

**Response**:
```json
{
  "endpoint": "/api/satellite/cache-warming",
  "method": "POST",
  "description": "Triggers cache warming background job for favorite parcelles",
  "authentication": "Requires CRON_SECRET in Authorization header or x-cron-secret header",
  "schedule": "Daily at 2:00 AM UTC",
  "features": [
    "Pre-caches recent imagery (last 30 days)",
    "Pre-calculates NDVI for recent dates",
    "Pre-generates temporal data (last 3 months)",
    "Processes top 20 most recently accessed parcelles"
  ]
}
```

## Manual Triggering

You can manually trigger the cache warming job for testing or maintenance:

```bash
# Using curl
curl -X POST http://localhost:3000/api/satellite/cache-warming \
  -H "Authorization: Bearer your-cron-secret"

# Using httpie
http POST http://localhost:3000/api/satellite/cache-warming \
  Authorization:"Bearer your-cron-secret"
```

## Monitoring

### Viewing Job Results

Query the `satellite_audit_logs` table to view job execution history:

```sql
SELECT 
  created_at,
  event_data->>'duration' as duration_ms,
  event_data->>'totalParcelles' as total_parcelles,
  event_data->>'successCount' as success_count,
  event_data->>'failureCount' as failure_count,
  event_data->'statistics' as statistics
FROM satellite_audit_logs
WHERE event_type = 'cache_warming'
ORDER BY created_at DESC
LIMIT 10;
```

### Checking Cache Status

View cached data for a specific parcelle:

```sql
-- Check cache metadata
SELECT 
  cache_key,
  data_type,
  size_bytes,
  last_accessed_at,
  expires_at
FROM satellite_cache_metadata
WHERE parcelle_id = 'your-parcelle-id'
ORDER BY last_accessed_at DESC;

-- Check NDVI results
SELECT 
  calculation_date,
  mean_ndvi,
  health_status,
  created_at
FROM ndvi_results
WHERE parcelle_id = 'your-parcelle-id'
ORDER BY calculation_date DESC
LIMIT 10;
```

## Performance Considerations

### Expected Duration

- **Single Parcelle**: 2-5 seconds
- **20 Parcelles (batch of 5)**: 40-100 seconds total
- **Factors**: Network latency, GEE API response time, data availability

### Resource Usage

- **API Calls**: ~3-5 GEE API calls per parcelle
- **Storage**: ~2-5 MB per parcelle (imagery + NDVI raster)
- **Database**: ~1-3 rows per parcelle (NDVI results, cache metadata)
- **Redis**: ~10-50 KB per parcelle (temporal data, NDVI cache)

### Rate Limiting

The system respects Google Earth Engine API rate limits:
- Free tier: 250,000 requests/day
- Cache warming uses: ~60-100 requests/day (20 parcelles × 3-5 calls)
- Leaves plenty of headroom for user requests

## Troubleshooting

### Job Not Running

**Symptom**: Cache warming job doesn't execute at scheduled time

**Possible Causes**:
1. `CRON_SECRET` not configured in Vercel environment variables
2. Vercel Cron not enabled for the project
3. `vercel.json` not deployed

**Solution**:
1. Check Vercel dashboard > Settings > Environment Variables
2. Verify `CRON_SECRET` is set
3. Check Vercel dashboard > Cron Jobs to see scheduled jobs
4. Redeploy the project to apply `vercel.json` changes

### High Failure Rate

**Symptom**: Many parcelles fail to warm

**Possible Causes**:
1. Google Earth Engine API errors
2. Invalid parcelle geometries
3. No recent imagery available
4. Network connectivity issues

**Solution**:
1. Check `satellite_audit_logs` for error details
2. Validate parcelle geometries in database
3. Adjust cloud cover threshold or date range
4. Check GEE service account credentials

### Slow Performance

**Symptom**: Job takes longer than expected

**Possible Causes**:
1. Too many parcelles being warmed
2. Large parcelle geometries
3. GEE API slow response times
4. Network latency

**Solution**:
1. Reduce `FAVORITE_PARCELLES_COUNT` (default: 20)
2. Increase `MAX_CONCURRENT_OPERATIONS` (default: 5)
3. Monitor GEE API status
4. Consider running job during off-peak hours

## Best Practices

1. **Monitor Job Execution**: Regularly check audit logs for failures
2. **Adjust Schedule**: Change cron schedule if 2 AM doesn't work for your timezone
3. **Tune Concurrency**: Adjust batch size based on system performance
4. **Set Alerts**: Configure monitoring alerts for job failures
5. **Test Manually**: Periodically trigger job manually to verify functionality

## Future Enhancements

Potential improvements for future versions:

- **User-Defined Favorites**: Allow users to mark parcelles as favorites
- **Adaptive Scheduling**: Run more frequently for high-traffic periods
- **Selective Warming**: Warm only parcelles with stale cache
- **Priority Queue**: Prioritize parcelles based on user roles
- **Distributed Processing**: Use background workers for large-scale warming
- **Predictive Caching**: Use ML to predict which parcelles will be accessed

## Related Documentation

- [Satellite Imagery Setup](./gee-setup.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [Temporal Analysis](./temporal-analysis.md)
- [Cache Management](./cache-management.md)
- [API Documentation](../api/satellite.md)
