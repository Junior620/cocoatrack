/**
 * NDVI Service
 * 
 * This service provides methods to calculate NDVI (Normalized Difference Vegetation Index)
 * from Sentinel-2 satellite imagery. NDVI is calculated using the formula:
 * 
 *   NDVI = (NIR - Red) / (NIR + Red)
 * 
 * Where:
 * - NIR = Near-Infrared band (Sentinel-2 Band 8)
 * - Red = Red band (Sentinel-2 Band 4)
 * 
 * NDVI values range from -1 to +1:
 * - Values near +1 indicate dense, healthy vegetation
 * - Values near 0 indicate bare soil or rock
 * - Negative values typically indicate water
 * 
 * Requirements: Task 2.1.1
 * - Calculate NDVI using the standard formula
 * - Retrieve Sentinel-2 bands B4 (Red) and B8 (NIR) from ImageryService
 * - Calculate pixel-wise NDVI values
 * - Handle edge cases (division by zero when NIR + Red = 0)
 */

import type { MultiPolygon } from 'geojson';
import {
  NDVIResult,
  HealthStatus,
  BandData,
  NDVICalculationError,
  InsufficientDataError,
} from '../types';
import { imageryService } from './imagery.service';
import { mockImageryService, shouldUseMockImagery } from './imagery.service.mock';
import { rasterGeneratorService } from './raster-generator.service';
import { storageService } from './storage.service';
import { redisCacheService } from './redis-cache.service';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum number of valid pixels required for NDVI calculation
 * This ensures we have sufficient data for meaningful statistics
 */
const MIN_PIXEL_COUNT = 10;

/**
 * Sentinel-2 band names for NDVI calculation
 */
const NDVI_BANDS = {
  RED: 'B4',
  NIR: 'B8',
} as const;

/**
 * Health status thresholds based on mean NDVI values
 * Adjusted for cocoa (cacao) cultivation
 * 
 * Cocoa trees grow under shade (agroforestry) and have lower NDVI than full-sun crops
 * These thresholds are calibrated for cocoa-specific vegetation characteristics
 */
const HEALTH_STATUS_THRESHOLDS = {
  EXCELLENT: 0.65,  // 0.65 - 1.0 (Cacaoyers très vigoureux, ombrage optimal)
  GOOD: 0.55,       // 0.55 - 0.65 (Cacaoyers sains, bon développement foliaire)
  FAIR: 0.45,       // 0.45 - 0.55 (Santé acceptable, surveillance recommandée)
  POOR: 0.30,       // 0.30 - 0.45 (Stress hydrique ou nutritionnel probable)
  CRITICAL: 0.0,    // 0.0 - 0.30 (Défoliation sévère, intervention urgente)
} as const;

/**
 * Small epsilon value to prevent division by zero
 * When NIR + Red is less than this value, NDVI is set to 0
 */
const EPSILON = 1e-10;

// ============================================================================
// Types
// ============================================================================

/**
 * NDVI calculation options
 */
interface NDVICalculationOptions {
  /**
   * Whether to force recalculation even if cached result exists
   */
  forceRecalculate?: boolean;

  /**
   * Whether to store the result in the database
   */
  storeResult?: boolean;

  /**
   * Whether to generate and store NDVI raster image
   */
  generateRaster?: boolean;
}

/**
 * NDVI statistics calculated from pixel values
 */
interface NDVIStatistics {
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  validPixelCount: number;
}

// ============================================================================
// NDVIService Class
// ============================================================================

/**
 * Service for calculating NDVI from satellite imagery
 */
