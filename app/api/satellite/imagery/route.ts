// CocoaTrack V2 - Satellite Imagery API Route
// GET /api/satellite/imagery - Retrieve satellite imagery for a parcelle

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import {
  parseSatelliteImageryRequest,
  formatValidationError,
} from '@/lib/validations/satellite';
import { imageryService } from '@/lib/satellite/services/imagery.service';
import {
  ImageryUnavailableError,
  RateLimitError,
  CloudCoverError,
  AuthenticationError,
  InvalidGeometryError,
  isSatelliteError,
  type ImageryResponse,
} from '@/lib/satellite/types';
import type { MultiPolygon } from 'geojson';

/**
 * GET /api/satellite/imagery
 * 
 * Retrieve satellite imagery for a parcelle with optional date and cloud cover filtering.
 * 
 * Query Parameters:
 * - parcelleId: UUID of the parcelle (required)
 * - date: ISO 8601 date string (optional, defaults to most recent)
 * - cloudCoverThreshold: Maximum cloud cover percentage 0-100 (optional, defaults to 20)
 * 
 * Rate Limiting:
 * - 100 requests per minute per user
 * - Rate limit headers included in all responses
 * 
 * Returns:
 * - 200: Imagery data with metadata
 * - 400: Invalid request parameters
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (user cannot access this parcelle)
 * - 404: Imagery not found for the specified criteria
 * - 422: Cloud cover exceeds threshold or invalid geometry
 * - 429: Too many requests (rate limit exceeded)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const response = NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in to access satellite imagery.',
        },
        { status: 401 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Apply rate limiting (100 requests per minute per user)
    const { allowed, result, response: rateLimitResponse } = applyRateLimit(request, 'api', user.id);
    if (!allowed && rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const parseResult = parseSatelliteImageryRequest(searchParams);
    
    if (!parseResult.success) {
      const { field, message } = formatValidationError(parseResult.error);
      const response = NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: {
            field,
            message,
          },
        },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    const { parcelleId, date, cloudCoverThreshold } = parseResult.data;

    // Get daysOffset from query parameter or use environment variable as fallback
    const daysOffsetParam = searchParams.get('daysOffset');
    const daysOffset = daysOffsetParam 
      ? parseInt(daysOffsetParam, 10) 
      : parseInt(process.env.SATELLITE_IMAGERY_DAYS_OFFSET || '30', 10);

    // Fetch parcelle from database to get geometry and verify access
    // RLS policies will automatically enforce access control
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, geometry, planteur_id')
      .eq('id', parcelleId)
      .eq('is_active', true)
      .single<{
        id: string;
        geometry: MultiPolygon | null;
        planteur_id: string | null;
      }>();

    if (parcelleError || !parcelle) {
      const response = NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Parcelle not found or you do not have access to this parcelle',
          details: {
            parcelleId,
          },
        },
        { status: 404 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Validate geometry exists
    if (!parcelle.geometry || typeof parcelle.geometry !== 'object') {
      const response = NextResponse.json(
        {
          error: 'INVALID_GEOMETRY',
          message: 'Parcelle does not have valid geometry data',
          details: {
            parcelleId,
          },
        },
        { status: 422 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Parse date if provided, or calculate based on offset
    // Use daysOffset from query parameter or environment variable
    const targetDate = date 
      ? new Date(date) 
      : new Date(Date.now() - daysOffset * 24 * 60 * 60 * 1000); // Subtract days offset

    // Check if imagery is already cached in database
    const { data: cachedImagery, error: cacheError } = await supabase
      .from('satellite_imagery')
      .select('*')
      .eq('parcelle_id', parcelleId)
      .eq('acquisition_date', targetDate.toISOString())
      .lte('cloud_cover_percent', cloudCoverThreshold)
      .order('acquisition_date', { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        parcelle_id: string;
        acquisition_date: string;
        cloud_cover_percent: number;
        satellite_source: string;
        tile_url: string;
        bounds: [number, number, number, number];
        resolution_meters: number;
        created_at: string;
      }>();

    // If we have cached imagery less than 24 hours old, return it
    // But skip if the tileUrl is a direct GEE URL (CORS issue, must be proxied)
    if (cachedImagery && !cacheError) {
      const cacheAge = Date.now() - new Date(cachedImagery.created_at).getTime();
      const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
      const isProxiedUrl = cachedImagery.tile_url.startsWith('/api/satellite/tiles/');

      if (cacheAge < cacheMaxAge && isProxiedUrl) {
        const response = NextResponse.json<ImageryResponse>(
          {
            imagery: {
              id: cachedImagery.id,
              parcelleId: cachedImagery.parcelle_id,
              acquisitionDate: new Date(cachedImagery.acquisition_date),
              cloudCoverPercent: cachedImagery.cloud_cover_percent,
              satelliteSource: cachedImagery.satellite_source as 'sentinel-2',
              tileUrl: cachedImagery.tile_url,
              bounds: cachedImagery.bounds as [number, number, number, number],
              resolutionMeters: cachedImagery.resolution_meters,
              createdAt: new Date(cachedImagery.created_at),
            },
            cached: true,
            cacheAge,
          },
          { status: 200 }
        );

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', '100');
        response.headers.set('X-RateLimit-Remaining', String(result.remaining));
        response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Age', String(Math.floor(cacheAge / 1000)));

        addSecurityHeaders(response);
        return response;
      }
    }

    // Call ImageryService to retrieve satellite imagery
    const imagery = await imageryService.getImagery(
      parcelleId,
      parcelle.geometry as MultiPolygon,
      targetDate,
      cloudCoverThreshold
    );

    // Store imagery metadata in database for caching
    const imageryRecord = {
      id: imagery.id,
      parcelle_id: imagery.parcelleId,
      acquisition_date: imagery.acquisitionDate.toISOString(),
      cloud_cover_percent: imagery.cloudCoverPercent,
      satellite_source: imagery.satelliteSource,
      tile_url: imagery.tileUrl,
      bounds: imagery.bounds,
      resolution_meters: imagery.resolutionMeters,
    };

    const { error: insertError } = await supabase
      .from('satellite_imagery')
      .upsert(imageryRecord as any, {
        onConflict: 'parcelle_id,acquisition_date',
      });

    if (insertError) {
      console.error('Failed to cache imagery metadata:', insertError);
      // Don't fail the request if caching fails
    }

    // Return imagery data
    const response = NextResponse.json<ImageryResponse>(
      {
        imagery: {
          id: imagery.id,
          parcelleId: imagery.parcelleId,
          acquisitionDate: imagery.acquisitionDate,
          cloudCoverPercent: imagery.cloudCoverPercent,
          satelliteSource: imagery.satelliteSource,
          tileUrl: imagery.tileUrl,
          bounds: imagery.bounds,
          resolutionMeters: imagery.resolutionMeters,
          createdAt: imagery.createdAt,
        },
        cached: false,
      },
      { status: 200 }
    );

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
    response.headers.set('X-Cache', 'MISS');

    // Add security headers
    addSecurityHeaders(response);

    return response;

  } catch (error) {
    console.error('Error in GET /api/satellite/imagery:', error);

    // Handle specific satellite errors
    if (isSatelliteError(error)) {
      const satelliteError = error;
      
      // Handle imagery unavailable
      if (error instanceof ImageryUnavailableError) {
        const response = NextResponse.json(
          {
            error: satelliteError.code,
            message: satelliteError.message,
            details: {
              parcelleId: error.parcelleId,
              requestedDate: error.requestedDate?.toISOString(),
            },
          },
          { status: satelliteError.statusCode }
        );
        addSecurityHeaders(response);
        return response;
      }

      // Handle rate limit errors
      if (error instanceof RateLimitError) {
        const response = NextResponse.json(
          {
            error: satelliteError.code,
            message: satelliteError.message,
            retryAfter: error.retryAfter,
          },
          { status: satelliteError.statusCode }
        );
        if (error.retryAfter) {
          response.headers.set('Retry-After', String(error.retryAfter));
        }
        addSecurityHeaders(response);
        return response;
      }

      // Handle cloud cover errors
      if (error instanceof CloudCoverError) {
        const response = NextResponse.json(
          {
            error: satelliteError.code,
            message: satelliteError.message,
            details: {
              cloudCoverPercent: error.cloudCoverPercent,
              threshold: error.threshold,
            },
          },
          { status: satelliteError.statusCode }
        );
        addSecurityHeaders(response);
        return response;
      }

      // Handle authentication errors
      if (error instanceof AuthenticationError) {
        const response = NextResponse.json(
          {
            error: satelliteError.code,
            message: 'Google Earth Engine authentication failed. Please contact support.',
          },
          { status: 500 } // Return 500 for GEE auth errors (not user's fault)
        );
        addSecurityHeaders(response);
        return response;
      }

      // Handle invalid geometry errors
      if (error instanceof InvalidGeometryError) {
        const response = NextResponse.json(
          {
            error: satelliteError.code,
            message: satelliteError.message,
            details: {
              parcelleId: error.parcelleId,
            },
          },
          { status: satelliteError.statusCode }
        );
        addSecurityHeaders(response);
        return response;
      }

      // Handle other satellite errors
      const response = NextResponse.json(
        {
          error: satelliteError.code,
          message: satelliteError.message,
        },
        { status: satelliteError.statusCode }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Handle unexpected errors
    const response = NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while retrieving satellite imagery',
      },
      { status: 500 }
    );
    addSecurityHeaders(response);
    return response;
  }
}
