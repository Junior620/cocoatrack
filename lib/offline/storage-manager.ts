// CocoaTrack V2 - Storage Manager
// Handles storage quota detection, state machine, and eviction policies
// Requirements: REQ-OFF-004, REQ-OFF-007, REQ-OBS-003

import { openDatabase, DB_NAME } from './indexed-db';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/**
 * Storage thresholds as percentages
 */
export const STORAGE_THRESHOLDS = {
  WARNING: 80,
  PURGE_TIER3: 90,
  PURGE_TIER2: 95,
  EMERGENCY: 98,
} as const;

/**
 * Absolute fallback quota when Storage API is unavailable (50MB)
 */
export const FALLBACK_QUOTA_BYTES = 50 * 1024 * 1024;

/**
 * Storage state machine states
 */
export type StorageState = 'normal' | 'warning' | 'purging' | 'emergency';

/**
 * Storage metrics returned by getMetrics()
 */
export interface StorageMetrics {
  quota_total: number;        // bytes
  quota_used: number;         // bytes
  quota_percent: number;      // 0-100
  tier1_size: number;         // bytes (estimated)
  tier2_size: number;         // bytes (estimated)
  tier3_size: number;         // bytes (estimated)
  ops_queue_count: number;
  is_estimate: boolean;       // true if using fallback estimation
}

/**
 * Data tier definition
 */
export interface DataTierConfig {
  idb_stores: string[];
  cache_patterns: string[];
  max_size_bytes: number;
}

/**
 * Cached delivery with tier assignment
 */
export interface CachedDelivery {
  id: string;
  client_id: string;
  server_id: string | null;
  data: Record<string, unknown>;
  tier: 1 | 2 | 3;
  status: 'synced' | 'pending_sync' | 'conflict';
  cached_at: string;
  delivered_at: string;
  updated_at: string;
}

// ============================================================================
// DATA TIER DEFINITIONS
// ============================================================================

/**
 * Data tier configuration
 * Tier 1: NEVER purged (critical terrain data)
 * Tier 2: Purged at 95% quota
 * Tier 3: Purged first at 90% quota
 */
