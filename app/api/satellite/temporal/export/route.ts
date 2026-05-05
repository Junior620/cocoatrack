/**
 * GET /api/satellite/temporal/export
 * 
 * Exports temporal NDVI data as CSV file for a parcelle over a specified date range.
 * Returns CSV content with headers: date, mean_ndvi, min_ndvi, max_ndvi, change_from_previous
 * 
 * Query Parameters:
 * - parcelleId (required): UUID of the parcelle
 * - startDate (required): Start date in ISO 8601 format (YYYY-MM-DD)
 * - endDate (required): End date in ISO 8601 format (YYYY-MM-DD)
 * - interval (optional): Time interval - 'daily', 'weekly', or 'monthly' (default: 'monthly')
 * 
 * Response:
 * - 200: CSV file content with appropriate headers
 * - 400: Invalid request parameters
 * - 401: Unauthorized (missing or invalid authentication)
 * - 403: Forbidden (user does not have access to this parcelle)
 * - 404: Parcelle not found
 * - 422: Insufficient data for analysis
 * - 500: Internal server error
 * 
 * Requirements: Task 3.4.3
 * - Generate CSV with columns: date, mean_ndvi, min_ndvi, max_ndvi, change_from_previous
 * - Trigger download in browser
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';
import { InsufficientDataError, NDVICalculationError } from '@/lib/satellite/types';
import { convertTemporalDataToCSV, generateTemporalCSVFilename } from '@/lib/satellite/utils/csv-export';

/**
 * GET handler for temporal NDVI CSV export
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

    // Validate date range is not too large (max 2 years)
    const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      return NextResponse.json(
        {
          error: 'Date range exceeds maximum allowed (2 years)',
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
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, cooperative_id, geometry')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      if (parcelleError?.code === 'PGRST116') {
        return NextResponse.json(
          {
            error: 'Parcelle not found',
            code: 'PARCELLE_NOT_FOUND',
          },
          { status: 404 }
        );
      }

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
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      interval: interval as 'daily' | 'weekly' | 'monthly',
    };

    let timeline;
    const cachedData = await redisCacheService.getTemporalData(cacheKey);

    if (cachedData && cachedData.data?.summary?.timeline) {
      console.log(`[Temporal CSV Export] Cache hit for parcelle ${parcelleId}`);
      timeline = cachedData.data.summary.timeline.map((point: any) => ({
        date: new Date(point.date),
        ndvi: point.ndvi,
        cloudCover: point.cloudCover,
        healthStatus: point.healthStatus,
        hasSignificantChange: point.hasSignificantChange,
      }));
    } else {
      console.log(`[Temporal CSV Export] Cache miss for parcelle ${parcelleId}`);

      // Step 5: Retrieve temporal data from service
      const summary = await ndviService.calculateTemporalStatistics(
        parcelleId,
        startDate,
        endDate,
        interval as 'daily' | 'weekly' | 'monthly',
        {
          interpolateGaps: false,
          supabase,
        }
      );

      timeline = summary.timeline;
    }

    // Step 6: Convert to CSV format
    const csvContent = convertTemporalDataToCSV(timeline);

    // Step 7: Generate filename
    const filename = generateTemporalCSVFilename(parcelleId, startDate, endDate);

    // Step 8: Return CSV with appropriate headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[Temporal CSV Export] Error exporting temporal data:', error);

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
        error: 'Failed to export temporal data as CSV',
        code: 'INTERNAL_SERVER_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
