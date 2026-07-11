/**
 * Imagery Service
 * 
 * This service provides methods to retrieve satellite imagery from Google Earth Engine
 * using Sentinel-2 data. It handles imagery retrieval, date availability checking,
 * band data extraction, cloud cover filtering, and error handling with retry logic.
 * 
 * Requirements: Task 1.3.3
 * - Retrieve Sentinel-2 imagery from Google Earth Engine
 * - List available imagery dates
 * - Retrieve specific spectral bands
 * - Filter by cloud cover threshold (default 20%)
 * - Implement retry logic with exponential backoff
 */

import type { MultiPolygon } from 'geojson';
import {
  ImageryData,
  ImageryDate,
  BandData,
  ImageryUnavailableError,
  RateLimitError,
  CloudCoverError,
  AuthenticationError,
  InvalidGeometryError,
  SatelliteError,
} from '../types';
import { getAccessToken, refreshToken } from '../utils/gee-auth';
import { getEE, evaluateEE } from '../utils/gee-sdk';
import { redisCacheService } from './redis-cache.service';

// ============================================================================
// Constants
// ============================================================================

/**
 * Google Earth Engine API base URL
 */
const GEE_API_BASE_URL = 'https://earthengine.googleapis.com/v1';

/**
 * Sentinel-2 image collection ID
 */
const SENTINEL2_COLLECTION = 'COPERNICUS/S2_SR_HARMONIZED';

/**
 * Default cloud cover threshold (percentage)
 */
const DEFAULT_CLOUD_COVER_THRESHOLD = 20;

/**
 * Maximum retry attempts for failed requests
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial retry delay in milliseconds
 */
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Maximum retry delay in milliseconds (for exponential backoff)
 */
const MAX_RETRY_DELAY_MS = 10000;

/**
 * Sentinel-2 band names
 */
export const SENTINEL2_BANDS = {
  BLUE: 'B2',
  GREEN: 'B3',
  RED: 'B4',
  NIR: 'B8', // Near-Infrared
  SWIR1: 'B11',
  SWIR2: 'B12',
  CLOUD_PROBABILITY: 'MSK_CLDPRB',
} as const;

/**
 * Sentinel-2 resolution in meters
 */
const SENTINEL2_RESOLUTION = 10;

// ============================================================================
// Types
// ============================================================================

/**
 * Google Earth Engine image metadata
 */
interface GEEImageMetadata {
  id: string;
  properties: {
    'system:time_start': number;
    'system:time_end': number;
    CLOUDY_PIXEL_PERCENTAGE?: number;
    CLOUD_COVERAGE_ASSESSMENT?: number;
  };
}

/**
 * Google Earth Engine image collection response
 */
interface GEEImageCollectionResponse {
  features: GEEImageMetadata[];
}

/**
 * Retry options for API requests
 */
interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

// ============================================================================
// ImageryService Class
// ============================================================================

/**
 * Service for retrieving satellite imagery from Google Earth Engine
 */
export class ImageryService {
  private accessToken: string | null = null;

  // In-memory cache for imagery data (tileUrl + metadata)
  // Key: "parcelleId:YYYY-MM-DD", Value: { imagery, cachedAt }
  private imageryCache = new Map<string, { imagery: ImageryData; cachedAt: number }>();
  private readonly IMAGERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  /**
   * Get or refresh the access token
   */
  private async getToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await getAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(): Promise<string> {
    const token = await refreshToken();
    this.accessToken = token.accessToken;
    return this.accessToken;
  }

  /**
   * Make an authenticated request to Google Earth Engine API with retry logic
   * 
   * @param url - API endpoint URL
   * @param options - Fetch options
   * @param retryOptions - Retry configuration
   * @returns Response data
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {AuthenticationError} If authentication fails
   * @throws {SatelliteError} For other API errors
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {
      maxAttempts: MAX_RETRY_ATTEMPTS,
      initialDelayMs: INITIAL_RETRY_DELAY_MS,
      maxDelayMs: MAX_RETRY_DELAY_MS,
    }
  ): Promise<T> {
    let lastError: Error | null = null;
    let delayMs = retryOptions.initialDelayMs;

    for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
      try {
        const token = await this.getToken();

        // Use Node.js https module with IPv4 forced to avoid IPv6 timeout issues
        const data = await this.makeHttpsRequest<T>(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
          },
        });

        return data;

      } catch (error) {
        lastError = error as Error;

        // Handle rate limiting
        if ((error as SatelliteError).code === 'RATE_LIMIT_EXCEEDED') {
          throw error;
        }

        // Handle authentication errors
        if (error instanceof AuthenticationError) {
          if (attempt === 1) {
            await this.refreshAccessToken();
            continue;
          }
          throw error;
        }

        // Don't retry on certain errors
        if (
          error instanceof RateLimitError ||
          error instanceof InvalidGeometryError
        ) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === retryOptions.maxAttempts) {
          break;
        }

        // Wait before retrying (exponential backoff)
        await this.sleep(delayMs);
        delayMs = Math.min(delayMs * 2, retryOptions.maxDelayMs);
      }
    }

    // All retries failed
    throw new SatelliteError(
      `Request failed after ${retryOptions.maxAttempts} attempts: ${lastError?.message}`,
      'REQUEST_FAILED',
      500
    );
  }

  /**
   * Make HTTPS request using Node.js https module with IPv4 forced.
   * This bypasses the IPv6 timeout issue with Node.js fetch.
   */
  private makeHttpsRequest<T>(url: string, options: RequestInit): Promise<T> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const { URL } = require('url');

