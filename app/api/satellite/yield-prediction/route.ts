/**
 * POST /api/satellite/yield-prediction
 * 
 * Generate yield prediction for a parcelle using NDVI data and historical yields.
 * 
 * This endpoint:
 * 1. Validates request body (parcelleId, harvestSeason, historicalYield)
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Retrieves parcelle geometry and surface area from database
 * 5. Calls YieldPredictionService to generate prediction
 * 6. Stores prediction in database
 * 7. Returns yield prediction with confidence interval
 * 
 * Requirements: Task 5.5.3
 * 
 * GET /api/satellite/yield-prediction
 * 
 * Retrieve the most recent yield prediction for a parcelle.
 * 
 * Query Parameters:
 * - parcelleId: UUID of the parcelle
 * 
 * Requirements: Task 5.5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { yieldPredictionService } from '@/lib/satellite/services/yield-prediction.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  InvalidGeometryError,
  type YieldPrediction,
  type YieldPredictionRow,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for POST /api/satellite/yield-prediction request body
 */
const YieldPredictionRequestSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  harvestSeason: z
    .string()
    .regex(/^\d{4}-Q[1-4]$/, 'Invalid harvest season format. Use YYYY-QX format (e.g., "2024-Q4")')
    .optional(),
  historicalYield: z
    .array(z.number().positive('Historical yield must be positive'))
    .optional()
    .default([]),
  storePrediction: z.boolean().optional().default(true),
});

type YieldPredictionRequestBody = z.infer<typeof YieldPredictionRequestSchema>;

// ============================================================================
// Response Types
// ============================================================================

interface YieldPredictionResponse {
  prediction: YieldPrediction;
  stored: boolean;
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
      .select('id, planteur_id, cooperative_id')
      .eq('id', parcelleId)
      .maybeSingle();

