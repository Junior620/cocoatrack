// CocoaTrack V2 - Notification Types Hook
// Hook for triggering different notification types
// Requirements: REQ-NOTIF-002, REQ-NOTIF-003, REQ-NOTIF-004

'use client';

import { useCallback } from 'react';

import {
  notifyDeliveryCreated,
  notifyDeliveryUpdated,
  notifyDeliveryValidated,
  notifySyncCompleted,
  notifySyncError,
  notifyOfflineReminder,
  notifyPendingOps,
  shouldShowOfflineReminder,
  type DeliveryNotificationData,
  type SyncNotificationData,
} from '@/lib/notifications/notification-types';

export interface UseNotificationTypesReturn {
  /** Notify about a new delivery */
  notifyDeliveryCreated: (data: DeliveryNotificationData) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about an updated delivery */
  notifyDeliveryUpdated: (data: DeliveryNotificationData) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about a validated delivery */
  notifyDeliveryValidated: (data: DeliveryNotificationData) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about sync completion */
  notifySyncCompleted: (data: SyncNotificationData) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about sync error */
  notifySyncError: (errorCount: number, errorMessage?: string) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about offline reminder */
  notifyOfflineReminder: (pendingOpsCount: number, oldestOpAge: number) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Notify about pending operations */
  notifyPendingOps: (pendingOpsCount: number) => Promise<{ shown: boolean; inApp: boolean }>;
  /** Check if offline reminder should be shown */
  shouldShowOfflineReminder: () => Promise<boolean>;
}

export function useNotificationTypes(): UseNotificationTypesReturn {
  const handleDeliveryCreated = useCallback(
    (data: DeliveryNotificationData) => notifyDeliveryCreated(data),
    []
  );

  const handleDeliveryUpdated = useCallback(
    (data: DeliveryNotificationData) => notifyDeliveryUpdated(data),
    []
  );

  const handleDeliveryValidated = useCallback(
    (data: DeliveryNotificationData) => notifyDeliveryValidated(data),
    []
  );

  const handleSyncCompleted = useCallback(
    (data: SyncNotificationData) => notifySyncCompleted(data),
    []
  );

  const handleSyncError = useCallback(
    (errorCount: number, errorMessage?: string) => notifySyncError(errorCount, errorMessage),
    []
  );

  const handleOfflineReminder = useCallback(
    (pendingOpsCount: number, oldestOpAge: number) => notifyOfflineReminder(pendingOpsCount, oldestOpAge),
    []
  );

  const handlePendingOps = useCallback(
    (pendingOpsCount: number) => notifyPendingOps(pendingOpsCount),
    []
  );

  const checkShouldShowOfflineReminder = useCallback(
    () => shouldShowOfflineReminder(),
    []
  );

  return {
    notifyDeliveryCreated: handleDeliveryCreated,
    notifyDeliveryUpdated: handleDeliveryUpdated,
    notifyDeliveryValidated: handleDeliveryValidated,
    notifySyncCompleted: handleSyncCompleted,
    notifySyncError: handleSyncError,
    notifyOfflineReminder: handleOfflineReminder,
    notifyPendingOps: handlePendingOps,
    shouldShowOfflineReminder: checkShouldShowOfflineReminder,
  };
}

export default useNotificationTypes;
