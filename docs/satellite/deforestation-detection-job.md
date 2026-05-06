# Deforestation Detection Job

## Overview

The Deforestation Detection Job is a scheduled background task that periodically checks all parcelles for deforestation by comparing baseline NDVI (December 31, 2020) with current NDVI values. This job supports EUDR compliance requirements by automatically detecting vegetation loss exceeding regulatory thresholds.

**Task**: 4.5.1 - Create periodic deforestation detection job  
**Requirement**: 4 - Deforestation Detection

## Schedule

- **Production**: Runs weekly on Sundays at 2:00 AM UTC
- **Cron Expression**: `0 2 * * 0`
- **Configuration**: `vercel.json`

## How It Works

### 1. Job Initialization

The job initializes with a Supabase client using the service role key to bypass Row Level Security (RLS) and access all parcelles.

### 2. Parcelle Retrieval

Retrieves all active parcelles with:
- Valid geometry (not null)
- Surface area > 0 hectares
- Optional filter by cooperative ID

### 3. Batch Processing

Processes parcelles in configurable batches (default: 10 per batch) to:
- Reduce memory usage
- Avoid Google Earth Engine API rate limits
- Enable progress tracking
- Allow for graceful timeout handling

### 4. Deforestation Detection

For each parcelle:

1. **Retrieve Baseline NDVI**: Gets NDVI for December 31, 2020 (EUDR baseline) or closest available date within ±60 days
2. **Retrieve Current NDVI**: Gets NDVI for today or specified date
3. **Calculate Change**: Computes NDVI difference (current - baseline)
4. **Check Thresholds**: Flags deforestation if:
   - NDVI decrease > 0.3 (30% vegetation loss)
   - Affected area > 0.5 hectares
5. **Create Event**: If detected, creates a `deforestation_events` record with status 'pending'
6. **Send Notifications**: Notifies cooperative managers and agronomists

### 5. Progress Tracking

Updates the `job_executions` table with:
- Items processed
- Items failed
- Execution status
- Duration
- Error details (if any)

### 6. Completion

Marks the job as:
- **completed**: All parcelles processed successfully
- **partial**: Some parcelles failed but job completed
- **failed**: Job crashed or encountered critical error

## Configuration

### Default Configuration

```typescript
{
  batchSize: 10,              // Parcelles per batch
  batchDelayMs: 2000,         // Delay between batches (ms)
  maxExecutionTimeMs: 600000, // Max execution time (10 minutes)
  baselineDate: new Date('2020-12-31'), // EUDR baseline
  currentDate: new Date(),    // Today
  cooperativeId: undefined,   // All cooperatives
}
```

### Custom Configuration

You can customize the job behavior by passing options:

```typescript
await deforestationDetectionJob.run({
  batchSize: 5,               // Smaller batches
  batchDelayMs: 3000,         // Longer delay
  cooperativeId: 'uuid',      // Single cooperative
  baselineDate: new Date('2021-01-01'), // Custom baseline
  currentDate: new Date('2026-05-01'),  // Custom current date
});
```

## API Endpoints

### GET /api/cron/deforestation-detection

Runs the job with default configuration.

**Authentication**: Requires `Authorization: Bearer <CRON_SECRET>` header

**Example**:
```bash
curl -X GET https://your-domain.vercel.app/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response**:
```json
{
  "success": true,
  "status": "completed",
  "executionId": "550e8400-e29b-41d4-a716-446655440000",
  "totalProcessed": 150,
  "totalFailed": 2,
  "deforestationDetected": 5,
  "durationMs": 45000,
  "timestamp": "2026-05-06T02:00:00.000Z"
}
```

### POST /api/cron/deforestation-detection

Runs the job with custom configuration (manual trigger).

**Authentication**: Requires `Authorization: Bearer <CRON_SECRET>` header

**Request Body**:
```json
{
  "batchSize": 5,
  "batchDelayMs": 3000,
  "cooperativeId": "cooperative-uuid",
  "baselineDate": "2020-12-31",
  "currentDate": "2026-05-06"
}
```

**Example**:
```bash
curl -X POST https://your-domain.vercel.app/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 5,
    "cooperativeId": "cooperative-uuid"
  }'
```

**Response**: Same as GET endpoint with additional `options` field

## Monitoring

### Job Executions Table

Query recent job executions:

```sql
SELECT 
  id,
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  items_processed,
  items_failed,
  execution_metadata->>'deforestationDetected' as deforestation_detected
FROM job_executions
WHERE job_type = 'deforestation_detection'
ORDER BY started_at DESC
LIMIT 10;
```

### Job Execution Details

Get detailed information about a specific execution:

```sql
SELECT 
  id,
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  items_processed,
  items_failed,
  error_message,
  error_details,
  execution_metadata
FROM job_executions
WHERE id = 'execution-uuid';
```

### Deforestation Events

Query deforestation events detected by the job:

```sql
SELECT 
  de.id,
  de.parcelle_id,
  p.code as parcelle_code,
  de.detection_date,
  de.ndvi_change,
  de.affected_area_hectares,
  de.status