export class NDVIService {
  /**
   * Calculate NDVI for a parcelle
   * 
   * This method:
   * 1. Checks cache for existing NDVI result (unless forceRecalculate is true)
   * 2. If cached and fresh (< 24 hours), returns cached result
   * 3. Otherwise, retrieves Sentinel-2 bands B4 (Red) and B8 (NIR) from ImageryService
   * 4. Calculates pixel-wise NDVI values using the formula (NIR - Red) / (NIR + Red)
   * 5. Computes statistics (mean, min, max, standard deviation)
   * 6. Determines health status based on mean NDVI
   * 7. Stores result in database cache (if storeResult is true)
   * 8. Returns the complete NDVI result
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry (MultiPolygon)
   * @param date - Target date for NDVI calculation (defaults to current date)
   * @param options - Calculation options
   * @returns NDVI result with statistics and health status
   * @throws {NDVICalculationError} If NDVI calculation fails
   * @throws {InsufficientDataError} If insufficient valid pixels are available
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const result = await service.calculateNDVI(
   *   'parcelle-123',
   *   parcelleGeometry,
   *   new Date('2024-01-15')
   * );
   * console.log('Mean NDVI:', result.meanNDVI);
   * console.log('Health Status:', result.healthStatus);
   * ```
   */
  async calculateNDVI(
    parcelleId: string,
    geometry: MultiPolygon,
    date: Date = new Date(),
    options: NDVICalculationOptions = {}
  ): Promise<NDVIResult> {
    const {
      forceRecalculate = false,
      storeResult = true,
      generateRaster = false,
    } = options;

    try {
      // Step 1: Check cache unless force recalculate is requested
      if (!forceRecalculate) {
        const cachedResult = await this.getCachedNDVI(parcelleId, date);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Step 2: Retrieve Sentinel-2 bands B4 (Red) and B8 (NIR)
      const bandData = await this.retrieveBands(geometry, date);

      // Step 3: Calculate pixel-wise NDVI values (OPTIMIZED: uses Web Worker)
      const ndviValues = await this.calculatePixelWiseNDVI(
        bandData.red,
        bandData.nir
      );

      // Step 4: Validate we have sufficient data
      const validPixelCount = ndviValues.filter(v => !isNaN(v)).length;
      if (validPixelCount < MIN_PIXEL_COUNT) {
        throw new InsufficientDataError(
          `Insufficient valid pixels for NDVI calculation. Required: ${MIN_PIXEL_COUNT}, Available: ${validPixelCount}`,
          MIN_PIXEL_COUNT,
          validPixelCount
        );
      }

      // Step 5: Calculate statistics (OPTIMIZED: already calculated by worker if available)
      // If we used the worker, statistics are already calculated
      // Otherwise, calculate them here
      let statistics: NDVIStatistics;
      try {
        const { ndviWorkerManager } = await import('../workers/ndvi-worker-manager');
        // Statistics were already calculated by the worker
        // We need to recalculate them here since we only get ndviValues
        statistics = this.calculateStatistics(ndviValues);
      } catch {
        // Fallback: calculate statistics synchronously
        statistics = this.calculateStatistics(ndviValues);
      }

      // Step 6: Determine health status
      const healthStatus = this.calculateHealthStatus(statistics.mean);

      // Step 7: Generate raster if requested
      let ndviRasterUrl: string | null = null;
      if (generateRaster) {
        try {
          // Reshape NDVI values back to 2D array matching band dimensions
          const dataHeight = bandData.red.length;
          const dataWidth = bandData.red[0].length;
          const ndviGrid: number[][] = [];
          
          let idx = 0;
          for (let row = 0; row < dataHeight; row++) {
            const rowData: number[] = [];
            for (let col = 0; col < dataWidth; col++) {
              rowData.push(ndviValues[idx++] || NaN);
            }
            ndviGrid.push(rowData);
          }

          // Generate raster image from NDVI values
          const raster = await rasterGeneratorService.generateRaster(
            ndviGrid,
            geometry,
            {
              width: 512,
              height: 512,
              format: 'png',
              transparentNaN: true,
            }
          );

          // Upload raster to storage
          const uploadResult = await storageService.uploadNDVIRaster(
            parcelleId,
            date,
            raster.buffer
          );

          ndviRasterUrl = uploadResult.publicUrl;
          
          console.log(`[NDVI Service] Generated and uploaded raster: ${ndviRasterUrl}`);
        } catch (error) {
          // Log error but don't fail the entire calculation
          console.error('[NDVI Service] Failed to generate/upload raster:', error);
          // Continue without raster
        }
      }

      // Step 8: Create NDVI result
      const ndviResult: NDVIResult = {
        id: `ndvi-${parcelleId}-${date.getTime()}`,
        parcelleId,
        imageryId: null, // Will be set if imagery is stored in database
        calculationDate: date,
        meanNDVI: statistics.mean,
        minNDVI: statistics.min,
        maxNDVI: statistics.max,
        stdDevNDVI: statistics.stdDev,
        healthStatus,
        ndviRasterUrl,
        createdAt: new Date(),
      };

      // Step 9: Store result in cache if requested
      if (storeResult) {
        await this.cacheNDVI(ndviResult);
        
        // Invalidate Redis temporal cache for this parcelle
        // This ensures that any cached temporal queries will be refreshed
        // with the new NDVI data on the next request
        await redisCacheService.invalidateParcelleCache(parcelleId);
        console.log(`[NDVI Service] Invalidated temporal cache for parcelle ${parcelleId}`);
      }

      return ndviResult;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NDVICalculationError ||
        error instanceof InsufficientDataError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NDVICalculationError(
        `Failed to calculate NDVI for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Retrieve Sentinel-2 bands B4 (Red) and B8 (NIR) from ImageryService
   * 
   * @param geometry - Parcelle geometry
   * @param date - Target date
   * @returns Band data with Red and NIR bands
   * @throws {NDVICalculationError} If band retrieval fails
   */
  private async retrieveBands(
    geometry: MultiPolygon,
    date: Date
  ): Promise<BandData> {
    try {
      // Use mock service if enabled, otherwise use real service
      const service = shouldUseMockImagery() ? mockImageryService : imageryService;
      
      if (shouldUseMockImagery()) {
        console.log('[NDVI Service] Using mock imagery service for development');
      }

      // Request both Red (B4) and NIR (B8) bands
      const bands = [NDVI_BANDS.RED, NDVI_BANDS.NIR];
      const bandData = await service.getBands(geometry, date, bands);

      // Validate band data
      if (!bandData.red || !bandData.nir) {
        throw new NDVICalculationError(
          'Band data is missing Red or NIR bands',
          undefined,
          'Missing required bands'
        );
      }

      if (bandData.red.length === 0 || bandData.nir.length === 0) {
        throw new NDVICalculationError(
          'Band data arrays are empty',
          undefined,
          'Empty band data'
        );
      }

      // Validate dimensions match
      if (bandData.red.length !== bandData.nir.length) {
        throw new NDVICalculationError(
          'Red and NIR band dimensions do not match',
          undefined,
          'Dimension mismatch'
        );
      }

      return bandData;
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to retrieve bands: ${(error as Error).message}`,
        undefined,
        'Band retrieval failed'
      );
    }
  }

  /**
   * Calculate pixel-wise NDVI values from Red and NIR bands
   * 
   * OPTIMIZED VERSION (Task 6.4.2):
   * - Uses Web Worker for heavy calculations (non-blocking)
   * - Falls back to optimized synchronous calculation if workers unavailable
   * - Implements batching for multiple concurrent calculations
   * 
   * Applies the NDVI formula to each pixel:
   *   NDVI = (NIR - Red) / (NIR + Red)
   * 
   * Handles edge cases:
   * - Division by zero: When NIR + Red ≈ 0, NDVI is set to 0
   * - Invalid values: NaN values are preserved for filtering
   * 
   * @param redBand - Red band pixel values (2D array)
   * @param nirBand - NIR band pixel values (2D array)
   * @returns Promise resolving to flattened array of NDVI values
   * 
   * @example
   * ```typescript
   * const red = [[100, 150], [200, 250]];
   * const nir = [[300, 350], [400, 450]];
   * const ndvi = await service.calculatePixelWiseNDVI(red, nir);
   * // Returns: [0.5, 0.4, 0.333, 0.286]
   * ```
   */
  private async calculatePixelWiseNDVI(
    redBand: number[][],
    nirBand: number[][]
  ): Promise<number[]> {
    // Use Web Worker for calculation (optimized, non-blocking)
    try {
      const { ndviWorkerManager } = await import('../workers/ndvi-worker-manager');
      const result = await ndviWorkerManager.calculateNDVI(redBand, nirBand);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.ndviValues;
    } catch (error) {
      // Fallback to synchronous calculation if worker fails
      console.warn('[NDVI Service] Worker calculation failed, using fallback:', error);
      return this.calculatePixelWiseNDVISync(redBand, nirBand);
    }
  }

  /**
   * Synchronous fallback for pixel-wise NDVI calculation
   * 
   * Used when Web Workers are unavailable or fail.
   * 
   * @param redBand - Red band pixel values (2D array)
   * @param nirBand - NIR band pixel values (2D array)
   * @returns Flattened array of NDVI values
   */
  private calculatePixelWiseNDVISync(
    redBand: number[][],
    nirBand: number[][]
  ): number[] {
    const ndviValues: number[] = [];

    // Iterate through each row
    for (let row = 0; row < redBand.length; row++) {
      const redRow = redBand[row];
      const nirRow = nirBand[row];

      // Validate row dimensions match
      if (!redRow || !nirRow || redRow.length !== nirRow.length) {
        continue; // Skip invalid rows
      }

      // Iterate through each pixel in the row
      for (let col = 0; col < redRow.length; col++) {
        const red = redRow[col];
        const nir = nirRow[col];

        // Calculate NDVI for this pixel
        const ndvi = this.calculatePixelNDVI(nir, red);
        ndviValues.push(ndvi);
      }
    }

    return ndviValues;
  }

  /**
   * Calculate NDVI for a single pixel
   * 
   * Applies the NDVI formula: (NIR - Red) / (NIR + Red)
   * 
   * Edge case handling:
   * - If NIR + Red ≈ 0 (less than EPSILON), returns 0 to avoid division by zero
   * - If either NIR or Red is NaN, returns NaN
   * - Clamps result to [-1, 1] range (though formula should naturally produce this)
   * 
   * @param nir - Near-Infrared value
   * @param red - Red value
   * @returns NDVI value in range [-1, 1], or NaN if inputs are invalid
   */
  private calculatePixelNDVI(nir: number, red: number): number {
    // Handle invalid inputs
    if (isNaN(nir) || isNaN(red)) {
      return NaN;
    }

    // Calculate denominator
    const denominator = nir + red;

    // Handle division by zero edge case
    // When NIR + Red ≈ 0, the pixel likely has no reflectance (shadow, water, etc.)
    // We return 0 as a safe default
    if (Math.abs(denominator) < EPSILON) {
      return 0;
    }

    // Calculate NDVI using the standard formula
    const ndvi = (nir - red) / denominator;

    // Clamp to valid range [-1, 1] as a safety measure
    // (The formula should naturally produce values in this range)
    return Math.max(-1, Math.min(1, ndvi));
  }

  /**
   * Calculate statistics from NDVI pixel values
   * 
   * Computes:
   * - Mean (average) NDVI
   * - Minimum NDVI
   * - Maximum NDVI
   * - Standard deviation
   * - Count of valid pixels (non-NaN)
   * 
   * @param ndviValues - Array of NDVI values (may contain NaN)
   * @returns NDVI statistics
   * @throws {InsufficientDataError} If no valid pixels are found
   */
  private calculateStatistics(ndviValues: number[]): NDVIStatistics {
    // Filter out NaN values
    const validValues = ndviValues.filter(v => !isNaN(v));

    if (validValues.length === 0) {
      throw new InsufficientDataError(
        'No valid NDVI values found',
        MIN_PIXEL_COUNT,
        0
      );
    }

    // Calculate mean
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / validValues.length;

    // Calculate min and max
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    // Calculate standard deviation
    const squaredDiffs = validValues.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / validValues.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      min,
      max,
      stdDev,
      validPixelCount: validValues.length,
    };
  }

