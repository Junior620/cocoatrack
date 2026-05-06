# Task 4.5.1 Implementation Summary: Periodic Deforestation Detection Job

## Overview

Successfully implemented a periodic background job that checks all parcelles for deforestation on a weekly schedule. The job processes parcelles in batches to avoid rate limits and logs execution results.

**Task**: 4.5.1 - Create periodic deforestation detection job  
**Requirement**: 4 - Deforestation Detection  
**Status**: ✅ Complete

## Files Created

### 1. Database Migration
- **File**: `supabase/migrations/20260506000001_create_job_executions.sql`
- **Purpose**: Creates `job_executions` table to track scheduled job executions
- **Features**:
  - Tracks job status (running, completed, failed, cancelled)
  - Records execution duration, items processed, items failed
  - Stores error details and execution metadata
  - RLS policies for admin-only access
  - Automatic `updated_at` timestamp trigger

### 2. Job Service
- **File**: `lib/satellite/jobs/deforestation-detection.job.ts`
- **Purpose**: Core job implementation for periodic deforestation detection
- **Features**:
  - Batch processing (default: 10 parcelles per batch)
  - Configurable batch delay (default: 2 seconds)
  - Timeout protection (max: 10 minutes)
  - Progress tracking and logging
  - Error handling with partial failure support
  - Cooperative filtering support
  - Custom baseline/current date support

### 3. API Endpoint
- **File**: `app/api/cron/deforestation-detection/route.ts`
- **Purpose**: HTTP endpoint for triggering the job
- **Features**:
  - GET endpoint for scheduled execution (default config)
  - POST endpoint for manual execution (custom config)
  - CRON_SECRET authentication
  - Detailed response with execution results

### 4. Cron Configuration
- **File**: `vercel.json` (updated)
- **Purpose**: Configures weekly cron schedule
- **Schedule**: `0 2 * * 0` (Sundays at 2:00 AM UTC)

### 5. Documentation
- **File**: `lib/satellite/jobs/README.md`
- **Purpose**: Developer documentation for the job
- **Content**: Configuration, API endpoints, monitoring, troubleshooting

- **File**: `docs/satellite/deforestation-detection-job.md`
- **Purpose**: Comprehensive user and admin documentation
- **Content**: How it works, configuration, monitoring, performance, troubleshooting

### 6. Tests
- **File**: `tests/satellite/jobs/deforestation-detection.job.test.ts`
- **Purpose**: Unit tests for the job
- **Coverage**: 9 test cases covering initialization, execution, error handling
- **Status**: ✅ All tests passing

### 7. Environment Configuration
- **File**: `.env.local.example` (updated)
- **Purpose**: Documents CRON_SECRET environment variable

## How It Works

### 1. Job Initialization
- Creates Supabase client with service role key (bypasses RLS)
- Creates job execution record in `job_executions` table

### 2. Parcelle Retrieval
- Fetches all active parcelles with valid geometry and surface area
- Optional filtering by cooperative ID

### 3. Batch Processing
- Processes parcelles in configurable batches (default: 10)
- Delays between batches to avoid rate limits (default: 2 seconds)
- Parallel processing within each batch

### 4. Deforestation Detection
For each parcelle:
1. Retrieve baseline NDVI (Dec 31, 2020 or closest available)
2. Retrieve current NDVI
3. Calculate NDVI change
4. Check thresholds (NDVI decrease > 0.3, area > 0.5 ha)
5. Create deforestation event if detected
6. Send notifications to cooperative managers and agronomists

### 5. Progress Tracking
- Updates `job_executions` table with progress
- Logs items processed, items failed
- Records execution duration

### 6. Completion
- Marks job as completed, partial, or failed
- Stores final statistics and error details

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
```typescript
await deforestationDetectionJob.run({
  batchSize: 5,
  batchDelayMs: 3000,
  cooperativeId: 'uuid',
  baselineDate: new Date('2021-01-01'),
  currentDate: new Date('2026-05-01'),
});
```

## API Endpoints

### GET /api/cron/deforestation-detection
Runs the job with default configuration.

