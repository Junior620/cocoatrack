# Job Monitoring Documentation

## Overview

The Job Monitoring system provides comprehensive monitoring, logging, and alerting for background jobs in the CocoaTrack satellite imagery system. It tracks job execution metrics, maintains detailed logs, and sends alerts when jobs fail.

**Task**: 4.5.2 - Implement job monitoring

## Features

### 1. Structured Logging

The monitoring service provides structured logging with multiple log levels:

- **Info**: Normal job progress and completion
- **Warning**: Non-critical issues (e.g., approaching time limits)
- **Error**: Job failures and errors

Each log entry includes:
- Timestamp
- Log level
- Message
- Context (additional metadata)

### 2. Job Execution Metrics

The system tracks comprehensive metrics for each job execution:

- **Execution time**: Duration in milliseconds
- **Success rate**: Percentage of successfully processed items
- **Items processed**: Total number of items processed
- **Items failed**: Number of items that failed processing
- **Status**: completed, partial, or failed

### 3. Job Statistics

Analyze job performance over time periods:

- Total executions
- Success/failure counts
- Average execution time
- Success rate trends
- Last execution details

### 4. Job Health Monitoring

Automated health checks that identify:

- Low success rates (< 80%)
- Consecutive failures (≥ 3)
- High execution times (> 5 minutes)
- Recent execution status

### 5. Failure Alerting

Automatic alerts sent to administrators when:

- A job fails completely
- 3 or more consecutive failures occur
- Success rate drops below 50% in 24 hours

Alerts are delivered via:
- In-app notifications
- Email notifications (when configured)

## Usage

### Basic Logging

```typescript
import { jobMonitoringService } from '@/lib/satellite/jobs/job-monitoring.service';

// Log job start
jobMonitoringService.logJobStart(
  executionId,
  'My Background Job',
  'my_job_type',
  { customParam: 'value' }
);

// Log progress
jobMonitoringService.logJobProgress(
  executionId,
  'Processing batch 1/10',
  { batchNumber: 1, totalBatches: 10 }
);

// Log completion
jobMonitoringService.logJobCompletion(
  executionId,
  'My Background Job',
  'completed',
  {
    durationMs: 5000,
    itemsProcessed: 100,
    itemsFailed: 0,
  }
);

// Log errors
jobMonitoringService.logJobError(
  executionId,
  new Error('Something went wrong'),
  { additionalContext: 'value' }
);

// Log warnings
jobMonitoringService.logJobWarning(
  executionId,
  'Approaching time limit',
  { timeRemaining: 60000 }
);
```

### Retrieving Logs

```typescript
// Get logs for a specific execution
const logs = jobMonitoringService.getJobLogs(executionId);

// Clear logs when done
jobMonitoringService.clearJobLogs(executionId);
```

### Getting Job Metrics

```typescript
// Get metrics for a specific execution
const metrics = await jobMonitoringService.getJobMetrics(executionId);

console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Duration: ${metrics.durationMs}ms`);
console.log(`Processed: ${metrics.itemsProcessed}`);
console.log(`Failed: ${metrics.itemsFailed}`);
```

### Getting Job Statistics

```typescript
// Get statistics for the last 7 days
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const stats = await jobMonitoringService.getJobStatistics(
  'deforestation_detection',
  startDate,
  endDate
);

console.log(`Total executions: ${stats.totalExecutions}`);
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Average duration: ${stats.averageDurationMs}ms`);
```

### Checking Job Health

```typescript
// Check health status for the last 7 days
const health = await jobMonitoringService.getJobHealthStatus(
  'deforestation_detection',
  7
);

if (!health.isHealthy) {
  console.log('Job health issues detected:');
  health.issues.forEach(issue => console.log(`- ${issue}`));
}

console.log(`Consecutive failures: ${health.consecutiveFailures}`);
console.log(`Recent success rate: ${health.recentSuccessRate}%`);
```

### Sending Failure Alerts

```typescript
// Check and send failure alert if needed
await jobMonitoringService.checkAndSendFailureAlert(
  executionId,
  'My Background Job',
  'my_job_type',
  'failed',
  {
    durationMs: 5000,
    itemsProcessed: 10,
    itemsFailed: 10,
    errorMessage: 'Job failed due to API error',
  }
);
```

## Integration Example

Here's how the monitoring service is integrated into the deforestation detection job:

```typescript
import { jobMonitoringService } from './job-monitoring.service';

class MyBackgroundJob {
  async run() {
    const executionId = await this.createJobExecution();
    const startTime = Date.now();

    try {
      // Log job start
      jobMonitoringService.logJobStart(
        executionId,
        'My Background Job',
        'my_job_type'
      );

      // Process items
      let processed = 0;
      let failed = 0;

      for (const item of items) {
        try {
          await this.processItem(item);
          processed++;
          
          // Log progress periodically
          if (processed % 10 === 0) {
            jobMonitoringService.logJobProgress(
              executionId,
              `Processed ${processed}/${items.length} items`
            );
          }
        } catch (error) {
          failed++;
          jobMonitoringService.logJobError(
            executionId,
            error,
            { itemId: item.id }
          );
        }
      }

      // Determine status
      const status = failed === 0 ? 'completed' : 'partial';

      // Log completion
      jobMonitoringService.logJobCompletion(
        executionId,
        'My Background Job',
        status,
        {
          durationMs: Date.now() - startTime,
          itemsProcessed: processed,
          itemsFailed: failed,
        }
      );

      // Check if alert should be sent
      await jobMonitoringService.checkAndSendFailureAlert(
        executionId,
        'My Background Job',
        'my_job_type',
        status,
        {
          durationMs: Date.now() - startTime,
          itemsProcessed: processed,
          itemsFailed: failed,
        }
      );

      return { status, processed, failed };
    } catch (error) {
      // Log error
      jobMonitoringService.logJobError(executionId, error);

      // Log failure
      jobMonitoringService.logJobCompletion(
        executionId,
        'My Background Job',
        'failed',
        {
          durationMs: Date.now() - startTime,
          itemsProcessed: 0,
          itemsFailed: 0,
          errorMessage: error.message,
        }
      );

      // Send failure alert
      await jobMonitoringService.checkAndSendFailureAlert(
        executionId,
        'My Background Job',
        'my_job_type',
        'failed',
        {
          durationMs: Date.now() - startTime,
          itemsProcessed: 0,
          itemsFailed: 0,
          errorMessage: error.message,
        }
      );

      throw error;
    }
  }
}
```

