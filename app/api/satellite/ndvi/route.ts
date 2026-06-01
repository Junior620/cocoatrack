/**
 * POST /api/satellite/ndvi
 * 
 * Calculate NDVI (Normalized Difference Vegetation Index) for a parcelle.
 * 
 * This endpoint:
 * 1. Validates request body (parcelleId, date, forceRecalculate)
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Retrieves parcelle geometry from database
 * 5. Calls NDVIService to calculate NDVI
 * 6. Stores result in database
 * 7. Returns NDVI result with cache status
 * 
 * Requirements: Task 2.2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  InvalidGeometryError,
  type NDVIResponse,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for POST /api/satellite/ndvi request body
 */
const NDVIRequestSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD or full datetime).')
    .optional()
    .transform((val) => {
      if (!val) return new Date();
      // Handle both YYYY-MM-DD and full ISO datetime
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date value');
      }
      return date;
    }),
  forceRecalculate: z.boolean().optional().default(false),
});

type NDVIRequestBody = z.infer<typeof NDVIRequestSchema>;

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
      .maybeSingle();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    // Type assertion for profile
    const userProfile = profile as {
      role: string;
      cooperative_id: string | null;
    };

    // Admin has access to all parcelles
    if (userProfile.role === 'admin') {
      return { hasAccess: true };
    }

    // Get parcelle with planteur and cooperative info
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, planteurs(cooperative_id)')
      .eq('id', parcelleId)
      .maybeSingle();

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
 * Retrieve parcelle geometry from database
 */
async function getParcelleGeometry(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<{ geometry: MultiPolygon | null; error?: string }> {
  try {
    const { data: parcelle, error } = await supabase
      .from('parcelles')
      .select('geometry')
      .eq('id', parcelleId)
      .maybeSingle();

    if (error || !parcelle) {
      return { geometry: null, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = parcelle as { geometry: unknown };

    if (!parcelleData.geometry) {
      return { geometry: null, error: 'Parcelle has no geometry' };
    }

    // Validate geometry is MultiPolygon
    const geometry = parcelleData.geometry as MultiPolygon;
    if (geometry.type !== 'MultiPolygon') {
      return { geometry: null, error: 'Invalid geometry type. Expected MultiPolygon.' };
    }

    return { geometry };
  } catch (error) {
    console.error('Error retrieving parcelle geometry:', error);
    return { geometry: null, error: 'Failed to retrieve parcelle geometry' };
  }
}

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/satellite/ndvi
 * 
 * Calculate NDVI for a parcelle
 * 
 * Request Body:
 * {
 *   "parcelleId": "uuid",
 *   "date": "2024-01-15T00:00:00Z", // Optional, defaults to current date
 *   "forceRecalculate": false // Optional, defaults to false
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "ndvi": NDVIResult,
 *     "cached": boolean,
 *     "recommendation": string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    const validationResult = NDVIRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleId, date, forceRecalculate } = validationResult.data;

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

    // Step 4: Retrieve parcelle geometry
    const geometryResult = await getParcelleGeometry(supabase, parcelleId);
    if (!geometryResult.geometry) {
      return errorResponse(
        geometryResult.error || 'Failed to retrieve parcelle geometry',
        404,
        'GEOMETRY_NOT_FOUND'
      );
    }

    // Step 5: Calculate NDVI using NDVIService
    let ndviResult;
    let cached = false;

    try {
      // Check if we should use cached result
      if (!forceRecalculate) {
        const cachedResult = await ndviService.getCachedNDVI(parcelleId, date, supabase);
        if (cachedResult) {
          ndviResult = cachedResult;
          cached = true;
        }
      }

      // Calculate NDVI if not cached or force recalculate
      if (!ndviResult) {
        ndviResult = await ndviService.calculateNDVI(
          parcelleId,
          geometryResult.geometry,
          date,
          {
            forceRecalculate,
            storeResult: true, // Always store result in database
            generateRaster: true, // Generate raster for visualization
          }
        );
        
        // Cache the result - don't pass supabase client so it uses service role key
        await ndviService.cacheNDVI(ndviResult);
        cached = false;
      }
    } catch (error) {
      // Handle known NDVI calculation errors
      if (error instanceof NDVICalculationError) {
        return errorResponse(
          error.message,
          error.statusCode,
          error.code
        );
      }

      if (error instanceof InsufficientDataError) {
        return errorResponse(
          error.message,
          error.statusCode,
          error.code
        );
      }

      if (error instanceof InvalidGeometryError) {
        return errorResponse(
          error.message,
          error.statusCode,
          error.code
        );
      }

      // Handle unknown errors
      console.error('Unexpected error calculating NDVI:', error);
      return errorResponse(
        'Failed to calculate NDVI',
        500,
        'CALCULATION_ERROR'
      );
    }

    // Step 6: Get recommendation based on health status
    const recommendation = ndviService.getRecommendation(ndviResult.healthStatus);

    // Step 7: Return NDVI result with cache status
    const response: NDVIResponse = {
      ndvi: ndviResult,
      cached,
      recommendation,
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/satellite/ndvi:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
