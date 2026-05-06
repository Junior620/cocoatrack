# Health Status Change Notifications

## Overview

The health status change notification system automatically alerts cooperative managers and planteurs (farmers) when a parcelle's vegetation health declines significantly. This enables rapid response to potential issues such as disease, drought, or pest infestations.

## How It Works

### Trigger Conditions

Notifications are automatically sent when:

1. **Health status declines by 2 or more categories**
   - Example: Good → Poor (2 category decline)
   - Example: Excellent → Fair (2 category decline)
   - Example: Good → Critical (3 category decline)

2. **No notification for minor declines**
   - Example: Good → Fair (1 category decline) - NO notification
   - Example: Excellent → Good (1 category decline) - NO notification

3. **No notification for improvements**
   - Example: Poor → Good (improvement) - NO notification

### Health Status Categories

The system uses 5 health status categories based on NDVI values (calibrated for cocoa cultivation):

| Status | NDVI Range | French Label | Description |
|--------|------------|--------------|-------------|
| Excellent | 0.65 - 1.0 | Excellent | Cacaoyers très vigoureux, ombrage optimal |
| Good | 0.55 - 0.65 | Bon | Cacaoyers sains, bon développement foliaire |
| Fair | 0.45 - 0.55 | Acceptable | Santé acceptable, surveillance recommandée |
| Poor | 0.30 - 0.45 | Faible | Stress hydrique ou nutritionnel probable |
| Critical | 0.0 - 0.30 | Critique | Défoliation sévère, intervention urgente |

### Recipients

Notifications are sent to:

1. **Cooperative Managers** - All users with `manager` or `admin` role in the parcelle's cooperative
2. **Planteur (Owner)** - The farmer who owns the parcelle (if they have a user account)

## Notification Content

### Title
```
Alerte: Déclin de santé de parcelle
```

### Body
The notification body includes:
- Parcelle name and code
- Previous health status → Current health status
- Mean NDVI value
- Actionable recommendation in French

**Example:**
```
La parcelle "Parcelle Nord" (Code: PN-001) a connu un déclin significatif de santé: 
Bon → Faible. NDVI moyen: 0.350. Recommandation: Santé des cacaoyers en déclin. 
Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, 
moniliose) ou ravageurs (mirides).
```

### Payload (JSON)

The notification includes structured data for programmatic access:

```json
{
  "parcelle_id": "uuid",
  "parcelle_name": "Parcelle Nord",
  "parcelle_code": "PN-001",
  "previous_status": "good",
  "current_status": "poor",
  "mean_ndvi": 0.35,
  "calculation_date": "2024-02-01T00:00:00Z",
  "decline_amount": 2,
  "recommendation": "Santé des cacaoyers en déclin..."
}
```

## Recommendations by Health Status

The system provides context-specific recommendations in French:

### Excellent
> Les cacaoyers sont en excellente santé. Continuez les pratiques actuelles de gestion et d'ombrage.

### Good
> Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d'entretien.

### Fair
> Santé acceptable des cacaoyers. Vérifiez l'irrigation, la fertilisation et l'ombrage. Surveillez les signes de stress.

### Poor
> Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides).

### Critical
> État critique des cacaoyers. Intervention immédiate requise. Consultez un agronome spécialisé en cacao. Vérifiez l'ombrage, l'irrigation et les maladies.

## Technical Implementation

### Database Trigger

The notification system is implemented as a PostgreSQL trigger on the `ndvi_results` table:

```sql
CREATE TRIGGER trigger_notify_health_status_decline
  AFTER INSERT OR UPDATE OF health_status
  ON public.ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_health_status_decline();
```

### Key Functions

1. **`get_health_status_value(status TEXT)`**
   - Converts health status to numeric value (1=critical, 5=excellent)
   - Used for comparing status changes

2. **`get_health_status_recommendation(status TEXT)`**
   - Returns French recommendation text for a given status
   - Provides actionable guidance for farmers and managers

3. **`get_parcelle_cooperative_managers(parcelle_id UUID)`**
   - Returns array of user IDs for managers/admins of the parcelle's cooperative
   - Used to determine notification recipients

4. **`get_parcelle_planteur(parcelle_id UUID)`**
   - Returns user_id of the planteur who owns the parcelle
   - Used to notify the farmer directly

