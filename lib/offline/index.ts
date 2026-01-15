// CocoaTrack V2 - Offline Module
// IndexedDB storage and sync engine
// Requirements: 8.3, 8.5, 8.6, REQ-OFF-001, REQ-OFF-002, REQ-OFF-003, REQ-OFF-004, REQ-OFF-007, REQ-OFF-010, REQ-OFF-011, REQ-OFF-012, REQ-OBS-001, REQ-OBS-002, REQ-OBS-003

// Export from indexed-db (primary source for DB types and functions)
export * from './indexed-db';

// Export from sync-engine (excluding MAX_BATCH_SIZE which is also in delta-sync)
export {
  type SyncResult,
  type SyncError,
  type OperationResult,
  type AllowedTable,
  MAX_RETRIES,
  BASE_RETRY_DELAY,
  MAX_RETRY_DELAY,
  MAX_BATCH_SIZE,
  MIN_BATTERY_FOR_RETRY,
  PRIORITY_ORDER,
  ALLOWED_TABLES,
  TABLE_PRIORITY_MAP,
  NON_RETRYABLE_ERROR_CODES,
  getBatteryLevel,
  calculateRetryDelay,
  isRetryableError,
  SyncEngine,
  getSyncEngine,
  createOfflineDelivery,
  updateOfflineDelivery,
  createOfflinePlanteur,
  createOfflineChefPlanteur,
} from './sync-engine';

export * from './conflict-resolver';
export * from './conflict-detector';
export * from './use-offline';

// Export from storage-manager (excluding CachedDelivery and assignDeliveryTier which are in indexed-db)
export {
  STORAGE_THRESHOLDS,
  FALLBACK_QUOTA_BYTES,
  type StorageState,
  type StorageMetrics,
  type DataTierConfig,
  DATA_TIERS,
  getStorageStateFromPercent,
  isStorageAPIAvailable,
  StorageManager,
  getStorageManager,
  PROTECTED_STORES,
  isProtectedStore,
  canEvictDelivery,
  validateEvictionSafety,
} from './storage-manager';

// Export from delta-sync (excluding MAX_BATCH_SIZE which conflicts with sync-engine)
export {
  type SyncCursor,
  type DeltaSyncResult,
  type DeltaSyncTable,
  type DataTier,
  type TierSyncConfig,
  DEFAULT_BATCH_SIZE,
  TIER_CONFIGS,
  INITIAL_CURSOR_DATE,
  DeltaSyncManager,
  getDeltaSyncManager,
  isCursorStale,
  formatCursor,
} from './delta-sync';

export * from './degraded-mode-manager';
export * from './use-degraded-mode';
export * from './offline-entity';
export * from './offline-validation';

// Export from diagnostics-service (excluding ErrorLog which is in indexed-db)
export {
  MAX_ERROR_LOGS,
  APP_VERSION,
  type ErrorLogType,
  type CacheSizes,
  type IDBSizes,
  type LastSyncInfo,
  type DiagnosticsData,
  DiagnosticsService,
  getDiagnosticsService,
  logSyncError,
  logStorageError,
  logNetworkError,
  logValidationError,
  logGeneralError,
  recordSyncCompletion,
  formatBytes,
  type ErrorUploadConfig,
  getErrorUploadConfig,
  setErrorUploadEnabled,
  uploadErrorsAnonymously,
} from './diagnostics-service';
