// CocoaTrack V2 - Notification Types Service
// Implements different notification types: delivery alerts, sync completion, offline reminder
// Requirements: REQ-NOTIF-002, REQ-NOTIF-003, REQ-NOTIF-004

import { getAppState, setAppState } from '@/lib/offline/indexed-db';
import { 
  shouldShowNotification, 
  shouldShowPushNotification,
  type NotificationCategory,
} from './notification-preferences';
import { isPushSupported, getPermissionState } from './notification-permission';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification type identifiers
 */
export type NotificationType = 
  | 'delivery_created'
  | 'delivery_updated'
  | 'delivery_validated'
  | 'sync_completed'
  | 'sync_error'
  | 'offline_reminder'
  | 'pending_ops_reminder';

/**
 * Notification payload for creating notifications
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Delivery notification data
 */
export interface DeliveryNotificationData {
  deliveryId: string;
  planteurName: string;
  weight: number;
  createdBy: string;
  cooperativeId: string;
}

/**
 * Sync notification data
 */
export interface SyncNotificationData {
  syncedCount: number;
  failedCount: number;
  duration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LAST_OFFLINE_REMINDER_KEY = 'last_offline_reminder';
const OFFLINE_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Maps notification types to categories
 */
const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  delivery_created: 'livraisons',
  delivery_updated: 'livraisons',
  delivery_validated: 'livraisons',
  sync_completed: 'sync',
  sync_error: 'alertes',
  offline_reminder: 'rappels',
  pending_ops_reminder: 'rappels',
};

// ============================================================================
// NOTIFICATION CREATION
// ============================================================================

/**
 * Shows a browser notification if supported and permitted
 */
async function showBrowserNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }
  
  const permission = getPermissionState();
  if (permission !== 'granted') {
    return false;
  }
  
  const category = TYPE_TO_CATEGORY[payload.type];
  const shouldShow = await shouldShowPushNotification(category);
  
  if (!shouldShow) {
    return false;
  }
  
  try {
    // Use service worker for notifications if available
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        tag: payload.tag || payload.type,
        data: payload.data,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
      });
      return true;
    }
    
    // Fallback to Notification API
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      tag: payload.tag || payload.type,
      data: payload.data,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent,
    });
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to show notification:', error);
    return false;
  }
}

/**
 * Checks if a notification should be shown based on category
 */
async function shouldShowForCategory(type: NotificationType): Promise<boolean> {
  const category = TYPE_TO_CATEGORY[type];
  return shouldShowNotification(category);
}

// ============================================================================
// DELIVERY NOTIFICATIONS
// REQ-NOTIF-002: Delivery alerts (cross-user in cooperative)
// ============================================================================

/**
 * Creates a delivery created notification
 */
export async function notifyDeliveryCreated(
  data: DeliveryNotificationData
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('delivery_created');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'delivery_created',
    title: 'Nouvelle livraison',
    body: `${data.planteurName} - ${data.weight} kg par ${data.createdBy}`,
    tag: `delivery-${data.deliveryId}`,
    data: {
      deliveryId: data.deliveryId,
      url: `/deliveries/${data.deliveryId}`,
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true, // Always show in-app notification
  };
}

/**
 * Creates a delivery updated notification
 */
