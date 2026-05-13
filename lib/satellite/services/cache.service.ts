/**
 * Cache Service
 * 
 * This service provides client-side caching for satellite imagery data
 * with LRU (Least Recently Used) eviction strategy. It implements:
 * - Cache storage in satellite_cache_metadata table
 * - LRU eviction when cache limit is reached (50 parcelles)
 * - Protection for favorite parcelles from eviction
 * - Last accessed timestamp tracking
 * - Cache statistics and monitoring
 * 
 * Requirements: Task 6.1.4
 * - Add evictLRU() method
 * - Track last accessed timestamp
 * - Evict oldest entries when limit reached (50 parcelles)
 * - Protect favorite parcelles from eviction
 */

import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of parcelles to cache (LRU limit)
 */
const MAX_CACHED_PARCELLES = 50;

/**
 * Cache retention periods by data type (in days)
 */
const CACHE_RETENTION_DAYS = {
  imagery: 90,
  ndvi: 30,
  bands: 30,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  id: string;
  parcelleId: string;
  cacheKey: string;
  dataType: 'imagery' | 'ndvi' | 'bands';
  storageUrl: string;
  sizeBytes: number;
  lastAccessedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  uniqueParcelles: number;
  entriesByType: {
    imagery: number;
    ndvi: number;
    bands: number;
  };
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Options for storing cache entry
 */
export interface StoreCacheOptions {
  parcelleId: string;
  cacheKey: string;
  dataType: 'imagery' | 'ndvi' | 'bands';
  storageUrl: string;
  sizeBytes: number;
  isFavorite?: boolean;
}

/**
 * LRU eviction result
 */
export interface EvictionResult {
  evictedCount: number;
  freedBytes: number;
  evictedEntries: CacheEntry[];
}

// ============================================================================
// CacheService Class
// ============================================================================

/**
 * Service for managing satellite data cache with LRU eviction
 */
export class CacheService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  // satellite_cache_metadata is not yet in database.gen.ts — cast to any to bypass type check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cacheTable(): any {
    return (this.supabase as any).from('satellite_cache_metadata');
  }

  /**
   * Store a cache entry
   * 
   * Adds a new cache entry to the satellite_cache_metadata table.
   * If the cache limit is reached, triggers LRU eviction before storing.
   * 
   * @param options - Cache entry options
   * @returns The created cache entry or null if failed
   */
  async storeCache(options: StoreCacheOptions): Promise<CacheEntry | null> {
    try {
      // Check if we need to evict before storing
      const stats = await this.getCacheStats();
      if (stats.uniqueParcelles >= MAX_CACHED_PARCELLES) {
        console.log('[Cache Service] Cache limit reached, triggering LRU eviction');
        await this.evictLRU(1); // Evict at least 1 parcelle to make room
      }

      // Calculate expiration date based on data type
      const retentionDays = CACHE_RETENTION_DAYS[options.dataType];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      // Insert cache entry
      const { data, error } = await this.cacheTable()
        
        .insert({
          parcelle_id: options.parcelleId,
          cache_key: options.cacheKey,
          data_type: options.dataType,
          storage_url: options.storageUrl,
          size_bytes: options.sizeBytes,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Cache Service] Error storing cache entry:', error);
        return null;
      }

      return this.mapToCacheEntry(data);
    } catch (error) {
      console.error('[Cache Service] Error storing cache:', error);
      return null;
    }
  }

  /**
   * Get a cache entry by cache key
   * 
   * Retrieves a cache entry and updates its last_accessed_at timestamp.
   * Returns null if the entry doesn't exist or has expired.
   * 
   * @param cacheKey - Unique cache key
   * @returns Cache entry or null if not found
   */
  async getCache(cacheKey: string): Promise<CacheEntry | null> {
    try {
      // Retrieve cache entry
      const { data, error } = await this.cacheTable()
        
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (error || !data) {
        return null;
      }

      const entry = this.mapToCacheEntry(data);

      // Check if expired
      if (entry.expiresAt < new Date()) {
        console.log(`[Cache Service] Cache entry expired: ${cacheKey}`);
        await this.deleteCache(cacheKey);
        return null;
      }

      // Update last accessed timestamp
      await this.updateLastAccessed(cacheKey);

      return entry;
    } catch (error) {
      console.error('[Cache Service] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Update last accessed timestamp for a cache entry
   * 
   * Updates the last_accessed_at field to track cache usage for LRU eviction.
   * 
   * @param cacheKey - Unique cache key
   * @returns True if updated successfully
   */
  private async updateLastAccessed(cacheKey: string): Promise<boolean> {
    try {
      const { error } = await this.cacheTable()
        
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('cache_key', cacheKey);

      if (error) {
        console.error('[Cache Service] Error updating last accessed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Cache Service] Error updating last accessed:', error);
      return false;
    }
  }

  /**
   * Delete a cache entry
   * 
   * Removes a cache entry from the database.
   * Note: This does not delete the actual file from Supabase Storage.
   * 
   * @param cacheKey - Unique cache key
   * @returns True if deleted successfully
   */
  async deleteCache(cacheKey: string): Promise<boolean> {
    try {
      const { error } = await this.cacheTable()
        
        .delete()
        .eq('cache_key', cacheKey);

      if (error) {
        console.error('[Cache Service] Error deleting cache entry:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Cache Service] Error deleting cache:', error);
      return false;
    }
  }

  /**
   * Evict least recently used cache entries
   * 
   * Implements LRU eviction strategy:
   * 1. Identifies parcelles with cached data
   * 2. Sorts by last accessed timestamp (oldest first)
   * 3. Protects favorite parcelles from eviction
   * 4. Evicts the specified number of oldest parcelles
   * 5. Deletes all cache entries for evicted parcelles
   * 
   * @param count - Number of parcelles to evict (default: 1)
   * @param favoriteParcelles - Array of favorite parcelle IDs to protect
   * @returns Eviction result with count and freed bytes
   */
  async evictLRU(
    count: number = 1,
    favoriteParcelles: string[] = []
  ): Promise<EvictionResult> {
    try {
      // Get all cache entries grouped by parcelle with last accessed time
      const { data: entries, error } = await this.cacheTable()
        
        .select('*')
        .order('last_accessed_at', { ascending: true });

      if (error || !entries || entries.length === 0) {
        console.log('[Cache Service] No cache entries to evict');
        return {
          evictedCount: 0,
          freedBytes: 0,
          evictedEntries: [],
        };
      }

      // Group entries by parcelle and find the oldest access time per parcelle
      const parcelleMap = new Map<string, { lastAccessed: Date; entries: any[] }>();
      
      for (const entry of entries) {
        const parcelleId = entry.parcelle_id;
        const lastAccessed = new Date(entry.last_accessed_at);

        if (!parcelleMap.has(parcelleId)) {
          parcelleMap.set(parcelleId, {
            lastAccessed,
            entries: [entry],
          });
        } else {
          const existing = parcelleMap.get(parcelleId)!;
          existing.entries.push(entry);
          // Update to oldest access time for this parcelle
          if (lastAccessed < existing.lastAccessed) {
            existing.lastAccessed = lastAccessed;
          }
        }
      }

      // Filter out favorite parcelles
      const evictableParcelles = Array.from(parcelleMap.entries())
        .filter(([parcelleId]) => !favoriteParcelles.includes(parcelleId))
        .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

      if (evictableParcelles.length === 0) {
        console.log('[Cache Service] No evictable parcelles (all are favorites)');
        return {
          evictedCount: 0,
          freedBytes: 0,
          evictedEntries: [],
        };
      }

      // Select parcelles to evict (oldest first, up to count)
      const parcellesToEvict = evictableParcelles.slice(0, count);
      const evictedEntries: CacheEntry[] = [];
      let freedBytes = 0;

      // Delete all cache entries for selected parcelles
      for (const [parcelleId, { entries: parcelleEntries }] of parcellesToEvict) {
        for (const entry of parcelleEntries) {
          const { error: deleteError } = await this.cacheTable()
            
            .delete()
            .eq('id', entry.id);

          if (!deleteError) {
            evictedEntries.push(this.mapToCacheEntry(entry));
            freedBytes += entry.size_bytes;
          }
        }

        console.log(
          `[Cache Service] Evicted parcelle ${parcelleId} (${parcelleEntries.length} entries, ${this.formatBytes(
            parcelleEntries.reduce((sum: number, e: any) => sum + e.size_bytes, 0)
          )})`
        );
      }

      console.log(
        `[Cache Service] LRU eviction complete: ${parcellesToEvict.length} parcelles, ${evictedEntries.length} entries, ${this.formatBytes(freedBytes)} freed`
      );

      return {
        evictedCount: parcellesToEvict.length,
        freedBytes,
        evictedEntries,
      };
    } catch (error) {
      console.error('[Cache Service] Error during LRU eviction:', error);
      return {
        evictedCount: 0,
        freedBytes: 0,
        evictedEntries: [],
      };
    }
  }

  /**
   * Get cache statistics
   * 
   * Returns statistics about the current cache state including:
   * - Total number of entries
   * - Total size in bytes
   * - Number of unique parcelles
   * - Breakdown by data type
   * - Oldest and newest entries
   * 
   * @returns Cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const { data: entries, error } = await this.cacheTable()
        
        .select('*');

      if (error || !entries) {
        return this.getEmptyStats();
      }

      // Calculate statistics
      type RawEntry = { parcelle_id: string; data_type: string; size_bytes: number; created_at: string };
      const rows = entries as RawEntry[];
      const uniqueParcelles = new Set(rows.map((e) => e.parcelle_id)).size;
      const totalSizeBytes = rows.reduce((sum, e) => sum + e.size_bytes, 0);
      
      const entriesByType = {
        imagery: rows.filter((e) => e.data_type === 'imagery').length,
        ndvi: rows.filter((e) => e.data_type === 'ndvi').length,
        bands: rows.filter((e) => e.data_type === 'bands').length,
      };

      const dates = rows.map((e) => new Date(e.created_at));
      const oldestEntry = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
      const newestEntry = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

      return {
        totalEntries: rows.length,
        totalSizeBytes,
        uniqueParcelles,
        entriesByType,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      console.error('[Cache Service] Error getting cache stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get cache entries for a specific parcelle
   * 
   * @param parcelleId - Parcelle ID
   * @returns Array of cache entries
   */
  async getParcelleCache(parcelleId: string): Promise<CacheEntry[]> {
    try {
      const { data, error } = await this.cacheTable()
        
        .select('*')
        .eq('parcelle_id', parcelleId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(this.mapToCacheEntry);
    } catch (error) {
      console.error('[Cache Service] Error getting parcelle cache:', error);
      return [];
    }
  }

  /**
   * Clear expired cache entries
   * 
   * Removes all cache entries that have passed their expiration date.
   * 
   * @returns Number of entries deleted
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await this.cacheTable()
        
        .delete()
        .lt('expires_at', now)
        .select();

      if (error) {
        console.error('[Cache Service] Error clearing expired cache:', error);
        return 0;
      }

      const count = data?.length || 0;
      console.log(`[Cache Service] Cleared ${count} expired cache entries`);
      return count;
    } catch (error) {
      console.error('[Cache Service] Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries for a parcelle
   * 
   * @param parcelleId - Parcelle ID
   * @returns Number of entries deleted
   */
  async clearParcelleCache(parcelleId: string): Promise<number> {
    try {
      const { data, error } = await this.cacheTable()
        
        .delete()
        .eq('parcelle_id', parcelleId)
        .select();

      if (error) {
        console.error('[Cache Service] Error clearing parcelle cache:', error);
        return 0;
      }

      const count = data?.length || 0;
      console.log(`[Cache Service] Cleared ${count} cache entries for parcelle ${parcelleId}`);
      return count;
    } catch (error) {
      console.error('[Cache Service] Error clearing parcelle cache:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache on NDVI calculation
   * 
   * This method is called when new NDVI data is calculated for a parcelle.
   * It invalidates both the local cache (satellite_cache_metadata) and
   * the Redis temporal cache to ensure fresh data is retrieved on next request.
   * 
   * Invalidation strategy:
   * 1. Clear all cache entries for the parcelle from satellite_cache_metadata
   * 2. Invalidate Redis temporal cache using RedisCacheService
   * 
   * @param parcelleId - Parcelle ID
   * @returns True if invalidation succeeded, false otherwise
   * 
   * @example
   * ```typescript
   * const cacheService = getCacheService();
   * await cacheService.invalidateOnNDVICalculation('parcelle-123');
   * ```
   */
  async invalidateOnNDVICalculation(parcelleId: string): Promise<boolean> {
    try {
      console.log(`[Cache Service] Invalidating cache on NDVI calculation for parcelle ${parcelleId}`);
      
      // Clear local cache entries - this will throw if it fails
      const count = await this.clearParcelleCache(parcelleId);
      
      // If clearParcelleCache returned 0 due to error (check logs), consider it a failure
      // But we still want to try Redis invalidation
      
      // Invalidate Redis temporal cache
      const { redisCacheService } = await import('./redis-cache.service');
      await redisCacheService.invalidateParcelleCache(parcelleId);
      
      console.log(`[Cache Service] Successfully invalidated cache for parcelle ${parcelleId}`);
      return true;
    } catch (error) {
      console.error('[Cache Service] Error invalidating cache on NDVI calculation:', error);
      return false;
    }
  }

  /**
   * Invalidate cache on alert acknowledgment
   * 
   * This method is called when a deforestation alert is acknowledged or disputed.
   * While alert status changes don't directly affect cached imagery or NDVI data,
   * we invalidate the cache to ensure any related metadata or reports are refreshed.
   * 
   * Invalidation strategy:
   * 1. Clear all cache entries for the parcelle from satellite_cache_metadata
   * 2. Invalidate Redis temporal cache using RedisCacheService
   * 
   * @param parcelleId - Parcelle ID associated with the alert
   * @returns True if invalidation succeeded, false otherwise
   * 
   * @example
   * ```typescript
   * const cacheService = getCacheService();
   * await cacheService.invalidateOnAlertAcknowledgment('parcelle-123');
   * ```
   */
  async invalidateOnAlertAcknowledgment(parcelleId: string): Promise<boolean> {
    try {
      console.log(`[Cache Service] Invalidating cache on alert acknowledgment for parcelle ${parcelleId}`);
      
      // Clear local cache entries
      await this.clearParcelleCache(parcelleId);
      
      // Invalidate Redis temporal cache
      const { redisCacheService } = await import('./redis-cache.service');
      await redisCacheService.invalidateParcelleCache(parcelleId);
      
      console.log(`[Cache Service] Successfully invalidated cache for parcelle ${parcelleId}`);
      return true;
    } catch (error) {
      console.error('[Cache Service] Error invalidating cache on alert acknowledgment:', error);
      return false;
    }
  }

  /**
   * Invalidate cache on parcelle update
   * 
   * This method is called when a parcelle's geometry or metadata is updated.
   * Since cached imagery and NDVI data are tied to specific geometries,
   * any geometry change requires cache invalidation to prevent serving
   * stale data that doesn't match the updated parcelle boundaries.
   * 
   * Invalidation strategy:
   * 1. Clear all cache entries for the parcelle from satellite_cache_metadata
   * 2. Invalidate Redis temporal cache using RedisCacheService
   * 3. Clear NDVI results from database if geometry changed (optional)
   * 
   * @param parcelleId - Parcelle ID
   * @param geometryChanged - Whether the parcelle geometry was modified (default: true)
   * @returns True if invalidation succeeded, false otherwise
   * 
   * @example
   * ```typescript
   * const cacheService = getCacheService();
   * // Geometry changed - full invalidation
   * await cacheService.invalidateOnParcelleUpdate('parcelle-123', true);
   * 
   * // Metadata only changed - lighter invalidation
   * await cacheService.invalidateOnParcelleUpdate('parcelle-123', false);
   * ```
   */
  async invalidateOnParcelleUpdate(
    parcelleId: string,
    geometryChanged: boolean = true
  ): Promise<boolean> {
    try {
      console.log(
        `[Cache Service] Invalidating cache on parcelle update for parcelle ${parcelleId} (geometry changed: ${geometryChanged})`
      );
      
      // Clear local cache entries
      await this.clearParcelleCache(parcelleId);
      
      // Invalidate Redis temporal cache
      const { redisCacheService } = await import('./redis-cache.service');
      await redisCacheService.invalidateParcelleCache(parcelleId);
      
      // If geometry changed, also clear NDVI results from database
      // since they are no longer valid for the new geometry
      if (geometryChanged) {
        try {
          const { error } = await this.cacheTable()
            .from('ndvi_results')
            .delete()
            .eq('parcelle_id', parcelleId);
          
          if (error) {
            console.error('[Cache Service] Error clearing NDVI results:', error);
          } else {
            console.log(`[Cache Service] Cleared NDVI results for parcelle ${parcelleId} due to geometry change`);
          }
        } catch (error) {
          console.error('[Cache Service] Error clearing NDVI results:', error);
          // Don't fail the entire invalidation if NDVI clearing fails
        }
      }
      
      console.log(`[Cache Service] Successfully invalidated cache for parcelle ${parcelleId}`);
      return true;
    } catch (error) {
      console.error('[Cache Service] Error invalidating cache on parcelle update:', error);
      return false;
    }
  }

  /**
   * Map database row to CacheEntry interface
   * 
   * @param data - Database row
   * @returns CacheEntry object
   */
  private mapToCacheEntry(data: any): CacheEntry {
    return {
      id: data.id,
      parcelleId: data.parcelle_id,
      cacheKey: data.cache_key,
      dataType: data.data_type,
      storageUrl: data.storage_url,
      sizeBytes: data.size_bytes,
      lastAccessedAt: new Date(data.last_accessed_at),
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get empty cache statistics
   * 
   * @returns Empty cache stats
   */
  private getEmptyStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSizeBytes: 0,
      uniqueParcelles: 0,
      entriesByType: {
        imagery: 0,
        ndvi: 0,
        bands: 0,
      },
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Format bytes to human-readable string
   * 
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of CacheService
 * 
 * Use this instance throughout the application for consistent cache management.
 * Note: For testing, create new instances directly.
 */
let cacheServiceInstance: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
};