      const parsed = new URL(url);
      const body = options.body ? String(options.body) : undefined;

      const reqOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method: (options.method || 'GET').toUpperCase(),
        family: 4, // Force IPv4
        timeout: 30000,
        headers: {
          ...(options.headers as Record<string, string> || {}),
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      };

      const req = https.request(reqOptions, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          // Handle rate limiting
          if (res.statusCode === 429) {
            const retryAfter = res.headers['retry-after'];
            reject(new RateLimitError(
              'Google Earth Engine API rate limit exceeded',
              retryAfter ? parseInt(retryAfter, 10) : 60
            ));
            return;
          }

          // Handle auth errors
          if (res.statusCode === 401) {
            reject(new AuthenticationError('Authentication failed'));
            return;
          }

          // Handle other errors
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new SatelliteError(
              `Google Earth Engine API error (${res.statusCode}): ${data}`,
              'GEE_API_ERROR',
              res.statusCode
            ));
            return;
          }

          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new SatelliteError(
              `Failed to parse GEE response: ${data.substring(0, 200)}`,
              'PARSE_ERROR',
              500
            ));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new SatelliteError('GEE API request timed out', 'TIMEOUT', 504));
      });

      req.on('error', (e: Error) => {
        reject(new SatelliteError(
          `GEE API request failed: ${e.message}`,
          'REQUEST_FAILED',
          500
        ));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate parcelle geometry
   * 
   * @param geometry - Parcelle geometry
   * @throws {InvalidGeometryError} If geometry is invalid
   */
  private validateGeometry(geometry: MultiPolygon): void {
    if (!geometry || geometry.type !== 'MultiPolygon') {
      throw new InvalidGeometryError('Geometry must be a MultiPolygon');
    }

    if (!geometry.coordinates || geometry.coordinates.length === 0) {
      throw new InvalidGeometryError('Geometry coordinates are empty');
    }

    // Validate coordinate structure
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon) || polygon.length === 0) {
        throw new InvalidGeometryError('Invalid polygon structure');
      }

      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) {
          throw new InvalidGeometryError('Polygon ring must have at least 4 coordinates');
        }

        // Validate coordinate format [longitude, latitude]
        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2) {
            throw new InvalidGeometryError('Invalid coordinate format');
          }

          const [lon, lat] = coord;
          if (typeof lon !== 'number' || typeof lat !== 'number') {
            throw new InvalidGeometryError('Coordinates must be numbers');
          }

          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            throw new InvalidGeometryError('Coordinates out of valid range');
          }
        }
      }
    }
  }

  /**
   * Convert MultiPolygon to GEE geometry format
   * 
   * @param geometry - Parcelle geometry
   * @returns GEE geometry object
   */
  private toGEEGeometry(geometry: MultiPolygon): Record<string, unknown> {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates,
    };
  }

  /**
   * Get cloud cover percentage from image metadata
   * 
   * @param properties - Image properties
   * @returns Cloud cover percentage
   */
  private getCloudCover(properties: GEEImageMetadata['properties']): number {
    // Try CLOUDY_PIXEL_PERCENTAGE first (more accurate)
    if (typeof properties.CLOUDY_PIXEL_PERCENTAGE === 'number') {
      return properties.CLOUDY_PIXEL_PERCENTAGE;
    }

    // Fall back to CLOUD_COVERAGE_ASSESSMENT
    if (typeof properties.CLOUD_COVERAGE_ASSESSMENT === 'number') {
      return properties.CLOUD_COVERAGE_ASSESSMENT;
    }

    // Default to 100% if no cloud cover info available
    return 100;
  }

  /**
   * Clear the in-memory imagery cache.
   * Useful when tile URL format changes (e.g. after a code update).
   */
  clearImageryCache(): void {
    this.imageryCache.clear();
    console.log('[ImageryService] In-memory imagery cache cleared');
  }

  /**
   * Check if a cached tileUrl is valid (proxied through our API, not a direct GEE URL).
   * Direct GEE URLs are blocked by CORS in the browser.
   */
  private isTileUrlValid(tileUrl: string): boolean {
    // Valid URLs start with /api/satellite/tiles/ (our proxy)
    // Invalid: direct GEE URLs (earthengine.googleapis.com)
    return tileUrl.startsWith('/api/satellite/tiles/');
  }

  /**
   * Get satellite imagery for a parcelle
   * 
   * Retrieves the most recent cloud-free Sentinel-2 imagery for the specified
   * parcelle geometry and date. Filters imagery by cloud cover threshold.
   * 
   * This method implements Redis caching:
   * 1. Checks Redis cache for existing imagery data
   * 2. If cache hit, returns cached data immediately
   * 3. If cache miss, retrieves from GEE and caches the result
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry (MultiPolygon)
   * @param date - Target date (defaults to current date)
   * @param cloudCoverThreshold - Maximum acceptable cloud cover percentage (default 20%)
   * @returns Imagery data
   * @throws {InvalidGeometryError} If geometry is invalid
   * @throws {ImageryUnavailableError} If no suitable imagery is found
   * @throws {CloudCoverError} If all available imagery exceeds cloud cover threshold
   * 
   * @example
   * ```typescript
   * const service = new ImageryService();
   * const imagery = await service.getImagery(
   *   'parcelle-123',
   *   parcelleGeometry,
   *   new Date('2024-01-15'),
   *   20
   * );
   * console.log('Imagery URL:', imagery.tileUrl);
   * console.log('Cloud cover:', imagery.cloudCoverPercent);
   * ```
   */
  async getImagery(
    parcelleId: string,
    geometry: MultiPolygon,
    date: Date = new Date(),
    cloudCoverThreshold: number = DEFAULT_CLOUD_COVER_THRESHOLD
  ): Promise<ImageryData> {
    // Validate inputs
    this.validateGeometry(geometry);

    if (cloudCoverThreshold < 0 || cloudCoverThreshold > 100) {
      throw new CloudCoverError(
        'Cloud cover threshold must be between 0 and 100',
        cloudCoverThreshold,
        DEFAULT_CLOUD_COVER_THRESHOLD
      );
    }

    // Check Redis cache first
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheKey = `${parcelleId}:${dateKey}`;

    // Check in-memory cache first (fast, no Redis needed)
    const memCached = this.imageryCache.get(cacheKey);
    if (memCached && Date.now() - memCached.cachedAt < this.IMAGERY_CACHE_TTL_MS) {
      // Invalidate cache if tileUrl is a direct GEE URL (CORS issue)
      if (!this.isTileUrlValid(memCached.imagery.tileUrl)) {
        console.log(`[ImageryService] Invalidating in-memory cache for ${parcelleId}, tileUrl is not proxied`);
        this.imageryCache.delete(cacheKey);
      } else {
        console.log(`[ImageryService] Using in-memory cached imagery for parcelle ${parcelleId}`);
        return memCached.imagery;
      }
    }

    const cachedImagery = await redisCacheService.getImageryData(parcelleId, dateKey);
    
    if (cachedImagery) {
      // Invalidate Redis cache if tileUrl is a direct GEE URL (CORS issue)
      if (!this.isTileUrlValid(cachedImagery.tileUrl)) {
        console.log(`[ImageryService] Invalidating Redis cache for ${parcelleId}, tileUrl is not proxied`);
        // Don't use this cache entry, fall through to fresh generation
      } else {
        console.log(`[ImageryService] Using cached imagery for parcelle ${parcelleId}, date ${dateKey}`);
        this.imageryCache.set(cacheKey, { imagery: cachedImagery, cachedAt: Date.now() });
        return cachedImagery;
      }
    }

    // Get available dates, try progressively wider windows and relaxed cloud cover
    // for tropical regions where 20% cloud-free images are rare
    let availableDates: ImageryDate[] = [];
    const searchWindows = [
      { days: 30,  cloud: cloudCoverThreshold },
      { days: 60,  cloud: Math.min(cloudCoverThreshold + 20, 60) },
      { days: 90,  cloud: 80 },
    ];

    for (const { days, cloud } of searchWindows) {
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - days);

      availableDates = await this.getAvailableDates(geometry, startDate, date, cloud);
      if (availableDates.length > 0) {
        console.log(`[ImageryService] Found ${availableDates.length} dates with window=${days}d, cloud<${cloud}%`);
        break;
      }
    }

    if (availableDates.length === 0) {
      throw new ImageryUnavailableError(
        `No imagery available for parcelle within 90 days of ${date.toISOString()}`,
        parcelleId,
        date
      );
    }

    // Get the most recent available date
    const mostRecentDate = availableDates[availableDates.length - 1];

    // Generate tile URL for the imagery
    const tileUrl = await this.generateTileUrl(
      parcelleId,
      geometry,
      mostRecentDate.date
    );

    const imagery: ImageryData = {
      id: crypto.randomUUID(),
      parcelleId,
      acquisitionDate: mostRecentDate.date,
      cloudCoverPercent: mostRecentDate.cloudCoverPercent,
      satelliteSource: 'sentinel-2',
      tileUrl,
      bounds: this.calculateBounds(geometry),
      resolutionMeters: SENTINEL2_RESOLUTION,
      createdAt: new Date(),
    };

    // Cache the imagery data in Redis and in-memory
    await redisCacheService.setImageryData(parcelleId, dateKey, imagery);
    this.imageryCache.set(cacheKey, { imagery, cachedAt: Date.now() });
    console.log(`[ImageryService] Cached imagery for parcelle ${parcelleId}, date ${dateKey}`);

    return imagery;
  }

  /**
   * Get available imagery dates for a parcelle within a date range
   * 
   * Queries Google Earth Engine to find all Sentinel-2 imagery dates that
   * meet the cloud cover threshold for the specified geometry and date range.
   * 
   * @param geometry - Parcelle geometry
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param cloudCoverThreshold - Maximum acceptable cloud cover percentage
   * @returns Array of available imagery dates with metadata
   * @throws {InvalidGeometryError} If geometry is invalid
   * 
   * @example
   * ```typescript
   * const service = new ImageryService();
   * const dates = await service.getAvailableDates(
   *   parcelleGeometry,
   *   new Date('2024-01-01'),
   *   new Date('2024-03-31'),
   *   20
   * );
   * console.log(`Found ${dates.length} available dates`);
   * dates.forEach(d => console.log(d.date, d.cloudCoverPercent));
   * ```
   */
  async getAvailableDates(
    geometry: MultiPolygon,
    startDate: Date,
    endDate: Date,
    cloudCoverThreshold: number = DEFAULT_CLOUD_COVER_THRESHOLD
  ): Promise<ImageryDate[]> {
    this.validateGeometry(geometry);

    try {
      const ee = await getEE();
      const geeGeometry = ee.Geometry(this.toGEEGeometry(geometry));

      // Query Sentinel-2 collection filtered by date, bounds, and cloud cover
      const collection = ee.ImageCollection(SENTINEL2_COLLECTION)
        .filterDate(startDate.toISOString(), endDate.toISOString())
        .filterBounds(geeGeometry)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloudCoverThreshold))
        .sort('system:time_start', true); // ascending by date

      // Use aggregate_array to extract properties, avoids img.id() which is not
      // available when mapping over a List in the SDK
      const timeStarts = await evaluateEE<number[]>(
        collection.aggregate_array('system:time_start')
      );
      const cloudCovers = await evaluateEE<number[]>(
        collection.aggregate_array('CLOUDY_PIXEL_PERCENTAGE')
      );

      const dates: ImageryDate[] = (timeStarts ?? []).map((ts, i) => ({
        date: new Date(ts),
        cloudCoverPercent: cloudCovers?.[i] ?? 100,
        available: true,
      })).filter(d => !isNaN(d.date.getTime()));

      console.log(`[ImageryService] Found ${dates.length} available dates between ${startDate.toISOString().split('T')[0]} and ${endDate.toISOString().split('T')[0]}`);
      return dates;

    } catch (error) {
      console.error('[ImageryService] getAvailableDates failed:', error);
      if (
        error instanceof AuthenticationError ||
        error instanceof RateLimitError ||
        error instanceof InvalidGeometryError
      ) {
        throw error;
      }
      return [];
    }
  }

  /**
   * Get specific spectral bands from Sentinel-2 imagery
   * 
   * Retrieves raw band data for NDVI calculation or other analysis.
   * Commonly used bands: B4 (Red) and B8 (NIR) for NDVI.
   * 
   * @param geometry - Parcelle geometry
   * @param date - Imagery date
   * @param bands - Array of band names to retrieve (e.g., ['B4', 'B8'])
   * @returns Band data with pixel values
   * @throws {InvalidGeometryError} If geometry is invalid
   * @throws {ImageryUnavailableError} If imagery is not available for the date
   * 
   * @example
   * ```typescript
   * const service = new ImageryService();
   * const bandData = await service.getBands(
   *   parcelleGeometry,
   *   new Date('2024-01-15'),
   *   ['B4', 'B8'] // Red and NIR for NDVI
   * );
   * console.log('Red band:', bandData.red);
   * console.log('NIR band:', bandData.nir);
   * ```
   */
  async getBands(
    geometry: MultiPolygon,
    date: Date,
    bands: string[]
  ): Promise<BandData> {
    this.validateGeometry(geometry);

    if (!bands || bands.length === 0) {
      throw new SatelliteError('At least one band must be specified', 'INVALID_BANDS', 400);
    }

    const bounds = this.calculateBounds(geometry);

    // Search window: ±30 days around the requested date (wider for cloudy tropical regions)
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 30);

    try {
      const ee = await getEE();
      const geeGeometry = ee.Geometry(this.toGEEGeometry(geometry));

      // Get the least cloudy image in the ±30 day window
      const collection = ee.ImageCollection(SENTINEL2_COLLECTION)
        .filterDate(startDate.toISOString(), endDate.toISOString())
        .filterBounds(geeGeometry)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 80)) // Relaxed for cloudy regions
        .sort('CLOUDY_PIXEL_PERCENTAGE', true); // least cloudy first

      // Check if collection has any images before proceeding
      const collectionSize = await evaluateEE<number>(collection.size());
      if (collectionSize === 0) {
        throw new ImageryUnavailableError(
          `No Sentinel-2 imagery found within 30 days of ${date.toISOString().split('T')[0]} with cloud cover < 80%`,
          'unknown',
          date
        );
      }

      const image = collection.first().select(bands);

      // Try sampleRectangle first for larger parcelles (better spatial detail)
      // Fall back to reduceRegion for small parcelles
      let redArray: number[][] = [];
      let nirArray: number[][] = [];
      
      try {
        const sampled = image.sampleRectangle({
          region: geeGeometry,
          defaultValue: 0,
        });

        const result = await evaluateEE<Record<string, number[][]>>(sampled);

        const redBandName = bands.find(b => b === 'B4') ?? bands[0];
        const nirBandName = bands.find(b => b === 'B8') ?? bands[bands.length - 1];

        redArray = result?.[redBandName] ?? [];
        nirArray = result?.[nirBandName] ?? [];
      } catch (sampleError) {
        console.log(`[ImageryService] sampleRectangle failed, falling back to reduceRegion for small parcelle`);
      }

      // If sampleRectangle failed or returned empty arrays, use reduceRegion
      if (redArray.length === 0 || nirArray.length === 0) {
        console.log(`[ImageryService] Using reduceRegion for small parcelle geometry`);
        
        const redBandName = bands.find(b => b === 'B4') ?? bands[0];
        const nirBandName = bands.find(b => b === 'B8') ?? bands[bands.length - 1];
        
        // Calculate mean values over the entire geometry
        const stats = image.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: geeGeometry,
          scale: SENTINEL2_RESOLUTION,
          maxPixels: 1e9,
        });

        const result = await evaluateEE<Record<string, number>>(stats);
        
        const redMean = result?.[redBandName];
        const nirMean = result?.[nirBandName];

        if (redMean === undefined || nirMean === undefined || redMean === null || nirMean === null) {
          throw new ImageryUnavailableError(
            `No valid pixel data for date ${date.toISOString().split('T')[0]}. The parcelle may be outside the image coverage or completely cloud-covered.`,
            'unknown',
            date
          );
        }

        // Convert single mean values to 1x1 arrays for compatibility
        redArray = [[redMean]];
        nirArray = [[nirMean]];
        
        console.log(`[ImageryService] getBands: retrieved mean values (Red: ${redMean.toFixed(2)}, NIR: ${nirMean.toFixed(2)}) for small parcelle`);
      } else {
        console.log(`[ImageryService] getBands: retrieved ${redArray.length}x${redArray[0]?.length ?? 0} pixels for ${bands.join(', ')}`);
      }

      return {
        red: redArray,
        nir: nirArray,
        bounds,
        resolution: SENTINEL2_RESOLUTION,
      };

    } catch (error) {
      if (
        error instanceof ImageryUnavailableError ||
        error instanceof AuthenticationError ||
        error instanceof RateLimitError ||
        error instanceof InvalidGeometryError
      ) {
        throw error;
      }
      console.error('[ImageryService] getBands failed:', error);
      throw new SatelliteError(
        `Failed to retrieve band data from Google Earth Engine: ${(error as Error).message}`,
        'BAND_RETRIEVAL_FAILED',
        500
      );
    }
  }

  /**
   * Calculate bounding box for a MultiPolygon geometry
   * 
   * @param geometry - MultiPolygon geometry
   * @returns Bounding box [minLon, minLat, maxLon, maxLat]
   */
  private calculateBounds(geometry: MultiPolygon): [number, number, number, number] {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon);
          minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }

    return [minLon, minLat, maxLon, maxLat];
  }

  /**
   * Generate a tile URL for GEE imagery
   * 
   * This method converts Google Earth Engine imagery to a tile URL that can be
   * used with Leaflet or Google Maps. The tiles are cached in Supabase Storage
   * for offline access and performance optimization.
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry
   * @param date - Imagery acquisition date
   * @returns Tile URL for map display
   * 
   * @example
   * ```typescript
   * const tileUrl = await service.generateTileUrl(
   *   'parcelle-123',
   *   geometry,
   *   new Date('2024-01-15')
   * );
   * // Returns: 'https://[project].supabase.co/storage/v1/object/public/satellite-imagery/...'
   * ```
   */
  async generateTileUrl(
    parcelleId: string,
    geometry: MultiPolygon,
    date: Date
  ): Promise<string> {
    // Generate cache key for this imagery
    const cacheKey = this.generateCacheKey(parcelleId, date);

    // Check if tiles are already cached
    const cachedUrl = await this.getCachedTileUrl(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Generate tiles from GEE imagery
    const tileUrl = await this.generateAndCacheTiles(
      parcelleId,
      geometry,
      date,
      cacheKey
    );

    return tileUrl;
  }

  /**
   * Generate a cache key for imagery tiles
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Imagery date
   * @returns Cache key string
   */
  private generateCacheKey(parcelleId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${parcelleId}/${dateStr}`;
  }

  /**
   * Check if tiles are cached in Supabase Storage
   * 
   * @param cacheKey - Cache key
   * @returns Cached tile URL or null
   */
  private async getCachedTileUrl(cacheKey: string): Promise<string | null> {
    try {
      // Check if tile metadata exists in cache
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Check if tiles exist in storage
      const tilePath = `${cacheKey}/tiles.json`;
      const { data, error } = await supabase.storage
        .from('satellite-imagery')
        .list(cacheKey);

      if (error || !data || data.length === 0) {
        return null;
      }

      // Generate signed URL for cached tiles
      const { data: urlData } = await supabase.storage
        .from('satellite-imagery')
        .createSignedUrl(tilePath, 86400); // 24 hour expiry

      return urlData?.signedUrl || null;
    } catch (error) {
      // If cache check fails, return null to trigger fresh generation
      console.error('Cache check failed:', error);
      return null;
    }
  }

  /**
   * Generate tiles from GEE imagery and cache in Supabase Storage
   * 
   * This method:
   * 1. Queries GEE for the imagery
   * 2. Generates map tiles optimized for web display
   * 3. Uploads tiles to Supabase Storage
   * 4. Returns the tile URL
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry
   * @param date - Imagery date
   * @param cacheKey - Cache key for storage
   * @returns Tile URL
   */
  private async generateAndCacheTiles(
    parcelleId: string,
    geometry: MultiPolygon,
    date: Date,
    cacheKey: string
  ): Promise<string> {
    try {
      // Get GEE map ID for the imagery
      const mapId = await this.getGEEMapId(geometry, date);

      // Generate tile URL template for Leaflet/Google Maps
      // GEE provides tiles in the format: https://earthengine.googleapis.com/v1/projects/{project}/maps/{mapid}/tiles/{z}/{x}/{y}
      const tileUrlTemplate = this.createTileUrlTemplate(mapId);

      // Cache tile metadata in Supabase Storage
      await this.cacheTileMetadata(cacheKey, {
        parcelleId,
        date: date.toISOString(),
        mapId,
        tileUrlTemplate,
        bounds: this.calculateBounds(geometry),
        createdAt: new Date().toISOString(),
      });

      return tileUrlTemplate;
    } catch (error) {
      throw new SatelliteError(
        `Failed to generate tiles: ${(error as Error).message}`,
        'TILE_GENERATION_FAILED',
        500
      );
    }
  }

  /**
   * Get Google Earth Engine Map ID for imagery using the SDK.
   * Returns a tile URL template that proxies through our Next.js API
   * to avoid CORS and authentication issues in the browser.
   */
  private async getGEEMapId(
    geometry: MultiPolygon,
    date: Date
  ): Promise<string> {
    const ee = await getEE();
    const geeGeometry = ee.Geometry(this.toGEEGeometry(geometry));

    // Search window: ±15 days around the requested date
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 15);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 15);

    // Get least-cloudy Sentinel-2 image in the window
    const image = ee.ImageCollection(SENTINEL2_COLLECTION)
      .filterDate(startDate.toISOString(), endDate.toISOString())
      .filterBounds(geeGeometry)
      .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 30))
      .sort('CLOUDY_PIXEL_PERCENTAGE', true)
      .first()
      .select(['B4', 'B3', 'B2']); // True color RGB

    // Visualize as true-color RGB
    const visualized = image.visualize({
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 3000,
      gamma: 1.4,
    });

    // Get the map ID with embedded token from the SDK
    const mapIdResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
      visualized.getMapId({}, (mapId: Record<string, unknown>, err: string) => {
        if (err) reject(new Error(`GEE getMapId failed: ${err}`));
        else {
          console.log('[ImageryService] getMapId result keys:', Object.keys(mapId ?? {}));
          resolve(mapId);
        }
      });
    });

    // The SDK can return the token in different fields depending on version:
    // - Legacy: { mapid: string, token: string }
    // - Newer:  { mapid: string, urlFormat: string } (token embedded in urlFormat)
    const geeMapId = (mapIdResult.mapid ?? mapIdResult.name ?? '') as string;
    const token = (mapIdResult.token ?? '') as string;
    const urlFormat = (mapIdResult.urlFormat ?? '') as string;

    console.log(`[ImageryService] mapid=${geeMapId}, token=${token ? 'present' : 'empty'}, urlFormat=${urlFormat ? 'present' : 'empty'}`);

    // If urlFormat is available, it contains the full tile URL template with auth embedded.
    // We return it as DIRECT so createTileUrlTemplate can extract the mapId and proxy it.
    if (urlFormat && !token) {
      console.log(`[ImageryService] urlFormat available, will proxy via Next.js (avoids CORS)`);
      return `DIRECT|||${urlFormat}`;
    }

    // Return the mapid and token joined with a triple-pipe separator
    // (avoids conflicts since GEE tokens don't contain "|||")
    return `${geeMapId}|||${token}`;
  }

  /**
   * Create a tile URL template for map libraries.
   *
   * All cases route through the Next.js proxy to avoid CORS issues in the browser.
   *
   * Case 1: DIRECT, urlFormat from newer SDK (contains token embedded in URL).
   *   Extract the GEE map path from the urlFormat and proxy without a token
   *   (the proxy generates its own OAuth token via service account).
   *
   * Case 2: Legacy, mapId + token from older SDK.
   *   Proxy through /api/satellite/tiles/[mapId]/{z}/{x}/{y}?token=...
   */
  private createTileUrlTemplate(mapId: string): string {
    // Case 1: urlFormat from newer SDK
    // urlFormat looks like: https://earthengine.googleapis.com/v1/projects/.../maps/MAP_ID/tiles/{z}/{x}/{y}?token=...
    if (mapId.startsWith('DIRECT|||')) {
      const urlFormat = mapId.substring('DIRECT|||'.length);
      console.log(`[ImageryService] Tile URL (direct urlFormat): ${urlFormat.substring(0, 120)}`);

      // Extract the GEE map path (everything between /v1/ and /tiles/{z}/{x}/{y})
      // e.g. "projects/earthengine-legacy/maps/abc123-def456"
      const match = urlFormat.match(/\/v1\/(projects\/[^/]+\/maps\/[^/]+)\/tiles/);
      if (match) {
        const geeMapPath = match[1];
        // Encode as base64url to avoid slash issues in Next.js dynamic routing
        const encodedMapId = Buffer.from(geeMapPath).toString('base64url');
        console.log(`[ImageryService] Proxying via /api/satellite/tiles/${geeMapPath}/{z}/{x}/{y} (no token, proxy uses OAuth)`);
        // No token needed, the proxy generates its own OAuth token
        return `/api/satellite/tiles/${encodedMapId}/{z}/{x}/{y}`;
      }

      // Fallback: if we can't parse the map path, log a warning and use the proxy with encoded URL
      // This should not happen with standard GEE urlFormat
      console.warn(`[ImageryService] Could not extract mapId from urlFormat, falling back to direct URL`);
      return urlFormat;
    }

    // Case 2: Legacy mapId + token, proxy through Next.js
    const separatorIdx = mapId.indexOf('|||');
    const geeMapId = separatorIdx >= 0 ? mapId.substring(0, separatorIdx) : mapId;
    const token = separatorIdx >= 0 ? mapId.substring(separatorIdx + 3) : '';

    // Encode as base64url to avoid slash issues in Next.js dynamic routing
    const encodedMapId = Buffer.from(geeMapId).toString('base64url');
    const encodedToken = encodeURIComponent(token);
    const tokenParam = token ? `?token=${encodedToken}` : '';
    console.log(`[ImageryService] Proxying via /api/satellite/tiles/${geeMapId}/{z}/{x}/{y} (legacy token: ${token ? 'present' : 'none'})`);
    return `/api/satellite/tiles/${encodedMapId}/{z}/{x}/{y}${tokenParam}`;
  }

  /**
   * Cache tile metadata in Supabase Storage
   * 
   * Stores tile metadata (map ID, URL template, bounds) in Supabase Storage
   * for future retrieval. This enables offline access and reduces GEE API calls.
   * 
   * @param cacheKey - Cache key
   * @param metadata - Tile metadata
   */
  private async cacheTileMetadata(
    cacheKey: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Store metadata as JSON
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });

      const tilePath = `${cacheKey}/tiles.json`;

      const { error } = await supabase.storage
        .from('satellite-imagery')
        .upload(tilePath, metadataBlob, {
          contentType: 'application/json',
          upsert: true,
        });

      if (error) {
        console.error('Failed to cache tile metadata:', error);
        // Don't throw - caching failure shouldn't break tile generation
      }

      // Also store in satellite_cache_metadata table for tracking
      await this.storeCacheMetadata(cacheKey, tilePath, metadataBlob.size);
    } catch (error) {
      console.error('Failed to cache tile metadata:', error);
      // Don't throw - caching failure shouldn't break tile generation
    }
  }

  /**
   * Store cache metadata in database for tracking and management
   * 
   * @param cacheKey - Cache key
   * @param storageUrl - Storage URL
   * @param sizeBytes - File size in bytes
   */
  private async storeCacheMetadata(
    cacheKey: string,
    storageUrl: string,
    sizeBytes: number
  ): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Extract parcelle ID from cache key
      const parcelleId = cacheKey.split('/')[0];

      // Calculate expiration (90 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const { error } = await supabase
        .from('satellite_cache_metadata')
        .upsert({
          parcelle_id: parcelleId,
          cache_key: cacheKey,
          data_type: 'imagery',
          storage_url: storageUrl,
          size_bytes: sizeBytes,
          last_accessed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        console.error('Failed to store cache metadata:', error);
      }
    } catch (error) {
      console.error('Failed to store cache metadata:', error);
    }
  }

  /**
   * Optimize tile size and resolution for web display
   * 
   * This method applies optimization parameters to reduce tile size while
   * maintaining visual quality for web display. Optimizations include:
   * - WebP format for better compression (with JPEG fallback)
   * - Progressive loading support
   * - Resolution adjustment (256x256 or 512x512 pixels per tile)
   * - Quality-based compression
   * 
   * Task 6.4.1: Added WebP format support and progressive loading
   * 
   * @param tileSize - Tile size in pixels (default 256)
   * @param quality - Image quality 0-100 (default 85)
   * @param format - Image format ('webp' or 'jpeg', default 'webp')
   * @param progressive - Enable progressive loading (default true)
   * @returns Optimization parameters
   */
  getOptimizationParams(
    tileSize: number = 256,
    quality: number = 85,
    format: 'webp' | 'jpeg' = 'webp',
    progressive: boolean = true
  ): Record<string, unknown> {
    return {
      tileSize,
      quality,
      format: format === 'webp' ? 'image/webp' : 'image/jpeg',
      compression: format === 'webp' ? 'WEBP' : 'JPEG',
      progressive, // Enable progressive loading
      maxZoom: 18, // Limit zoom level to prevent excessive API calls
      minZoom: 10, // Minimum zoom for satellite imagery
      // WebP-specific optimizations
      ...(format === 'webp' && {
        webpQuality: quality,
        webpMethod: 4, // Compression method (0-6, 4 is balanced)
        webpLossless: false, // Use lossy compression for smaller files
      }),
    };
  }

  /**
   * Check if imagery is available for a specific date and location
   * 
   * @param geometry - Parcelle geometry
   * @param date - Target date
   * @param cloudCoverThreshold - Maximum acceptable cloud cover
   * @returns True if suitable imagery is available
   */
  async isImageryAvailable(
    geometry: MultiPolygon,
    date: Date,
    cloudCoverThreshold: number = DEFAULT_CLOUD_COVER_THRESHOLD
  ): Promise<boolean> {
    try {
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 7); // Check 7 days before

      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 7); // Check 7 days after

      const dates = await this.getAvailableDates(
        geometry,
        startDate,
        endDate,
        cloudCoverThreshold
      );

      return dates.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the closest available imagery date to a target date
   * 
   * @param geometry - Parcelle geometry
   * @param targetDate - Target date
   * @param maxDaysDifference - Maximum days difference from target (default 30)
   * @param cloudCoverThreshold - Maximum acceptable cloud cover
   * @returns Closest available date or null if none found
   */
  async getClosestDate(
    geometry: MultiPolygon,
    targetDate: Date,
    maxDaysDifference: number = 30,
    cloudCoverThreshold: number = DEFAULT_CLOUD_COVER_THRESHOLD
  ): Promise<ImageryDate | null> {
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - maxDaysDifference);

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + maxDaysDifference);

    const dates = await this.getAvailableDates(
      geometry,
      startDate,
      endDate,
      cloudCoverThreshold
    );

    if (dates.length === 0) {
      return null;
    }

    // Find the date closest to target
    const targetTime = targetDate.getTime();
    let closestDate = dates[0];
    let minDifference = Math.abs(dates[0].date.getTime() - targetTime);

    for (const date of dates) {
      const difference = Math.abs(date.date.getTime() - targetTime);
      if (difference < minDifference) {
        minDifference = difference;
        closestDate = date;
      }
    }

    return closestDate;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of ImageryService
 * 
 * Use this instance throughout the application to maintain a single
 * authentication token cache.
 */
export const imageryService = new ImageryService();

