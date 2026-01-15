// CocoaTrack V2 - Notifications Library
// Export all notification-related utilities

export {
  getNotificationPreferences,
  saveNotificationPreferences,
  toggleCategory,
  updateQuietHours,
  markPermissionRequested,
  markPermissionDenied,
  isWithinQuietHours,
  shouldShowNotification,
  shouldShowPushNotification,
  DEFAULT_PREFERENCES,
  CATEGORY_LABELS,
  type NotificationPreferences,
  type NotificationCategory,
  type QuietHours,
} from './notification-preferences';

export {
  isPushSupported,
  getPermissionState,
  getPermissionStatus,
  requestNotificationPermission,
  canRequestPermission,
  shouldUseBadgeFallback,
  disablePushNotifications,
  enablePushNotifications,
  type PermissionState,
  type PermissionResult,
} from './notification-permission';

export {
  notifyDeliveryCreated,
  notifyDeliveryUpdated,
  notifyDeliveryValidated,
  notifySyncCompleted,
  notifySyncError,
  notifyOfflineReminder,
  notifyPendingOps,
  shouldShowOfflineReminder,
  clearNotificationsByTag,
  clearAllNotifications,
  getActiveNotificationCount,
  type NotificationType,
  type NotificationPayload,
  type DeliveryNotificationData,
  type SyncNotificationData,
} from './notification-types';
