/**
 * Redis Cache Service
 * 
 * This service provides Redis-based caching for satellite imagery data,
 * specifically for temporal NDVI queries. It implements:
 * - Cache key generation with consistent formatting
 * - 24-hour TTL for temporal data
 * - Cache invalidation on new NDVI calculations
 * - Graceful fallback when Redis is unavailable
 * 
 * Requirements: Task 3.2.2
 * - Add Redis caching for temporal queries
 * - Use cache key: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`
 * - Set 24-hour TTL
 * - Invalidate cache on new NDVI calculation
 */

import Redis from 'ioredis';

// ============================================================================
// Constants
// ============================================================================

/**
 * Cache TTL for temporal data (24 hours in seconds)
 */
const TEMPORAL_CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Cache key prefix for temporal queries
 */
const TEMPORAL_KEY_PREFIX = 'temporal';

/**
 * Cache key prefix for NDVI invalidation tracking
 */
const NDVI_INVALIDATION_PREFIX = 'ndvi_invalidation';

// ============================================================================
// Types
// ============================================================================

/**
 * Temporal cache key components
 */
interface TemporalCacheKey {
  parcelleId: string;
  startDate: string; // ISO 8601 format (YYYY-MM-DD)
  endDate: string;   // ISO 8601 format (YYYY-MM-DD)
  interval: 'daily' | 'weekly' | 'monthly';
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

// ============================================================================
// RedisCacheService Class
// ============================================================================

/**
 * Service for Redis-based caching of satellite data
 */
export class RedisCacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  /**
   * Initialize Redis client connection
   * 
   * Attempts to connect to Redis using the REDIS_URL environment variable.
   * If Redis is not configured or connection fails, the service will operate
   * in fallback mode (no caching, always returns cache miss).
   * 
   * Connection is lazy - only established when first cache operation is attempted.
   */
  private async connect(): Promise<void> {
    // If already connected, return
    if (this.isConnected && this.client) {
      return;
    }

    // Check if Redis URL is configured
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('[Redis Cache] REDIS_URL not configured, caching disabled');
      return;
    }

