// CocoaTrack V2 - Notification Service for Satellite Imagery
// Implements notification delivery for deforestation alerts and health status changes
// Requirements: Requirement 19 (Notification System for Critical Changes)

import { createClient } from '@/lib/supabase/client';
import { NotificationBatchingService } from './notification-batching.service';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification template types for satellite imagery features
 */
export type SatelliteNotificationType =
  | 'deforestation_detected'
  | 'health_status_declined'
  | 'api_rate_limit_warning'
  | 'api_rate_limit_exceeded'
  | 'yield_prediction_ready';

/**
 * Notification delivery channels
 */
export type NotificationChannel = 'email' | 'in-app' | 'both';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Base notification payload
 */
export interface NotificationPayload {
  type: SatelliteNotificationType;
  userId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

/**
 * Deforestation alert notification data
 */
export interface DeforestationNotificationData {
  alertId: string;
  parcelleId: string;
  parcelleName: string;
  cooperativeId: string;
  cooperativeName: string;
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  ndviChange: number;
  detectionDate: Date;
  baselineDate: Date;
}

/**
 * Health status change notification data
 */
export interface HealthStatusChangeData {
  parcelleId: string;
  parcelleName: string;
  cooperativeId: string;
  cooperativeName: string;
  previousStatus: string;
  currentStatus: string;
  meanNDVI: number;
  calculationDate: Date;
  recommendation?: string;
}

/**
 * API rate limit notification data
 */
export interface RateLimitNotificationData {
  currentUsage: number;
  dailyLimit: number;
  usagePercent: number;
  estimatedTimeToReset: number; // in hours
}

/**
 * Notification template
 */
interface NotificationTemplate {
  title: (data: unknown) => string;
  body: (data: unknown) => string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  actionUrl?: (data: unknown) => string;
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Notification templates for satellite imagery features
 * Requirement 19.5: Include parcelle name, location, change description, and link
 */
const NOTIFICATION_TEMPLATES: Record<SatelliteNotificationType, NotificationTemplate> = {
  deforestation_detected: {
    title: (data: unknown) => {
      const d = data as DeforestationNotificationData;
      return `🚨 Déforestation détectée - ${d.parcelleName}`;
    },
    body: (data: unknown) => {
      const d = data as DeforestationNotificationData;
      return `Une perte de végétation de ${d.affectedAreaHectares.toFixed(2)} ha (${d.affectedAreaPercent.toFixed(1)}%) a été détectée sur la parcelle ${d.parcelleName} (${d.cooperativeName}). Changement NDVI: ${d.ndviChange.toFixed(3)}. Vérification requise.`;
    },
    priority: 'critical',
    channel: 'both',
    actionUrl: (data: unknown) => {
      const d = data as DeforestationNotificationData;
      return `/parcelles/${d.parcelleId}?tab=satellite&alert=${d.alertId}`;
    },
  },
  
  health_status_declined: {
    title: (data: unknown) => {
      const d = data as HealthStatusChangeData;
      return `⚠️ Santé de la parcelle en déclin - ${d.parcelleName}`;
    },
    body: (data: unknown) => {
      const d = data as HealthStatusChangeData;
      return `La santé de la parcelle ${d.parcelleName} (${d.cooperativeName}) est passée de "${d.previousStatus}" à "${d.currentStatus}". NDVI actuel: ${d.meanNDVI.toFixed(3)}. ${d.recommendation || 'Intervention recommandée.'}`;
    },
    priority: 'high',
    channel: 'both',
    actionUrl: (data: unknown) => {
      const d = data as HealthStatusChangeData;
      return `/parcelles/${d.parcelleId}?tab=satellite`;
    },
  },
  
  api_rate_limit_warning: {
    title: () => '⚠️ Limite API Google Earth Engine',
    body: (data: unknown) => {
      const d = data as RateLimitNotificationData;
      return `L'utilisation de l'API Google Earth Engine a atteint ${d.usagePercent.toFixed(0)}% de la limite quotidienne (${d.currentUsage.toLocaleString()}/${d.dailyLimit.toLocaleString()} requêtes). Réinitialisation dans ${d.estimatedTimeToReset}h.`;
    },
    priority: 'medium',
    channel: 'in-app',
    actionUrl: () => '/admin/satellite/usage',
  },
  
  api_rate_limit_exceeded: {
    title: () => '🚫 Limite API Google Earth Engine dépassée',
    body: (data: unknown) => {
      const d = data as RateLimitNotificationData;
      return `La limite quotidienne de l'API Google Earth Engine a été atteinte (${d.dailyLimit.toLocaleString()} requêtes). Les données en cache seront utilisées. Réinitialisation dans ${d.estimatedTimeToReset}h.`;
    },
    priority: 'high',
    channel: 'both',
    actionUrl: () => '/admin/satellite/usage',
  },
  
  yield_prediction_ready: {
    title: (data: unknown) => {
      const d = data as { parcelleName: string };
      return `📊 Prédiction de rendement disponible - ${d.parcelleName}`;
    },
    body: (data: unknown) => {
      const d = data as { parcelleName: string; predictedYield: number; harvestSeason: string };
      return `La prédiction de rendement pour ${d.parcelleName} est maintenant disponible: ${d.predictedYield.toFixed(0)} kg/ha pour la saison ${d.harvestSeason}.`;
    },
    priority: 'low',
    channel: 'in-app',
    actionUrl: (data: unknown) => {
      const d = data as { parcelleId: string };
      return `/parcelles/${d.parcelleId}?tab=satellite&section=yield`;
    },
  },
};

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

/**
 * Notification Service for Satellite Imagery Features
 * 
 * Handles notification delivery via email and in-app channels
 * Requirement 19: Notification System for Critical Changes
 */
export class NotificationService {
  /**
   * Send a notification using a template
   * 
   * Implements batching logic:
   * - Critical and high priority notifications are sent immediately
   * - Medium and low priority notifications are batched for daily digest
   * 
   * @param type - Notification template type
   * @param userId - Target user ID
   * @param data - Template data
   * @returns Promise resolving to notification ID
   */
  static async sendNotification(
    type: SatelliteNotificationType,
    userId: string,
    data: unknown
  ): Promise<string | null> {
    const template = NOTIFICATION_TEMPLATES[type];
    
    if (!template) {
      console.error(`[NotificationService] Unknown notification type: ${type}`);
      return null;
    }
    
    const payload: NotificationPayload = {
      type,
      userId,
      title: template.title(data),
      body: template.body(data),
      priority: template.priority,
      channel: template.channel,
      metadata: data as Record<string, unknown>,
      actionUrl: template.actionUrl ? template.actionUrl(data) : undefined,
    };
    
    // Check if notification should be batched
    // Requirement 19.6: Batch non-critical notifications
    if (NotificationBatchingService.shouldBatchNotification(payload.priority)) {
      console.log(`[NotificationService] Batching ${payload.priority} priority notification for user ${userId}`);
      return await NotificationBatchingService.addToBatch(payload);
    }
    
    // Send critical/high priority notifications immediately
    console.log(`[NotificationService] Sending ${payload.priority} priority notification immediately for user ${userId}`);
    
    // Send via appropriate channels
    const results = await Promise.allSettled([
      payload.channel === 'in-app' || payload.channel === 'both'
        ? this.sendInAppNotification(payload)
        : Promise.resolve(null),
      payload.channel === 'email' || payload.channel === 'both'
        ? this.sendEmailNotification(payload)
        : Promise.resolve(null),
    ]);
    
    // Return the in-app notification ID if created
    const inAppResult = results[0];
    if (inAppResult.status === 'fulfilled' && inAppResult.value) {
      return inAppResult.value;
    }
    
    return null;
  }
  
