// CocoaTrack V2 - iOS Manager
// Handles iOS-specific PWA limitations and behaviors
// Requirements: REQ-IOS-001, REQ-IOS-002, REQ-IOS-003

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Storage keys for iOS-specific state
 */
export const IOS_STORAGE_KEYS = {
  BANNER_DISMISSED: 'ios_degraded_banner_dismissed',
  LAST_ACTIVITY: 'ios_last_activity',
  DATA_INTEGRITY_CHECKED: 'ios_data_integrity_checked',
} as const;

/**
 * Days of inactivity before checking data integrity
 * REQ-IOS-002: Check after 7 days inactivity
 */
export const INACTIVITY_THRESHOLD_DAYS = 7;

// ============================================================================
// TYPES
// ============================================================================

/**
 * iOS platform detection result
 */
export interface IOSDetectionResult {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  version: number | null;
}

/**
 * iOS degraded mode state
 */
export interface IOSDegradedState {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  bannerDismissed: boolean;
  lastActivity: Date | null;
  daysSinceActivity: number | null;
  needsIntegrityCheck: boolean;
  hasBackgroundSync: boolean;
}

/**
 * Data integrity check result
 * REQ-IOS-002: Detect if iOS purged data
 */
export interface DataIntegrityResult {
  isIntact: boolean;
  tier1Missing: boolean;
  planteursCount: number;
  chefPlanteursCount: number;
  warehousesCount: number;
  opsQueueCount: number;
  expectedMinimum: number;
  message: string;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detects if the current platform is iOS
 * REQ-IOS-001: iOS detection for degraded mode
 */
export function detectIOS(): IOSDetectionResult {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isSafari: false,
      isStandalone: false,
      version: null,
    };
  }

  const ua = navigator.userAgent;
  
  // iOS detection (iPad, iPhone, iPod)
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  
  // Safari detection (not Chrome, Firefox, etc. on iOS)
  const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  
  // Standalone mode detection (installed PWA)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isStandalone = (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  
  // iOS version detection
  let version: number | null = null;
  const versionMatch = ua.match(/OS (\d+)_/);
  if (versionMatch) {
    version = parseInt(versionMatch[1], 10);
  }

  return {
    isIOS,
    isSafari,
    isStandalone,
    version,
  };
}

/**
 * Checks if Background Sync API is available
 * REQ-IOS-003: Background Sync unavailable on iOS
 */
export function hasBackgroundSync(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  
  // Check if SyncManager is available (not on iOS Safari)
  return 'SyncManager' in window;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Gets the iOS degraded mode state
 * REQ-IOS-001: iOS Degraded Mode Banner
 */
export function getIOSDegradedState(): IOSDegradedState {
  const detection = detectIOS();
  const bannerDismissed = isBannerDismissed();
  const lastActivity = getLastActivity();
  const daysSinceActivity = lastActivity 
    ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const needsIntegrityCheck = daysSinceActivity !== null && 
    daysSinceActivity >= INACTIVITY_THRESHOLD_DAYS;

  return {
    isIOS: detection.isIOS,
    isSafari: detection.isSafari,
    isStandalone: detection.isStandalone,
    bannerDismissed,
    lastActivity,
    daysSinceActivity,
    needsIntegrityCheck,
    hasBackgroundSync: hasBackgroundSync(),
  };
}

/**
 * Checks if the iOS degraded banner has been permanently dismissed
 * REQ-IOS-001: Banner can be closed permanently
 */
export function isBannerDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  
  try {
    return localStorage.getItem(IOS_STORAGE_KEYS.BANNER_DISMISSED) === 'true';
  } catch {
    return false;
  }
}

/**
 * Dismisses the iOS degraded banner permanently
 * REQ-IOS-001: Dismissable permanently
 */
