// CocoaTrack V2 - Notification Permission Service
// Handles permission request flow with fallback to in-app badge
// Requirements: REQ-NOTIF-005

import {
  getNotificationPreferences,
  saveNotificationPreferences,
  markPermissionRequested,
  markPermissionDenied,
} from './notification-preferences';

// ============================================================================
// TYPES
// ============================================================================

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface PermissionResult {
  state: PermissionState;
  canUsePush: boolean;
  shouldUseBadge: boolean;
  wasAutoRequested: boolean;
}

// ============================================================================
// PERMISSION UTILITIES
// ============================================================================

/**
 * Checks if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets the current notification permission state
 */
export function getPermissionState(): PermissionState {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission as PermissionState;
}

/**
 * Checks if we should show the in-app badge fallback
 * This is true when push is denied or unsupported
 */
export async function shouldUseBadgeFallback(): Promise<boolean> {
  const state = getPermissionState();
  if (state === 'denied' || state === 'unsupported') {
    return true;
  }
  
  const prefs = await getNotificationPreferences();
  // If permission was denied before, use badge
  if (prefs.permissionDenied) {
    return true;
  }
  
  return false;
}

/**
 * Checks if we can request permission
 * REQ-NOTIF-005: Never auto-request again after denial
 */
export async function canRequestPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }
  
  const state = getPermissionState();
  if (state === 'denied') {
    return false;
  }
  
  const prefs = await getNotificationPreferences();
  // Never auto-request if previously denied
  if (prefs.permissionDenied) {
    return false;
  }
  
  return state === 'prompt';
}

/**
 * Requests notification permission
 * REQ-NOTIF-005: Only request after user action
 * 
 * @param userInitiated - Must be true to indicate user clicked a button
 * @returns The permission result
 */
export async function requestNotificationPermission(
  userInitiated: boolean = false
): Promise<PermissionResult> {
  // Safety check: never auto-request
  if (!userInitiated) {
    console.warn('[NotificationPermission] Permission request must be user-initiated');
    return {
      state: getPermissionState(),
      canUsePush: false,
      shouldUseBadge: true,
      wasAutoRequested: true,
    };
  }
  
  if (!isPushSupported()) {
    return {
      state: 'unsupported',
      canUsePush: false,
      shouldUseBadge: true,
      wasAutoRequested: false,
    };
  }
  
  // Check if we can request
  const canRequest = await canRequestPermission();
  if (!canRequest) {
    const state = getPermissionState();
    return {
      state,
      canUsePush: state === 'granted',
      shouldUseBadge: state !== 'granted',
      wasAutoRequested: false,
    };
  }
  
  // Mark that we requested permission
  await markPermissionRequested();
  
  try {
    const result = await Notification.requestPermission();
    
    if (result === 'denied') {
      // Mark as denied so we never auto-request again
      await markPermissionDenied();
      return {
        state: 'denied',
        canUsePush: false,
        shouldUseBadge: true,
        wasAutoRequested: false,
      };
    }
    
    if (result === 'granted') {
      // Enable push notifications in preferences
      await saveNotificationPreferences({ pushEnabled: true });
      return {
        state: 'granted',
        canUsePush: true,
        shouldUseBadge: false,
        wasAutoRequested: false,
      };
    }
    
    // Still in 'default' state (user dismissed)
    return {
      state: 'prompt',
      canUsePush: false,
      shouldUseBadge: true,
      wasAutoRequested: false,
    };
  } catch (error) {
    console.error('[NotificationPermission] Failed to request permission:', error);
    return {
      state: getPermissionState(),
      canUsePush: false,
      shouldUseBadge: true,
      wasAutoRequested: false,
    };
  }
}

/**
 * Gets the full permission status including preferences
 */
export async function getPermissionStatus(): Promise<PermissionResult> {
  const state = getPermissionState();
  const prefs = await getNotificationPreferences();
  
  return {
    state,
    canUsePush: state === 'granted' && prefs.pushEnabled,
    shouldUseBadge: state !== 'granted' || prefs.permissionDenied,
    wasAutoRequested: false,
  };
}

/**
 * Disables push notifications (user opt-out)
 */
export async function disablePushNotifications(): Promise<void> {
  await saveNotificationPreferences({ pushEnabled: false });
}

/**
 * Enables push notifications (if permission granted)
 */
export async function enablePushNotifications(): Promise<boolean> {
  const state = getPermissionState();
  if (state !== 'granted') {
    return false;
  }
  
  await saveNotificationPreferences({ pushEnabled: true });
  return true;
}
