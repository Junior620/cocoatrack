# Notification Batching

## Overview

The notification batching system prevents notification spam by grouping non-critical notifications into daily digest emails. This ensures users receive important alerts immediately while batching less urgent updates into a single daily summary.

**Task**: 4.4.5 - Implement notification batching  
**Requirement**: 19.6 - Batch notifications to avoid spam (max 1 digest per day)

## Batching Rules

### Immediate Delivery (No Batching)

The following notifications are sent **immediately**:

- **Critical Priority**: Deforestation alerts, API rate limit exceeded
- **High Priority**: Health status declined by 2+ categories, API rate limit warnings

### Batched Delivery (Daily Digest)

The following notifications are **batched** for daily digest:

- **Medium Priority**: API rate limit warnings (non-admin users)
- **Low Priority**: Yield predictions ready, general updates

## Architecture

### Database Schema

#### notification_batches Table

Tracks daily digest batches for each user:

```sql
CREATE TABLE notification_batches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  batch_date DATE NOT NULL,
  notification_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (user_id, batch_date)
);
```

**Key Constraint**: `UNIQUE (user_id, batch_date)` ensures max 1 batch per user per day.

#### batched_notifications Table

Stores individual notifications within batches:

```sql
CREATE TABLE batched_notifications (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES notification_batches(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  metadata JSONB,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Service Layer

#### NotificationBatchingService

Main service for batching logic:

```typescript
class NotificationBatchingService {
  // Determine if notification should be batched
  static shouldBatchNotification(priority: NotificationPriority): boolean;
  
  // Add notification to batch queue
  static addToBatch(payload: NotificationPayload): Promise<string | null>;
  
  // Get unsent batches for a date
  static getUnsentBatches(batchDate: string): Promise<NotificationBatch[]>;
  
  // Get notifications for a batch
  static getBatchNotifications(batchId: string): Promise<BatchedNotification[]>;
  
  // Send batch digest email
  static sendBatchDigest(batch: NotificationBatch, notifications: BatchedNotification[]): Promise<boolean>;
  
  // Mark batch as sent
  static markBatchAsSent(batchId: string): Promise<boolean>;
  
  // Process all unsent batches (called by cron job)
  static processUnsentBatches(batchDate?: string): Promise<number>;
}
```

### Integration with NotificationService

The main `NotificationService` automatically routes notifications based on priority:

```typescript
static async sendNotification(
  type: SatelliteNotificationType,
  userId: string,
  data: unknown
): Promise<string | null> {
  const payload = buildPayload(type, userId, data);
  
  // Check if notification should be batched
  if (NotificationBatchingService.shouldBatchNotification(payload.priority)) {
    return await NotificationBatchingService.addToBatch(payload);
  }
  
  // Send immediately for critical/high priority
  return await sendImmediately(payload);
}
```

## Scheduled Job

### Cron Configuration

Daily digest emails are sent by a scheduled job configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-notification-digests",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Schedule**: Every day at 8:00 AM UTC (9:00 AM WAT in Cameroon)

### Cron Endpoint

**Endpoint**: `GET /api/cron/send-notification-digests`

**Security**: Protected by `CRON_SECRET` environment variable

**Process**:
1. Retrieve all unsent batches from yesterday
2. For each batch:
   - Get all notifications in the batch
   - Generate digest email HTML
   - Send email to user
   - Mark batch as sent
3. Return count of processed batches

**Manual Trigger** (for testing):

```bash
curl -X POST https://your-app.vercel.app/api/cron/send-notification-digests \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batchDate": "2026-05-05"}'
```

## Digest Email Format

### Email Structure

The daily digest email includes:

1. **Header**: CocoaTrack branding, date
2. **Summary**: Total notification count
3. **Notification List**: Each notification with:
   - Title
   - Priority badge (color-coded)
   - Body text
   - Action link (if applicable)
4. **Call-to-Action**: "View all notifications" button
5. **Footer**: Unsubscribe/preferences link

### Example Email

```
┌─────────────────────────────────────────┐
│  📊 Résumé quotidien CocoaTrack         │
│  Lundi 6 mai 2026                       │
└─────────────────────────────────────────┘

Bonjour Jean Dupont,

Vous avez reçu 3 notifications aujourd'hui concernant vos parcelles et activités satellite.

┌─────────────────────────────────────────┐
│ 📊 Prédiction de rendement disponible   │ [BASSE]
│ La prédiction de rendement pour         │
│ Parcelle A est maintenant disponible    │
│ → Voir les détails                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⚠️ Limite API Google Earth Engine       │ [MOYENNE]
│ L'utilisation de l'API a atteint 85%    │
│ → Voir les détails                      │
└─────────────────────────────────────────┘

[Voir toutes les notifications]

─────────────────────────────────────────
Ceci est un résumé quotidien automatique.
Gérer vos préférences de notification
```

## Environment Variables

### Required Variables

```bash
# Cron job authentication
CRON_SECRET=your-secret-key-here

# Application URL for email links
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Setting Up Cron Secret

1. Generate a secure random string:
   ```bash
   openssl rand -base64 32
   ```

2. Add to Vercel environment variables:
   ```bash
   vercel env add CRON_SECRET
   ```