  /**
   * Calculate health status from mean NDVI value
   * 
   * Maps NDVI values to health status categories (calibrated for cocoa):
   * - Excellent: 0.65 - 1.0 (Cacaoyers très vigoureux, ombrage optimal)
   * - Good: 0.55 - 0.65 (Cacaoyers sains, bon développement foliaire)
   * - Fair: 0.45 - 0.55 (Santé acceptable, surveillance recommandée)
   * - Poor: 0.30 - 0.45 (Stress hydrique ou nutritionnel probable)
   * - Critical: 0.0 - 0.30 (Défoliation sévère, intervention urgente)
   * 
   * @param meanNDVI - Mean NDVI value
   * @returns Health status category
   * 
   * @example
   * ```typescript
   * calculateHealthStatus(0.70) // Returns: 'excellent'
   * calculateHealthStatus(0.60) // Returns: 'good'
   * calculateHealthStatus(0.50) // Returns: 'fair'
   * calculateHealthStatus(0.35) // Returns: 'poor'
   * calculateHealthStatus(0.25) // Returns: 'critical'
   * ```
   */
  calculateHealthStatus(meanNDVI: number): HealthStatus {
    if (meanNDVI >= HEALTH_STATUS_THRESHOLDS.EXCELLENT) {
      return 'excellent';
    } else if (meanNDVI >= HEALTH_STATUS_THRESHOLDS.GOOD) {
      return 'good';
    } else if (meanNDVI >= HEALTH_STATUS_THRESHOLDS.FAIR) {
      return 'fair';
    } else if (meanNDVI >= HEALTH_STATUS_THRESHOLDS.POOR) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  /**
   * Calculate health status trend from a chronological series of statuses
   * 
   * Analyzes a time series of health status values to determine if the trend
   * is improving, declining, or stable.
   * 
   * @param statuses - Array of health status values in chronological order
   * @returns 'improving' if trend is positive, 'declining' if negative, 'stable' otherwise
   * 
   * @example
   * ```typescript
   * calculateHealthStatusTrend(['poor', 'fair', 'good']) // Returns: 'improving'
   * calculateHealthStatusTrend(['excellent', 'good', 'fair']) // Returns: 'declining'
   * calculateHealthStatusTrend(['good', 'good', 'good']) // Returns: 'stable'
   * ```
   */
  calculateHealthStatusTrend(statuses: HealthStatus[]): 'improving' | 'declining' | 'stable' {
    if (statuses.length === 0 || statuses.length === 1) {
      return 'stable';
    }

    // Define status ordering (lower index = worse status)
    const statusOrder: HealthStatus[] = ['critical', 'poor', 'fair', 'good', 'excellent'];
    
    const oldestStatus = statuses[0];
    const mostRecentStatus = statuses[statuses.length - 1];
    
    const oldestIndex = statusOrder.indexOf(oldestStatus);
    const mostRecentIndex = statusOrder.indexOf(mostRecentStatus);
    
    if (mostRecentIndex > oldestIndex) {
      return 'improving';
    } else if (mostRecentIndex < oldestIndex) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * Get health status recommendation based on current status
   * 
   * Provides actionable recommendations based on the health status level.
   * 
   * @param status - Current health status
   * @returns Recommendation string appropriate for the status level
   * 
   * @example
   * ```typescript
   * getHealthStatusRecommendation('critical') // Returns: "Immediate intervention required..."
   * getHealthStatusRecommendation('excellent') // Returns: "Continue current maintenance practices..."
   * ```
   */
  getHealthStatusRecommendation(status: HealthStatus): string {
    switch (status) {
      case 'critical':
        return 'Immediate intervention required. Investigate potential issues such as disease, pest infestation, water stress, or nutrient deficiency. Consider soil testing and expert consultation.';
      case 'poor':
        return 'Action needed. Monitor closely and implement corrective measures. Check irrigation, fertilization, and pest control practices. Consider targeted interventions.';
      case 'fair':
        return 'Monitoring recommended. Health is below optimal levels. Review management practices and consider adjustments to irrigation, fertilization, or pest control.';
      case 'good':
        return 'Continue current maintenance practices. Health is good but monitor for any changes. Maintain regular irrigation and fertilization schedules.';
      case 'excellent':
        return 'Continue current maintenance practices. Vegetation health is optimal. Maintain existing management strategies and monitor regularly.';
      default:
        return 'Status unknown. Unable to provide recommendation.';
    }
  }

  /**
   * Calculate health status distribution from a collection of statuses
   * 
   * Aggregates health status values to count the number of parcelles in each category.
   * 
   * @param statuses - Array of health status values
   * @returns Object with counts for each status category
   * 
   * @example
   * ```typescript
   * calculateHealthStatusDistribution(['excellent', 'good', 'excellent'])
   * // Returns: { excellent: 2, good: 1, fair: 0, poor: 0, critical: 0 }
   * ```
   */
  calculateHealthStatusDistribution(statuses: HealthStatus[]): {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
  } {
    const distribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
    };

    for (const status of statuses) {
      if (status in distribution) {
        distribution[status]++;
      }
    }

    return distribution;
  }

  /**
   * Get cached NDVI result from database
   * 
   * Retrieves a previously calculated NDVI result from cache.
   * Implements two-level caching:
   * 1. Redis cache (fast, 24-hour TTL)
   * 2. Database cache (persistent, 24-hour freshness check)
   * 
   * The calculation_date is normalized to midnight UTC to ensure consistent
   * cache lookups for the same date regardless of time.
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Target date for NDVI calculation
   * @param supabase - Optional Supabase client (if not provided, creates a new one)
   * @returns Cached NDVI result if found and fresh, null otherwise
   * @throws {NDVICalculationError} If cache retrieval fails
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const cached = await service.getCachedNDVI('parcelle-123', new Date('2024-01-15'));
   * if (cached) {
   *   console.log('Using cached NDVI:', cached.meanNDVI);
   * } else {
   *   console.log('Cache miss, need to calculate');
   * }
   * ```
   */
  async getCachedNDVI(
    parcelleId: string,
    date: Date,
    supabase?: any
  ): Promise<NDVIResult | null> {
    try {
      // Normalize date to midnight UTC for consistent cache lookups
      const normalizedDate = new Date(date);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      const dateKey = normalizedDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Level 1: Check Redis cache first (fastest)
      const cachedFromRedis = await redisCacheService.getNDVIData(parcelleId, dateKey);
      
      if (cachedFromRedis) {
        console.log(`[NDVI Service] Redis cache hit for parcelle ${parcelleId}, date ${dateKey}`);
        
        // Remove the cachedAt timestamp before returning
        const { cachedAt, ...ndviResult } = cachedFromRedis;
        
        // Convert date strings back to Date objects
        return {
          ...ndviResult,
          calculationDate: new Date(ndviResult.calculationDate),
          createdAt: new Date(ndviResult.createdAt),
        };
      }

      console.log(`[NDVI Service] Redis cache miss for parcelle ${parcelleId}, date ${dateKey}, checking database`);

      // Level 2: Check database cache (slower but persistent)
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Query database for cached NDVI result
      const { data, error } = await client
        .from('ndvi_results')
        .select('*')
        .eq('parcelle_id', parcelleId)
        .eq('calculation_date', normalizedDate.toISOString())
        .single();

      if (error) {
        // If no rows found, return null (cache miss)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Check cache TTL (24 hours)
      const cacheAge = Date.now() - new Date(data.created_at).getTime();
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (cacheAge > CACHE_TTL_MS) {
        // Cache is stale, return null to trigger recalculation
        return null;
      }

      // Convert database row to NDVIResult
      const ndviResult: NDVIResult = {
        id: data.id,
        parcelleId: data.parcelle_id,
        imageryId: data.imagery_id,
        calculationDate: new Date(data.calculation_date),
        meanNDVI: Number(data.mean_ndvi),
        minNDVI: Number(data.min_ndvi),
        maxNDVI: Number(data.max_ndvi),
        stdDevNDVI: Number(data.std_dev_ndvi),
        healthStatus: data.health_status as HealthStatus,
        ndviRasterUrl: data.ndvi_raster_url,
        createdAt: new Date(data.created_at),
      };

      // Cache in Redis for faster future access
      await redisCacheService.setNDVIData(parcelleId, dateKey, ndviResult);
      console.log(`[NDVI Service] Cached NDVI in Redis for parcelle ${parcelleId}, date ${dateKey}`);

      return ndviResult;
    } catch (error) {
      // Log error but don't throw - cache retrieval failure should not block calculation
      console.error('Failed to retrieve cached NDVI:', {
        message: (error as Error).message,
        details: (error as Error).stack,
        hint: 'Check Supabase connection and RLS policies',
        code: (error as any).code || '',
      });
      return null;
    }
  }

  /**
   * Store NDVI result in cache
   * 
   * Stores a calculated NDVI result in both Redis and database caches.
   * Uses UPSERT logic (INSERT ... ON CONFLICT DO UPDATE) to handle cases
   * where a result already exists for the same parcelle and date.
   * 
   * The calculation_date is normalized to midnight UTC to ensure consistent
   * cache storage and retrieval.
   * 
   * @param ndviResult - NDVI result to cache
   * @param supabase - Optional Supabase client (if not provided, creates a new one with service role)
   * @throws {NDVICalculationError} If cache storage fails
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const result = await service.calculateNDVI('parcelle-123', geometry, new Date());
   * await service.cacheNDVI(result);
   * console.log('NDVI result cached successfully');
   * ```
   */
  async cacheNDVI(ndviResult: NDVIResult, supabase?: any): Promise<void> {
    try {
      // Normalize date to midnight UTC for consistent cache storage
      const normalizedDate = new Date(ndviResult.calculationDate);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      const dateKey = normalizedDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Cache in Redis first (fast cache)
      await redisCacheService.setNDVIData(ndviResult.parcelleId, dateKey, ndviResult);
      console.log(`[NDVI Service] Cached NDVI in Redis for parcelle ${ndviResult.parcelleId}, date ${dateKey}`);

      // Then cache in database (persistent cache)
      // Use provided client or create a new one with SERVICE ROLE KEY to bypass RLS
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key to bypass RLS for caching operations
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }
        
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Prepare database row
      const row = {
        parcelle_id: ndviResult.parcelleId,
        imagery_id: ndviResult.imageryId,
        calculation_date: normalizedDate.toISOString(),
        mean_ndvi: ndviResult.meanNDVI,
        min_ndvi: ndviResult.minNDVI,
        max_ndvi: ndviResult.maxNDVI,
        std_dev_ndvi: ndviResult.stdDevNDVI,
        health_status: ndviResult.healthStatus,
        ndvi_raster_url: ndviResult.ndviRasterUrl,
      };

      // UPSERT: Insert or update if already exists
      // The unique constraint on (parcelle_id, calculation_date) ensures
      // that we update existing records instead of creating duplicates
      const { error } = await client
        .from('ndvi_results')
        .upsert(row, {
          onConflict: 'parcelle_id,calculation_date',
        });

      if (error) {
        throw error;
      }

      console.log(`[NDVI Service] Cached NDVI in database for parcelle ${ndviResult.parcelleId}, date ${dateKey}`);
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to cache NDVI result: ${(error as Error).message}`,
        ndviResult.parcelleId,
        'Cache storage failed'
      );
    }
  }

  /**
   * Get NDVI trend over time
   * 
   * Analyzes historical NDVI data to determine the trend (improving, stable, declining)
   * over a specified time period. By default, analyzes the past 3 months.
   * 
   * The trend is calculated using linear regression to determine the rate of change
   * per month. The trend classification is based on the slope:
   * - Improving: slope > +0.05 NDVI units per month (significant positive change)
   * - Declining: slope < -0.05 NDVI units per month (significant negative change)
   * - Stable: slope between -0.05 and +0.05 (minimal change)
   * 
   * @param parcelleId - Parcelle ID
   * @param startDate - Start date for trend analysis (defaults to 3 months ago)
   * @param endDate - End date for trend analysis (defaults to today)
   * @returns NDVI trend analysis
   * @throws {InsufficientDataError} If insufficient data points are available
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const trend = await service.getNDVITrend('parcelle-123');
   * console.log('Trend:', trend.trend); // 'improving', 'stable', or 'declining'
   * console.log('Change rate:', trend.changeRate, 'NDVI units per month');
   * ```
   */
  async getNDVITrend(
    parcelleId: string,
    startDate?: Date,
    endDate?: Date,
    supabaseClient?: any
  ): Promise<import('../types').NDVITrend> {
    try {
      // Default to past 3 months if not specified
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      // Use provided Supabase client or create a new one
      let supabase = supabaseClient;
      if (!supabase) {
        // Dynamically import Supabase client
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
      }

      // Retrieve historical NDVI results from database
      console.log('[getNDVITrend] Query params:', {
        parcelleId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });

      const { data, error } = await supabase
        .from('ndvi_results')
        .select('calculation_date, mean_ndvi')
        .eq('parcelle_id', parcelleId)
        .gte('calculation_date', start.toISOString())
        .lte('calculation_date', end.toISOString())
        .order('calculation_date', { ascending: true });

      console.log('[getNDVITrend] Query result:', {
        dataCount: data?.length || 0,
        data: data,
        error: error,
      });

      if (error) {
        throw error;
      }

      // Validate we have sufficient data points (minimum 2 for trend analysis)
      if (!data || data.length < 2) {
        throw new InsufficientDataError(
          `Insufficient data points for trend analysis. Required: 2, Available: ${data?.length || 0}`,
          2,
          data?.length || 0
        );
      }

      // Extract NDVI values and dates
      const dataPoints = data.map((row: any) => ({
        date: new Date(row.calculation_date),
        ndvi: Number(row.mean_ndvi),
      }));

      // Calculate trend using linear regression
      const { slope, startNDVI, endNDVI } = this.calculateLinearRegression(dataPoints);

      // Convert slope to NDVI units per month
      // slope is in NDVI units per millisecond, convert to per month (30 days)
      const changeRatePerMonth = slope * 30 * 24 * 60 * 60 * 1000;

      // Classify trend based on change rate
      // Thresholds:
      // - Improving: > +0.05 NDVI units per month
      // - Declining: < -0.05 NDVI units per month
      // - Stable: between -0.05 and +0.05
      const TREND_THRESHOLD = 0.05;
      let trend: 'improving' | 'stable' | 'declining';

      if (changeRatePerMonth > TREND_THRESHOLD) {
        trend = 'improving';
      } else if (changeRatePerMonth < -TREND_THRESHOLD) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      return {
        trend,
        changeRate: changeRatePerMonth,
        dataPoints: dataPoints.length,
        startDate: start,
        endDate: end,
        startNDVI,
        endNDVI,
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof InsufficientDataError) {
        throw error;
      }

      // Wrap unknown errors
      throw new NDVICalculationError(
        `Failed to calculate NDVI trend for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Calculate linear regression for NDVI trend analysis
   * 
   * Uses the least squares method to fit a line to the NDVI data points.
   * Returns the slope (rate of change) and the start/end NDVI values.
   * 
   * @param dataPoints - Array of date-NDVI pairs
   * @returns Regression results with slope and NDVI values
   */
  private calculateLinearRegression(
    dataPoints: Array<{ date: Date; ndvi: number }>
  ): { slope: number; startNDVI: number; endNDVI: number } {
    const n = dataPoints.length;

    // Convert dates to timestamps (milliseconds since epoch) for regression
    const x = dataPoints.map(p => p.date.getTime());
    const y = dataPoints.map(p => p.ndvi);

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate slope using least squares method
    // slope = Σ((x - x̄)(y - ȳ)) / Σ((x - x̄)²)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    // Calculate slope (NDVI units per millisecond)
    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Get start and end NDVI values (first and last data points)
    const startNDVI = y[0];
    const endNDVI = y[n - 1];

    return { slope, startNDVI, endNDVI };
  }

  /**
   * Validate NDVI value is in valid range
   * 
   * @param ndvi - NDVI value to validate
   * @returns True if valid, false otherwise
   */
  isValidNDVI(ndvi: number): boolean {
    return !isNaN(ndvi) && ndvi >= -1 && ndvi <= 1;
  }

  /**
   * Get health status color for visualization
   * 
   * Returns the color code associated with each health status for
   * consistent visualization across the application.
   * 
   * @param status - Health status
   * @returns Hex color code
   */
  getHealthStatusColor(status: HealthStatus): string {
    const colors: Record<HealthStatus, string> = {
      excellent: '#2d5016', // Dark Green
      good: '#6FAF3D',      // Green
      fair: '#fbbf24',      // Yellow
      poor: '#E68A1F',      // Orange
      critical: '#ef4444',  // Red
    };

    return colors[status];
  }

  /**
   * Get NDVI color for visualization
   * 
   * Maps NDVI values to colors for visualization:
   * - Red (0.0-0.2): Very poor vegetation
   * - Yellow (0.2-0.4): Poor vegetation
   * - Light Green (0.4-0.6): Moderate vegetation
   * - Green (0.6-0.8): Good vegetation
   * - Dark Green (0.8-1.0): Excellent vegetation
   * 
   * @param ndvi - NDVI value
   * @returns Hex color code
   */
  getNDVIColor(ndvi: number): string {
    if (ndvi < 0.2) {
      return '#ef4444'; // Red
    } else if (ndvi < 0.4) {
      return '#fbbf24'; // Yellow
    } else if (ndvi < 0.6) {
      return '#84cc16'; // Light Green
    } else if (ndvi < 0.8) {
      return '#22c55e'; // Green
    } else {
      return '#15803d'; // Dark Green
    }
  }

  /**
   * Get recommendation based on health status
   * 
   * Provides actionable recommendations in French, specific to cocoa cultivation.
   * 
   * @param status - Health status
   * @returns Recommendation text in French
   */
  getRecommendation(status: HealthStatus): string {
    const recommendations: Record<HealthStatus, string> = {
      excellent: 'Les cacaoyers sont en excellente santé. Continuez les pratiques actuelles de gestion et d\'ombrage.',
      good: 'Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d\'entretien.',
      fair: 'Santé acceptable des cacaoyers. Vérifiez l\'irrigation, la fertilisation et l\'ombrage. Surveillez les signes de stress.',
      poor: 'Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides).',
      critical: 'État critique des cacaoyers. Intervention immédiate requise. Consultez un agronome spécialisé en cacao. Vérifiez l\'ombrage, l\'irrigation et les maladies.',
    };

    return recommendations[status];
  }

  /**
   * Get temporal NDVI data for a parcelle over a date range
   * 
   * Retrieves NDVI results for the specified date range and interval.
   * Supports daily, weekly, and monthly intervals. Fills gaps in data with
   * null values or interpolation based on options.
   * 
   * This method:
   * 1. Generates expected dates based on the interval (daily, weekly, monthly)
   * 2. Retrieves all NDVI results from the database within the date range
   * 3. Maps database results to expected dates
   * 4. Fills gaps with null values or interpolated values
   * 5. Calculates significant changes (NDVI change > 0.15 from previous)
   * 6. Returns complete timeline with all data points
   * 
   * @param parcelleId - Parcelle ID
   * @param startDate - Start date for temporal analysis
   * @param endDate - End date for temporal analysis
   * @param interval - Time interval ('daily', 'weekly', 'monthly')
   * @param options - Additional options for data retrieval
   * @returns Array of temporal data points
   * @throws {NDVICalculationError} If temporal data retrieval fails
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const timeline = await service.getTemporalData(
   *   'parcelle-123',
   *   new Date('2024-01-01'),
   *   new Date('2024-12-31'),
   *   'monthly'
   * );
   * console.log('Data points:', timeline.length);
   * timeline.forEach(point => {
   *   console.log(`${point.date.toISOString()}: NDVI=${point.ndvi}, Status=${point.healthStatus}`);
   * });
   * ```
   */
  async getTemporalData(
    parcelleId: string,
    startDate: Date,
    endDate: Date,
    interval: 'daily' | 'weekly' | 'monthly',
    options: {
      interpolateGaps?: boolean;
      supabase?: any;
    } = {}
  ): Promise<import('../types').TemporalDataPoint[]> {
    const { interpolateGaps = false, supabase } = options;

    try {
      // Step 1: Generate expected dates based on interval
      const expectedDates = this.generateIntervalDates(startDate, endDate, interval);

      // Step 2: Retrieve all NDVI results from database within date range
      const ndviResults = await this.retrieveNDVIResultsInRange(
        parcelleId,
        startDate,
        endDate,
        supabase
      );

      // Step 3: Create a map of dates to NDVI results for quick lookup
      // For monthly intervals, group by year-month instead of exact date
      const ndviMap = new Map<string, NDVIResult>();
      const ndviByMonth = new Map<string, NDVIResult[]>();
      
      ndviResults.forEach(result => {
        const dateKey = this.normalizeDateToKey(result.calculationDate);
        ndviMap.set(dateKey, result);
        
        // Also group by month for monthly interval matching
        if (interval === 'monthly') {
          const monthKey = this.normalizeToMonthKey(result.calculationDate);
          if (!ndviByMonth.has(monthKey)) {
            ndviByMonth.set(monthKey, []);
          }
          ndviByMonth.get(monthKey)!.push(result);
        }
      });

      console.log('[getTemporalData] Expected dates:', expectedDates.map(d => d.toISOString()));
      console.log('[getTemporalData] NDVI map keys:', Array.from(ndviMap.keys()));
      console.log('[getTemporalData] NDVI results count:', ndviResults.length);
      if (interval === 'monthly') {
        console.log('[getTemporalData] NDVI by month keys:', Array.from(ndviByMonth.keys()));
      }

      // Step 4: Build timeline by mapping expected dates to NDVI results
      const timeline: import('../types').TemporalDataPoint[] = [];
      let previousNDVI: number | null = null;

      for (let i = 0; i < expectedDates.length; i++) {
        const date = expectedDates[i];
        const dateKey = this.normalizeDateToKey(date);
        let ndviResult = ndviMap.get(dateKey);
        
        // For monthly intervals, if exact date not found, find any data in the same month
        if (!ndviResult && interval === 'monthly') {
          const monthKey = this.normalizeToMonthKey(date);
          const monthResults = ndviByMonth.get(monthKey);
          if (monthResults && monthResults.length > 0) {
            // Use the most recent result in the month
            ndviResult = monthResults[monthResults.length - 1];
          }
        }

        if (ndviResult) {
          // We have data for this date
          const dataPoint: import('../types').TemporalDataPoint = {
            date,
            ndvi: ndviResult.meanNDVI,
            cloudCover: 0, // Will be populated from imagery data if available
            healthStatus: ndviResult.healthStatus,
            hasSignificantChange: this.hasSignificantChange(previousNDVI, ndviResult.meanNDVI),
          };
          timeline.push(dataPoint);
          previousNDVI = ndviResult.meanNDVI;
        } else {
          // No data for this date - fill gap
          if (interpolateGaps && previousNDVI !== null && i < expectedDates.length - 1) {
            // Try to find next available data point for interpolation
            const nextNDVI = this.findNextNDVI(expectedDates, ndviMap, i + 1);
            if (nextNDVI !== null) {
              // Interpolate between previous and next
              const interpolatedNDVI: number = (previousNDVI + nextNDVI) / 2;
              const dataPoint: import('../types').TemporalDataPoint = {
                date,
                ndvi: interpolatedNDVI,
                cloudCover: 0,
                healthStatus: this.calculateHealthStatus(interpolatedNDVI),
                hasSignificantChange: this.hasSignificantChange(previousNDVI, interpolatedNDVI),
              };
              timeline.push(dataPoint);
              previousNDVI = interpolatedNDVI;
            } else {
              // No next data point, use null
              timeline.push(this.createNullDataPoint(date));
            }
          } else {
            // No interpolation or no previous data - use null
            timeline.push(this.createNullDataPoint(date));
          }
        }
      }

      return timeline;
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to retrieve temporal data for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Generate array of dates based on interval
   * 
   * Creates an array of dates from startDate to endDate with the specified interval.
   * For monthly intervals, dates fall on the same day of each month (or last day if not available).
   * For weekly intervals, dates are 7 days apart.
   * For daily intervals, dates are consecutive days.
   * 
   * @param startDate - Start date
   * @param endDate - End date
   * @param interval - Time interval
   * @returns Array of dates
   */
  private generateIntervalDates(
    startDate: Date,
    endDate: Date,
    interval: 'daily' | 'weekly' | 'monthly'
  ): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0); // Normalize to midnight UTC

    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);

    // For monthly intervals, remember the target day of month
    const targetDay = interval === 'monthly' ? current.getUTCDate() : null;

    while (current <= end) {
      dates.push(new Date(current));

      // Increment based on interval
      switch (interval) {
        case 'daily':
          current.setUTCDate(current.getUTCDate() + 1);
          break;
        case 'weekly':
          current.setUTCDate(current.getUTCDate() + 7);
          break;
        case 'monthly':
          // Move to next month
          const currentMonth = current.getUTCMonth();
          const currentYear = current.getUTCFullYear();
          
          // Set to first day of next month
          current.setUTCMonth(currentMonth + 1, 1);
          
          // Try to set to target day
          if (targetDay !== null) {
            // Get last day of this month
            const lastDayOfMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
            
            // Use target day or last day of month, whichever is smaller
            current.setUTCDate(Math.min(targetDay, lastDayOfMonth));
          }
          break;
      }
    }

    return dates;
  }

  /**
   * Retrieve all NDVI results from database within date range
   * 
   * @param parcelleId - Parcelle ID
   * @param startDate - Start date
   * @param endDate - End date
   * @param supabase - Optional Supabase client
   * @returns Array of NDVI results
   */
  private async retrieveNDVIResultsInRange(
    parcelleId: string,
    startDate: Date,
    endDate: Date,
    supabase?: any
  ): Promise<NDVIResult[]> {
    // Use provided client or create a new one
    let client = supabase;
    if (!client) {
      const { createClient } = await import('@supabase/supabase-js');
      client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            fetch: fetch.bind(globalThis),
          },
        }
      );
    }

    // Normalize dates to midnight UTC
    const normalizedStart = new Date(startDate);
    normalizedStart.setUTCHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setUTCHours(23, 59, 59, 999);

    // Query database for NDVI results in range
    const { data, error } = await client
      .from('ndvi_results')
      .select('*')
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', normalizedStart.toISOString())
      .lte('calculation_date', normalizedEnd.toISOString())
      .order('calculation_date', { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert database rows to NDVIResult objects
    return data.map((row: any) => ({
      id: row.id,
      parcelleId: row.parcelle_id,
      imageryId: row.imagery_id,
      calculationDate: new Date(row.calculation_date),
      meanNDVI: Number(row.mean_ndvi),
      minNDVI: Number(row.min_ndvi),
      maxNDVI: Number(row.max_ndvi),
      stdDevNDVI: Number(row.std_dev_ndvi),
      healthStatus: row.health_status as HealthStatus,
      ndviRasterUrl: row.ndvi_raster_url,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Normalize date to string key for map lookup
   * 
   * Converts date to YYYY-MM-DD format for consistent key generation
   * 
   * @param date - Date to normalize
   * @returns Date key string
   */
  private normalizeDateToKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Normalize date to year-month key (for monthly grouping)
   * 
   * @param date - Date to normalize
   * @returns Month key string (YYYY-MM)
   */
  private normalizeToMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Check if NDVI change is significant (> 0.15)
   * 
   * @param previousNDVI - Previous NDVI value (or null if first data point)
   * @param currentNDVI - Current NDVI value
   * @returns True if change is significant
   */
  private hasSignificantChange(previousNDVI: number | null, currentNDVI: number): boolean {
    if (previousNDVI === null) {
      return false; // First data point, no previous to compare
    }
    const change = Math.abs(currentNDVI - previousNDVI);
    return change > 0.15;
  }

  /**
   * Find next available NDVI value in timeline
   * 
   * Searches forward from the given index to find the next date with NDVI data
   * 
   * @param dates - Array of expected dates
   * @param ndviMap - Map of date keys to NDVI results
   * @param startIndex - Index to start searching from
   * @returns Next NDVI value or null if not found
   */
  private findNextNDVI(
    dates: Date[],
    ndviMap: Map<string, NDVIResult>,
    startIndex: number
  ): number | null {
    for (let i = startIndex; i < dates.length; i++) {
      const dateKey = this.normalizeDateToKey(dates[i]);
      const ndviResult = ndviMap.get(dateKey);
      if (ndviResult) {
        return ndviResult.meanNDVI;
      }
    }
    return null;
  }

  /**
   * Create a null data point for missing data
   * 
   * @param date - Date for the data point
   * @returns Temporal data point with null/default values
   */
  private createNullDataPoint(date: Date): import('../types').TemporalDataPoint {
    return {
      date,
      ndvi: NaN, // Use NaN to indicate missing data
      cloudCover: 0,
      healthStatus: 'critical', // Default to critical for missing data
      hasSignificantChange: false,
    };
  }

  /**
   * Detect significant changes in temporal NDVI data
   * 
   * This method analyzes a timeline of NDVI data points and identifies dates
   * where the NDVI change from the previous measurement exceeds 0.15 (15%).
   * For each significant change, it calculates both absolute and percentage change.
   * 
   * A significant change is defined as:
   * - Absolute NDVI change > 0.15 from the previous data point
   * - This threshold is based on research showing that NDVI changes > 0.15
   *   typically indicate substantial vegetation changes (deforestation, disease, etc.)
   * 
   * The method returns an array of change events with:
   * - Date of the change
   * - Previous NDVI value
   * - Current NDVI value
   * - Absolute change (current - previous)
   * - Percentage change ((current - previous) / |previous| * 100)
   * - Change direction ('increase' or 'decrease')
   * 
   * @param timeline - Array of temporal data points (must be sorted by date ascending)
   * @returns Array of significant change events
   * @throws {NDVICalculationError} If timeline is invalid or empty
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const timeline = await service.getTemporalData(
   *   'parcelle-123',
   *   new Date('2024-01-01'),
   *   new Date('2024-12-31'),
   *   'monthly'
   * );
   * const changes = service.detectSignificantChanges(timeline);
   * console.log(`Found ${changes.length} significant changes`);
   * changes.forEach(change => {
   *   console.log(`${change.date.toISOString()}: ${change.direction} of ${change.absoluteChange.toFixed(3)} (${change.percentageChange.toFixed(1)}%)`);
   * });
   * ```
   */
  detectSignificantChanges(
    timeline: import('../types').TemporalDataPoint[]
  ): Array<{
    date: Date;
    previousNDVI: number;
    currentNDVI: number;
    absoluteChange: number;
    percentageChange: number;
    direction: 'increase' | 'decrease';
  }> {
    // Validate input
    if (!timeline || timeline.length === 0) {
      throw new NDVICalculationError(
        'Cannot detect changes in empty timeline',
        undefined,
        'Empty timeline'
      );
    }

    // Filter out data points with invalid NDVI values (NaN)
    const validDataPoints = timeline.filter(point => !isNaN(point.ndvi));

    if (validDataPoints.length < 2) {
      // Need at least 2 data points to detect changes
      return [];
    }

    const significantChanges: Array<{
      date: Date;
      previousNDVI: number;
      currentNDVI: number;
      absoluteChange: number;
      percentageChange: number;
      direction: 'increase' | 'decrease';
    }> = [];

    // Threshold for significant change (15% or 0.15 NDVI units)
    const SIGNIFICANT_CHANGE_THRESHOLD = 0.15;

    // Iterate through timeline starting from second data point
    for (let i = 1; i < validDataPoints.length; i++) {
      const previousPoint = validDataPoints[i - 1];
      const currentPoint = validDataPoints[i];

      const previousNDVI = previousPoint.ndvi;
      const currentNDVI = currentPoint.ndvi;

      // Calculate absolute change
      const absoluteChange = currentNDVI - previousNDVI;

      // Check if change exceeds threshold
      if (Math.abs(absoluteChange) > SIGNIFICANT_CHANGE_THRESHOLD) {
        // Calculate percentage change
        // Use absolute value of previous NDVI to avoid issues with negative values
        // Formula: (change / |baseline|) * 100
        const percentageChange = previousNDVI !== 0
          ? (absoluteChange / Math.abs(previousNDVI)) * 100
          : 0; // If previous NDVI is 0, percentage change is undefined, use 0

        // Determine direction
        const direction: 'increase' | 'decrease' = absoluteChange > 0 ? 'increase' : 'decrease';

        // Add to significant changes array
        significantChanges.push({
          date: currentPoint.date,
          previousNDVI,
          currentNDVI,
          absoluteChange,
          percentageChange,
          direction,
        });
      }
    }

    return significantChanges;
  }

  /**
   * Calculate temporal statistics for a parcelle over a date range
   * 
   * This method provides comprehensive temporal analysis by combining:
   * 1. Overall trend (improving, stable, declining) using linear regression
   * 2. Total count of valid data points in the period
   * 3. Count of significant changes (NDVI change > 0.15)
   * 4. Average NDVI value across all data points
   * 5. Average cloud cover across all imagery
   * 
   * The method leverages existing service methods:
   * - `getTemporalData()` to retrieve the timeline
   * - `getNDVITrend()` to calculate the trend
   * - `detectSignificantChanges()` to identify significant changes
   * 
   * This provides a complete statistical summary of vegetation health over time,
   * useful for:
   * - Identifying parcelles with declining health trends
   * - Assessing data quality and coverage
   * - Generating reports and dashboards
   * - Making intervention decisions
   * 
   * @param parcelleId - Parcelle ID
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @param interval - Time interval ('daily', 'weekly', 'monthly')
   * @param options - Additional options (supabase client, interpolation)
   * @returns Temporal analysis summary with statistics
   * @throws {NDVICalculationError} If temporal statistics calculation fails
   * @throws {InsufficientDataError} If insufficient data points are available
   * 
   * @example
   * ```typescript
   * const service = new NDVIService();
   * const stats = await service.calculateTemporalStatistics(
   *   'parcelle-123',
   *   new Date('2024-01-01'),
   *   new Date('2024-12-31'),
   *   'monthly'
   * );
   * 
   * console.log('Trend:', stats.trend.trend); // 'improving', 'stable', or 'declining'
   * console.log('Total data points:', stats.trend.dataPoints);
   * console.log('Significant changes:', stats.significantChanges);
   * console.log('Average NDVI:', stats.averageNDVI.toFixed(3));
   * console.log('Average cloud cover:', stats.averageCloudCover.toFixed(1), '%');
   * ```
   */
  async calculateTemporalStatistics(
    parcelleId: string,
    startDate: Date,
    endDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' = 'monthly',
    options: {
      interpolateGaps?: boolean;
      supabase?: any;
    } = {}
  ): Promise<import('../types').TemporalAnalysisSummary> {
    try {
      // Step 1: Retrieve temporal data (timeline of NDVI values)
      const timeline = await this.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        options
      );

      // Step 2: Calculate overall trend (improving, stable, declining)
      // This uses linear regression on the NDVI values over time
      // Note: Trend calculation requires at least 2 data points
      let trend: import('../types').NDVITrend | null = null;
      
      try {
        trend = await this.getNDVITrend(
          parcelleId,
          startDate,
          endDate,
          options.supabase // Pass authenticated Supabase client
        );
      } catch (error) {
        // If insufficient data for trend calculation, set trend to null
        // This is expected when there's only 1 data point
        if (error instanceof InsufficientDataError) {
          console.log(`[calculateTemporalStatistics] Insufficient data for trend calculation: ${error.message}`);
          trend = null;
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      // Step 3: Detect significant changes (NDVI change > 0.15)
      const significantChangeEvents = this.detectSignificantChanges(timeline);
      const significantChangesCount = significantChangeEvents.length;

      // Step 4: Calculate average NDVI over the period
      // Filter out invalid data points (NaN values)
      const validDataPoints = timeline.filter(point => !isNaN(point.ndvi));
      
      if (validDataPoints.length === 0) {
        throw new InsufficientDataError(
          `No valid data points found for temporal statistics calculation`,
          1,
          0
        );
      }

      // Calculate mean NDVI
      const totalNDVI = validDataPoints.reduce((sum, point) => sum + point.ndvi, 0);
      const averageNDVI = totalNDVI / validDataPoints.length;

      // Step 5: Calculate average cloud cover
      // Note: Cloud cover data may not be available for all data points
      // We calculate the average of available cloud cover values
      const dataPointsWithCloudCover = validDataPoints.filter(point => point.cloudCover !== undefined);
      const averageCloudCover = dataPointsWithCloudCover.length > 0
        ? dataPointsWithCloudCover.reduce((sum, point) => sum + point.cloudCover, 0) / dataPointsWithCloudCover.length
        : 0;

      // Step 6: Construct and return the temporal analysis summary
      const summary: import('../types').TemporalAnalysisSummary = {
        timeline,
        trend,
        significantChanges: significantChangesCount,
        averageNDVI,
        averageCloudCover,
      };

      return summary;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NDVICalculationError ||
        error instanceof InsufficientDataError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NDVICalculationError(
        `Failed to calculate temporal statistics for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of NDVIService
 * 
 * Use this instance throughout the application for consistent NDVI calculations.
 */
export const ndviService = new NDVIService();
