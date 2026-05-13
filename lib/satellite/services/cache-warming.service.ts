/**
 * Cache Warming Service
 * 
 * This service provides background job functionality to pre-cache satellite imagery
 * and NDVI data for favorite parcelles. It runs daily at 2 AM to ensure fresh data
 * is available for frequently accessed parcelles.
 * 
 * Requirements: Task 6.2.4
 * - Create background job to pre-cache favorite parcelles
 * - Run job daily at 2 AM
 * - Pre-cache recent imagery and NDVI
 * - Pre-generate temporal data for last 3 months
 * 
 * Features:
 * - Identifies favorite parcelles (most recently accessed)
 * - Pre-caches latest imagery
 * - Pre-calculates NDVI for recent dates
 * - Pre-generates temporal analysis data
 * - Logs warming progress and statistics
 */

import { createClient } from '@supabase/supabase-js';
import { imageryService } from './imagery.service';
import { ndviService } from './ndvi.service';
import { redisCacheService } from './redis-cache.service';
import type { MultiPolygon } from 'geojson';

// ============================================================================
// Constants
// ============================================================================

/**
 * Number of favorite parcelles to warm (top N most recently accessed)
 */
const FAVORITE_PARCELLES_COUNT = 20;

/**
 * Number of days to look back for recent imagery
 */
const RECENT_IMAGERY_DAYS = 30;

/**
 * Number of months to pre-generate temporal data
 */
const TEMPORAL_DATA_MONTHS = 3;

/**
 * Maximum concurrent warming operations
 */
const MAX_CONCURRENT_OPERATIONS = 5;

// ============================================================================
// Types
// ============================================================================

/**
 * Cache warming result for a single parcelle
 */
export interface ParcelleWarmingResult {
  parcelleId: string;
  success: boolean;
  imageryCached: boolean;
  ndviCached: boolean;
  temporalDataGenerated: boolean;
  error?: string;
  duration: number; // milliseconds
}

/**
 * Overall cache warming job result
 */
export interface CacheWarmingJobResult {
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  totalParcelles: number;
  successCount: number;
  failureCount: number;
  results: ParcelleWarmingResult[];
  statistics: {
    imageryCached: number;
    ndviCached: number;
    temporalDataGenerated: number;
  };
}

/**
 * Favorite parcelle data
 */
interface FavoriteParcelle {
  id: string;
  geometry: MultiPolygon;
  lastAccessedAt: Date;
}

// ============================================================================
// CacheWarmingService Class
// ============================================================================

/**
 * Service for warming cache with frequently accessed parcelle data
 */