export function dismissBannerPermanently(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(IOS_STORAGE_KEYS.BANNER_DISMISSED, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resets the banner dismissed state (for testing)
 */
export function resetBannerDismissed(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem(IOS_STORAGE_KEYS.BANNER_DISMISSED);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

/**
 * Gets the last activity timestamp
 * REQ-IOS-002: Track inactivity for data integrity check
 */
export function getLastActivity(): Date | null {
  if (typeof localStorage === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(IOS_STORAGE_KEYS.LAST_ACTIVITY);
    if (stored) {
      return new Date(stored);
    }
  } catch {
    // Ignore storage errors
  }
  
  return null;
}

/**
 * Records the current activity timestamp
 * REQ-IOS-002: Track activity for inactivity detection
 */
export function recordActivity(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(IOS_STORAGE_KEYS.LAST_ACTIVITY, new Date().toISOString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks if data integrity check is needed
 * REQ-IOS-002: Check after 7 days inactivity
 */
export function needsDataIntegrityCheck(): boolean {
  const lastActivity = getLastActivity();
  
  if (!lastActivity) {
    // First time - record activity and don't check
    recordActivity();
    return false;
  }
  
  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceActivity >= INACTIVITY_THRESHOLD_DAYS;
}

/**
 * Marks data integrity as checked
 */
export function markIntegrityChecked(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(
      IOS_STORAGE_KEYS.DATA_INTEGRITY_CHECKED, 
      new Date().toISOString()
    );
    // Also record activity
    recordActivity();
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// SHOULD SHOW HELPERS
// ============================================================================

/**
 * Determines if the iOS degraded mode banner should be shown
 * REQ-IOS-001: Show banner on iOS Safari
 * 
 * Returns true when:
 * - Platform is iOS
 * - Banner has not been permanently dismissed
 * - Background Sync is not available
 */
export function shouldShowIOSDegradedBanner(): boolean {
  const state = getIOSDegradedState();
  
  // Only show on iOS
  if (!state.isIOS) {
    return false;
  }
  
  // Don't show if permanently dismissed
  if (state.bannerDismissed) {
    return false;
  }
  
  // Show if Background Sync is not available (typical for iOS)
  return !state.hasBackgroundSync;
}

/**
 * Determines if manual sync button should be prominently shown
 * REQ-IOS-003: Visible sync button when Background Sync unavailable
 */
export function shouldShowManualSyncButton(): boolean {
  const detection = detectIOS();
  
  // Show on iOS or when Background Sync is unavailable
  return detection.isIOS || !hasBackgroundSync();
}

// ============================================================================
// IOS MANAGER CLASS
// ============================================================================

/**
 * IOSManager handles iOS-specific PWA behaviors
 * REQ-IOS-001, REQ-IOS-002, REQ-IOS-003
 */
export class IOSManager {
  private isInitialized = false;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Initializes the iOS manager
   * Sets up visibility change listener for manual sync
   * REQ-IOS-003: Trigger sync on visibilitychange
   */
  initialize(onForeground?: () => void): void {
    if (this.isInitialized || typeof document === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // Record initial activity
    recordActivity();

    // Set up visibility change handler for iOS manual sync
    if (onForeground) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          const detection = detectIOS();
          if (detection.isIOS && !hasBackgroundSync()) {
            console.log('[IOSManager] App returned to foreground, triggering sync');
            onForeground();
          }
        }
      };

      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    console.log('[IOSManager] Initialized');
  }

  /**
   * Cleans up event listeners
   */
  destroy(): void {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.isInitialized = false;
  }

  /**
   * Gets the current iOS state
   */
  getState(): IOSDegradedState {
    return getIOSDegradedState();
  }

  /**
   * Dismisses the degraded mode banner permanently
   */
  dismissBanner(): void {
    dismissBannerPermanently();
  }

  /**
   * Checks if the degraded banner should be shown
   */
  shouldShowBanner(): boolean {
    return shouldShowIOSDegradedBanner();
  }

  /**
   * Records user activity
   */
  recordActivity(): void {
    recordActivity();
  }

  /**
   * Checks if data integrity check is needed
   */
  needsIntegrityCheck(): boolean {
    return needsDataIntegrityCheck();
  }

  /**
   * Marks integrity as checked
   */
  markIntegrityChecked(): void {
    markIntegrityChecked();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let iosManagerInstance: IOSManager | null = null;

/**
 * Gets the singleton IOSManager instance
 */
export function getIOSManager(): IOSManager {
  if (!iosManagerInstance) {
    iosManagerInstance = new IOSManager();
  }
  return iosManagerInstance;
}

/**
 * Creates and initializes a new IOSManager
 */
export function createIOSManager(onForeground?: () => void): IOSManager {
  iosManagerInstance = new IOSManager();
  iosManagerInstance.initialize(onForeground);
  return iosManagerInstance;
}