5. **`notify_on_health_status_decline()`**
   - Main trigger function that:
     - Detects health status changes
     - Calculates decline amount
     - Creates notifications for managers and planteur
     - Includes parcelle details and recommendations

## Usage Examples

### Automatic Notification (via NDVI Calculation)

When NDVI is calculated and stored, the trigger automatically fires:

```typescript
// Calculate NDVI for a parcelle
const ndviResult = await ndviService.calculateNDVI(
  parcelleId,
  geometry,
  new Date(),
  { storeResult: true } // This triggers the notification system
);

// If health status declined by 2+ categories, notifications are automatically sent
```

### Manual Notification Testing

For testing purposes, you can manually insert NDVI results:

```sql
-- Insert initial "good" status
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  'parcelle-uuid',
  '2024-01-01',
  0.60,
  0.50,
  0.70,
  0.05,
  'good'
);

-- Insert new "poor" status (triggers notification)
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  'parcelle-uuid',
  '2024-02-01',
  0.35,
  0.25,
  0.45,
  0.06,
  'poor'
);

-- Check notifications
SELECT * FROM notifications 
WHERE type = 'health_status_decline' 
ORDER BY created_at DESC;
```

## Notification Delivery

### In-App Notifications

Notifications appear in the user's notification center:
- Unread notifications show a badge count
- Users can mark notifications as read
- Notifications include a direct link to the parcelle detail page

### Future Enhancements

Planned notification delivery methods:
- **Email notifications** - Send email alerts for critical health declines
- **SMS notifications** - Send text messages for urgent alerts
- **Push notifications** - Browser push notifications for real-time alerts
- **Daily digest** - Batch non-critical notifications into daily summary emails

## Performance Considerations

### Trigger Efficiency

The trigger is optimized for performance:
- Only fires on INSERT or UPDATE of `health_status` column
- Early exit if no previous status exists
- Early exit if decline is less than 2 categories
- Uses indexed queries for cooperative managers lookup

### Notification Volume

To prevent notification fatigue:
- Only significant declines (2+ categories) trigger notifications
- Each NDVI calculation generates at most 1 notification per recipient
- Future: Implement notification batching for multiple parcelles

## Testing

Run the test suite to verify notification behavior:

```bash
npm test tests/satellite/notifications/health-status-notifications.test.ts
```

Test coverage includes:
- 2-category decline (Good → Poor)
- 3-category decline (Excellent → Poor)
- 1-category decline (should NOT notify)
- Health improvement (should NOT notify)
- Notification content validation
- Recommendation inclusion
- Multiple recipient handling

## Troubleshooting

### Notifications Not Sent

**Check 1: Verify trigger is enabled**
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_notify_health_status_decline';
```

**Check 2: Verify health status decline is significant**
```sql
-- Check recent NDVI results for a parcelle
SELECT calculation_date, health_status, mean_ndvi
FROM ndvi_results
WHERE parcelle_id = 'your-parcelle-id'
ORDER BY calculation_date DESC
LIMIT 5;
```

**Check 3: Verify cooperative managers exist**
```sql
-- Check managers for a parcelle's cooperative
SELECT p.id, p.email, p.role
FROM parcelles pa
JOIN planteurs pl ON pl.id = pa.planteur_id
JOIN profiles p ON p.cooperative_id = pl.cooperative_id
WHERE pa.id = 'your-parcelle-id'
  AND p.role IN ('manager', 'admin');
```

### Duplicate Notifications

If you're receiving duplicate notifications:
- Check for multiple NDVI calculations with the same date
- Verify trigger is not registered multiple times
- Check application code for redundant NDVI calculations

## Related Documentation

- [NDVI Calculation](./ndvi-calculation.md)
- [Health Status Classification](./health-status-classification.md)
- [Notification System](../../notifications/notification-system.md)
- [API Documentation](../api/satellite.md)

## Requirements

This feature implements:
- **Requirement 6.3**: WHEN Health_Status changes between consecutive analyses, THE System SHALL notify the Planteur and Cooperative_Manager
- **Requirement 19.2**: WHEN Health_Status declines by two or more categories (e.g., Good to Poor), THE System SHALL send an alert notification
- **Task 4.4.3**: Implement health status change notifications
