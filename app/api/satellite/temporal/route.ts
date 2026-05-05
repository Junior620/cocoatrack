/**
 * GET /api/satellite/temporal
 * 
 * Retrieves temporal NDVI data for a parcelle over a specified date range.
 * Returns a timeline of NDVI values with summary statistics including trend analysis,
 * significant changes, and average values.
 * 
 * Query Parameters:
 * - parcelleId (required): UUID of the parcelle
 * - startDate (required): Start date in ISO 8601 format (YYYY-MM-DD)
 * - endDate (required): End date in ISO 8601 format (YYYY-MM-DD)
 * - interval (optional): Time interval - 'daily', 'weekly', or 'monthly' (default: 'monthly')
 * 
 * Response:
 * - 200: Temporal analysis data with timeline and summary statistics
 * - 400: Invalid request parameters
 * - 401: Unauthorized (missing or invalid authentication)
 * - 403: Forbidden (user does not have access to this parcelle)
 * - 404: Parcelle not found
 * - 422: Insufficient data for analysis
 * - 500: Internal server error
 * 
 * Requirements: Task 3.2.1
 * - Implement GET handler with query params (parcelleId, startDate, endDate, interval)
 * - Add authentication and authorization
 * - Call temporal service to retrieve data
 * - Return timeline with summary statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';
import { InsufficientDataError, NDVICalculationError } from '@/lib/satellite/types';

/**
 * GET handler for temporal NDVI data retrieval
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Extract and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const parcelleId = searchParams.get('parcelleId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const interval = searchParams.get('interval') || 'monthly';

    // Validate required parameters
    if (!parcelleId) {
      return NextResponse.json(
        {
          error: 'Missing required parameter: parcelleId',
          code: 'MISSING_PARCELLE_ID',
        },
        { status: 400 }
      );
    }

    if (!startDateStr) {
      return NextResponse.json(
        {
          error: 'Missing required parameter: startDate',
          code: 'MISSING_START_DATE',
        },
        { status: 400 }
      );
    }

    if (!endDateStr) {
      return NextResponse.json(
        {
          error: 'Missing required parameter: endDate',
          code: 'MISSING_END_DATE',
        },
        { status: 400 }
      );
    }

    // Validate interval parameter
    if (!['daily', 'weekly', 'monthly'].includes(interval)) {
      return NextResponse.json(
        {
          error: 'Invalid interval parameter. Must be one of: daily, weekly, monthly',
          code: 'INVALID_INTERVAL',
        },
        { status: 400 }
      );
    }

    // Parse and validate dates
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid startDate format. Expected ISO 8601 format (YYYY-MM-DD)',
          code: 'INVALID_START_DATE',
        },
        { status: 400 }
      );
    }

    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid endDate format. Expected ISO 8601 format (YYYY-MM-DD)',
          code: 'INVALID_END_DATE',
        },
        { status: 400 }
      );
    }

    // Validate date range
    if (startDate > endDate) {
      return NextResponse.json(
        {
          error: 'startDate must be before or equal to endDate',
          code: 'INVALID_DATE_RANGE',
        },
        { status: 400 }
      );
    }

    // Validate date range is not too large (max 15 years)
    const maxRangeMs = 15 * 365 * 24 * 60 * 60 * 1000; // 15 years in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      return NextResponse.json(
        {
          error: 'Date range exceeds maximum allowed (15 years)',
          code: 'DATE_RANGE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // Step 2: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Step 3: Verify user has access to the parcelle
    // Check if parcelle exists and user has permission to view it
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, geometry')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      // Check if it's a permission error or not found
      if (parcelleError?.code === 'PGRST116') {
        return NextResponse.json(
          {
            error: 'Parcelle not found',
            code: 'PARCELLE_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      // Permission denied (RLS policy blocked access)
      return NextResponse.json(
        {
          error: 'You do not have permission to access this parcelle',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Step 4: Check Redis cache for temporal data
    const cacheKey = {
      parcelleId,
      startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
      endDate: endDate.toISOString().split('T')[0],
      interval: interval as 'daily' | 'weekly' | 'monthly',
    };

    const cachedData = await redisCacheService.getTemporalData(cacheKey);

    if (cachedData) {
      console.log(`[Temporal API] Cache hit for parcelle ${parcelleId}`);
      return NextResponse.json(
        {
          success: true,
          data: cachedData.data,
          cached: true,
          cachedAt: new Date(cachedData.cachedAt).toISOString(),
        },
        { status: 200 }
      );
    }

    console.log(`[Temporal API] Cache miss for parcelle ${parcelleId}`);

    // Step 5: Call temporal service to retrieve data
    console.log(`[Temporal API] Retrieving temporal data for parcelle ${parcelleId}`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interval,
      userId: user.id,
    });

    const summary = await ndviService.calculateTemporalStatistics(
      parcelleId,
      startDate,
      endDate,
      interval as 'daily' | 'weekly' | 'monthly',
      {
        interpolateGaps: false, // Don't interpolate gaps by default
        supabase, // Pass authenticated Supabase client
      }
    );

    // Step 6: Prepare response data
    const responseData = {
      parcelleId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interval,
      summary: {
        timeline: summary.timeline.map(point => ({
          date: point.date.toISOString(),
          ndvi: point.ndvi,
          cloudCover: point.cloudCover,
          healthStatus: point.healthStatus,
          hasSignificantChange: point.hasSignificantChange,
        })),
        trend: summary.trend ? {
          trend: summary.trend.trend,
          changeRate: summary.trend.changeRate,
          dataPoints: summary.trend.dataPoints,
          startDate: summary.trend.startDate.toISOString(),
          endDate: summary.trend.endDate.toISOString(),
          startNDVI: summary.trend.startNDVI,
          endNDVI: summary.trend.endNDVI,
        } : null, // null when insufficient data for trend calculation
        significantChanges: summary.significantChanges,
        averageNDVI: summary.averageNDVI,
        averageCloudCover: summary.averageCloudCover,
      },
    };

    // Step 7: Cache the response data in Redis
    await redisCacheService.setTemporalData(cacheKey, { data: responseData });

    // Step 8: Return timeline with summary statistics
    return NextResponse.json(
      {
        success: true,
        data: responseData,
        cached: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Temporal API] Error retrieving temporal data:', error);

    // Handle known error types
    if (error instanceof InsufficientDataError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: {
            requiredDataPoints: error.requiredDataPoints,
            availableDataPoints: error.availableDataPoints,
          },
        },
        { status: 422 }
      );
    }

    if (error instanceof NDVICalculationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: {
            parcelleId: error.parcelleId,
            reason: error.reason,
          },
        },
        { status: 500 }
      );
    }

    // Handle unknown errors
    return NextResponse.json(
      {
        error: 'Failed to retrieve temporal data',
        code: 'INTERNAL_SERVER_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
