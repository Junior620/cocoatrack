/**
 * GET /api/satellite/health-status/:parcelleId
 * 
 * Retrieve current health status for a parcelle.
 * 
 * This endpoint:
 * 1. Validates parcelleId parameter
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Retrieves the most recent NDVI result from cache/database
 * 5. Calculates NDVI trend over the past 3 months
 * 6. Returns health status with NDVI value, trend, and recommendation
 * 7. Implements 24-hour caching via Cache-Control headers
 * 
 * Requirements: Task 2.2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  type HealthStatus,
  type NDVITrend,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for parcelleId parameter
 */
const ParcelleIdSchema = z.string().uuid('Invalid parcelle ID format');

// ============================================================================
// Response Types
// ============================================================================

/**
 * Health status response data
 */
interface HealthStatusResponse {
  parcelleId: string;
  healthStatus: HealthStatus;
  meanNDVI: number;
  lastCalculationDate: Date;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changeRate: number; // NDVI units per month
    dataPoints: number;
  } | null;
  recommendation: string;
  cached: boolean;
  ndviRasterUrl: string | null;
  ndviRasterBounds: [number, number, number, number] | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create error response with consistent format
 */
function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || 'UNKNOWN_ERROR',
    },
    { status }
  );
}

/**
 * Check if user has access to the parcelle
 * 
 * Access rules:
 * - Admin: Access to all parcelles
 * - Cooperative Manager: Access to parcelles in their cooperative
 * - Agronomist: Access to parcelles they are assigned to
 * - Planteur: Access to their own parcelles
 */
async function checkParcelleAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  parcelleId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    // Type assertion for profile
    const userProfile = profile as { role: string; cooperative_id: string | null };

    // Admin has access to all parcelles
    if (userProfile.role === 'admin') {
      return { hasAccess: true };
    }

    // Get parcelle with planteur and cooperative info
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, planteurs(cooperative_id)')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      return { hasAccess: false, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = {
      id: parcelle.id,
      planteur_id: parcelle.planteur_id,
      cooperative_id: (parcelle.planteurs as { cooperative_id: string | null } | null)?.cooperative_id ?? null,
    };

    // Cooperative Manager: Check if parcelle is in their cooperative
    if (userProfile.role === 'cooperative_manager') {
      if (parcelleData.cooperative_id === userProfile.cooperative_id) {
        return { hasAccess: true };
      }
      return { hasAccess: false, error: 'Parcelle not in your cooperative' };
    }

    // Planteur: Check if they own the parcelle
    if (userProfile.role === 'planteur') {
      if (parcelleData.planteur_id === userId) {
        return { hasAccess: true };
      }
      return { hasAccess: false, error: 'You do not own this parcelle' };
    }

    // Agronomist: Check if they are assigned to the parcelle
    // (This would require an assignment table - for now, allow access to all)
    if (userProfile.role === 'agronomist') {
      return { hasAccess: true };
    }

    return { hasAccess: false, error: 'Insufficient permissions' };
  } catch (error) {
    console.error('Error checking parcelle access:', error);
    return { hasAccess: false, error: 'Failed to verify access' };
  }
}

/**
 * Get the most recent NDVI result for a parcelle
 */
async function getMostRecentNDVI(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<{
  meanNDVI: number;
  healthStatus: HealthStatus;
  calculationDate: Date;
  ndviRasterUrl: string | null;
  ndviRasterBounds: [number, number, number, number] | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('ndvi_results')
      .select('mean_ndvi, health_status, calculation_date, ndvi_raster_url, ndvi_raster_bounds')
      .eq('parcelle_id', parcelleId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getMostRecentNDVI] Supabase error:', error);
      return null;
    }
    
    if (!data) {
      console.log('[getMostRecentNDVI] No data found for parcelle:', parcelleId);
      return null;
    }

    // Type assertion for the data object
    const ndviData = data as {
      mean_ndvi: number;
      health_status: string;
      calculation_date: string;
      ndvi_raster_url: string | null;
      ndvi_raster_bounds: [number, number, number, number] | null;
    };

    return {
      meanNDVI: Number(ndviData.mean_ndvi),
      healthStatus: ndviData.health_status as HealthStatus,
      calculationDate: new Date(ndviData.calculation_date),
      ndviRasterUrl: ndviData.ndvi_raster_url,
      ndviRasterBounds: ndviData.ndvi_raster_bounds,
    };
  } catch (error) {
    console.error('Error retrieving most recent NDVI:', error);
    return null;
  }
}

/**
 * Get NDVI trend for a parcelle (past 3 months)
 */
async function getNDVITrendSafe(
  parcelleId: string
): Promise<NDVITrend | null> {
  try {
    const trend = await ndviService.getNDVITrend(parcelleId);
    return trend;
  } catch (error) {
    // If insufficient data for trend analysis, return null
    if (error instanceof InsufficientDataError) {
      return null;
    }
    // Log other errors but don't fail the request
    console.error('Error calculating NDVI trend:', error);
    return null;
  }
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/satellite/health-status/:parcelleId
 * 
 * Retrieve current health status for a parcelle
 * 
 * Path Parameters:
 * - parcelleId: UUID of the parcelle
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "parcelleId": "uuid",
 *     "healthStatus": "good",
 *     "meanNDVI": 0.65,
 *     "lastCalculationDate": "2024-01-15T00:00:00Z",
 *     "trend": {
 *       "direction": "improving",
 *       "changeRate": 0.02,
 *       "dataPoints": 5
 *     },
 *     "recommendation": "Vegetation is healthy. Monitor regularly...",
 *     "cached": true
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parcelleId: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { parcelleId: parcelleIdParam } = await params;
    
    // Step 1: Validate parcelleId parameter
    const validationResult = ParcelleIdSchema.safeParse(parcelleIdParam);

    if (!validationResult.success) {
      return errorResponse(
        'Invalid parcelle ID format',
        400,
        'VALIDATION_ERROR'
      );
    }

    const parcelleId = validationResult.data;

    // Step 2: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Step 3: Authorize access to parcelle
    const accessCheck = await checkParcelleAccess(supabase, user.id, parcelleId);
    if (!accessCheck.hasAccess) {
      return errorResponse(
        accessCheck.error || 'Access denied',
        403,
        'FORBIDDEN'
      );
    }

    // Step 4: Retrieve the most recent NDVI result
    const recentNDVI = await getMostRecentNDVI(supabase, parcelleId);

    if (!recentNDVI) {
      return errorResponse(
        'No NDVI data available for this parcelle. Please calculate NDVI first.',
        404,
        'NDVI_NOT_FOUND'
      );
    }

    // Step 5: Calculate NDVI trend over the past 3 months
    const trend = await getNDVITrendSafe(parcelleId);

    // Step 6: Get recommendation based on health status
    const recommendation = ndviService.getRecommendation(recentNDVI.healthStatus);

    // Step 7: Build response
    const response: HealthStatusResponse = {
      parcelleId,
      healthStatus: recentNDVI.healthStatus,
      meanNDVI: recentNDVI.meanNDVI,
      lastCalculationDate: recentNDVI.calculationDate,
      trend: trend
        ? {
            direction: trend.trend,
            changeRate: trend.changeRate,
            dataPoints: trend.dataPoints,
          }
        : null,
      recommendation,
      cached: true, // Data is retrieved from database cache
      ndviRasterUrl: recentNDVI.ndviRasterUrl,
      ndviRasterBounds: recentNDVI.ndviRasterBounds,
    };

    // Step 8: Return response with 24-hour cache headers
    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/satellite/health-status:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