FROM deforestation_events de
JOIN parcelles p ON p.id = de.parcelle_id
WHERE de.detection_date >= NOW() - INTERVAL '7 days'
ORDER BY de.detection_date DESC;
```

## Performance Considerations

### Batch Size

- **Smaller batches (5-10)**: Lower memory usage, longer total execution time
- **Larger batches (20-50)**: Higher memory usage, shorter total execution time
- **Recommended**: 10 parcelles per batch for balanced performance

### Batch Delay

- **Shorter delays (1-2 seconds)**: Faster execution, higher risk of rate limiting
- **Longer delays (3-5 seconds)**: Slower execution, lower risk of rate limiting
- **Recommended**: 2 seconds between batches

### Execution Time

With default configuration (10 parcelles/batch, 2-second delays):
- **100 parcelles**: ~2 minutes
- **300 parcelles**: ~6 minutes
- **500 parcelles**: ~10 minutes (max timeout)

### API Limits

Google Earth Engine free tier:
- **Daily limit**: 250,000 requests/day
- **Per-parcelle requests**: ~4 requests (baseline imagery, current imagery, NDVI bands)
- **Weekly capacity**: ~1,750 parcelles (250,000 / 4 / 7 days)

## Error Handling

### Partial Failures

If some parcelles fail processing:
- Job continues with remaining parcelles
- Status marked as `partial`
- Failed parcelles logged in `execution_metadata.errors`
- Error details include parcelle ID and error message

### Complete Failures

If the job crashes:
- Status marked as `failed`
- Error message and stack trace logged
- Job execution record updated with error details

### Rate Limiting

If Google Earth Engine API rate limit is reached:
- Batch delays help avoid rate limiting
- Exponential backoff implemented in imagery service
- Failed requests logged and can be retried manually

### Timeout Protection

If execution exceeds 10 minutes:
- Job stops processing remaining parcelles
- Status marked as `partial`
- Processed parcelles count updated
- Remaining parcelles processed in next scheduled run

## Troubleshooting

### Job Times Out

**Symptoms**: Job status shows `partial`, not all parcelles processed

**Solutions**:
1. Reduce `batchSize` to 5 parcelles per batch
2. Increase `batchDelayMs` to 3000ms (3 seconds)
3. Filter by `cooperativeId` to process fewer parcelles
4. Run job more frequently (e.g., twice per week)

### High Failure Rate

**Symptoms**: Many parcelles fail processing, high `items_failed` count

**Solutions**:
1. Check Google Earth Engine API status: https://status.earthengine.google.com/
2. Verify `GOOGLE_EARTH_ENGINE_API_KEY` is valid and not expired
3. Check Supabase connection and service role key
4. Review error details in `job_executions.error_details`
5. Check parcelle geometry validity (some parcelles may have invalid MultiPolygon)

### No Deforestation Detected

**Symptoms**: Job completes successfully but `deforestationDetected` is 0

**Possible Causes**:
1. No actual deforestation occurred (expected)
2. Baseline imagery unavailable for December 31, 2020
3. NDVI calculation errors
4. Thresholds too strict (0.3 NDVI decrease, 0.5 ha area)

**Solutions**:
1. Verify baseline imagery availability for sample parcelles
2. Check NDVI calculation is working correctly
3. Review deforestation thresholds in requirements
4. Test with known deforestation cases

### Notifications Not Sent

**Symptoms**: Deforestation detected but no notifications received

**Solutions**:
1. Check notification service is working
2. Verify cooperative managers and agronomists exist
3. Check notification preferences are enabled
4. Review notification logs in `notifications` table

## Environment Variables

Required environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Google Earth Engine
GOOGLE_EARTH_ENGINE_PROJECT_ID=your-gee-project-id
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=your-service-account-email
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cron Security
CRON_SECRET=your-random-secret-string
```

## Testing

### Local Testing

Test the job locally:

```typescript
import { deforestationDetectionJob } from '@/lib/satellite/jobs/deforestation-detection.job';

// Run with default configuration
const result = await deforestationDetectionJob.run();
console.log(result);

// Run with custom configuration
const customResult = await deforestationDetectionJob.run({
  batchSize: 5,
  cooperativeId: 'test-cooperative-id',
});
console.log(customResult);
```

### Manual Trigger

Trigger the job manually via API:

```bash
# Default configuration
curl -X GET http://localhost:3000/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Custom configuration
curl -X POST http://localhost:3000/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 5,
    "cooperativeId": "test-cooperative-id"
  }'
```

### Unit Tests

Run unit tests:

```bash
npm run test tests/satellite/jobs/deforestation-detection.job.test.ts
```

## Security

### Authentication

- All cron endpoints protected by `CRON_SECRET` environment variable
- Requests must include `Authorization: Bearer <CRON_SECRET>` header
- Unauthorized requests return 401 status

### Authorization

- Job uses Supabase service role key to bypass RLS
- Service role key should never be exposed to client
- Only server-side code can access service role key

### Data Access

- Job can access all parcelles regardless of user permissions
- Deforestation events created with system user context
- Notifications sent to appropriate cooperative managers and agronomists

## Future Enhancements

- [ ] Add email notifications for job failures
- [ ] Implement retry logic for failed parcelles
- [ ] Add support for custom NDVI thresholds per cooperative
- [ ] Implement incremental processing (only check parcelles updated since last run)
- [ ] Add dashboard for job execution monitoring
- [ ] Support for multiple baseline dates (not just EUDR)
- [ ] Add Slack/Discord webhook notifications for critical events
- [ ] Implement job scheduling UI for admins
- [ ] Add support for dry-run mode (detect but don't create events)
- [ ] Implement parallel processing across multiple serverless functions

## Related Documentation

- [Deforestation Detection Service](./deforestation-detection.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [Satellite Imagery API](../api/satellite.md)
- [Job Executions Table Schema](../database/schema.md#job_executions)