export class CacheWarmingService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    // Use service role key for background jobs (bypasses RLS)
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  /**
   * Run cache warming job
   * 
   * This is the main entry point for the cache warming job. It:
   * 1. Identifies favorite parcelles (most recently accessed)
   * 2. Pre-caches recent imagery for each parcelle
   * 3. Pre-calculates NDVI for recent dates
   * 4. Pre-generates temporal analysis data for last 3 months
   * 5. Returns detailed results and statistics
   * 
   * @returns Cache warming job result
   * 
   * @example
   * ```typescript
   * const service = new CacheWarmingService();
   * const result = await service.runCacheWarmingJob();
   * console.log(`Warmed ${result.successCount}/${result.totalParcelles} parcelles`);
   * console.log(`Duration: ${result.duration}ms`);
   * ```
   */
  async runCacheWarmingJob(): Promise<CacheWarmingJobResult> {
    const startTime = new Date();
    console.log(`[Cache Warming] Starting cache warming job at ${startTime.toISOString()}`);

    try {
      // Step 1: Identify favorite parcelles
      const favoriteParcelles = await this.getFavoriteParcelles();
      console.log(`[Cache Warming] Found ${favoriteParcelles.length} favorite parcelles to warm`);

      if (favoriteParcelles.length === 0) {
        const endTime = new Date();
        return {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          totalParcelles: 0,
          successCount: 0,
          failureCount: 0,
          results: [],
          statistics: {
            imageryCached: 0,
            ndviCached: 0,
            temporalDataGenerated: 0,
          },
        };
      }

      // Step 2: Warm cache for each parcelle (with concurrency control)
      const results = await this.warmParcelles(favoriteParcelles);

      // Step 3: Calculate statistics
      const endTime = new Date();
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const statistics = {
        imageryCached: results.filter(r => r.imageryCached).length,
        ndviCached: results.filter(r => r.ndviCached).length,
        temporalDataGenerated: results.filter(r => r.temporalDataGenerated).length,
      };

      const jobResult: CacheWarmingJobResult = {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        totalParcelles: favoriteParcelles.length,
        successCount,
        failureCount,
        results,
        statistics,
      };

      console.log(`[Cache Warming] Job completed in ${jobResult.duration}ms`);
      console.log(`[Cache Warming] Success: ${successCount}, Failures: ${failureCount}`);
      console.log(`[Cache Warming] Statistics:`, statistics);

      // Step 4: Log job result to database
      await this.logJobResult(jobResult);

      return jobResult;
    } catch (error) {
      console.error('[Cache Warming] Job failed:', error);
      const endTime = new Date();
      
      const errorResult: CacheWarmingJobResult = {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        totalParcelles: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        statistics: {
          imageryCached: 0,
          ndviCached: 0,
          temporalDataGenerated: 0,
        },
      };

      await this.logJobResult(errorResult);
      return errorResult;
    }
  }

  /**
   * Get favorite parcelles (most recently accessed)
   * 
   * Identifies parcelles that should be pre-cached based on recent access patterns.
   * Uses the satellite_cache_metadata table to find parcelles with recent cache access.
   * 
   * Strategy:
   * 1. Query satellite_cache_metadata for parcelles with recent last_accessed_at
   * 2. Group by parcelle_id and get the most recent access time
   * 3. Sort by access time descending
   * 4. Take top N parcelles (FAVORITE_PARCELLES_COUNT)
   * 5. Fetch full parcelle data including geometry
   * 
   * @returns Array of favorite parcelles with geometry
   */
  private async getFavoriteParcelles(): Promise<FavoriteParcelle[]> {
    try {
      // Query cache metadata to find recently accessed parcelles
      const { data: cacheData, error: cacheError } = await this.supabase
        .from('satellite_cache_metadata')
        .select('parcelle_id, last_accessed_at')
        .order('last_accessed_at', { ascending: false })
        .limit(FAVORITE_PARCELLES_COUNT * 2); // Get more than needed to account for duplicates

      if (cacheError) {
        console.error('[Cache Warming] Error fetching cache metadata:', cacheError);
        return [];
      }

      if (!cacheData || cacheData.length === 0) {
        console.log('[Cache Warming] No cache metadata found, using fallback strategy');
        return this.getFallbackParcelles();
      }

      // Group by parcelle_id and get most recent access time
      const parcelleAccessMap = new Map<string, Date>();
      const cacheEntries = cacheData as { parcelle_id: string; last_accessed_at: string }[];
      for (const entry of cacheEntries) {
        const parcelleId = entry.parcelle_id;
        const accessTime = new Date(entry.last_accessed_at);
        
        if (!parcelleAccessMap.has(parcelleId) || accessTime > parcelleAccessMap.get(parcelleId)!) {
          parcelleAccessMap.set(parcelleId, accessTime);
        }
      }

      // Sort by access time and take top N
      const sortedParcelles = Array.from(parcelleAccessMap.entries())
        .sort((a, b) => b[1].getTime() - a[1].getTime())
        .slice(0, FAVORITE_PARCELLES_COUNT)
        .map(([id]) => id);

      // Fetch full parcelle data including geometry
      const { data: parcellesData, error: parcellesError } = await this.supabase
        .from('parcelles')
        .select('id, geometry')
        .in('id', sortedParcelles);

      if (parcellesError) {
        console.error('[Cache Warming] Error fetching parcelles:', parcellesError);
        return [];
      }

      if (!parcellesData || parcellesData.length === 0) {
        return [];
      }

      // Map to FavoriteParcelle objects
      const parcelleRows = parcellesData as { id: string; geometry: unknown }[];
      const favoriteParcelles: FavoriteParcelle[] = parcelleRows.map(p => ({
        id: p.id,
        geometry: p.geometry as MultiPolygon,
        lastAccessedAt: parcelleAccessMap.get(p.id) || new Date(),
      }));

      return favoriteParcelles;
    } catch (error) {
      console.error('[Cache Warming] Error getting favorite parcelles:', error);
      return [];
    }
  }

  /**
   * Get fallback parcelles when no cache metadata is available
   * 
   * Uses a simple strategy to select parcelles for warming:
   * - Select recently created parcelles
   * - Limit to FAVORITE_PARCELLES_COUNT
   * 
   * @returns Array of parcelles
   */
  private async getFallbackParcelles(): Promise<FavoriteParcelle[]> {
    try {
      const { data, error } = await this.supabase
        .from('parcelles')
        .select('id, geometry, created_at')
        .order('created_at', { ascending: false })
        .limit(FAVORITE_PARCELLES_COUNT);

      if (error || !data) {
        console.error('[Cache Warming] Error fetching fallback parcelles:', error);
        return [];
      }

      const fallbackRows = data as { id: string; geometry: unknown; created_at: string }[];
      return fallbackRows.map(p => ({
        id: p.id,
        geometry: p.geometry as MultiPolygon,
        lastAccessedAt: new Date(p.created_at),
      }));
    } catch (error) {
      console.error('[Cache Warming] Error getting fallback parcelles:', error);
      return [];
    }
  }

  /**
   * Warm cache for multiple parcelles with concurrency control
   * 
   * Processes parcelles in batches to avoid overwhelming the system.
   * Uses Promise.allSettled to ensure all parcelles are processed even if some fail.
   * 
   * @param parcelles - Array of parcelles to warm
   * @returns Array of warming results
   */
  private async warmParcelles(
    parcelles: FavoriteParcelle[]
  ): Promise<ParcelleWarmingResult[]> {
    const results: ParcelleWarmingResult[] = [];

    // Process in batches to control concurrency
    for (let i = 0; i < parcelles.length; i += MAX_CONCURRENT_OPERATIONS) {
      const batch = parcelles.slice(i, i + MAX_CONCURRENT_OPERATIONS);
      console.log(`[Cache Warming] Processing batch ${Math.floor(i / MAX_CONCURRENT_OPERATIONS) + 1}/${Math.ceil(parcelles.length / MAX_CONCURRENT_OPERATIONS)}`);

      const batchPromises = batch.map(parcelle => this.warmParcelle(parcelle));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle rejected promise
          console.error('[Cache Warming] Batch operation failed:', result.reason);
          results.push({
            parcelleId: 'unknown',
            success: false,
            imageryCached: false,
            ndviCached: false,
            temporalDataGenerated: false,
            error: result.reason?.message || 'Unknown error',
            duration: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Warm cache for a single parcelle
   * 
   * Performs the following operations:
   * 1. Pre-cache recent imagery (last 30 days)
   * 2. Pre-calculate NDVI for recent dates
   * 3. Pre-generate temporal data for last 3 months
   * 
   * @param parcelle - Parcelle to warm
   * @returns Warming result
   */
  private async warmParcelle(
    parcelle: FavoriteParcelle
  ): Promise<ParcelleWarmingResult> {
    const startTime = Date.now();
    console.log(`[Cache Warming] Warming parcelle ${parcelle.id}`);

    const result: ParcelleWarmingResult = {
      parcelleId: parcelle.id,
      success: false,
      imageryCached: false,
      ndviCached: false,
      temporalDataGenerated: false,
      duration: 0,
    };

    try {
      // Step 1: Pre-cache recent imagery
      result.imageryCached = await this.cacheRecentImagery(parcelle);

      // Step 2: Pre-calculate NDVI
      result.ndviCached = await this.cacheRecentNDVI(parcelle);

      // Step 3: Pre-generate temporal data
      result.temporalDataGenerated = await this.generateTemporalData(parcelle);

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(`[Cache Warming] Successfully warmed parcelle ${parcelle.id} in ${result.duration}ms`);
    } catch (error) {
      result.error = (error as Error).message;
      result.duration = Date.now() - startTime;
      console.error(`[Cache Warming] Failed to warm parcelle ${parcelle.id}:`, error);
    }

    return result;
  }

  /**
   * Cache recent imagery for a parcelle
   * 
   * Retrieves and caches the most recent cloud-free imagery within the last 30 days.
   * 
   * @param parcelle - Parcelle to cache imagery for
   * @returns True if imagery was successfully cached
   */
  private async cacheRecentImagery(parcelle: FavoriteParcelle): Promise<boolean> {
    try {
      const today = new Date();
      
      // Try to get imagery from the last 30 days
      const imagery = await imageryService.getImagery(
        parcelle.id,
        parcelle.geometry,
        today,
        20 // 20% cloud cover threshold
      );

      if (imagery) {
        console.log(`[Cache Warming] Cached imagery for parcelle ${parcelle.id}, date: ${imagery.acquisitionDate.toISOString()}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[Cache Warming] Failed to cache imagery for parcelle ${parcelle.id}:`, error);
      return false;
    }
  }

  /**
   * Cache recent NDVI calculations for a parcelle
   * 
   * Calculates and caches NDVI for the most recent available date.
   * 
   * @param parcelle - Parcelle to cache NDVI for
   * @returns True if NDVI was successfully cached
   */
  private async cacheRecentNDVI(parcelle: FavoriteParcelle): Promise<boolean> {
    try {
      const today = new Date();
      
      // Calculate NDVI for today (will use most recent available imagery)
      const ndviResult = await ndviService.calculateNDVI(
        parcelle.id,
        parcelle.geometry,
        today,
        {
          forceRecalculate: false, // Use cache if available
          storeResult: true,
          generateRaster: false, // Skip raster generation for warming
        }
      );

      if (ndviResult) {
        console.log(`[Cache Warming] Cached NDVI for parcelle ${parcelle.id}, mean: ${ndviResult.meanNDVI.toFixed(3)}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[Cache Warming] Failed to cache NDVI for parcelle ${parcelle.id}:`, error);
      return false;
    }
  }

  /**
   * Generate and cache temporal data for a parcelle
   * 
   * Pre-generates temporal analysis data for the last 3 months.
   * This involves querying NDVI results and caching the temporal timeline in Redis.
   * 
   * @param parcelle - Parcelle to generate temporal data for
   * @returns True if temporal data was successfully generated
   */
  private async generateTemporalData(parcelle: FavoriteParcelle): Promise<boolean> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - TEMPORAL_DATA_MONTHS);

      // Query NDVI results for the time period
      const { data, error } = await this.supabase
        .from('ndvi_results')
        .select('calculation_date, mean_ndvi, health_status')
        .eq('parcelle_id', parcelle.id)
        .gte('calculation_date', startDate.toISOString())
        .lte('calculation_date', endDate.toISOString())
        .order('calculation_date', { ascending: true });

      if (error) {
        console.error(`[Cache Warming] Error querying NDVI results for parcelle ${parcelle.id}:`, error);
        return false;
      }

      if (!data || data.length === 0) {
        console.log(`[Cache Warming] No temporal data available for parcelle ${parcelle.id}`);
        return false;
      }

      // Cache temporal data in Redis
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const ndviRows = data as { calculation_date: string; mean_ndvi: number; health_status: string }[];
      const temporalData = {
        parcelleId: parcelle.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval: 'monthly',
        dataPoints: ndviRows.map(d => ({
          date: d.calculation_date,
          ndvi: d.mean_ndvi,
          healthStatus: d.health_status,
        })),
        cachedAt: new Date().toISOString(),
      };

      await redisCacheService.setTemporalData(
        { parcelleId: parcelle.id, startDate: startDateStr, endDate: endDateStr, interval: 'monthly' },
        temporalData
      );

      console.log(`[Cache Warming] Generated temporal data for parcelle ${parcelle.id}, ${data.length} data points`);
      return true;
    } catch (error) {
      console.error(`[Cache Warming] Failed to generate temporal data for parcelle ${parcelle.id}:`, error);
      return false;
    }
  }

  /**
   * Log cache warming job result to database
   * 
   * Stores job execution details in the satellite_audit_logs table for monitoring.
   * 
   * @param result - Job result to log
   */
  private async logJobResult(result: CacheWarmingJobResult): Promise<void> {
    try {
      const { error } = await (this.supabase
        .from('satellite_audit_logs') as any)
        .insert({
          user_id: null, // System job, no user
          parcelle_id: null, // Job affects multiple parcelles
          event_type: 'cache_warming',
          event_data: {
            duration: result.duration,
            totalParcelles: result.totalParcelles,
            successCount: result.successCount,
            failureCount: result.failureCount,
            statistics: result.statistics,
          },
          created_at: result.endTime.toISOString(),
        });

      if (error) {
        console.error('[Cache Warming] Failed to log job result:', error);
      }
    } catch (error) {
      console.error('[Cache Warming] Failed to log job result:', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of CacheWarmingService
 */
let cacheWarmingServiceInstance: CacheWarmingService | null = null;

export const getCacheWarmingService = (): CacheWarmingService => {
  if (!cacheWarmingServiceInstance) {
    cacheWarmingServiceInstance = new CacheWarmingService();
  }
  return cacheWarmingServiceInstance;
};

/**
 * Export service instance for direct use
 * Note: Use getCacheWarmingService() for lazy initialization to avoid
 * instantiating at module load time (which fails during build without env vars)
 */
export const cacheWarmingService = {
  runCacheWarmingJob: (...args: Parameters<CacheWarmingService['runCacheWarmingJob']>) =>
    getCacheWarmingService().runCacheWarmingJob(...args),
};