    if (parcelleError || !parcelle) {
      return { hasAccess: false, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = parcelle as {
      id: string;
      planteur_id: string | null;
      cooperative_id: string | null;
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
 * Retrieve parcelle geometry and surface area from database
 */
async function getParcelleData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<{
  geometry: MultiPolygon | null;
  surfaceHectares: number | null;
  error?: string;
}> {
  try {
    const { data: parcelle, error } = await supabase
      .from('parcelles')
      .select('geometry, surface_hectares')
      .eq('id', parcelleId)
      .maybeSingle();

    if (error || !parcelle) {
      return { geometry: null, surfaceHectares: null, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = parcelle as {
      geometry: unknown;
      surface_hectares: number | null;
    };

    if (!parcelleData.geometry) {
      return { geometry: null, surfaceHectares: null, error: 'Parcelle has no geometry' };
    }

    if (!parcelleData.surface_hectares || parcelleData.surface_hectares <= 0) {
      return {
        geometry: null,
        surfaceHectares: null,
        error: 'Parcelle has no valid surface area',
      };
    }

    // Validate geometry is MultiPolygon
    const geometry = parcelleData.geometry as MultiPolygon;
    if (geometry.type !== 'MultiPolygon') {
      return {
        geometry: null,
        surfaceHectares: null,
        error: 'Invalid geometry type. Expected MultiPolygon.',
      };
    }

    return {
      geometry,
      surfaceHectares: parcelleData.surface_hectares,
    };
  } catch (error) {
    console.error('Error retrieving parcelle data:', error);
    return {
      geometry: null,
      surfaceHectares: null,
      error: 'Failed to retrieve parcelle data',
    };
  }
}

// ============================================================================
// POST Handler
// ============================================================================

/**
 * GET /api/satellite/yield-prediction
 * 
 * Retrieve the most recent yield prediction for a parcelle
 * 
 * Query Parameters:
 * - parcelleId: UUID of the parcelle
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "prediction": YieldPrediction
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const parcelleId = searchParams.get('parcelleId');

    if (!parcelleId) {
      return errorResponse('Missing parcelleId parameter', 400, 'MISSING_PARAMETER');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parcelleId)) {
      return errorResponse('Invalid parcelleId format', 400, 'INVALID_UUID');
    }

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
      return errorResponse(accessCheck.error || 'Access denied', 403, 'FORBIDDEN');
    }

    // Step 4: Fetch most recent yield prediction
    const { data: predictionRow, error: fetchError } = await supabase
      .from('yield_predictions')
      .select('*')
      .eq('parcelle_id', parcelleId)
      .order('prediction_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching yield prediction:', fetchError);
      return errorResponse('Failed to fetch yield prediction', 500, 'DATABASE_ERROR');
    }

    if (!predictionRow) {
      return errorResponse('No yield prediction found for this parcelle', 404, 'NOT_FOUND');
    }

    // Step 5: Convert database row to YieldPrediction type
    const predictionData = predictionRow as any;
    const prediction: YieldPrediction = {
      id: predictionData.id,
      parcelleId: predictionData.parcelle_id,
      predictionDate: new Date(predictionData.prediction_date),
      harvestSeason: predictionData.harvest_season,
      predictedYieldKgPerHa: predictionData.predicted_yield_kg_per_ha,
      confidenceLevel: predictionData.confidence_level as 'high' | 'medium' | 'low',
      confidenceIntervalLower: predictionData.confidence_interval_lower,
      confidenceIntervalUpper: predictionData.confidence_interval_upper,
      modelVersion: predictionData.model_version,
      inputFeatures: predictionData.input_features as {
        meanNDVI: number;
        ndviTrend: number;
        historicalYield: number[];
        surfaceHectares: number;
      },
      actualYieldKgPerHa: predictionData.actual_yield_kg_per_ha,
      createdAt: new Date(predictionData.created_at),
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          prediction,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/satellite/yield-prediction:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/satellite/yield-prediction
 * 
 * Generate yield prediction for a parcelle
 * 
 * Request Body:
 * {
 *   "parcelleId": "uuid",
 *   "harvestSeason": "2024-Q4", // Optional, defaults to next harvest season
 *   "historicalYield": [450, 480, 520], // Optional, array of past yields in kg/ha
 *   "storePrediction": true // Optional, defaults to true
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "prediction": YieldPrediction,
 *     "stored": boolean
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    const validationResult = YieldPredictionRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleId, harvestSeason, historicalYield, storePrediction } =
      validationResult.data;

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
      return errorResponse(accessCheck.error || 'Access denied', 403, 'FORBIDDEN');
    }

    // Step 4: Retrieve parcelle geometry and surface area
    const parcelleData = await getParcelleData(supabase, parcelleId);
    if (!parcelleData.geometry || !parcelleData.surfaceHectares) {
      return errorResponse(
        parcelleData.error || 'Failed to retrieve parcelle data',
        404,
        'PARCELLE_DATA_NOT_FOUND'
      );
    }

    // Step 5: Generate yield prediction using YieldPredictionService
    let prediction: YieldPrediction;

    try {
      prediction = await yieldPredictionService.predictYield(
        parcelleId,
        parcelleData.geometry,
        parcelleData.surfaceHectares,
        {
          harvestSeason,
          historicalYield,
          storePrediction,
          supabase,
        }
      );
    } catch (error) {
      // Handle known prediction errors
      if (error instanceof NDVICalculationError) {
        return errorResponse(error.message, error.statusCode, error.code);
      }

      if (error instanceof InsufficientDataError) {
        return errorResponse(error.message, error.statusCode, error.code);
      }

      if (error instanceof InvalidGeometryError) {
        return errorResponse(error.message, error.statusCode, error.code);
      }

      // Handle unknown errors
      console.error('Unexpected error generating yield prediction:', error);
      return errorResponse(
        'Failed to generate yield prediction',
        500,
        'PREDICTION_ERROR'
      );
    }

    // Step 6: Return yield prediction with storage status
    const response: YieldPredictionResponse = {
      prediction,
      stored: storePrediction,
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/satellite/yield-prediction:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
