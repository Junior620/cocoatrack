// CocoaTrack V2 - Diagnostics Service
// Collects app metrics, cache sizes, IndexedDB sizes, and error logs
// Requirements: REQ-OBS-001, REQ-OBS-002, REQ-OBS-003

import { v4 as uuidv4 } from 'uuid';

import { openDatabase, getAllQueuedOperations, DB_NAME, DB_VERSION } from './indexed-db';
import { getStorageManager, type StorageMetrics } from './storage-manager';
import type { SyncResult } from './sync-engine';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of error logs to keep in IndexedDB
 */
export const MAX_ERROR_LOGS = 100;

/**
 * App version - should be updated on each release
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0';

/**
 * Error log types
 */
export type ErrorLogType = 'sync' | 'storage' | 'network' | 'validation' | 'general';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Error log entry stored in IndexedDB
 * REQ-OBS-002: Log sync/storage/network errors with context
 */
export interface ErrorLog {
  id: string;
  timestamp: string;
  type: ErrorLogType;
  code: string;
  message: string;
  context: Record<string, unknown>;
  stack?: string;
}

/**
 * Cache size information by category
 */
export interface CacheSizes {
  total: number;
  byCategory: Record<string, number>;
}

/**
 * IndexedDB size information by store
 */
export interface IDBSizes {
  total: number;
  byStore: Record<string, number>;
}

/**
 * Last sync information
 */
export interface LastSyncInfo {
  sync_run_id: string | null;
  timestamp: string | null;
  result: SyncResult | null;
  duration_ms: number | null;
}

/**
 * Complete diagnostics data
 * REQ-OBS-001: Diagnostics screen data
 */
export interface DiagnosticsData {
  app_version: string;
  sw_version: string | null;
  cache_sizes: CacheSizes;
  idb_sizes: IDBSizes;
  last_sync: LastSyncInfo;
  recent_errors: ErrorLog[];
  storage_metrics: StorageMetrics;
  platform: string;
  user_agent: string;
  is_online: boolean;
  is_standalone: boolean;
  degraded_mode: string;
  ops_queue_count: number;
  collected_at: string;
}

// ============================================================================
// ERROR LOG STORAGE (In-Memory + LocalStorage fallback)
// ============================================================================

/**
 * In-memory error log storage
 * Falls back to localStorage if IndexedDB is not available
 */
class ErrorLogStorage {
  private static readonly STORAGE_KEY = 'cocoatrack_error_logs';
  private logs: ErrorLog[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to load from localStorage
      const stored = localStorage.getItem(ErrorLogStorage.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      // Ignore errors, start with empty logs
    }

    this.initialized = true;
  }

  async add(log: ErrorLog): Promise<void> {
    await this.initialize();

    // Add to beginning (most recent first)
    this.logs.unshift(log);

    // Keep only MAX_ERROR_LOGS
    if (this.logs.length > MAX_ERROR_LOGS) {
      this.logs = this.logs.slice(0, MAX_ERROR_LOGS);
    }

    // Persist to localStorage
    this.persist();
  }

  async getAll(): Promise<ErrorLog[]> {
    await this.initialize();
    return [...this.logs];
  }

  async getRecent(count: number): Promise<ErrorLog[]> {
    await this.initialize();
    return this.logs.slice(0, count);
  }

  async clear(): Promise<void> {
    this.logs = [];
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(ErrorLogStorage.STORAGE_KEY, JSON.stringify(this.logs));
    } catch {
      // localStorage might be full or unavailable
      console.warn('[DiagnosticsService] Failed to persist error logs to localStorage');
    }
  }
}

// ============================================================================
// LAST SYNC STORAGE
// ============================================================================

/**
 * Stores last sync information in localStorage
 */
class LastSyncStorage {
  private static readonly STORAGE_KEY = 'cocoatrack_last_sync';