export const DATA_TIERS: Record<1 | 2 | 3, DataTierConfig> = {
  1: {
    idb_stores: ['ops_queue', 'planteurs', 'chef_planteurs', 'warehouses', 'sync_metadata'],
    cache_patterns: ['cocoatrack-precache-*'],
    max_size_bytes: 20 * 1024 * 1024, // 20MB
  },
  2: {
    idb_stores: ['deliveries_cache'], // where tier === 2
    cache_patterns: ['cocoatrack-api-tier23-*'],
    max_size_bytes: 10 * 1024 * 1024, // 10MB
  },
  3: {
    idb_stores: ['exports_cache', 'dashboards_cache'],
    cache_patterns: ['cocoatrack-images-*'],
    max_size_bytes: 20 * 1024 * 1024, // 20MB
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Assigns a delivery to a tier based on delivered_at date
 * - Tier 1: delivered within last 7 days (0-7 days ago, inclusive)
 * - Tier 2: delivered 8-30 days ago
 * - Tier 3: delivered more than 30 days ago
 */
export function assignDeliveryTier(delivered_at: string): 1 | 2 | 3 {
  const deliveredDate = new Date(delivered_at);
  const now = Date.now();
  const daysAgo = (now - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Use < 8 instead of <= 7 to handle boundary correctly
  // This ensures that anything up to and including 7 full days is Tier 1
  if (daysAgo < 8) return 1;
  if (daysAgo < 31) return 2;
  return 3;
}

/**
 * Determines storage state based on quota percentage
 * State machine: normal → warning → purging → emergency
 */
export function getStorageStateFromPercent(percent: number): StorageState {
  if (percent >= STORAGE_THRESHOLDS.EMERGENCY) return 'emergency';
  if (percent >= STORAGE_THRESHOLDS.PURGE_TIER3) return 'purging';
  if (percent >= STORAGE_THRESHOLDS.WARNING) return 'warning';
  return 'normal';
}

/**
 * Checks if Storage API is available
 */
export function isStorageAPIAvailable(): boolean {
  return typeof navigator !== 'undefined' && 
         'storage' in navigator && 
         'estimate' in navigator.storage;
}

// ============================================================================
// STORAGE MANAGER CLASS
// ============================================================================

export class StorageManager {
  private cachedMetrics: StorageMetrics | null = null;
  private metricsTimestamp: number = 0;
  private readonly METRICS_CACHE_TTL = 5000; // 5 seconds

  /**
   * Gets storage metrics including quota, usage, and tier sizes
   * Uses Storage API with fallback to absolute estimation
   */
  async getMetrics(): Promise<StorageMetrics> {
    // Return cached metrics if still valid
    const now = Date.now();
    if (this.cachedMetrics && (now - this.metricsTimestamp) < this.METRICS_CACHE_TTL) {
      return this.cachedMetrics;
    }

    let quota_total: number;
    let quota_used: number;
    let is_estimate = false;

    if (isStorageAPIAvailable()) {
      try {
        const estimate = await navigator.storage.estimate();
        quota_total = estimate.quota || FALLBACK_QUOTA_BYTES;
        quota_used = estimate.usage || 0;
      } catch {
        // Fallback if estimate fails
        quota_total = FALLBACK_QUOTA_BYTES;
        quota_used = await this.estimateUsageFromIDB();
        is_estimate = true;
      }
    } else {
      // Fallback for browsers without Storage API
      quota_total = FALLBACK_QUOTA_BYTES;
      quota_used = await this.estimateUsageFromIDB();
      is_estimate = true;
    }

    // Calculate percentage (avoid division by zero)
    const quota_percent = quota_total > 0 
      ? Math.round((quota_used / quota_total) * 100) 
      : 0;

    // Get ops_queue count
    const ops_queue_count = await this.getOpsQueueCount();

    // Estimate tier sizes (simplified - actual implementation would query each store)
    const tierSizes = await this.estimateTierSizes();

    const metrics: StorageMetrics = {
      quota_total,
      quota_used,
      quota_percent,
      tier1_size: tierSizes.tier1,
      tier2_size: tierSizes.tier2,
      tier3_size: tierSizes.tier3,
      ops_queue_count,
      is_estimate,
    };

    // Cache the metrics
    this.cachedMetrics = metrics;
    this.metricsTimestamp = now;

    return metrics;
  }

  /**
   * Gets the current storage state based on quota percentage
   */
  async getState(): Promise<StorageState> {
    const metrics = await this.getMetrics();
    return getStorageStateFromPercent(metrics.quota_percent);
  }

  /**
   * Checks if writes are allowed (not in emergency state)
   */
  async canWrite(): Promise<boolean> {
    const state = await this.getState();
    return state !== 'emergency';
  }

  /**
   * Checks if Tier 2 downloads are allowed
   */
  async canDownloadTier2(): Promise<boolean> {
    const metrics = await this.getMetrics();
    return metrics.quota_percent < STORAGE_THRESHOLDS.PURGE_TIER2;
  }

  /**
   * Checks if Tier 3 downloads are allowed
   */
  async canDownloadTier3(): Promise<boolean> {
    const metrics = await this.getMetrics();
    return metrics.quota_percent < STORAGE_THRESHOLDS.PURGE_TIER3;
  }

  /**
   * Purges Tier 3 data (exports, dashboards, old images)
   * Returns bytes freed
   */
  async purgeTier3(): Promise<number> {
    let bytesFreed = 0;

    // Clear Tier 3 IndexedDB stores
    bytesFreed += await this.clearTier3IDBStores();

    // Clear Tier 3 cache entries
    bytesFreed += await this.clearCachesByPattern(DATA_TIERS[3].cache_patterns);

    // Clear Tier 3 deliveries from deliveries_cache
    bytesFreed += await this.clearDeliveriesByTier(3);

    // Invalidate metrics cache
    this.cachedMetrics = null;

    return bytesFreed;
  }

  /**
   * Purges Tier 2 data (historical deliveries 8-30 days)
   * Returns bytes freed
   */
  async purgeTier2(): Promise<number> {
    let bytesFreed = 0;

    // Clear Tier 2 cache entries
    bytesFreed += await this.clearCachesByPattern(DATA_TIERS[2].cache_patterns);

    // Clear Tier 2 deliveries from deliveries_cache
    bytesFreed += await this.clearDeliveriesByTier(2);

    // Invalidate metrics cache
    this.cachedMetrics = null;

    return bytesFreed;
  }

  /**
   * Aggressive cleanup preserving only Tier 1 data
   * CRITICAL: Never deletes ops_queue or pending_sync records
   * Returns bytes freed
   */
  async forceCleanup(): Promise<number> {
    let bytesFreed = 0;

    // Purge Tier 3 first
    bytesFreed += await this.purgeTier3();

    // Then purge Tier 2
    bytesFreed += await this.purgeTier2();

    // Clear all non-essential caches
    bytesFreed += await this.clearNonEssentialCaches();

    // Invalidate metrics cache
    this.cachedMetrics = null;

    return bytesFreed;
  }

  /**
   * Invalidates the metrics cache, forcing a fresh read on next getMetrics()
   */
  invalidateCache(): void {
    this.cachedMetrics = null;
    this.metricsTimestamp = 0;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Estimates storage usage by querying IndexedDB
   * Used as fallback when Storage API is unavailable
   */
  private async estimateUsageFromIDB(): Promise<number> {
    try {
      const db = await openDatabase();
      let totalSize = 0;

      // Estimate size of each store by counting records and assuming average size
      const stores = ['planteurs', 'chef_planteurs', 'warehouses', 'ops_queue', 'sync_metadata'];
      
      for (const storeName of stores) {
        try {
          const count = await db.count(storeName as 'planteurs' | 'chef_planteurs' | 'warehouses' | 'ops_queue' | 'sync_metadata');
          // Rough estimate: 1KB per record average
          totalSize += count * 1024;
        } catch {
          // Store might not exist yet
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Gets the count of operations in ops_queue
   */
  private async getOpsQueueCount(): Promise<number> {
    try {
      const db = await openDatabase();
      return await db.count('ops_queue');
    } catch {
      return 0;
    }
  }

  /**
   * Estimates sizes for each tier
   */
  private async estimateTierSizes(): Promise<{ tier1: number; tier2: number; tier3: number }> {
    try {
      const db = await openDatabase();
      
      // Tier 1: planteurs, chef_planteurs, warehouses, ops_queue, sync_metadata
      let tier1 = 0;
      for (const store of DATA_TIERS[1].idb_stores) {
        try {
          const count = await db.count(store as 'planteurs' | 'chef_planteurs' | 'warehouses' | 'ops_queue' | 'sync_metadata');
          tier1 += count * 1024; // 1KB average per record
        } catch {
          // Store might not exist
        }
      }

      // Tier 2 and 3: Would need deliveries_cache store with tier index
      // For now, return 0 as these stores don't exist yet
      const tier2 = 0;
      const tier3 = 0;

      return { tier1, tier2, tier3 };
    } catch {
      return { tier1: 0, tier2: 0, tier3: 0 };
    }
  }

  /**
   * Clears Tier 3 IndexedDB stores
   */
  private async clearTier3IDBStores(): Promise<number> {
    // These stores don't exist yet in the current schema
    // Will be added in migration v2
    // For now, return 0
    return 0;
  }

  /**
   * Clears deliveries from deliveries_cache by tier
   * CRITICAL: Never clears pending_sync deliveries
   */
  private async clearDeliveriesByTier(tier: 2 | 3): Promise<number> {
    try {
      const db = await openDatabase();
      
      // Check if deliveries_cache store exists
      if (!db.objectStoreNames.contains('deliveries_cache')) {
        return 0;
      }

      // Get all deliveries of the specified tier
      const tx = db.transaction('deliveries_cache' as 'planteurs', 'readwrite');
      const store = tx.objectStore('deliveries_cache' as 'planteurs');
      const allDeliveries = await store.getAll();
      
      let bytesFreed = 0;
      
      for (const delivery of allDeliveries) {
        const cachedDelivery = delivery as unknown as CachedDelivery;
        
        // CRITICAL: Never delete pending_sync deliveries
        if (cachedDelivery.status === 'pending_sync') {
          continue;
        }
        
        // Only delete deliveries of the specified tier
        if (cachedDelivery.tier === tier) {
          await store.delete(cachedDelivery.id);
          bytesFreed += 1024; // Estimate 1KB per delivery
        }
      }
      
      await tx.done;
      return bytesFreed;
    } catch {
      // Store might not exist yet
      return 0;
    }
  }

  /**
   * Clears caches matching the given patterns
   */
  private async clearCachesByPattern(patterns: string[]): Promise<number> {
    if (typeof caches === 'undefined') return 0;

    let bytesFreed = 0;

    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        for (const pattern of patterns) {
          // Convert glob pattern to regex
          const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
          if (regex.test(cacheName)) {
            await caches.delete(cacheName);
            // Estimate freed bytes (rough estimate)
            bytesFreed += 1024 * 1024; // 1MB per cache
          }
        }
      }
    } catch {
      // Cache API might not be available
    }

    return bytesFreed;
  }

  /**
   * Clears all non-essential caches (keeps precache and tier1 API cache)
   */
  private async clearNonEssentialCaches(): Promise<number> {
    if (typeof caches === 'undefined') return 0;

    let bytesFreed = 0;
    const essentialPatterns = [
      /^cocoatrack-precache-/,
      /^cocoatrack-api-tier1-/,
      /^cocoatrack-shell-/,
    ];

    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        const isEssential = essentialPatterns.some(pattern => pattern.test(cacheName));
        if (!isEssential && cacheName.startsWith('cocoatrack-')) {
          await caches.delete(cacheName);
          bytesFreed += 1024 * 1024; // 1MB estimate per cache
        }
      }
    } catch {
      // Cache API might not be available
    }

    return bytesFreed;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storageManagerInstance: StorageManager | null = null;

/**
 * Gets the singleton StorageManager instance
 */
export function getStorageManager(): StorageManager {
  if (!storageManagerInstance) {
    storageManagerInstance = new StorageManager();
  }
  return storageManagerInstance;
}

// ============================================================================
// EVICTION POLICY INVARIANTS
// ============================================================================

/**
 * Stores that are NEVER purged (Tier 1 + ops_queue)
 * Used by eviction policy to verify invariants
 */
export const PROTECTED_STORES = [
  'ops_queue',
  'planteurs',
  'chef_planteurs',
  'warehouses',
  'sync_metadata',
] as const;

/**
 * Checks if a store is protected from eviction
 */
export function isProtectedStore(storeName: string): boolean {
  return PROTECTED_STORES.includes(storeName as typeof PROTECTED_STORES[number]);
}

/**
 * Checks if a delivery can be evicted
 * CRITICAL: pending_sync deliveries are NEVER evicted
 */
export function canEvictDelivery(delivery: CachedDelivery): boolean {
  // Never evict pending_sync deliveries
  if (delivery.status === 'pending_sync') {
    return false;
  }
  
  // Only Tier 2 and Tier 3 deliveries can be evicted
  return delivery.tier === 2 || delivery.tier === 3;
}

/**
 * Validates that an eviction operation respects invariants
 * Returns true if the eviction is safe
 */
export function validateEvictionSafety(params: {
  storesToClear: string[];
  deliveriesToDelete: CachedDelivery[];
}): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check for protected stores
  for (const store of params.storesToClear) {
    if (isProtectedStore(store)) {
      violations.push(`Cannot clear protected store: ${store}`);
    }
  }

  // Check for pending_sync deliveries
  for (const delivery of params.deliveriesToDelete) {
    if (delivery.status === 'pending_sync') {
      violations.push(`Cannot delete pending_sync delivery: ${delivery.id}`);
    }
    if (delivery.tier === 1) {
      violations.push(`Cannot delete Tier 1 delivery: ${delivery.id}`);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
