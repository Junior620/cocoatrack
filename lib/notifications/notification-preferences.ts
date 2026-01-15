// CocoaTrack V2 - Notification Preferences Service
// Manages user notification preferences with categories and quiet hours
// Requirements: REQ-NOTIF-001

import { getAppState, setAppState } from '@/lib/offline/indexed-db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notification categories that can be toggled
 */
export type NotificationCategory = 'livraisons' | 'alertes' | 'rappels' | 'sync';

/**
 * Quiet hours configuration
 */
export interface QuietHours {
  enabled: boolean;
  start: string; // HH:mm format (e.g., "22:00")
  end: string;   // HH:mm format (e.g., "07:00")
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  /** Whether push notifications are enabled globally */
  pushEnabled: boolean;
  
  /** Whether in-app notifications are enabled */
  inAppEnabled: boolean;
  
  /** Category-specific toggles */
  categories: Record<NotificationCategory, boolean>;
  
  /** Quiet hours configuration */
  quietHours: QuietHours;
  
  /** Whether permission was ever requested */
  permissionRequested: boolean;
  
  /** Whether permission was denied (never auto-request again) */
  permissionDenied: boolean;
  
  /** Last updated timestamp */
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PREFERENCES_KEY = 'notification_preferences';

/**
 * Default notification preferences
 */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  inAppEnabled: true,
  categories: {
    livraisons: true,
    alertes: true,
    rappels: true,
    sync: false,
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00',
  },
  permissionRequested: false,
  permissionDenied: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Category labels in French
 */
export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  livraisons: {
    label: 'Livraisons',
    description: 'Nouvelles livraisons et modifications',
  },
  alertes: {
    label: 'Alertes',
    description: 'Alertes importantes et urgentes',
  },
  rappels: {
    label: 'Rappels',
    description: 'Rappels de synchronisation et actions en attente',
  },
  sync: {
    label: 'Synchronisation',
    description: 'Notifications de fin de synchronisation',
  },
};

// ============================================================================
// PREFERENCES MANAGEMENT
// ============================================================================

/**
 * Gets the current notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await getAppState<NotificationPreferences>(PREFERENCES_KEY);
    if (stored) {
      // Merge with defaults to handle new fields
      return {
        ...DEFAULT_PREFERENCES,
        ...stored,
        categories: {
          ...DEFAULT_PREFERENCES.categories,
          ...stored.categories,
        },
        quietHours: {
          ...DEFAULT_PREFERENCES.quietHours,
          ...stored.quietHours,
        },
      };
    }
  } catch (error) {
    console.warn('[NotificationPreferences] Failed to load preferences:', error);
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Saves notification preferences
 */
export async function saveNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  const updated: NotificationPreferences = {
    ...current,
    ...preferences,
    categories: {
      ...current.categories,
      ...(preferences.categories || {}),
    },
    quietHours: {
      ...current.quietHours,
      ...(preferences.quietHours || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  
  await setAppState(PREFERENCES_KEY, updated);
  return updated;
}

/**
 * Toggles a notification category
 */
export async function toggleCategory(
  category: NotificationCategory,
  enabled: boolean
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  return saveNotificationPreferences({
    categories: {
      ...current.categories,
      [category]: enabled,
    },
  });
}

/**
 * Updates quiet hours settings
 */
export async function updateQuietHours(
  quietHours: Partial<QuietHours>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  return saveNotificationPreferences({
    quietHours: {
      ...current.quietHours,
      ...quietHours,
    },
  });
}

/**
 * Marks that permission was requested
 */
export async function markPermissionRequested(): Promise<void> {
  await saveNotificationPreferences({ permissionRequested: true });
}

/**
 * Marks that permission was denied
 */
export async function markPermissionDenied(): Promise<void> {
  await saveNotificationPreferences({ 
    permissionRequested: true,
    permissionDenied: true,
  });
}

// ============================================================================
// QUIET HOURS UTILITIES
// ============================================================================

/**
 * Parses a time string (HH:mm) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if the current time is within quiet hours
 */
export function isWithinQuietHours(quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(quietHours.start);
  const endMinutes = parseTimeToMinutes(quietHours.end);
  
  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    // Quiet hours span midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Quiet hours within same day
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Checks if a notification should be shown based on preferences
 */
export async function shouldShowNotification(
  category: NotificationCategory
): Promise<boolean> {
  const prefs = await getNotificationPreferences();
  
  // Check if category is enabled
  if (!prefs.categories[category]) {
    return false;
  }
  
  // Check quiet hours
  if (isWithinQuietHours(prefs.quietHours)) {
    return false;
  }
  
  return true;
}

/**
 * Checks if push notifications should be shown
 */
export async function shouldShowPushNotification(
  category: NotificationCategory
): Promise<boolean> {
  const prefs = await getNotificationPreferences();
  
  // Check if push is enabled globally
  if (!prefs.pushEnabled) {
    return false;
  }
  
  return shouldShowNotification(category);
}