  static get(): LastSyncInfo {
    try {
      const stored = localStorage.getItem(LastSyncStorage.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore errors
    }
    return {
      sync_run_id: null,
      timestamp: null,
      result: null,
      duration_ms: null,
    };
  }

  static set(info: LastSyncInfo): void {
    try {
      localStorage.setItem(LastSyncStorage.STORAGE_KEY, JSON.stringify(info));
    } catch {
      // Ignore errors
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(LastSyncStorage.STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// DIAGNOSTICS SERVICE CLASS
// ============================================================================

/**
 * DiagnosticsService collects and manages app diagnostics
 * REQ-OBS-001: Diagnostics screen
 * REQ-OBS-002: Error tracking
 * REQ-OBS-003: Storage metrics
 */
export class DiagnosticsService {
  private errorStorage = new ErrorLogStorage();
  private swVersion: string | null = null;

  /**
   * Gets complete diagnostics data
   * REQ-OBS-001: Display all metrics
   */
  async getData(): Promise<DiagnosticsData> {
    const [
      cacheSizes,
      idbSizes,
      storageMetrics,
      recentErrors,
      opsQueueCount,
    ] = await Promise.all([
      this.getCacheSizes(),
      this.getIDBSizes(),
      this.getStorageMetrics(),
      this.getRecentErrors(10),
      this.getOpsQueueCount(),
    ]);

    const swVersion = await this.getSWVersion();
    const lastSync = LastSyncStorage.get();

    return {
      app_version: APP_VERSION,
      sw_version: swVersion,
      cache_sizes: cacheSizes,
      idb_sizes: idbSizes,
      last_sync: lastSync,
      recent_errors: recentErrors,
      storage_metrics: storageMetrics,
      platform: this.getPlatform(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      is_online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      is_standalone: this.isStandalone(),
      degraded_mode: this.getDegradedMode(),
      ops_queue_count: opsQueueCount,
      collected_at: new Date().toISOString(),
    };
  }

  /**
   * Exports all logs as JSON string
   * REQ-OBS-001: Export logs as JSON button
   */
  async exportLogs(): Promise<string> {
    const data = await this.getData();
    const allErrors = await this.errorStorage.getAll();

    const exportData = {
      ...data,
      all_errors: allErrors,
      exported_at: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clears all error logs
   */
  async clearLogs(): Promise<void> {
    await this.errorStorage.clear();
  }

  /**
   * Logs an error with context
   * REQ-OBS-002: Log sync/storage/network errors with context
   */
  async logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<void> {
    const log: ErrorLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...error,
    };

    await this.errorStorage.add(log);

    // Also log to console for debugging
    console.error(`[DiagnosticsService] ${error.type} error:`, error.message, error.context);
  }

  /**
   * Records a sync completion
   */
  recordSyncCompletion(result: SyncResult, durationMs: number): void {
    const syncRunId = uuidv4();
    
    LastSyncStorage.set({
      sync_run_id: syncRunId,
      timestamp: new Date().toISOString(),
      result,
      duration_ms: durationMs,
    });

    // Log sync errors if any
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        this.logError({
          type: 'sync',
          code: error.code,
          message: error.message,
          context: {
            operation_id: error.operationId,
            sync_run_id: syncRunId,
          },
        });
      }
    }
  }

  /**
   * Gets recent error logs
   */
  async getRecentErrors(count: number = 10): Promise<ErrorLog[]> {
    return this.errorStorage.getRecent(count);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Gets cache sizes by category
   */
  private async getCacheSizes(): Promise<CacheSizes> {
    if (typeof caches === 'undefined') {
      return { total: 0, byCategory: {} };
    }

    const byCategory: Record<string, number> = {};
    let total = 0;

    try {
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        if (!cacheName.startsWith('cocoatrack-')) continue;

        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        // Estimate size based on number of entries (rough estimate: 50KB per entry average)
        const estimatedSize = keys.length * 50 * 1024;
        
        // Extract category from cache name (e.g., 'cocoatrack-pages-v1' -> 'pages')
        const category = this.extractCacheCategory(cacheName);
        byCategory[category] = (byCategory[category] || 0) + estimatedSize;
        total += estimatedSize;
      }
    } catch (error) {
      console.warn('[DiagnosticsService] Failed to get cache sizes:', error);
    }

    return { total, byCategory };
  }

  /**
   * Extracts category from cache name
   */
  private extractCacheCategory(cacheName: string): string {
    // cocoatrack-pages-v1 -> pages
    // cocoatrack-api-tier1-v1 -> api-tier1
    const match = cacheName.match(/^cocoatrack-(.+?)-v\d+$/);
    return match ? match[1] : cacheName;
  }

  /**
   * Gets IndexedDB sizes by store
   */
  private async getIDBSizes(): Promise<IDBSizes> {
    const byStore: Record<string, number> = {};
    let total = 0;

    try {
      const db = await openDatabase();
      const storeNames = ['planteurs', 'chef_planteurs', 'warehouses', 'ops_queue', 'sync_metadata'];

      for (const storeName of storeNames) {
        try {
          const count = await db.count(storeName as 'planteurs' | 'chef_planteurs' | 'warehouses' | 'ops_queue' | 'sync_metadata');
          // Estimate size: 1KB per record average
          const estimatedSize = count * 1024;
          byStore[storeName] = estimatedSize;
          total += estimatedSize;
        } catch {
          byStore[storeName] = 0;
        }
      }
    } catch (error) {
      console.warn('[DiagnosticsService] Failed to get IDB sizes:', error);
    }

    return { total, byStore };
  }

  /**
   * Gets storage metrics from StorageManager
   */
  private async getStorageMetrics(): Promise<StorageMetrics> {
    const storageManager = getStorageManager();
    return storageManager.getMetrics();
  }

  /**
   * Gets ops_queue count
   */
  private async getOpsQueueCount(): Promise<number> {
    try {
      const ops = await getAllQueuedOperations();
      return ops.length;
    } catch {
      return 0;
    }
  }

  /**
   * Gets Service Worker version
   */
  private async getSWVersion(): Promise<string | null> {
    if (this.swVersion) return this.swVersion;

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) return null;

      // Try to get version from SW via message
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve('unknown'), 2000);

        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          this.swVersion = event.data?.version || 'unknown';
          resolve(this.swVersion);
        };

        registration.active?.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
      });
    } catch {
      return null;
    }
  }

  /**
   * Gets platform information
   */
  private getPlatform(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Mac/.test(ua)) return 'macos';
    if (/Linux/.test(ua)) return 'linux';
    
    return 'unknown';
  }

  /**
   * Checks if app is running in standalone mode
   */
  private isStandalone(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    );
  }

  /**
   * Gets current degraded mode status
   */
  private getDegradedMode(): string {
    // This would integrate with DegradedModeManager
    // For now, return 'normal' as default
    return 'normal';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let diagnosticsServiceInstance: DiagnosticsService | null = null;

/**
 * Gets the singleton DiagnosticsService instance
 */
export function getDiagnosticsService(): DiagnosticsService {
  if (!diagnosticsServiceInstance) {
    diagnosticsServiceInstance = new DiagnosticsService();
  }
  return diagnosticsServiceInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Logs a sync error
 */
export async function logSyncError(
  code: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const service = getDiagnosticsService();
  await service.logError({
    type: 'sync',
    code,
    message,
    context,
  });
}

/**
 * Logs a storage error
 */
export async function logStorageError(
  code: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const service = getDiagnosticsService();
  await service.logError({
    type: 'storage',
    code,
    message,
    context,
  });
}

/**
 * Logs a network error
 */
export async function logNetworkError(
  code: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const service = getDiagnosticsService();
  await service.logError({
    type: 'network',
    code,
    message,
    context,
  });
}

/**
 * Logs a validation error
 */
export async function logValidationError(
  code: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const service = getDiagnosticsService();
  await service.logError({
    type: 'validation',
    code,
    message,
    context,
  });
}

/**
 * Logs a general error
 */
export async function logGeneralError(
  code: string,
  message: string,
  context: Record<string, unknown> = {},
  stack?: string
): Promise<void> {
  const service = getDiagnosticsService();
  await service.logError({
    type: 'general',
    code,
    message,
    context,
    stack,
  });
}

/**
 * Records sync completion for diagnostics
 */
export function recordSyncCompletion(result: SyncResult, durationMs: number): void {
  const service = getDiagnosticsService();
  service.recordSyncCompletion(result, durationMs);
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// ANONYMOUS SERVER UPLOAD (OPT-IN)
// REQ-OBS-002: Optional anonymous server upload
// ============================================================================

/**
 * Configuration for anonymous error upload
 */
export interface ErrorUploadConfig {
  enabled: boolean;
  endpoint: string;
  maxErrorsPerUpload: number;
}

const DEFAULT_UPLOAD_CONFIG: ErrorUploadConfig = {
  enabled: false,
  endpoint: '/api/diagnostics/errors',
  maxErrorsPerUpload: 10,
};

/**
 * Gets the error upload configuration from localStorage
 */
export function getErrorUploadConfig(): ErrorUploadConfig {
  try {
    const stored = localStorage.getItem('cocoatrack_error_upload_config');
    if (stored) {
      return { ...DEFAULT_UPLOAD_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_UPLOAD_CONFIG;
}

/**
 * Sets the error upload configuration
 */
export function setErrorUploadEnabled(enabled: boolean): void {
  try {
    const config = getErrorUploadConfig();
    config.enabled = enabled;
    localStorage.setItem('cocoatrack_error_upload_config', JSON.stringify(config));
  } catch {
    // Ignore errors
  }
}

/**
 * Anonymizes error data before upload
 * Removes potentially identifying information
 */
function anonymizeErrorData(errors: ErrorLog[]): Record<string, unknown>[] {
  return errors.map(error => {
    const context: Record<string, unknown> = {};
    
    // Only include non-identifying technical context
    if (error.context.operation_type) {
      context.operation_type = error.context.operation_type;
    }
    if (error.context.table) {
      context.table = error.context.table;
    }
    if (error.context.error_code) {
      context.error_code = error.context.error_code;
    }
    if (error.context.retry_count) {
      context.retry_count = error.context.retry_count;
    }
    
    return {
      type: error.type,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      context,
    };
  });
}

/**
 * Uploads error logs anonymously to the server (opt-in)
 * REQ-OBS-002: Optional anonymous server upload
 */
export async function uploadErrorsAnonymously(): Promise<{ success: boolean; uploaded: number }> {
  const config = getErrorUploadConfig();
  
  if (!config.enabled) {
    return { success: false, uploaded: 0 };
  }

  try {
    const service = getDiagnosticsService();
    const errors = await service.getRecentErrors(config.maxErrorsPerUpload);
    
    if (errors.length === 0) {
      return { success: true, uploaded: 0 };
    }

    const anonymizedErrors = anonymizeErrorData(errors);
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_version: APP_VERSION,
        platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        errors: anonymizedErrors,
        uploaded_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return { success: true, uploaded: anonymizedErrors.length };
  } catch (error) {
    console.warn('[DiagnosticsService] Failed to upload errors:', error);
    return { success: false, uploaded: 0 };
  }
}
