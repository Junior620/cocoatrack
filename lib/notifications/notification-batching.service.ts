// CocoaTrack V2 - Notification Batching Service
// Implements batching logic for non-critical notifications
// Task: 4.4.5 - Implement notification batching
// Requirement 19.6: Batch notifications to avoid spam (max 1 digest per day)

import { createClient } from '@/lib/supabase/client';
import { NotificationPayload, NotificationPriority } from './notification.service';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Batched notification data
 */
export interface BatchedNotification {
  id: string;
  batchId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  createdAt: Date;
}

/**
 * Notification batch
 */
export interface NotificationBatch {
  id: string;
  userId: string;
  batchDate: Date;
  notificationCount: number;
  sentAt: Date | null;
  createdAt: Date;
  notifications?: BatchedNotification[];
}

/**
 * Batch digest email data
 */
export interface BatchDigestData {
  userName: string;
  userEmail: string;
  batchDate: Date;
  notifications: BatchedNotification[];
  totalCount: number;
}

// ============================================================================
// NOTIFICATION BATCHING SERVICE
// ============================================================================

/**
 * Notification Batching Service
 * 
 * Handles batching of non-critical notifications for daily digest delivery
 * Requirement 19.6: Batch notifications to avoid spam
 */
export class NotificationBatchingService {
  /**
   * Determine if a notification should be batched or sent immediately
   * 
   * Critical and high priority notifications are sent immediately
   * Medium and low priority notifications are batched
   * 
   * @param priority - Notification priority
   * @returns True if notification should be batched
   */
  static shouldBatchNotification(priority: NotificationPriority): boolean {
    return priority === 'medium' || priority === 'low';
  }
  
  /**
   * Add a notification to the batch queue
   * 
   * @param payload - Notification payload
   * @returns Promise resolving to batched notification ID
   */
  static async addToBatch(
    payload: NotificationPayload
  ): Promise<string | null> {
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get or create batch for today
      const batch = await this.getOrCreateBatch(payload.userId, today);
      
      if (!batch) {
        console.error('[NotificationBatchingService] Failed to get or create batch');
        return null;
      }
      
      // Add notification to batch
      const { data, error } = await (supabase as any)
        .from('batched_notifications')
        .insert({
          batch_id: batch.id,
          user_id: payload.userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          priority: payload.priority,
          metadata: payload.metadata,
          action_url: payload.actionUrl,
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('[NotificationBatchingService] Failed to add notification to batch:', error);
        return null;
      }
      
      // Update batch notification count
      await this.updateBatchCount(batch.id);
      
      return data?.id || null;
    } catch (error) {
      console.error('[NotificationBatchingService] Error adding notification to batch:', error);
      return null;
    }
  }
  
  /**
   * Get or create a batch for a user and date
   * 
   * @param userId - User ID
   * @param batchDate - Batch date (YYYY-MM-DD)
   * @returns Promise resolving to notification batch
   */
  private static async getOrCreateBatch(
    userId: string,
    batchDate: string
  ): Promise<NotificationBatch | null> {
    try {
      const supabase = createClient();
      
      // Try to get existing batch
      const { data: existingBatch, error: selectError } = await (supabase as any)
        .from('notification_batches')
        .select('*')
        .eq('user_id', userId)
        .eq('batch_date', batchDate)
        .is('sent_at', null)
        .single();
      
      if (existingBatch) {
        return {
          id: existingBatch.id,
          userId: existingBatch.user_id,
          batchDate: new Date(existingBatch.batch_date),
          notificationCount: existingBatch.notification_count,
          sentAt: existingBatch.sent_at ? new Date(existingBatch.sent_at) : null,
          createdAt: new Date(existingBatch.created_at),
        };
      }
      
      // Create new batch if not found
      const { data: newBatch, error: insertError } = await (supabase as any)
        .from('notification_batches')
        .insert({
          user_id: userId,
          batch_date: batchDate,
          notification_count: 0,
        })
        .select('*')
        .single();
      
      if (insertError || !newBatch) {
        console.error('[NotificationBatchingService] Failed to create batch:', insertError);
        return null;
      }
      
      return {
        id: newBatch.id,
        userId: newBatch.user_id,
        batchDate: new Date(newBatch.batch_date),
        notificationCount: newBatch.notification_count,
        sentAt: newBatch.sent_at ? new Date(newBatch.sent_at) : null,
        createdAt: new Date(newBatch.created_at),
      };
    } catch (error) {
      console.error('[NotificationBatchingService] Error getting or creating batch:', error);
      return null;
    }
  }
  