## API Endpoints

### GET /api/admin/jobs

Get job execution statistics and health status.

**Authentication**: Admin only

**Query Parameters**:
- `jobType` (optional): Filter by job type (default: 'deforestation_detection')
- `days` (optional): Number of days to look back (default: 7)

**Response**:
```json
{
  "success": true,
  "data": {
    "jobType": "deforestation_detection",
    "period": {
      "startDate": "2026-04-29T00:00:00.000Z",
      "endDate": "2026-05-06T00:00:00.000Z",
      "days": 7
    },
    "statistics": {
      "totalExecutions": 10,
      "successfulExecutions": 8,
      "failedExecutions": 1,
      "partialExecutions": 1,
      "successRate": 80,
      "averageDurationMs": 45000,
      "totalItemsProcessed": 500,
      "totalItemsFailed": 25
    },
    "health": {
      "jobType": "deforestation_detection",
      "isHealthy": true,
      "issues": [],
      "consecutiveFailures": 0,
      "recentSuccessRate": 80,
      "averageExecutionTime": 45000
    },
    "recentExecutions": [...]
  }
}
```

### GET /api/admin/jobs/[executionId]

Get detailed information about a specific job execution.

**Authentication**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "uuid",
      "job_name": "Periodic Deforestation Detection",
      "job_type": "deforestation_detection",
      "status": "completed",
      "started_at": "2026-05-06T10:00:00.000Z",
      "completed_at": "2026-05-06T10:05:00.000Z",
      "duration_ms": 300000,
      "items_processed": 50,
      "items_failed": 2
    },
    "metrics": {
      "executionId": "uuid",
      "jobType": "deforestation_detection",
      "successRate": 96,
      "logs": [...]
    },
    "logs": [
      {
        "timestamp": "2026-05-06T10:00:00.000Z",
        "level": "info",
        "message": "[Job Start] Periodic Deforestation Detection",
        "context": {...}
      }
    ]
  }
}
```

## Database Schema

Job executions are tracked in the `job_executions` table:

```sql
CREATE TABLE job_executions (
  id UUID PRIMARY KEY,
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  execution_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Notification Format

When a job fails, administrators receive a notification:

**Title**: 🚨 Échec du job: [Job Name]

**Body**: Le job "[Job Name]" a échoué après [duration]s. Erreur: [error message]. [Consecutive failures if > 1]

**Action**: Link to `/admin/jobs` page

## Best Practices

### 1. Log Appropriately

- Use `logJobStart()` at the beginning of job execution
- Use `logJobProgress()` for significant milestones (not every item)
- Use `logJobCompletion()` at the end with final metrics
- Use `logJobError()` for errors that don't stop the job
- Use `logJobWarning()` for non-critical issues

### 2. Include Context

Always include relevant context in log entries:

```typescript
jobMonitoringService.logJobProgress(
  executionId,
  'Processing batch',
  {
    batchNumber: 1,
    totalBatches: 10,
    batchSize: 50,
    cooperativeId: 'uuid',
  }
);
```

### 3. Clear Logs

Clear logs after job completion to prevent memory leaks:

```typescript
// At the end of job execution
jobMonitoringService.clearJobLogs(executionId);
```

### 4. Monitor Health Regularly

Set up periodic health checks:

```typescript
// Run daily health check
const health = await jobMonitoringService.getJobHealthStatus(
  'deforestation_detection',
  7
);

if (!health.isHealthy) {
  // Take action (notify admins, investigate issues)
}
```

### 5. Use Failure Alerts

Always call `checkAndSendFailureAlert()` after job completion:

```typescript
await jobMonitoringService.checkAndSendFailureAlert(
  executionId,
  jobName,
  jobType,
  status,
  metrics
);
```

## Troubleshooting

### Logs Not Appearing

Logs are stored in memory and cleared after job completion. To persist logs:

1. Store logs in the `execution_metadata` field of `job_executions` table
2. Implement a log persistence mechanism
3. Use external logging service (e.g., CloudWatch, Datadog)

### Alerts Not Sending

Check:

1. Admin users exist in the database
2. Notification service is configured correctly
3. Email service is set up (if using email notifications)
4. Check console logs for error messages

### High Memory Usage

If memory usage is high:

1. Clear logs more frequently using `clearJobLogs()`
2. Limit the number of log entries per execution
3. Implement log rotation or persistence

## Future Enhancements

Potential improvements for the monitoring system:

1. **Log Persistence**: Store logs in database or external service
2. **Real-time Monitoring**: WebSocket-based real-time job monitoring dashboard
3. **Advanced Analytics**: Trend analysis, anomaly detection
4. **Custom Alerts**: Configurable alert thresholds and conditions
5. **Performance Profiling**: Detailed performance metrics and bottleneck identification
6. **Integration**: Integration with external monitoring tools (Datadog, New Relic, etc.)

## Related Documentation

- [Deforestation Detection Job](./deforestation-detection.md)
- [Notification System](../notifications/notification-system.md)
- [API Documentation](../api/satellite.md)
