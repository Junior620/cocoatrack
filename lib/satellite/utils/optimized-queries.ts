/**
 * Optimized database queries for satellite imagery analysis
 * 
 * This module provides type-safe wrappers around optimized database functions
 * and materialized views for improved query performance.
 */

import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface LatestNDVIResult {
  calculation_date: string;
  mean_ndvi: number;
  health_status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  ndvi_raster_url: string | null;
}

export interface NDVITrendPoint {
  calculation_date: string;
  mean_ndvi: number;
  health_status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  change_from_previous: number | null;
}

export interface ParcelleHealthSummary {
  parcelle_id: string;
  parcelle_nom: string;
  cooperative_id: string;
  planteur_id: string;
  latest_mean_ndvi: number;
  latest_health_status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  latest_calculation_date: string;
  total_ndvi_calculations: number;
  pending_deforestation_alerts: number;
}

export interface PendingDeforestationAlert {
  alert_id: string;
  parcelle_id: string;
  detection_date: string;
  baseline_ndvi: number;
  current_ndvi: number;
  ndvi_change: number;
  affected_area_hectares: number;
  affected_area_percent: number;
  created_at: string;
}

export interface MonthlyNDVIData {
  month: string;
  avg_mean_ndvi: number;
  min_mean_ndvi: number;
  max_mean_ndvi: number;
  data_points: number;
}

export interface QueryCacheOptions {
  ttlSeconds?: number;
  forceRefresh?: boolean;
}

// ============================================================================
// Optimized Query Functions
// ============================================================================

/**
 * Get the latest NDVI result for a parcelle using materialized view
 * 
 * This is significantly faster than querying ndvi_results directly with ORDER BY + LIMIT
 */
export async function getLatestNDVI(
  parcelleId: string,
  supabase?: SupabaseClient
): Promise<LatestNDVIResult | null> {
  const client = supabase || createClient();

  const { data, error } = await (client as any).rpc('get_latest_ndvi', {
    p_parcelle_id: parcelleId,
  });

  if (error) {
    console.error('Error fetching latest NDVI:', error);
    throw error;
  }

  return data?.[0] || null;
}

/**
 * Get NDVI trend data with change calculations
 * 
 * Uses optimized query with LAG window function for efficient change calculation
 */