  /**
   * Update the notification count for a batch
   * 
   * @param batchId - Batch ID
   * @returns Promise resolving to success status
   */
  private static async updateBatchCount(batchId: string): Promise<boolean> {
    try {
      const supabase = createClient();
      
      // Count notifications in batch
      const { count, error: countError } = await (supabase as any)
        .from('batched_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batchId);
      
      if (countError) {
        console.error('[NotificationBatchingService] Failed to count notifications:', countError);
        return false;
      }
      
      // Update batch count
      const { error: updateError } = await (supabase as any)
        .from('notification_batches')
        .update({ notification_count: count || 0 })
        .eq('id', batchId);
      
      if (updateError) {
        console.error('[NotificationBatchingService] Failed to update batch count:', updateError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[NotificationBatchingService] Error updating batch count:', error);
      return false;
    }
  }
  
  /**
   * Get all unsent batches for a specific date
   * 
   * @param batchDate - Batch date (YYYY-MM-DD)
   * @returns Promise resolving to array of batches
   */
  static async getUnsentBatches(batchDate: string): Promise<NotificationBatch[]> {
    try {
      const supabase = createClient();
      
      const { data, error } = await (supabase as any)
        .from('notification_batches')
        .select('*')
        .eq('batch_date', batchDate)
        .is('sent_at', null)
        .gt('notification_count', 0); // Only batches with notifications
      
      if (error) {
        console.error('[NotificationBatchingService] Failed to get unsent batches:', error);
        return [];
      }
      
      return (data || []).map((batch: any) => ({
        id: batch.id,
        userId: batch.user_id,
        batchDate: new Date(batch.batch_date),
        notificationCount: batch.notification_count,
        sentAt: batch.sent_at ? new Date(batch.sent_at) : null,
        createdAt: new Date(batch.created_at),
      }));
    } catch (error) {
      console.error('[NotificationBatchingService] Error getting unsent batches:', error);
      return [];
    }
  }
  
  /**
   * Get notifications for a batch
   * 
   * @param batchId - Batch ID
   * @returns Promise resolving to array of batched notifications
   */
  static async getBatchNotifications(batchId: string): Promise<BatchedNotification[]> {
    try {
      const supabase = createClient();
      
      const { data, error } = await (supabase as any)
        .from('batched_notifications')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[NotificationBatchingService] Failed to get batch notifications:', error);
        return [];
      }
      
      return (data || []).map((notification: any) => ({
        id: notification.id,
        batchId: notification.batch_id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        priority: notification.priority as NotificationPriority,
        metadata: notification.metadata as Record<string, unknown> | undefined,
        actionUrl: notification.action_url || undefined,
        createdAt: new Date(notification.created_at),
      }));
    } catch (error) {
      console.error('[NotificationBatchingService] Error getting batch notifications:', error);
      return [];
    }
  }
  
  /**
   * Mark a batch as sent
   * 
   * @param batchId - Batch ID
   * @returns Promise resolving to success status
   */
  static async markBatchAsSent(batchId: string): Promise<boolean> {
    try {
      const supabase = createClient();
      
      const { error } = await (supabase as any)
        .from('notification_batches')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', batchId);
      
      if (error) {
        console.error('[NotificationBatchingService] Failed to mark batch as sent:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[NotificationBatchingService] Error marking batch as sent:', error);
      return false;
    }
  }
  
  /**
   * Send a batch digest email
   * 
   * @param batch - Notification batch
   * @param notifications - Array of batched notifications
   * @returns Promise resolving to success status
   */
  static async sendBatchDigest(
    batch: NotificationBatch,
    notifications: BatchedNotification[]
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      
      // Get user profile
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('email, full_name')
        .eq('id', batch.userId)
        .single();
      
      if (profileError || !profile?.email) {
        console.error('[NotificationBatchingService] Failed to get user profile:', profileError);
        return false;
      }
      
      const digestData: BatchDigestData = {
        userName: profile.full_name || 'Utilisateur',
        userEmail: profile.email,
        batchDate: batch.batchDate,
        notifications,
        totalCount: notifications.length,
      };
      
      // Generate digest email HTML
      const emailHTML = this.generateDigestEmailHTML(digestData);
      
      // TODO: Send email via email service provider
      // For now, we'll log the email that would be sent
      console.log('[NotificationBatchingService] Batch digest email (not sent - email service not configured):', {
        to: profile.email,
        subject: `CocoaTrack - Résumé quotidien (${notifications.length} notification${notifications.length > 1 ? 's' : ''})`,
        html: emailHTML,
      });
      
      // In production, replace the above with actual email sending:
      /*
      const emailService = new EmailService();
      await emailService.send({
        to: profile.email,
        subject: `CocoaTrack - Résumé quotidien (${notifications.length} notification${notifications.length > 1 ? 's' : ''})`,
        html: emailHTML,
      });
      */
      
      return true;
    } catch (error) {
      console.error('[NotificationBatchingService] Error sending batch digest:', error);
      return false;
    }
  }
  
  /**
   * Generate HTML for batch digest email
   * 
   * @param data - Batch digest data
   * @returns HTML email content
   */
  private static generateDigestEmailHTML(data: BatchDigestData): string {
    const priorityColors: Record<NotificationPriority, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#3b82f6',
    };
    
    const priorityLabels: Record<NotificationPriority, string> = {
      critical: 'Critique',
      high: 'Haute',
      medium: 'Moyenne',
      low: 'Basse',
    };
    
    const notificationsHTML = data.notifications
      .map(notification => {
        const priorityColor = priorityColors[notification.priority];
        const priorityLabel = priorityLabels[notification.priority];
        
        return `
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid ${priorityColor};">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; color: #1f2937;">${notification.title}</h3>
            <span style="background-color: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; margin-left: 8px;">
              ${priorityLabel}
            </span>
          </div>
          <p style="margin: 8px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.5;">${notification.body}</p>
          ${notification.actionUrl ? `
          <div style="margin-top: 12px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${notification.actionUrl}" 
               style="color: #6FAF3D; text-decoration: none; font-size: 14px; font-weight: 500;">
              Voir les détails →
            </a>
          </div>
          ` : ''}
        </div>
        `;
      })
      .join('');
    
    const formattedDate = data.batchDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CocoaTrack - Résumé quotidien</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="background-color: #6FAF3D; color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">📊 Résumé quotidien CocoaTrack</h1>
    <p style="margin: 0; font-size: 14px; opacity: 0.9;">${formattedDate}</p>
  </div>
  
  <div style="margin-bottom: 24px;">
    <p style="font-size: 16px; color: #1f2937;">Bonjour ${data.userName},</p>
    <p style="font-size: 14px; color: #4b5563;">
      Vous avez reçu <strong>${data.totalCount} notification${data.totalCount > 1 ? 's' : ''}</strong> aujourd'hui concernant vos parcelles et activités satellite.
    </p>
  </div>
  
  <div style="margin-bottom: 32px;">
    ${notificationsHTML}
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/notifications" 
       style="display: inline-block; background-color: #6FAF3D; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
      Voir toutes les notifications
    </a>
  </div>
  
  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
    <p style="margin: 0 0 8px 0;">Ceci est un résumé quotidien automatique de CocoaTrack.</p>
    <p style="margin: 0;">
      Pour gérer vos préférences de notification, visitez votre 
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile/notifications" style="color: #6FAF3D; text-decoration: none;">
        page de profil
      </a>.
    </p>
  </div>
</body>
</html>
    `.trim();
  }
  
  /**
   * Process all unsent batches for a specific date
   * This should be called by a scheduled job (e.g., cron job, Vercel Cron)
   * 
   * @param batchDate - Batch date (YYYY-MM-DD), defaults to yesterday
   * @returns Promise resolving to number of batches processed
   */
  static async processUnsentBatches(batchDate?: string): Promise<number> {
    try {
      // Default to yesterday's date (batches are sent the next day)
      const targetDate = batchDate || new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      console.log(`[NotificationBatchingService] Processing unsent batches for ${targetDate}`);
      
      // Get all unsent batches for the date
      const batches = await this.getUnsentBatches(targetDate);
      
      if (batches.length === 0) {
        console.log('[NotificationBatchingService] No unsent batches found');
        return 0;
      }
      
      console.log(`[NotificationBatchingService] Found ${batches.length} unsent batches`);
      
      let processedCount = 0;
      
      // Process each batch
      for (const batch of batches) {
        try {
          // Get notifications for this batch
          const notifications = await this.getBatchNotifications(batch.id);
          
          if (notifications.length === 0) {
            console.log(`[NotificationBatchingService] Batch ${batch.id} has no notifications, skipping`);
            continue;
          }
          
          // Send batch digest
          const sent = await this.sendBatchDigest(batch, notifications);
          
          if (sent) {
            // Mark batch as sent
            await this.markBatchAsSent(batch.id);
            processedCount++;
            console.log(`[NotificationBatchingService] Successfully processed batch ${batch.id} with ${notifications.length} notifications`);
          } else {
            console.error(`[NotificationBatchingService] Failed to send batch ${batch.id}`);
          }
        } catch (error) {
          console.error(`[NotificationBatchingService] Error processing batch ${batch.id}:`, error);
        }
      }
      
      console.log(`[NotificationBatchingService] Processed ${processedCount}/${batches.length} batches`);
      
      return processedCount;
    } catch (error) {
      console.error('[NotificationBatchingService] Error processing unsent batches:', error);
      return 0;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported via 'export interface' declarations above
// No additional exports needed
