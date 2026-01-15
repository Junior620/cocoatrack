// CocoaTrack V2 - PWA Utilities
// Service Worker registration and management
// Requirements: REQ-SW-001, REQ-SW-002, REQ-CACHE-001, REQ-CACHE-002
// Requirements: REQ-PWA-001, REQ-PWA-005, REQ-PWA-006

'use client';

export * from './service-worker';
export { useServiceWorker } from './use-service-worker';
export type { ServiceWorkerState, UseServiceWorkerReturn } from './use-service-worker';

// SW Update Manager
export {
  SWUpdateManager,
  getSWUpdateManager,
  createSWUpdateManager,
} from './sw-update-manager';
export type {
  SWUpdateState,
  SafetyCheckResult,
  SWUpdateManagerConfig,
} from './sw-update-manager';

// Install Manager
export {
  InstallManager,
  getInstallManager,
  createInstallManager,
  shouldShowPromptPure,
  detectPlatformFromUserAgent,
} from './install-manager';
export type {
  Platform,
  InstallState,
  InstallManagerConfig,
} from './install-manager';

// iOS Manager
export {
  IOSManager,
  getIOSManager,
  createIOSManager,
  detectIOS,
  hasBackgroundSync,
  getIOSDegradedState,
  shouldShowIOSDegradedBanner,
  shouldShowManualSyncButton,
  dismissBannerPermanently,
  needsDataIntegrityCheck,
  recordActivity,
  markIntegrityChecked,
  IOS_STORAGE_KEYS,
  INACTIVITY_THRESHOLD_DAYS,
} from './ios-manager';
export type {
  IOSDetectionResult,
  IOSDegradedState,
  DataIntegrityResult,
} from './ios-manager';

// iOS Data Integrity
export {
  checkDataIntegrity,
  checkIntegrityIfNeeded,
  shouldCheckIntegrity,
  getLastIntegrityCheckResult,
  clearIntegrityCheckResult,
  INTEGRITY_CHECK_KEY,
  MINIMUM_EXPECTED_RECORDS,
} from './ios-data-integrity';
export type {
  DetailedIntegrityResult,
  IntegrityCheckCallback,
  UseIOSDataIntegrityState,
  UseIOSDataIntegrityReturn,
} from './ios-data-integrity';

// iOS Data Integrity Hook
export { useIOSDataIntegrity } from './use-ios-data-integrity';

// iOS Manual Sync Hook
export { useIOSManualSync, DEFAULT_MIN_SYNC_INTERVAL, LAST_SYNC_KEY } from './use-ios-manual-sync';
export type {
  UseIOSManualSyncState,
  UseIOSManualSyncReturn,
  UseIOSManualSyncOptions,
} from './use-ios-manual-sync';