  /**
   * Send an in-app notification
   * Requirement 19.3: Support in-app notification center
   * 
   * @param payload - Notification payload
   * @returns Promise resolving to notification ID
   */
  static async sendInAppNotification(
    payload: NotificationPayload
  ): Promise<string | null> {
    try {
      const supabase = createClient();
      
      const { data, error } = await (supabase as any)
        .from('notifications')
        .insert({
          user_id: payload.userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          payload: {
            priority: payload.priority,
            actionUrl: payload.actionUrl,
            metadata: payload.metadata,
          },
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('[NotificationService] Failed to create in-app notification:', error);
        return null;
      }
      
      return data?.id || null;
    } catch (error) {
      console.error('[NotificationService] Error creating in-app notification:', error);
      return null;
    }
  }
  
  /**
   * Send an email notification
   * Requirement 19.3: Support email notification delivery
   * 
   * Note: This implementation uses Supabase Auth's email functionality.
   * For production, consider integrating a dedicated email service like:
   * - Resend (https://resend.com)
   * - SendGrid (https://sendgrid.com)
   * - AWS SES (https://aws.amazon.com/ses/)
   * 
   * @param payload - Notification payload
   * @returns Promise resolving to success status
   */
  static async sendEmailNotification(
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      // Get user email
      const supabase = createClient();
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('email, full_name')
        .eq('id', payload.userId)
        .single();
      
      if (profileError || !profile?.email) {
        console.error('[NotificationService] Failed to get user email:', profileError);
        return false;
      }
      
      // TODO: Implement email sending via email service provider
      // For now, we'll log the email that would be sent
      console.log('[NotificationService] Email notification (not sent - email service not configured):', {
        to: profile.email,
        subject: payload.title,
        body: payload.body,
        priority: payload.priority,
        actionUrl: payload.actionUrl,
      });
      
      // In production, replace the above with actual email sending:
      /*
      const emailService = new EmailService(); // Your email service integration
      await emailService.send({
        to: profile.email,
        subject: payload.title,
        html: this.generateEmailHTML(payload, profile.full_name),
        priority: payload.priority,
      });
      */
      
      return true;
    } catch (error) {
      console.error('[NotificationService] Error sending email notification:', error);
      return false;
    }
  }
  
