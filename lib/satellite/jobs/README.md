# Satellite Imagery Background Jobs

This directory contains background jobs for satellite imagery analysis operations.

## Deforestation Detection Job

**File**: `deforestation-detection.job.ts`

**Purpose**: Periodically checks all parcelles for deforestation by comparing baseline NDVI (December 31, 2020) with current NDVI values.

### Schedule

- **Production**: Runs weekly on Sundays at 2:00 AM UTC
- **Cron Expression**: `0 2 * * 0` (configured in `vercel.json`)

### How It Works

1. **Retrieves Parcelles**: Fetches all active parcelles with valid geometry and surface area
2. **Batch Processing**: Processes parcelles in batches of 10 to avoid rate limits
3. **Deforestation Detection**: For each parcelle:
   - Retrieves baseline NDVI (Dec 31, 2020 or closest available date)
   - Retrieves current NDVI
   - Compares NDVI values
   - Flags deforestation if:
     - NDVI decrease > 0.3 (30% vegetation loss)
     - Affected area > 0.5 hectares
4. **Event Creation**: Creates deforestation event records for detected cases
5. **Notifications**: Sends notifications to cooperative managers and agronomists
6. **Logging**: Logs execution results to `job_executions` table

### Configuration

The job can be configured with the following options:

```typescript
{
  batchSize: 10,              // Number of parcelles per batch
  batchDelayMs: 2000,         // Delay between batches (ms)
  maxExecutionTimeMs: 600000, // Max execution time (10 minutes)
  baselineDate: new Date('2020-12-31'), // EUDR baseline date
  currentDate: new Date(),    // Current date for comparison
  cooperativeId: 'uuid',      // Optional: filter by cooperative
}
```

### API Endpoints

#### GET /api/cron/deforestation-detection

Runs the job with default configuration.

**Authentication**: Requires `Authorization: Bearer <CRON_SECRET>` header

**Response**:
```json
{
  "success": true,
  "status": "completed",
  "executionId": "uuid",
  "totalProcessed": 150,
  "totalFailed": 2,
  "deforestationDetected": 5,
  "durationMs": 45000,
  "timestamp": "2026-05-06T02:00:00.000Z"
}
```

#### POST /api/cron/deforestation-detection

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

**Response**: Same as GET endpoint

### Manual Triggering

You can manually trigger the job using curl:

```bash
# Default configuration
curl -X GET https://your-domain.vercel.app/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Custom configuration
curl -X POST https://your-domain.vercel.app/api/cron/deforestation-detection \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 5,
    "cooperativeId": "cooperative-uuid"
  }'
```

### Monitoring

Job executions are logged to the `job_executions` table:

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
  execution_metadata
FROM job_executions
WHERE job_type = 'deforestation_detection'
ORDER BY started_at DESC
LIMIT 10;
```

### Error Handling

- **Partial Failures**: If some parcelles fail processing, the job continues and marks status as `partial`
- **Complete Failures**: If the job crashes, status is marked as `failed` with error details
- **Rate Limiting**: Batch delays help avoid Google Earth Engine API rate limits
- **Timeout Protection**: Job stops processing after 10 minutes to avoid Vercel timeout

### Performance Considerations

- **Batch Size**: Smaller batches (5-10) reduce memory usage but increase total execution time
- **Batch Delay**: Longer delays (2-5 seconds) reduce rate limit risk but increase total execution time
- **Execution Time**: With 10 parcelles/batch and 2-second delays, the job can process ~300 parcelles in 10 minutes
- **API Limits**: Google Earth Engine free tier allows 250,000 requests/day (sufficient for weekly runs)

### Troubleshooting

#### Job Times Out

- Reduce `batchSize` to process fewer parcelles per batch
- Increase `batchDelayMs` to reduce API load
- Filter by `cooperativeId` to process fewer parcelles

#### High Failure Rate

- Check Google Earth Engine API status
- Verify `GOOGLE_EARTH_ENGINE_API_KEY` is valid
- Check Supabase connection
- Review error details in `job_executions.error_details`

#### No Deforestation Detected

- Verify baseline imagery is available (Dec 31, 2020)
- Check NDVI calculation is working correctly
- Review deforestation thresholds (0.3 NDVI decrease, 0.5 ha area)

### Environment Variables

Required environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Google Earth Engine
GOOGLE_EARTH_ENGINE_API_KEY=your-gee-api-key
GOOGLE_EARTH_ENGINE_PROJECT_ID=your-gee-project-id
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=your-service-account-email

# Cron Security
CRON_SECRET=your-random-secret-string
```

### Testing

To test the job locally:

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

### Future Enhancements

- [ ] Add email notifications for job failures
- [ ] Implement retry logic for failed parcelles
- [ ] Add support for custom NDVI thresholds per cooperative
- [ ] Implement incremental processing (only check parcelles updated since last run)
- [ ] Add dashboard for job execution monitoring
- [ ] Support for multiple baseline dates (not just EUDR)
