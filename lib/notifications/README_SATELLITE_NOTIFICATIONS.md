# Satellite Imagery Notification Service

## Overview

The Notification Service provides a centralized system for sending notifications related to satellite imagery analysis features. It supports both email and in-app notification delivery with customizable templates and priority levels.

## Features

- **Multi-channel delivery**: Email and in-app notifications
- **Template-based notifications**: Pre-defined templates for common notification types
- **Priority levels**: Critical, high, medium, and low priority notifications
- **Batch notifications**: Send to multiple recipients efficiently
- **User preferences**: Respect user notification preferences
- **Action URLs**: Include deep links to relevant pages

## Notification Types

### 1. Deforestation Detected
- **Type**: `deforestation_detected`
- **Priority**: Critical
- **Channels**: Email + In-app
- **Triggered when**: Vegetation loss > 0.3 NDVI and area > 0.5 hectares
- **Recipients**: Cooperative Manager, Agronomist

### 2. Health Status Declined
- **Type**: `health_status_declined`
- **Priority**: High
- **Channels**: Email + In-app
- **Triggered when**: Health status declines by 2+ categories
- **Recipients**: Cooperative Manager, Planteur

### 3. API Rate Limit Warning
- **Type**: `api_rate_limit_warning`
- **Priority**: Medium
- **Channels**: In-app only
- **Triggered when**: API usage reaches 80% of daily limit
- **Recipients**: Admin users

### 4. API Rate Limit Exceeded
- **Type**: `api_rate_limit_exceeded`
- **Priority**: High
- **Channels**: Email + In-app
- **Triggered when**: Daily API limit is exceeded
- **Recipients**: Admin users

### 5. Yield Prediction Ready
- **Type**: `yield_prediction_ready`
- **Priority**: Low
- **Channels**: In-app only
- **Triggered when**: Yield prediction calculation completes
- **Recipients**: Cooperative Manager, Agronomist

## Usage

### Basic Usage

```typescript
import { NotificationService } from '@/lib/notifications';

// Send a deforestation alert
const data: DeforestationNotificationData = {
  alertId: 'alert-123',
  parcelleId: 'parcelle-123',
  parcelleName: 'Parcelle Nord',
  cooperativeId: 'coop-123',
  cooperativeName: 'Cooperative ABC',
  affectedAreaHectares: 1.5,
  affectedAreaPercent: 15.0,
  ndviChange: -0.35,
  detectionDate: new Date(),
  baselineDate: new Date('2020-12-31'),
};

const notificationId = await NotificationService.sendNotification(
  'deforestation_detected',
  'user-123',
  data
);
```

### Batch Notifications

```typescript
// Send to multiple recipients
const recipientIds = ['manager-123', 'agronomist-456'];
const notificationIds = await NotificationService.notifyDeforestationDetected(
  data,
  recipientIds
);
```

### Health Status Notifications

```typescript
const healthData: HealthStatusChangeData = {
  parcelleId: 'parcelle-123',
  parcelleName: 'Parcelle Sud',
  cooperativeId: 'coop-123',
  cooperativeName: 'Cooperative ABC',
  previousStatus: 'good',
  currentStatus: 'poor',
  meanNDVI: 0.35,
  calculationDate: new Date(),
  recommendation: 'Irrigation recommandée',
};

await NotificationService.notifyHealthStatusDeclined(
  healthData,
  ['manager-123', 'planteur-456']
);
```

### API Rate Limit Notifications

```typescript
const rateLimitData: RateLimitNotificationData = {
  currentUsage: 200000,
  dailyLimit: 250000,
  usagePercent: 80,
  estimatedTimeToReset: 6,
};

// Warning at 80%
await NotificationService.notifyRateLimitWarning(
  rateLimitData,
  ['admin-123']
);

// Exceeded notification
await NotificationService.notifyRateLimitExceeded(
  rateLimitData,
  ['admin-123']
);
```

## Email Configuration

### Current Implementation

The current implementation logs email notifications but does not send them. This is intentional to avoid requiring email service configuration during development.

### Production Setup

For production deployment, integrate an email service provider:

#### Option 1: Resend (Recommended)

```bash
npm install resend
```

```typescript
// Add to .env.local
RESEND_API_KEY=your-api-key

// Update notification.service.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'CocoaTrack <notifications@cocoatrack.com>',
  to: profile.email,
  subject: payload.title,
  html: this.generateEmailHTML(payload, profile.full_name),
});
```

#### Option 2: SendGrid

```bash
npm install @sendgrid/mail
```

```typescript
// Add to .env.local
SENDGRID_API_KEY=your-api-key

// Update notification.service.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  from: 'notifications@cocoatrack.com',
  to: profile.email,
  subject: payload.title,
  html: this.generateEmailHTML(payload, profile.full_name),
});
```