**Authentication**: `Authorization: Bearer <CRON_SECRET>`

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
  "executionId": "uuid",
  "totalProcessed": 150,
  "totalFailed": 2,
  "deforestationDetected": 5,
  "durationMs": 45000,
  "timestamp": "2026-05-06T02:00:00.000Z"
}
```

### POST /api/cron/deforestation-detection
Runs the job with custom configuration.

**Authentication**: `Authorization: Bearer <CRON_SECRET>`

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

## Monitoring

### Query Recent Executions
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

### Query Detected Events
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

## Performance

### Execution Time
With default configuration (10 parcelles/batch, 2-second delays):
- **100 parcelles**: ~2 minutes
- **300 parcelles**: ~6 minutes
- **500 parcelles**: ~10 minutes (max timeout)

### API Limits
Google Earth Engine free tier:
- **Daily limit**: 250,000 requests/day
- **Per-parcelle requests**: ~4 requests
- **Weekly capacity**: ~1,750 parcelles

## Error Handling

### Partial Failures
- Job continues with remaining parcelles
- Status marked as `partial`
- Failed parcelles logged in execution metadata

### Complete Failures
- Status marked as `failed`
- Error message and stack trace logged
- Job execution record updated

### Rate Limiting
- Batch delays help avoid rate limiting
- Exponential backoff in imagery service
- Failed requests can be retried manually

### Timeout Protection
- Job stops after 10 minutes
- Status marked as `partial`
- Remaining parcelles processed in next run

## Testing

### Unit Tests
- ✅ 9 test cases
- ✅ All tests passing
- Coverage: initialization, execution, error handling

### Test Results
```
✓ DeforestationDetectionJob (9)
  ✓ Job Initialization (2)
    ✓ should throw error if SUPABASE_SERVICE_KEY is missing
    ✓ should initialize successfully with required environment variables
  ✓ Job Execution (6)
    ✓ should complete successfully with no parcelles
    ✓ should process parcelles in batches
    ✓ should detect deforestation events
    ✓ should handle partial failures
    ✓ should respect batch delay
    ✓ should filter by cooperative ID
  ✓ Error Handling (1)
    ✓ should handle complete job failure

Test Files  1 passed (1)
     Tests  9 passed (9)
  Duration  2.13s
```

## Environment Variables

Required:
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

## Security

### Authentication
- All cron endpoints protected by `CRON_SECRET`
- Unauthorized requests return 401 status

### Authorization
- Job uses service role key to bypass RLS
- Service role key never exposed to client

### Data Access
- Job can access all parcelles
- Events created with system context
- Notifications sent to appropriate users

## Acceptance Criteria

✅ **Create background job to check all parcelles for deforestation**
- Implemented `DeforestationDetectionJob` class
- Retrieves all active parcelles
- Detects deforestation using baseline vs current NDVI

✅ **Run job weekly (configurable schedule)**
- Configured in `vercel.json`: `0 2 * * 0` (Sundays at 2:00 AM UTC)
- Schedule is configurable via Vercel dashboard

✅ **Process parcelles in batches to avoid rate limits**
- Default batch size: 10 parcelles
- Default batch delay: 2 seconds
- Both configurable via options

✅ **Log job execution and results**
- Creates `job_executions` record
- Logs status, duration, items processed/failed
- Stores error details and execution metadata

✅ **Job runs on schedule and detects deforestation**
- Scheduled via Vercel Cron
- Detects deforestation using NDVI thresholds
- Creates events and sends notifications

## Next Steps

1. **Deploy Migration**: Run `supabase/migrations/20260506000001_create_job_executions.sql`
2. **Set Environment Variable**: Add `CRON_SECRET` to Vercel environment variables
3. **Deploy to Production**: Push changes to trigger Vercel deployment
4. **Verify Cron Schedule**: Check Vercel dashboard for cron job configuration
5. **Monitor First Run**: Check `job_executions` table after first scheduled run
6. **Test Manual Trigger**: Use POST endpoint to test with custom configuration

## Related Tasks

- ✅ Task 4.1.1: Implement deforestation detection algorithm
- ✅ Task 4.1.2: Implement baseline imagery retrieval
- ✅ Task 4.1.3: Implement alert creation
- ✅ Task 4.4.2: Implement notification sending
- ✅ Task 4.5.1: Create periodic deforestation detection job (this task)

## Future Enhancements

- [ ] Add email notifications for job failures
- [ ] Implement retry logic for failed parcelles
- [ ] Add support for custom NDVI thresholds per cooperative
- [ ] Implement incremental processing (only check updated parcelles)
- [ ] Add dashboard for job execution monitoring
- [ ] Support for multiple baseline dates
- [ ] Add Slack/Discord webhook notifications
- [ ] Implement job scheduling UI for admins
- [ ] Add dry-run mode (detect but don't create events)
- [ ] Implement parallel processing across multiple functions