export async function getNDVITrend(
  parcelleId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {},
  supabase?: SupabaseClient
): Promise<NDVITrendPoint[]> {
  const client = supabase || createClient();

  const startDate = options.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  const endDate = options.endDate || new Date();

  const { data, error } = await (client as any).rpc('get_ndvi_trend', {
    p_parcelle_id: parcelleId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) {
    console.error('Error fetching NDVI trend:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get parcelles filtered by health status with pagination
 * 
 * Uses materialized view for fast filtering and aggregation
 */
export async function getParcellesByHealthStatus(
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
  options: {
    cooperativeId?: string;
    limit?: number;
    offset?: number;
  } = {},
  supabase?: SupabaseClient
): Promise<ParcelleHealthSummary[]> {
  const client = supabase || createClient();

  const { data, error } = await (client as any).rpc('get_parcelles_by_health_status', {
    p_health_status: healthStatus,
    p_cooperative_id: options.cooperativeId || null,
    p_limit: options.limit || 50,
    p_offset: options.offset || 0,
  });

  if (error) {
    console.error('Error fetching parcelles by health status:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get pending deforestation alerts with pagination
 * 
 * Uses partial index on pending status for fast filtering
 */
export async function getPendingDeforestationAlerts(
  options: {
    cooperativeId?: string;
    limit?: number;
    offset?: number;
  } = {},
  supabase?: SupabaseClient
): Promise<PendingDeforestationAlert[]> {
  const client = supabase || createClient();

  const { data, error } = await (client as any).rpc('get_pending_deforestation_alerts', {
    p_cooperative_id: options.cooperativeId || null,
    p_limit: options.limit || 50,
    p_offset: options.offset || 0,
  });

  if (error) {
    console.error('Error fetching pending deforestation alerts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get temporal NDVI data aggregated by month
 * 
 * Efficient aggregation for temporal analysis and charting
 */
export async function getTemporalNDVIMonthly(
  parcelleId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {},
  supabase?: SupabaseClient
): Promise<MonthlyNDVIData[]> {
  const client = supabase || createClient();

  const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
  const endDate = options.endDate || new Date();

  const { data, error } = await (client as any).rpc('get_temporal_ndvi_monthly', {
    p_parcelle_id: parcelleId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  });

  if (error) {
    console.error('Error fetching temporal NDVI monthly:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// Query Result Caching Functions
// ============================================================================

/**
 * Generate a cache key for a query
 */
function generateCacheKey(
  queryType: string,
  parameters: Record<string, any>
): string {
  const sortedParams = Object.keys(parameters)
    .sort()
    .map((key) => `${key}:${JSON.stringify(parameters[key])}`)
    .join('|');
  return `${queryType}:${sortedParams}`;
}

/**
 * Get cached query result
 */
export async function getCachedQueryResult<T = any>(
  cacheKey: string,
  queryType: string,
  ttlSeconds: number = 3600,
  supabase?: SupabaseClient
): Promise<T | null> {
  const client = supabase || createClient();

  const { data, error } = await (client as any).rpc('get_cached_query_result', {
    p_cache_key: cacheKey,
    p_query_type: queryType,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    console.error('Error fetching cached query result:', error);
    return null;
  }

  return data as T;
}

/**
 * Set cached query result
 */
export async function setCachedQueryResult(
  cacheKey: string,
  queryType: string,
  resultData: any,
  parameters: Record<string, any>,
  ttlSeconds: number = 3600,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || createClient();

  const { error } = await (client as any).rpc('set_cached_query_result', {
    p_cache_key: cacheKey,
    p_query_type: queryType,
    p_result_data: resultData,
    p_parameters: parameters,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    console.error('Error setting cached query result:', error);
    throw error;
  }
}

/**
 * Invalidate cached query results
 */
export async function invalidateQueryCache(
  options: {
    queryType?: string;
    cacheKeyPattern?: string;
  } = {},
  supabase?: SupabaseClient
): Promise<number> {
  const client = supabase || createClient();

  const { data, error } = await (client as any).rpc('invalidate_query_cache', {
    p_query_type: options.queryType || null,
    p_cache_key_pattern: options.cacheKeyPattern || null,
  });

  if (error) {
    console.error('Error invalidating query cache:', error);
    throw error;
  }

  return data || 0;
}

/**
 * Execute a query with automatic caching
 */
export async function executeWithCache<T = any>(
  queryType: string,
  parameters: Record<string, any>,
  queryFn: () => Promise<T>,
  options: QueryCacheOptions = {},
  supabase?: SupabaseClient
): Promise<T> {
  const { ttlSeconds = 3600, forceRefresh = false } = options;
  const cacheKey = generateCacheKey(queryType, parameters);

  // Try to get cached result if not forcing refresh
  if (!forceRefresh) {
    const cachedResult = await getCachedQueryResult<T>(
      cacheKey,
      queryType,
      ttlSeconds,
      supabase
    );

    if (cachedResult !== null) {
      return cachedResult;
    }
  }

  // Execute query
  const result = await queryFn();

  // Cache the result
  await setCachedQueryResult(
    cacheKey,
    queryType,
    result,
    parameters,
    ttlSeconds,
    supabase
  );

  return result;
}

// ============================================================================
// Materialized View Refresh Functions
// ============================================================================

/**
 * Manually refresh materialized views
 * 
 * Note: Materialized views are automatically refreshed by triggers,
 * but this function can be used for manual refresh if needed
 */
export async function refreshMaterializedViews(
  views: ('latest_ndvi' | 'health_summary' | 'deforestation_alerts')[] = [
    'latest_ndvi',
    'health_summary',
    'deforestation_alerts',
  ],
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || createClient();

  const viewNames = {
    latest_ndvi: 'mv_latest_ndvi_per_parcelle',
    health_summary: 'mv_parcelle_health_summary',
    deforestation_alerts: 'mv_deforestation_alerts_by_cooperative',
  };

  for (const view of views) {
    const viewName = viewNames[view];
    const { error } = await (client as any).rpc('refresh_materialized_view', {
      view_name: viewName,
    });

    if (error) {
      console.error(`Error refreshing materialized view ${viewName}:`, error);
      // Continue with other views even if one fails
    }
  }
}

// ============================================================================
// Batch Query Functions
// ============================================================================

/**
 * Get latest NDVI for multiple parcelles in a single query
 */
export async function getLatestNDVIBatch(
  parcelleIds: string[],
  supabase?: SupabaseClient
): Promise<Map<string, LatestNDVIResult>> {
  const client = supabase || createClient();

  const { data, error } = await (client as any)
    .from('mv_latest_ndvi_per_parcelle')
    .select('*')
    .in('parcelle_id', parcelleIds);

  if (error) {
    console.error('Error fetching latest NDVI batch:', error);
    throw error;
  }

  const resultMap = new Map<string, LatestNDVIResult>();
  data?.forEach((row: LatestNDVIResult & { parcelle_id: string }) => {
    resultMap.set(row.parcelle_id, {
      calculation_date: row.calculation_date,
      mean_ndvi: row.mean_ndvi,
      health_status: row.health_status,
      ndvi_raster_url: row.ndvi_raster_url,
    });
  });

  return resultMap;
}

/**
 * Get health summary for multiple parcelles in a single query
 */
export async function getParcelleHealthSummaryBatch(
  parcelleIds: string[],
  supabase?: SupabaseClient
): Promise<Map<string, ParcelleHealthSummary>> {
  const client = supabase || createClient();

  const { data, error } = await (client as any)
    .from('mv_parcelle_health_summary')
    .select('*')
    .in('parcelle_id', parcelleIds);

  if (error) {
    console.error('Error fetching parcelle health summary batch:', error);
    throw error;
  }

  const resultMap = new Map<string, ParcelleHealthSummary>();
  data?.forEach((row: ParcelleHealthSummary) => {
    resultMap.set(row.parcelle_id, row as ParcelleHealthSummary);
  });

  return resultMap;
}
