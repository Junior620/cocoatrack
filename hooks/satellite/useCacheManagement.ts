/**
 * useCacheManagement Hook
 * 
 * Manages satellite data cache state and operations.
 * Provides cache statistics, clear/refresh operations, and cache status tracking.
 * 
 * Requirements: Task 6.1.5
 */

import { useState, useEffect, useCallback } from 'react';
import { getCacheService, type CacheStats, type CacheEntry } from '@/lib/satellite/services/cache.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Cache status for a parcelle
 */
export type CacheStatus = 'cached' | 'stale' | 'not-cached';

/**
 * Parcelle cache info
 */
export interface ParcelleCacheInfo {
  parcelleId: string;
  status: CacheStatus;
  entries: CacheEntry[];
  totalSize: number;
  lastAccessed: Date | null;
  expiresAt: Date | null;
}

/**
 * Hook options
 */
interface UseCacheManagementOptions {
  /** Whether to automatically fetch cache stats on mount */
  autoFetch?: boolean;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
}

/**
 * Hook return value
 */
interface UseCacheManagementReturn {
  /** Cache statistics */
  stats: CacheStats | null;
  /** Whether cache stats are loading */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Refresh cache statistics */
  refreshStats: () => Promise<void>;
  /** Clear all cache entries */
  clearAllCache: () => Promise<boolean>;
  /** Clear cache for specific parcelle */
  clearParcelleCache: (parcelleId: string) => Promise<boolean>;
  /** Clear expired cache entries */
  clearExpiredCache: () => Promise<number>;
  /** Get cache info for a specific parcelle */
  getParcelleCacheInfo: (parcelleId: string) => Promise<ParcelleCacheInfo>;
  /** Get cache status for a parcelle */
  getCacheStatus: (parcelleId: string) => Promise<CacheStatus>;
  /** Calculate cache hit rate (0-100) */
  cacheHitRate: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Cache staleness threshold in milliseconds (24 hours)
 */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useCacheManagement Hook
 * 
 * Provides cache management functionality including statistics,
 * clear operations, and cache status tracking.
 * 
 * @example
 * ```tsx
 * // Basic usage with auto-fetch
 * const { stats, loading, clearAllCache } = useCacheManagement({
 *   autoFetch: true,
 * });
 * 
 * // Clear all cache
 * await clearAllCache();
 * 
 * // Clear specific parcelle cache
 * await clearParcelleCache('abc-123');
 * 
 * // Get cache status for a parcelle
 * const status = await getCacheStatus('abc-123');
 * ```
 */
export function useCacheManagement({
  autoFetch = false,
  refreshInterval = 0,
}: UseCacheManagementOptions = {}): UseCacheManagementReturn {
  // State management
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHitRate, setCacheHitRate] = useState(0);

  // Cache service instance
  const cacheService = getCacheService();

  /**
   * Refresh cache statistics
   */
  const refreshStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cacheStats = await cacheService.getCacheStats();
      setStats(cacheStats);

      // Calculate cache hit rate (simplified - based on total entries vs max)
      // In a real implementation, you'd track actual hits/misses
      const hitRate = cacheStats.uniqueParcelles > 0
        ? Math.min(100, (cacheStats.uniqueParcelles / 50) * 100)
        : 0;
      setCacheHitRate(Math.round(hitRate));

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cache statistics';
      setError(errorMessage);
      console.error('Error fetching cache stats:', err);
    } finally {
      setLoading(false);
    }
  }, [cacheService]);

  /**
   * Clear all cache entries
   */
  const clearAllCache = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Get all cache entries
      const currentStats = await cacheService.getCacheStats();
      
      if (currentStats.totalEntries === 0) {
        console.log('[Cache Management] No cache entries to clear');
        return true;
      }

      // Clear all entries by evicting all parcelles
      const result = await cacheService.evictLRU(currentStats.uniqueParcelles);

      console.log(`[Cache Management] Cleared ${result.evictedCount} parcelles, ${result.evictedEntries.length} entries`);

      // Refresh stats after clearing
      await refreshStats();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMessage);
      console.error('Error clearing cache:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cacheService, refreshStats]);

  /**
   * Clear cache for specific parcelle
   */
  const clearParcelleCache = useCallback(async (parcelleId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const count = await cacheService.clearParcelleCache(parcelleId);

      console.log(`[Cache Management] Cleared ${count} cache entries for parcelle ${parcelleId}`);

      // Refresh stats after clearing
      await refreshStats();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear parcelle cache';
      setError(errorMessage);
      console.error('Error clearing parcelle cache:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cacheService, refreshStats]);

  /**
   * Clear expired cache entries
   */
  const clearExpiredCache = useCallback(async (): Promise<number> => {
    try {
      setLoading(true);
      setError(null);

      const count = await cacheService.clearExpiredCache();

      console.log(`[Cache Management] Cleared ${count} expired cache entries`);

      // Refresh stats after clearing
      await refreshStats();

      return count;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear expired cache';
      setError(errorMessage);
      console.error('Error clearing expired cache:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [cacheService, refreshStats]);

  /**
   * Get cache info for a specific parcelle
   */
  const getParcelleCacheInfo = useCallback(async (parcelleId: string): Promise<ParcelleCacheInfo> => {
    try {
      const entries = await cacheService.getParcelleCache(parcelleId);

      if (entries.length === 0) {
        return {
          parcelleId,
          status: 'not-cached',
          entries: [],
          totalSize: 0,
          lastAccessed: null,
          expiresAt: null,
        };
      }

      // Calculate total size
      const totalSize = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

      // Find most recent access and expiration
      const lastAccessed = new Date(Math.max(...entries.map(e => e.lastAccessedAt.getTime())));
      const expiresAt = new Date(Math.min(...entries.map(e => e.expiresAt.getTime())));

      // Determine cache status
      const now = new Date();
      let status: CacheStatus;

      if (expiresAt < now) {
        status = 'not-cached'; // Expired
      } else if (now.getTime() - lastAccessed.getTime() > STALE_THRESHOLD_MS) {
        status = 'stale'; // Not accessed in 24 hours
      } else {
        status = 'cached'; // Fresh
      }

      return {
        parcelleId,
        status,
        entries,
        totalSize,
        lastAccessed,
        expiresAt,
      };
    } catch (err) {
      console.error('Error getting parcelle cache info:', err);
      return {
        parcelleId,
        status: 'not-cached',
        entries: [],
        totalSize: 0,
        lastAccessed: null,
        expiresAt: null,
      };
    }
  }, [cacheService]);

  /**
   * Get cache status for a parcelle
   */
  const getCacheStatus = useCallback(async (parcelleId: string): Promise<CacheStatus> => {
    const info = await getParcelleCacheInfo(parcelleId);
    return info.status;
  }, [getParcelleCacheInfo]);

  /**
   * Auto-fetch cache stats on mount
   */
  useEffect(() => {
    if (autoFetch) {
      refreshStats();
    }
  }, [autoFetch, refreshStats]);

  /**
   * Set up refresh interval if specified
   */
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(() => {
        refreshStats();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, refreshStats]);

  return {
    stats,
    loading,
    error,
    refreshStats,
    clearAllCache,
    clearParcelleCache,
    clearExpiredCache,
    getParcelleCacheInfo,
    getCacheStatus,
    cacheHitRate,
  };
}