3. Add to `.env.local` for local testing:
   ```bash
   CRON_SECRET=your-generated-secret
   ```

## Testing

### Unit Tests

Run notification batching tests:

```bash
npm test tests/notifications/notification-batching.service.test.ts
```

### Manual Testing

1. **Create test notifications**:
   ```typescript
   // In your code or API route
   await NotificationService.sendNotification(
     'yield_prediction_ready',
     'user-id',
     { parcelleName: 'Test Parcelle', predictedYield: 1500, harvestSeason: '2026-Q2' }
   );
   ```

2. **Check batch created**:
   ```sql
   SELECT * FROM notification_batches WHERE user_id = 'user-id';
   SELECT * FROM batched_notifications WHERE user_id = 'user-id';
   ```

3. **Manually trigger digest**:
   ```bash
   curl -X POST http://localhost:3000/api/cron/send-notification-digests \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"batchDate": "2026-05-06"}'
   ```

4. **Verify batch marked as sent**:
   ```sql
   SELECT * FROM notification_batches WHERE sent_at IS NOT NULL;
   ```

## Monitoring

### Key Metrics

Monitor the following metrics:

1. **Batch Processing Success Rate**:
   - Number of batches processed successfully
   - Number of batches failed
   - Average processing time

2. **Notification Volume**:
   - Total notifications batched per day
   - Average notifications per batch
   - Peak notification times

3. **Email Delivery**:
   - Email send success rate
   - Email bounce rate
   - Email open rate (if tracking enabled)

### Logging

The batching service logs key events:

```typescript
// Batch creation
[NotificationBatchingService] Batching medium priority notification for user user-123

// Batch processing
[Cron] Starting notification digest processing
[Cron] Found 15 unsent batches
[Cron] Successfully processed batch batch-456 with 3 notifications
[Cron] Notification digest processing complete: 15 batches sent

// Errors
[NotificationBatchingService] Failed to add notification to batch: <error>
[Cron] Error processing batch batch-789: <error>
```

### Database Queries

**Check unsent batches**:
```sql
SELECT 
  nb.id,
  nb.user_id,
  p.full_name,
  p.email,
  nb.batch_date,
  nb.notification_count,
  nb.created_at
FROM notification_batches nb
JOIN profiles p ON p.id = nb.user_id
WHERE nb.sent_at IS NULL
ORDER BY nb.batch_date DESC;
```

**Check batch statistics**:
```sql
SELECT 
  batch_date,
  COUNT(*) as total_batches,
  SUM(notification_count) as total_notifications,
  AVG(notification_count) as avg_notifications_per_batch,
  COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) as sent_batches,
  COUNT(CASE WHEN sent_at IS NULL THEN 1 END) as unsent_batches
FROM notification_batches
GROUP BY batch_date
ORDER BY batch_date DESC;
```

## Troubleshooting

### Batches Not Being Sent

**Symptoms**: Batches remain unsent after cron job runs

**Possible Causes**:
1. Cron job not configured correctly in `vercel.json`
2. `CRON_SECRET` not set or incorrect
3. Email service not configured
4. Database connection issues

**Solutions**:
1. Verify cron configuration in Vercel dashboard
2. Check environment variables
3. Review cron job logs in Vercel
4. Manually trigger cron endpoint to test

### Duplicate Digests

**Symptoms**: Users receive multiple digests for the same day

**Possible Causes**:
1. Cron job running multiple times
2. Manual triggers overlapping with scheduled runs
3. Database constraint not enforced

**Solutions**:
1. Check cron job schedule in Vercel
2. Verify `UNIQUE (user_id, batch_date)` constraint exists
3. Review cron job execution logs

### Missing Notifications in Digest

**Symptoms**: Some notifications not included in digest

**Possible Causes**:
1. Notifications sent after batch was processed
2. Notifications marked as immediate (critical/high priority)
3. Database query filtering issues

**Solutions**:
1. Check notification timestamps vs batch sent_at
2. Verify notification priority settings
3. Review batch notification query logic

## Best Practices

### For Developers

1. **Always use NotificationService**: Don't bypass the service to send notifications directly
2. **Set correct priority**: Ensure notifications have appropriate priority levels
3. **Test batching logic**: Verify notifications are batched correctly before deploying
4. **Monitor cron jobs**: Set up alerts for cron job failures

### For Administrators

1. **Review batch statistics**: Regularly check batch processing metrics
2. **Adjust cron schedule**: Modify schedule based on user timezone preferences
3. **Monitor email deliverability**: Track bounce rates and spam complaints
4. **Respect user preferences**: Honor notification preference settings

## Future Enhancements

Potential improvements for the batching system:

1. **User-configurable digest time**: Allow users to choose when they receive digests
2. **Digest frequency options**: Support weekly or custom frequency
3. **Priority-based grouping**: Group notifications by priority in digest
4. **Rich email templates**: Add charts, images, and interactive elements
5. **SMS digest option**: Support SMS delivery for users without email
6. **Digest preview**: Allow users to preview digest before sending
7. **Batch analytics**: Provide insights on notification patterns

## Related Documentation

- [Notification System](./notifications.md)
- [API Documentation](../api/satellite.md)
- [Database Schema](../database/schema.md)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