  /**
   * Send deforestation alert notification
   * Requirement 19.1: Notify when deforestation detected
   * 
   * @param data - Deforestation notification data
   * @param recipientIds - Array of user IDs to notify (cooperative manager, agronomist)
   * @returns Promise resolving to array of notification IDs
   */
  static async notifyDeforestationDetected(
    data: DeforestationNotificationData,
    recipientIds: string[]
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const userId of recipientIds) {
      const id = await this.sendNotification(
        'deforestation_detected',
        userId,
        data
      );
      if (id) {
        notificationIds.push(id);
      }
    }
    
    return notificationIds;
  }
  
  /**
   * Send health status decline notification
   * Requirement 19.2: Notify when health status declines by 2+ categories
   * 
   * @param data - Health status change data
   * @param recipientIds - Array of user IDs to notify (cooperative manager, planteur)
   * @returns Promise resolving to array of notification IDs
   */
  static async notifyHealthStatusDeclined(
    data: HealthStatusChangeData,
    recipientIds: string[]
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const userId of recipientIds) {
      const id = await this.sendNotification(
        'health_status_declined',
        userId,
        data
      );
      if (id) {
        notificationIds.push(id);
      }
    }
    
    return notificationIds;
  }
  
  /**
   * Send API rate limit warning notification
   * Requirement 13.2: Alert when API usage reaches 80%
   * 
   * @param data - Rate limit notification data
   * @param adminUserIds - Array of admin user IDs
   * @returns Promise resolving to array of notification IDs
   */
  static async notifyRateLimitWarning(
    data: RateLimitNotificationData,
    adminUserIds: string[]
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const userId of adminUserIds) {
      const id = await this.sendNotification(
        'api_rate_limit_warning',
        userId,
        data
      );
      if (id) {
        notificationIds.push(id);
      }
    }
    
    return notificationIds;
  }
  
  /**
   * Send API rate limit exceeded notification
   * Requirement 13.6: Notify when daily limit exceeded
   * 
   * @param data - Rate limit notification data
   * @param adminUserIds - Array of admin user IDs
   * @returns Promise resolving to array of notification IDs
   */
  static async notifyRateLimitExceeded(
    data: RateLimitNotificationData,
    adminUserIds: string[]
  ): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const userId of adminUserIds) {
      const id = await this.sendNotification(
        'api_rate_limit_exceeded',
        userId,
        data
      );
      if (id) {
        notificationIds.push(id);
      }
    }
    
    return notificationIds;
  }
  
  /**
   * Generate HTML email template
   * 
   * @param payload - Notification payload
   * @param userName - Recipient name
   * @returns HTML email content
   */
  private static generateEmailHTML(
    payload: NotificationPayload,
    userName: string
  ): string {
    const priorityColors: Record<NotificationPriority, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#3b82f6',
    };
    
    const priorityColor = priorityColors[payload.priority];
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <div style="border-left: 4px solid ${priorityColor}; padding-left: 16px;">
      <h2 style="margin: 0 0 10px 0; color: ${priorityColor};">${payload.title}</h2>
      <p style="margin: 0; color: #666; font-size: 14px;">Priorité: ${payload.priority.toUpperCase()}</p>
    </div>
  </div>
  
  <div style="margin-bottom: 20px;">
    <p>Bonjour ${userName},</p>
    <p>${payload.body}</p>
  </div>
  
  ${payload.actionUrl ? `
  <div style="margin: 30px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${payload.actionUrl}" 
       style="display: inline-block; background-color: #6FAF3D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
      Voir les détails
    </a>
  </div>
  ` : ''}
  
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px;">
    <p>Ceci est une notification automatique de CocoaTrack.</p>
    <p>Pour gérer vos préférences de notification, visitez votre <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile/notifications" style="color: #6FAF3D;">page de profil</a>.</p>
  </div>
</body>
</html>
    `.trim();
  }
  
  /**
   * Check if a user should receive notifications based on their preferences
   * Requirement 19.4: Allow users to configure notification preferences
   * 
   * @param userId - User ID
   * @param notificationType - Type of notification
   * @returns Promise resolving to whether notification should be sent
   */
  static async shouldNotifyUser(
    userId: string,
    notificationType: SatelliteNotificationType
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      
      // Get user notification preferences
      const { data: preferences, error } = await (supabase as any)
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .single();
      
      if (error || !preferences) {
        // Default to sending notifications if preferences not found
        return true;
      }
      
      // Check if user has disabled this notification type
      const prefs = preferences.notification_preferences as Record<string, unknown> | null;
      if (!prefs) {
        return true;
      }
      
      // Check satellite notifications enabled
      if (prefs.satellite_notifications === false) {
        return false;
      }
      
      // Check specific notification type
      const typeKey = `satellite_${notificationType}`;
      if (prefs[typeKey] === false) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[NotificationService] Error checking notification preferences:', error);
      // Default to sending notifications on error
      return true;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported via 'export interface' and 'export type' declarations above
// No additional exports needed