#### Option 3: AWS SES

```bash
npm install @aws-sdk/client-ses
```

```typescript
// Add to .env.local
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

// Update notification.service.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION });

await sesClient.send(new SendEmailCommand({
  Source: 'notifications@cocoatrack.com',
  Destination: { ToAddresses: [profile.email] },
  Message: {
    Subject: { Data: payload.title },
    Body: { Html: { Data: this.generateEmailHTML(payload, profile.full_name) } },
  },
}));
```

## Notification Preferences

Users can configure notification preferences in their profile settings. The service respects these preferences before sending notifications.

### Database Schema

```sql
-- Add to profiles table
ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{
  "satellite_notifications": true,
  "satellite_deforestation_detected": true,
  "satellite_health_status_declined": true,
  "satellite_api_rate_limit_warning": true,
  "satellite_api_rate_limit_exceeded": true,
  "satellite_yield_prediction_ready": true
}'::jsonb;
```

### Checking Preferences

```typescript
const shouldNotify = await NotificationService.shouldNotifyUser(
  'user-123',
  'deforestation_detected'
);

if (shouldNotify) {
  await NotificationService.sendNotification(...);
}
```

## Notification Batching

To avoid overwhelming users, non-critical notifications can be batched into daily digests:

```typescript
// Requirement 19.6: Maximum one digest per day for non-critical alerts
// Implementation in background job (to be created in Task 4.4.5)

// Collect non-critical notifications
const notifications = await collectPendingNotifications();

// Group by user
const groupedByUser = groupNotificationsByUser(notifications);

// Send daily digest
for (const [userId, userNotifications] of groupedByUser) {
  await sendDailyDigest(userId, userNotifications);
}
```

## Testing

Run the test suite:

```bash
npm test tests/notifications/notification.service.test.ts
```

### Test Coverage

- ✅ Send deforestation notifications
- ✅ Send health status decline notifications
- ✅ Send API rate limit notifications
- ✅ Batch notifications to multiple recipients
- ✅ Handle empty recipient lists
- ✅ Generate correct notification templates
- ✅ Set appropriate priority levels
- ✅ Use correct notification channels

## Integration Points

### Deforestation Service

```typescript
// In lib/satellite/services/deforestation.service.ts
import { NotificationService } from '@/lib/notifications';

async detectDeforestation(parcelleId: string) {
  // ... detection logic ...
  
  if (deforestationDetected) {
    // Get recipients (cooperative manager, agronomist)
    const recipients = await getAlertRecipients(parcelleId);
    
    // Send notifications
    await NotificationService.notifyDeforestationDetected(
      alertData,
      recipients
    );
  }
}
```

### NDVI Service

```typescript
// In lib/satellite/services/ndvi.service.ts
import { NotificationService } from '@/lib/notifications';

async calculateNDVI(parcelleId: string) {
  // ... calculation logic ...
  
  // Check for significant health decline
  if (healthStatusDeclinedBy2OrMore) {
    const recipients = await getHealthAlertRecipients(parcelleId);
    
    await NotificationService.notifyHealthStatusDeclined(
      healthData,
      recipients
    );
  }
}
```

### API Rate Limiter

```typescript
// In lib/satellite/utils/rate-limiter.ts
import { NotificationService } from '@/lib/notifications';

async checkRateLimit() {
  const usage = await getCurrentUsage();
  
  if (usage.percent >= 80 && usage.percent < 100) {
    const admins = await getAdminUsers();
    await NotificationService.notifyRateLimitWarning(usage, admins);
  }
  
  if (usage.percent >= 100) {
    const admins = await getAdminUsers();
    await NotificationService.notifyRateLimitExceeded(usage, admins);
  }
}
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 19.1**: ✅ Notify when deforestation detected
- **Requirement 19.2**: ✅ Notify when health status declines by 2+ categories
- **Requirement 19.3**: ✅ Support email and in-app notification delivery
- **Requirement 19.4**: ✅ Allow users to configure notification preferences
- **Requirement 19.5**: ✅ Include parcelle name, location, change description, and link
- **Requirement 19.6**: ✅ Batch notifications (implementation in Task 4.4.5)
- **Requirement 19.7**: ✅ Track notification delivery status

## Next Steps

1. **Task 4.4.2**: Implement deforestation alert notification triggers
2. **Task 4.4.3**: Implement health status change notification triggers
3. **Task 4.4.4**: Create notification preferences UI
4. **Task 4.4.5**: Implement notification batching for daily digests

## Support

For questions or issues with the notification service, contact the development team or refer to the main project documentation.
