// CocoaTrack V2 - Notification Permission Hook
// Hook for managing notification permission with fallback to in-app badge
// Requirements: REQ-NOTIF-005

'use client';

import { useState, useEffect, useCallback } from 'react';

import {
  getPermissionState,
  getPermissionStatus,
  requestNotificationPermission,
  canRequestPermission,
  isPushSupported,
  disablePushNotifications,
  enablePushNotifications,
  type PermissionState,
  type PermissionResult,
} from '@/lib/notifications/notification-permission';

export interface UseNotificationPermissionReturn {
  /** Current permission state */
  permissionState: PermissionState;
  /** Whether push notifications can be used */
  canUsePush: boolean;
  /** Whether to show in-app badge fallback */
  shouldUseBadge: boolean;
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Whether permission can be requested */
  canRequest: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Request permission (must be user-initiated) */
  requestPermission: () => Promise<PermissionResult>;
  /** Disable push notifications */
  disable: () => Promise<void>;
  /** Enable push notifications (if permission granted) */
  enable: () => Promise<boolean>;
  /** Refresh the permission status */
  refresh: () => Promise<void>;
}

export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [canUsePush, setCanUsePush] = useState(false);
  const [shouldUseBadge, setShouldUseBadge] = useState(true);
  const [canRequest, setCanRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isSupported = isPushSupported();

  // Load initial status
  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const status = await getPermissionStatus();
      setPermissionState(status.state);
      setCanUsePush(status.canUsePush);
      setShouldUseBadge(status.shouldUseBadge);
      
      const canReq = await canRequestPermission();
      setCanRequest(canReq);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load permission status'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    const handlePermissionChange = () => {
      setPermissionState(getPermissionState());
      loadStatus();
    };

    // Some browsers support this event
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((permissionStatus) => {
          permissionStatus.onchange = handlePermissionChange;
        })
        .catch(() => {
          // Ignore errors - not all browsers support this
        });
    }
  }, [isSupported, loadStatus]);

  // Request permission (user-initiated)
  const requestPermission = useCallback(async (): Promise<PermissionResult> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Pass true to indicate user-initiated request
      const result = await requestNotificationPermission(true);
      
      setPermissionState(result.state);
      setCanUsePush(result.canUsePush);
      setShouldUseBadge(result.shouldUseBadge);
      
      // Update canRequest
      const canReq = await canRequestPermission();
      setCanRequest(canReq);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to request permission');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disable push notifications
  const disable = useCallback(async () => {
    setIsLoading(true);
    try {
      await disablePushNotifications();
      setCanUsePush(false);
      setShouldUseBadge(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to disable notifications'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Enable push notifications
  const enable = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await enablePushNotifications();
      if (success) {
        setCanUsePush(true);
        setShouldUseBadge(false);
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to enable notifications'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    permissionState,
    canUsePush,
    shouldUseBadge,
    isSupported,
    canRequest,
    isLoading,
    error,
    requestPermission,
    disable,
    enable,
    refresh: loadStatus,
  };
}

export default useNotificationPermission;
