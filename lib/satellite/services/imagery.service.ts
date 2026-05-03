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

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          
          throw new RateLimitError(
            'Google Earth Engine API rate limit exceeded',
            retryAfterSeconds
          );
        }

        // Handle authentication errors
        if (response.status === 401) {
          // Try refreshing token once
          if (attempt === 1) {
            await this.refreshAccessToken();
            continue; // Retry with new token
          }
          throw new AuthenticationError('Authentication failed after token refresh');
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new SatelliteError(
            `Google Earth Engine API error: ${errorText}`,
            'GEE_API_ERROR',
            response.status
          );
        }

        // Parse and return response
        const data = await response.json();
        return data as T;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (
          error instanceof RateLimitError ||
          error instanceof AuthenticationError ||
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
   * Get satellite imagery for a parcelle
   * 
   * Retrieves the most recent cloud-free Sentinel-2 imagery for the specified
   * parcelle geometry and date. Filters imagery by cloud cover threshold.
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

    // Get available dates within 30 days before target date
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 30);

    const availableDates = await this.getAvailableDates(
      geometry,
      startDate,
      date,
      cloudCoverThreshold
    );

    if (availableDates.length === 0) {
      throw new ImageryUnavailableError(
        `No cloud-free imagery available for parcelle within 30 days of ${date.toISOString()}`,
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
      id: `imagery-${parcelleId}-${mostRecentDate.date.getTime()}`,
      parcelleId,
      acquisitionDate: mostRecentDate.date,
      cloudCoverPercent: mostRecentDate.cloudCoverPercent,
      satelliteSource: 'sentinel-2',
      tileUrl,
      bounds: this.calculateBounds(geometry),
      resolutionMeters: SENTINEL2_RESOLUTION,
      createdAt: new Date(),
    };

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
    // Validate geometry
    this.validateGeometry(geometry);

    // TODO: In a real implementation, this would:
    // 1. Query GEE ImageCollection for Sentinel-2
    // 2. Filter by geometry, date range, and cloud cover
    // 3. Extract acquisition dates and cloud cover metadata
    // 4. Return sorted list of available dates
    //
    // For now, we'll return a placeholder implementation
    // This will be completed when GEE API integration is fully set up

    // Placeholder: Return empty array
    // In production, this would make an actual GEE API call
    const dates: ImageryDate[] = [];

    // Example of what the real implementation would look like:
    /*
    const geeGeometry = this.toGEEGeometry(geometry);
    
    const response = await this.makeRequest<GEEImageCollectionResponse>(
      `${GEE_API_BASE_URL}/projects/${projectId}/assets:listImages`,
      {
        method: 'POST',
        body: JSON.stringify({
          collection: SENTINEL2_COLLECTION,
          geometry: geeGeometry,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          filter: {
            cloudCover: { max: cloudCoverThreshold }
          }
        }),
      }
    );

    const dates: ImageryDate[] = response.features.map(feature => ({
      date: new Date(feature.properties['system:time_start']),
      cloudCoverPercent: this.getCloudCover(feature.properties),
      available: true,
    }));

    // Sort by date ascending
    dates.sort((a, b) => a.date.getTime() - b.date.getTime());
    */

    return dates;
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
    // Validate geometry
    this.validateGeometry(geometry);

    // Validate bands
    if (!bands || bands.length === 0) {
      throw new SatelliteError(
        'At least one band must be specified',
        'INVALID_BANDS',
        400
      );
    }

    // TODO: In a real implementation, this would:
    // 1. Query GEE for the specific image at the date
    // 2. Extract the requested bands
    // 3. Sample pixel values within the geometry
    // 4. Return band data as 2D arrays
    //
    // For now, we'll return a placeholder structure
    // This will be completed when GEE API integration is fully set up

    const bandData: BandData = {
      red: [], // TODO: Extract B4 band data from GEE
      nir: [], // TODO: Extract B8 band data from GEE
      bounds: this.calculateBounds(geometry),
      resolution: SENTINEL2_RESOLUTION,
    };

    return bandData;
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
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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
   * Get Google Earth Engine Map ID for imagery
   * 
   * This method queries GEE to get a Map ID that can be used to generate tile URLs.
   * The Map ID represents a rendered visualization of the imagery.
   * 
   * @param geometry - Parcelle geometry
   * @param date - Imagery date
   * @returns GEE Map ID
   */
  private async getGEEMapId(
    geometry: MultiPolygon,
    date: Date
  ): Promise<string> {
    // TODO: In production, this would make an actual GEE API call:
    // 
    // 1. Query Sentinel-2 collection for the date and geometry
    // 2. Apply visualization parameters (bands, min/max values)
    // 3. Request a Map ID from GEE
    // 4. Return the Map ID
    //
    // Example GEE API call structure:
    /*
    const geeGeometry = this.toGEEGeometry(geometry);
    const projectId = process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;
    
    const response = await this.makeRequest<{ name: string }>(
      `${GEE_API_BASE_URL}/projects/${projectId}/maps`,
      {
        method: 'POST',
        body: JSON.stringify({
          expression: {
            functionInvocationValue: {
              functionName: 'Image.visualize',
              arguments: {
                image: {
                  functionInvocationValue: {
                    functionName: 'ImageCollection.filterBounds',
                    arguments: {
                      collection: SENTINEL2_COLLECTION,
                      geometry: geeGeometry,
                    }
                  }
                },
                visParams: {
                  bands: ['B4', 'B3', 'B2'], // RGB
                  min: 0,
                  max: 3000,
                }
              }
            }
          }
        }),
      }
    );
    
    // Extract map ID from response
    const mapId = response.name.split('/').pop();
    return mapId;
    */

    // Placeholder: Return a mock map ID
    // This will be replaced with actual GEE API integration
    const timestamp = date.getTime();
    return `mock-map-id-${timestamp}`;
  }

  /**
   * Create a tile URL template for map libraries
   * 
   * Generates a URL template that can be used with Leaflet's L.TileLayer
   * or Google Maps' ImageMapType. The template includes {z}, {x}, {y} placeholders
   * that will be replaced by the map library with actual tile coordinates.
   * 
   * @param mapId - GEE Map ID
   * @returns Tile URL template
   * 
   * @example
   * ```typescript
   * const template = createTileUrlTemplate('abc123');
   * // Returns: 'https://earthengine.googleapis.com/v1/projects/.../maps/abc123/tiles/{z}/{x}/{y}'
   * 
   * // Usage with Leaflet:
   * L.tileLayer(template, { attribution: '© Google Earth Engine' }).addTo(map);
   * ```
   */
  private createTileUrlTemplate(mapId: string): string {
    const projectId = process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID || 'cocoatrack';
    
    // GEE tile URL format
    // In production, this would be the actual GEE tiles endpoint
    const baseUrl = `${GEE_API_BASE_URL}/projects/${projectId}/maps/${mapId}/tiles`;
    
    // Return template with {z}/{x}/{y} placeholders for map libraries
    return `${baseUrl}/{z}/{x}/{y}`;
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
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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
   * - Compression (JPEG for RGB, PNG for transparency)
   * - Resolution adjustment (256x256 or 512x512 pixels per tile)
   * - Color depth reduction
   * 
   * @param tileSize - Tile size in pixels (default 256)
   * @param quality - JPEG quality 0-100 (default 85)
   * @returns Optimization parameters
   */
  getOptimizationParams(
    tileSize: number = 256,
    quality: number = 85
  ): Record<string, unknown> {
    return {
      tileSize,
      quality,
      format: 'image/jpeg', // JPEG for smaller file size
      compression: 'JPEG',
      maxZoom: 18, // Limit zoom level to prevent excessive API calls
      minZoom: 10, // Minimum zoom for satellite imagery
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