export async function notifyDeliveryUpdated(
  data: DeliveryNotificationData
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('delivery_updated');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'delivery_updated',
    title: 'Livraison modifiée',
    body: `${data.planteurName} - ${data.weight} kg modifié par ${data.createdBy}`,
    tag: `delivery-${data.deliveryId}`,
    data: {
      deliveryId: data.deliveryId,
      url: `/deliveries/${data.deliveryId}`,
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

/**
 * Creates a delivery validated notification
 */
export async function notifyDeliveryValidated(
  data: DeliveryNotificationData
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('delivery_validated');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'delivery_validated',
    title: 'Livraison validée',
    body: `${data.planteurName} - ${data.weight} kg validé`,
    tag: `delivery-${data.deliveryId}`,
    data: {
      deliveryId: data.deliveryId,
      url: `/deliveries/${data.deliveryId}`,
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

// ============================================================================
// SYNC NOTIFICATIONS
// REQ-NOTIF-003: Sync completion (if enabled)
// ============================================================================

/**
 * Creates a sync completed notification
 */
export async function notifySyncCompleted(
  data: SyncNotificationData
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('sync_completed');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'sync_completed',
    title: 'Synchronisation terminée',
    body: `${data.syncedCount} opération(s) synchronisée(s)${data.failedCount > 0 ? `, ${data.failedCount} erreur(s)` : ''}`,
    tag: 'sync-completed',
    silent: true, // Sync notifications should be silent
    data: {
      url: '/sync',
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

/**
 * Creates a sync error notification
 */
export async function notifySyncError(
  errorCount: number,
  errorMessage?: string
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('sync_error');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'sync_error',
    title: 'Erreur de synchronisation',
    body: errorMessage || `${errorCount} opération(s) en erreur`,
    tag: 'sync-error',
    requireInteraction: true, // Errors should require interaction
    data: {
      url: '/sync',
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

// ============================================================================
// OFFLINE REMINDER NOTIFICATIONS
// REQ-NOTIF-004: Offline reminder (24h pending ops, once/day)
// ============================================================================

/**
 * Gets the last offline reminder timestamp
 */
async function getLastOfflineReminder(): Promise<number | null> {
  try {
    const timestamp = await getAppState<number>(LAST_OFFLINE_REMINDER_KEY);
    return timestamp || null;
  } catch {
    return null;
  }
}

/**
 * Sets the last offline reminder timestamp
 */
async function setLastOfflineReminder(): Promise<void> {
  await setAppState(LAST_OFFLINE_REMINDER_KEY, Date.now());
}

/**
 * Checks if we should show an offline reminder
 * REQ-NOTIF-004: Once per day maximum
 */
export async function shouldShowOfflineReminder(): Promise<boolean> {
  const lastReminder = await getLastOfflineReminder();
  
  if (!lastReminder) {
    return true;
  }
  
  const timeSinceLastReminder = Date.now() - lastReminder;
  return timeSinceLastReminder >= OFFLINE_REMINDER_INTERVAL_MS;
}

/**
 * Creates an offline reminder notification
 * REQ-NOTIF-004: Offline reminder (24h pending ops, once/day)
 */
export async function notifyOfflineReminder(
  pendingOpsCount: number,
  oldestOpAge: number // in hours
): Promise<{ shown: boolean; inApp: boolean }> {
  // Check if we should show (once per day)
  const shouldRemind = await shouldShowOfflineReminder();
  if (!shouldRemind) {
    return { shown: false, inApp: false };
  }
  
  // Check category preference
  const shouldShow = await shouldShowForCategory('offline_reminder');
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  // Only show if ops are older than 24h
  if (oldestOpAge < 24) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'offline_reminder',
    title: 'Opérations en attente',
    body: `${pendingOpsCount} opération(s) en attente depuis plus de 24h. Connectez-vous pour synchroniser.`,
    tag: 'offline-reminder',
    requireInteraction: true,
    data: {
      url: '/sync',
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  // Mark that we showed the reminder
  if (browserShown) {
    await setLastOfflineReminder();
  }
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

/**
 * Creates a pending operations reminder notification
 */
export async function notifyPendingOps(
  pendingOpsCount: number
): Promise<{ shown: boolean; inApp: boolean }> {
  const shouldShow = await shouldShowForCategory('pending_ops_reminder');
  
  if (!shouldShow) {
    return { shown: false, inApp: false };
  }
  
  const payload: NotificationPayload = {
    type: 'pending_ops_reminder',
    title: 'Synchronisation requise',
    body: `${pendingOpsCount} opération(s) en attente de synchronisation`,
    tag: 'pending-ops',
    data: {
      url: '/sync',
    },
  };
  
  const browserShown = await showBrowserNotification(payload);
  
  return { 
    shown: browserShown, 
    inApp: true,
  };
}

// ============================================================================
// NOTIFICATION UTILITIES
// ============================================================================

/**
 * Clears all notifications with a specific tag
 */
export async function clearNotificationsByTag(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag });
    notifications.forEach(notification => notification.close());
  } catch (error) {
    console.error('[Notifications] Failed to clear notifications:', error);
  }
}

/**
 * Clears all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    notifications.forEach(notification => notification.close());
  } catch (error) {
    console.error('[Notifications] Failed to clear all notifications:', error);
  }
}

/**
 * Gets the count of active notifications
 */
export async function getActiveNotificationCount(): Promise<number> {
  if (!('serviceWorker' in navigator)) {
    return 0;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    return notifications.length;
  } catch {
    return 0;
  }
}
