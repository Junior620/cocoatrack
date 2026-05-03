/**
 * TypeScript types for satellite imagery analysis feature
 * 
 * This module defines all core data types used throughout the satellite imagery
 * analysis system, including imagery data, NDVI results, deforestation events,
 * temporal analysis, yield predictions, and custom error types.
 */

import type { GeoJSON } from 'geojson';

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Health status classification based on NDVI values
 * - excellent: 0.7-1.0
 * - good: 0.6-0.7
 * - fair: 0.5-0.6
 * - poor: 0.3-0.5
 * - critical: 0.0-0.3
 */
export type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Satellite imagery data retrieved from Google Earth Engine
 */
export interface ImageryData {
  id: string;
  parcelleId: string;
  acquisitionDate: Date;
  cloudCoverPercent: number;
  satelliteSource: 'sentinel-2';
  tileUrl: string;
  bounds: GeoJSON.BBox;
  resolutionMeters: number;
  createdAt: Date;
}

/**
 * NDVI (Normalized Difference Vegetation Index) calculation result
 * NDVI = (NIR - Red) / (NIR + Red)
 * Range: -1 to 1
 */
export interface NDVIResult {
  id: string;
  parcelleId: string;
  imageryId: string | null;
  calculationDate: Date;
  meanNDVI: number; // -1 to 1
  minNDVI: number;
  maxNDVI: number;
  stdDevNDVI: number;
  healthStatus: HealthStatus;
  ndviRasterUrl: string | null;
  createdAt: Date;
}

/**
 * Deforestation event detected through temporal NDVI analysis
 */