    try {
      // Create Redis client
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          // Exponential backoff: 50ms, 100ms, 200ms, then give up
          if (times > 3) {
            console.error('[Redis Cache] Max retries reached, giving up');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 200);
          console.log(`[Redis Cache] Retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
      });

      // Set up error handler
      this.client.on('error', (error) => {
        console.error('[Redis Cache] Connection error:', error);
        this.isConnected = false;
        this.stats.errors++;
      });

      // Set up ready handler
      this.client.on('ready', () => {
        console.log('[Redis Cache] Connected successfully');
        this.isConnected = true;
      });

      // Attempt connection
      await this.client.connect();
    } catch (error) {
      console.error('[Redis Cache] Failed to connect:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key for temporal query
   * 
   * Format: `temporal:{parcelleId}:{startDate}:{endDate}:{interval}`
   * Example: `temporal:123e4567-e89b-12d3-a456-426614174000:2024-01-01:2024-12-31:monthly`
   * 
   * @param key - Cache key components
   * @returns Formatted cache key string
   */
  private generateTemporalKey(key: TemporalCacheKey): string {
    return `${TEMPORAL_KEY_PREFIX}:${key.parcelleId}:${key.startDate}:${key.endDate}:${key.interval}`;
  }

  /**
   * Generate invalidation key for parcelle NDVI updates
   * 
   * Format: `ndvi_invalidation:{parcelleId}`
   * This key tracks when NDVI data was last updated for a parcelle,
   * allowing us to invalidate all temporal caches for that parcelle.
   * 
   * @param parcelleId - Parcelle ID
   * @returns Invalidation key string
   */
  private generateInvalidationKey(parcelleId: string): string {
    return `${NDVI_INVALIDATION_PREFIX}:${parcelleId}`;
  }

  /**
   * Get cached temporal data
   * 
   * Retrieves cached temporal analysis data from Redis if available.
   * Returns null if:
   * - Redis is not connected
   * - Cache key does not exist (cache miss)
   * - Cached data has been invalidated
   * - An error occurs during retrieval
   * 
   * @param key - Cache key components
   * @returns Cached data object or null if not found
   */
  async getTemporalData(key: TemporalCacheKey): Promise<any | null> {
    try {
      // Ensure connection
      await this.connect();

      // If not connected, return cache miss
      if (!this.isConnected || !this.client) {
        this.stats.misses++;
        return null;
      }

      // Generate cache key
      const cacheKey = this.generateTemporalKey(key);

      // Retrieve from Redis
      const cachedData = await this.client.get(cacheKey);

      if (!cachedData) {
        // Cache miss
        this.stats.misses++;
        return null;
      }

      // Parse JSON data
      const data = JSON.parse(cachedData);

      // Check if data has been invalidated
      // Get the invalidation timestamp for this parcelle
      const invalidationKey = this.generateInvalidationKey(key.parcelleId);
      const invalidationTimestamp = await this.client.get(invalidationKey);

      if (invalidationTimestamp) {
        const invalidatedAt = parseInt(invalidationTimestamp, 10);
        const cachedAt = data.cachedAt || 0;

        // If data was cached before the invalidation, it's stale
        if (cachedAt < invalidatedAt) {
          console.log(`[Redis Cache] Cache invalidated for parcelle ${key.parcelleId}`);
          // Delete the stale cache entry
          await this.client.del(cacheKey);
          this.stats.misses++;
          return null;
        }
      }

      // Cache hit
      this.stats.hits++;
      console.log(`[Redis Cache] Cache hit for key: ${cacheKey}`);
      return data;
    } catch (error) {
      console.error('[Redis Cache] Error retrieving cached data:', error);
      this.stats.errors++;
      return null; // Graceful fallback
    }
  }

  /**
   * Set cached temporal data
   * 
   * Stores temporal analysis data in Redis with 24-hour TTL.
   * Adds a `cachedAt` timestamp to track when the data was cached,
   * which is used for invalidation checks.
   * 
   * @param key - Cache key components
   * @param data - Data to cache (will be JSON serialized)
   * @returns True if successfully cached, false otherwise
   */
  async setTemporalData(key: TemporalCacheKey, data: any): Promise<boolean> {
    try {
      // Ensure connection
      await this.connect();

      // If not connected, skip caching
      if (!this.isConnected || !this.client) {
        return false;
      }

      // Generate cache key
      const cacheKey = this.generateTemporalKey(key);

      // Add timestamp to track when data was cached
      const dataWithTimestamp = {
        ...data,
        cachedAt: Date.now(),
      };

      // Store in Redis with TTL
      await this.client.setex(
        cacheKey,
        TEMPORAL_CACHE_TTL,
        JSON.stringify(dataWithTimestamp)
      );

      console.log(`[Redis Cache] Cached data for key: ${cacheKey} (TTL: ${TEMPORAL_CACHE_TTL}s)`);
      return true;
    } catch (error) {
      console.error('[Redis Cache] Error caching data:', error);
      this.stats.errors++;
      return false; // Graceful fallback
    }
  }

  /**
   * Invalidate all temporal caches for a parcelle
   * 
   * This method is called when new NDVI data is calculated for a parcelle.
   * It sets an invalidation timestamp that will cause all cached temporal
   * queries for this parcelle to be considered stale.
   * 
   * The invalidation is done by setting a timestamp rather than deleting
   * individual cache keys, which is more efficient when there are many
   * cached queries for a parcelle.
   * 
   * @param parcelleId - Parcelle ID to invalidate caches for
   * @returns True if successfully invalidated, false otherwise
   */
  async invalidateParcelleCache(parcelleId: string): Promise<boolean> {
    try {
      // Ensure connection
      await this.connect();

      // If not connected, skip invalidation
      if (!this.isConnected || !this.client) {
        return false;
      }

      // Set invalidation timestamp
      const invalidationKey = this.generateInvalidationKey(parcelleId);
      const timestamp = Date.now().toString();

      // Store invalidation timestamp with 30-day TTL
      // (longer than temporal cache TTL to ensure proper invalidation)
      await this.client.setex(invalidationKey, 30 * 24 * 60 * 60, timestamp);

      console.log(`[Redis Cache] Invalidated cache for parcelle: ${parcelleId}`);
      return true;
    } catch (error) {
      console.error('[Redis Cache] Error invalidating cache:', error);
      this.stats.errors++;
      return false; // Graceful fallback
    }
  }

  /**
   * Clear all temporal caches (admin operation)
   * 
   * Deletes all cache keys with the temporal prefix.
   * Use with caution - this will clear all cached temporal data.
   * 
   * @returns Number of keys deleted
   */
  async clearAllTemporalCaches(): Promise<number> {
    try {
      // Ensure connection
      await this.connect();

      // If not connected, return 0
      if (!this.isConnected || !this.client) {
        return 0;
      }

      // Find all temporal cache keys
      const pattern = `${TEMPORAL_KEY_PREFIX}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        console.log('[Redis Cache] No temporal caches to clear');
        return 0;
      }

      // Delete all keys
      const deleted = await this.client.del(...keys);

      console.log(`[Redis Cache] Cleared ${deleted} temporal cache entries`);
      return deleted;
    } catch (error) {
      console.error('[Redis Cache] Error clearing caches:', error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Get cache statistics
   * 
   * Returns statistics about cache performance including:
   * - Total hits
   * - Total misses
   * - Total errors
   * - Hit rate (percentage)
   * 
   * @returns Cache statistics
   */
  getCacheStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      errors: this.stats.errors,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Reset cache statistics
   * 
   * Resets hit/miss/error counters to zero.
   * Useful for testing or periodic monitoring resets.
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
    };
  }

  /**
   * Check if Redis is connected and available
   * 
   * @returns True if connected, false otherwise
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Disconnect from Redis
   * 
   * Closes the Redis connection. Should be called during application shutdown.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      console.log('[Redis Cache] Disconnected');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of RedisCacheService
 * 
 * Use this instance throughout the application for consistent caching.
 */
export const redisCacheService = new RedisCacheService();