export interface DeforestationEvent {
  id: string;
  parcelleId: string;
  baselineDate: Date;
  detectionDate: Date;
  baselineNDVI: number;
  currentNDVI: number;
  ndviChange: number; // Negative value indicates vegetation loss
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  status: 'pending' | 'acknowledged' | 'disputed' | 'resolved';
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  acknowledgmentNotes: string | null;
  disputedBy: string | null;
  disputedAt: Date | null;
  disputeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Single data point in temporal NDVI analysis
 */
export interface TemporalDataPoint {
  date: Date;
  ndvi: number;
  cloudCover: number;
  healthStatus: HealthStatus;
  hasSignificantChange: boolean; // NDVI change > 0.15 from previous
}

/**
 * ML-based yield prediction for a parcelle
 */
export interface YieldPrediction {
  id: string;
  parcelleId: string;
  predictionDate: Date;
  harvestSeason: string; // e.g., "2024-Q4"
  predictedYieldKgPerHa: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceIntervalLower: number;
  confidenceIntervalUpper: number;
  modelVersion: string;
  inputFeatures: {
    meanNDVI: number;
    ndviTrend: number;
    historicalYield: number[];
    surfaceHectares: number;
  };
  actualYieldKgPerHa: number | null;
  createdAt: Date;
}

// ============================================================================
// Export and Report Options
// ============================================================================

/**
 * Options for KML export functionality
 */
export interface KMLExportOptions {
  includeTemporal: boolean;
  includeNDVI: boolean;
  includeDeforestation: boolean;
  startDate?: Date;
  endDate?: Date;
  format: 'kml' | 'kmz'; // kmz is compressed
}

/**
 * Options for certification report generation
 */
export interface ReportOptions {
  includeBeforeAfter: boolean;
  includeNDVITrend: boolean;
  includeYieldPrediction: boolean;
  baselineDate: Date;
  language: 'fr' | 'en';
}

// ============================================================================
// Cache and Metadata Types
// ============================================================================

/**
 * Cache metadata for satellite data management
 */
export interface CacheMetadata {
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
 * Cache statistics for monitoring
 */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitRate: number; // 0-1
  oldestEntry: Date;
  newestEntry: Date;
}

/**
 * Available imagery date with metadata
 */
export interface ImageryDate {
  date: Date;
  cloudCoverPercent: number;
  available: boolean;
}

/**
 * Sentinel-2 band data for NDVI calculation
 */
export interface BandData {
  red: number[][]; // Band 4
  nir: number[][]; // Band 8
  bounds: GeoJSON.BBox;
  resolution: number;
}

// ============================================================================
// Temporal Analysis Types
// ============================================================================

/**
 * NDVI trend over time
 */
export interface NDVITrend {
  trend: 'improving' | 'stable' | 'declining';
  changeRate: number; // NDVI units per month
  dataPoints: number;
  startDate: Date;
  endDate: Date;
  startNDVI: number;
  endNDVI: number;
}

/**
 * Temporal analysis summary
 */
export interface TemporalAnalysisSummary {
  timeline: TemporalDataPoint[];
  trend: NDVITrend;
  significantChanges: number;
  averageNDVI: number;
  averageCloudCover: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request parameters for imagery retrieval
 */
export interface ImageryRequest {
  parcelleId: string;
  date?: Date;
  cloudCoverThreshold?: number;
}

/**
 * Request parameters for NDVI calculation
 */
export interface NDVIRequest {
  parcelleId: string;
  date?: Date;
  forceRecalculate?: boolean;
}

/**
 * Request parameters for temporal analysis
 */
export interface TemporalAnalysisRequest {
  parcelleId: string;
  startDate: Date;
  endDate: Date;
  interval: 'daily' | 'weekly' | 'monthly';
}

/**
 * Request parameters for deforestation detection
 */
export interface DeforestationCheckRequest {
  parcelleId: string;
  baselineDate?: Date; // Defaults to Dec 31, 2020
  currentDate?: Date; // Defaults to now
}

/**
 * Response for imagery retrieval
 */
export interface ImageryResponse {
  imagery: ImageryData;
  cached: boolean;
  cacheAge?: number; // milliseconds
}

/**
 * Response for NDVI calculation
 */
export interface NDVIResponse {
  ndvi: NDVIResult;
  cached: boolean;
  recommendation?: string;
}

/**
 * Response for temporal analysis
 */
export interface TemporalAnalysisResponse {
  summary: TemporalAnalysisSummary;
  cached: boolean;
}

/**
 * Response for deforestation check
 */
export interface DeforestationCheckResponse {
  alerts: DeforestationEvent[];
  compliant: boolean;
  summary: {
    totalAlerts: number;
    pendingAlerts: number;
    acknowledgedAlerts: number;
    disputedAlerts: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error class for satellite imagery operations
 */
export class SatelliteError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'SatelliteError';
    Object.setPrototypeOf(this, SatelliteError.prototype);
  }
}

/**
 * Error thrown when satellite imagery is unavailable for a parcelle
 */
export class ImageryUnavailableError extends SatelliteError {
  constructor(
    message: string = 'Satellite imagery is unavailable for the requested date',
    public parcelleId?: string,
    public requestedDate?: Date
  ) {
    super(message, 'IMAGERY_UNAVAILABLE', 404);
    this.name = 'ImageryUnavailableError';
    Object.setPrototypeOf(this, ImageryUnavailableError.prototype);
  }
}

/**
 * Error thrown when Google Earth Engine API rate limit is exceeded
 */
export class RateLimitError extends SatelliteError {
  constructor(
    message: string = 'Google Earth Engine API rate limit exceeded',
    public retryAfter?: number // seconds
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Error thrown when cloud cover exceeds acceptable threshold
 */
export class CloudCoverError extends SatelliteError {
  constructor(
    message: string = 'Cloud cover exceeds acceptable threshold',
    public cloudCoverPercent?: number,
    public threshold?: number
  ) {
    super(message, 'CLOUD_COVER_EXCEEDED', 422);
    this.name = 'CloudCoverError';
    Object.setPrototypeOf(this, CloudCoverError.prototype);
  }
}

/**
 * Error thrown when NDVI calculation fails
 */
export class NDVICalculationError extends SatelliteError {
  constructor(
    message: string = 'NDVI calculation failed',
    public parcelleId?: string,
    public reason?: string
  ) {
    super(message, 'NDVI_CALCULATION_FAILED', 500);
    this.name = 'NDVICalculationError';
    Object.setPrototypeOf(this, NDVICalculationError.prototype);
  }
}

/**
 * Error thrown when Google Earth Engine authentication fails
 */
export class AuthenticationError extends SatelliteError {
  constructor(message: string = 'Google Earth Engine authentication failed') {
    super(message, 'AUTHENTICATION_FAILED', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error thrown when parcelle geometry is invalid
 */
export class InvalidGeometryError extends SatelliteError {
  constructor(
    message: string = 'Invalid parcelle geometry',
    public parcelleId?: string
  ) {
    super(message, 'INVALID_GEOMETRY', 400);
    this.name = 'InvalidGeometryError';
    Object.setPrototypeOf(this, InvalidGeometryError.prototype);
  }
}

/**
 * Error thrown when insufficient data is available for analysis
 */
export class InsufficientDataError extends SatelliteError {
  constructor(
    message: string = 'Insufficient data for analysis',
    public requiredDataPoints?: number,
    public availableDataPoints?: number
  ) {
    super(message, 'INSUFFICIENT_DATA', 422);
    this.name = 'InsufficientDataError';
    Object.setPrototypeOf(this, InsufficientDataError.prototype);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid HealthStatus
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    typeof value === 'string' &&
    ['excellent', 'good', 'fair', 'poor', 'critical'].includes(value)
  );
}

/**
 * Type guard to check if a value is a valid DeforestationEvent status
 */
export function isDeforestationStatus(
  value: unknown
): value is DeforestationEvent['status'] {
  return (
    typeof value === 'string' &&
    ['pending', 'acknowledged', 'disputed', 'resolved'].includes(value)
  );
}

/**
 * Type guard to check if an error is a SatelliteError
 */
export function isSatelliteError(error: unknown): error is SatelliteError {
  return error instanceof SatelliteError;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial NDVI result for updates
 */
export type PartialNDVIResult = Partial<Omit<NDVIResult, 'id' | 'parcelleId' | 'createdAt'>>;

/**
 * Partial deforestation event for updates
 */
export type PartialDeforestationEvent = Partial<
  Omit<DeforestationEvent, 'id' | 'parcelleId' | 'createdAt'>
>;

/**
 * Database row types (snake_case from database)
 */
export interface ImageryDataRow {
  id: string;
  parcelle_id: string;
  acquisition_date: string;
  cloud_cover_percent: number;
  satellite_source: string;
  tile_url: string;
  bounds: GeoJSON.BBox;
  resolution_meters: number;
  created_at: string;
}

export interface NDVIResultRow {
  id: string;
  parcelle_id: string;
  imagery_id: string | null;
  calculation_date: string;
  mean_ndvi: number;
  min_ndvi: number;
  max_ndvi: number;
  std_dev_ndvi: number;
  health_status: string;
  ndvi_raster_url: string | null;
  created_at: string;
}

export interface DeforestationEventRow {
  id: string;
  parcelle_id: string;
  baseline_date: string;
  detection_date: string;
  baseline_ndvi: number;
  current_ndvi: number;
  ndvi_change: number;
  affected_area_hectares: number;
  affected_area_percent: number;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgment_notes: string | null;
  disputed_by: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface YieldPredictionRow {
  id: string;
  parcelle_id: string;
  prediction_date: string;
  harvest_season: string;
  predicted_yield_kg_per_ha: number;
  confidence_level: string;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  model_version: string;
  input_features: Record<string, unknown>;
  actual_yield_kg_per_ha: number | null;
  created_at: string;
}
