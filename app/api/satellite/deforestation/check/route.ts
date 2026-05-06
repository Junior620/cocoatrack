/**
 * POST /api/satellite/deforestation/check
 * 
 * Trigger deforestation detection for a parcelle.
 * 
 * This endpoint:
 * 1. Validates request body (parcelleId, baselineDate, currentDate)
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Retrieves parcelle geometry and surface area
 * 5. Calls DeforestationService to detect deforestation
 * 6. Creates alerts if deforestation is detected
 * 7. Returns detection results with any new alerts
 * 
 * Requirements: Task 4.2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  type DeforestationEvent,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for POST /api/satellite/deforestation/check request body
 */
const DeforestationCheckSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  baselineDate: z
    .string()
    .datetime('Invalid baseline date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  currentDate: z
    .string()
    .datetime('Invalid current date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

type DeforestationCheckRequest = z.infer<typeof DeforestationCheckSchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for deforestation check endpoint
 */
interface DeforestationCheckResult {
  detected: boolean;
  baselineNDVI: number;
  currentNDVI: number;
  ndviChange: number;
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  alerts: DeforestationEvent[];
  message: string;
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
 * - Certification Auditor: Access to all parcelles (for EUDR compliance verification)
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

    // Admin and Certification Auditor have access to all parcelles
    if (userProfile.role === 'admin' || userProfile.role === 'certification_auditor') {
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
 * Retrieve parcelle geometry and surface area
 */
async function getParcelleData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<{
  geometry: MultiPolygon;
  surfaceHectares: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from('parcelles')
      .select('geometry, surface_hectares')
      .eq('id', parcelleId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Type assertion for parcelle data
    const parcelleData = data as {
      geometry: MultiPolygon;
      surface_hectares: number;
    };

    return {
      geometry: parcelleData.geometry,
      surfaceHectares: parcelleData.surface_hectares,
    };
  } catch (error) {
    console.error('Error retrieving parcelle data:', error);
    return null;
  }
}

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/satellite/deforestation/check
 * 
 * Trigger deforestation detection for a parcelle
 * 
 * Request Body:
 * {
 *   "parcelleId": string (required) - UUID of the parcelle
 *   "baselineDate": string (optional) - ISO 8601 date for baseline (defaults to Dec 31, 2020)
 *   "currentDate": string (optional) - ISO 8601 date for current comparison (defaults to today)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "detected": boolean,
 *     "baselineNDVI": number,
 *     "currentNDVI": number,
 *     "ndviChange": number,
 *     "affectedAreaHectares": number,
 *     "affectedAreaPercent": number,
 *     "alerts": DeforestationEvent[],
 *     "message": string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    let body: DeforestationCheckRequest;
    
    try {
      const rawBody = await request.json();
      const validationResult = DeforestationCheckSchema.safeParse(rawBody);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((e) => e.message).join(', ');
        return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
      }

      body = validationResult.data;
    } catch (error) {
      return errorResponse('Invalid JSON in request body', 400, 'INVALID_JSON');
    }

    const { parcelleId, baselineDate, currentDate } = body;

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

    // Step 4: Retrieve parcelle geometry and surface area
    const parcelleData = await getParcelleData(supabase, parcelleId);
    if (!parcelleData) {
      return errorResponse(
        'Parcelle not found or missing geometry data',
        404,
        'PARCELLE_NOT_FOUND'
      );
    }

    const { geometry, surfaceHectares } = parcelleData;

    // Step 5: Trigger deforestation detection
    let detectionResult;

    try {
      console.log(`[Deforestation Check API] Starting detection for parcelle ${parcelleId}`);
      console.log(`[Deforestation Check API] Baseline date: ${baselineDate?.toISOString() || 'default (Dec 31, 2020)'}`);
      console.log(`[Deforestation Check API] Current date: ${currentDate?.toISOString() || 'default (today)'}`);

      detectionResult = await deforestationService.detectDeforestation(
        parcelleId,
        geometry,
        surfaceHectares,
        {
          baselineDate,
          currentDate,
          storeEvents: true, // Store events in database
          supabase,
        }
      );

      console.log(`[Deforestation Check API] Detection complete. Detected: ${detectionResult.detected}`);
    } catch (error) {
      // Handle known errors
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
          503, // Service Unavailable
          'INSUFFICIENT_DATA'
        );
      }

      // Handle unknown errors
      console.error('Unexpected error during deforestation detection:', error);
      return errorResponse(
        'Failed to detect deforestation',
        500,
        'DETECTION_ERROR'
      );
    }

    // Step 6: Prepare response
    const alerts: DeforestationEvent[] = detectionResult.event
      ? [detectionResult.event]
      : [];

    const message = detectionResult.detected
      ? `Deforestation detected: NDVI decreased by ${Math.abs(detectionResult.ndviChange).toFixed(4)} (${detectionResult.affectedAreaPercent.toFixed(1)}% of parcelle area affected)`
      : 'No deforestation detected';

    const response: DeforestationCheckResult = {
      detected: detectionResult.detected,
      baselineNDVI: detectionResult.baselineNDVI,
      currentNDVI: detectionResult.currentNDVI,
      ndviChange: detectionResult.ndviChange,
      affectedAreaHectares: detectionResult.affectedAreaHectares,
      affectedAreaPercent: detectionResult.affectedAreaPercent,
      alerts,
      message,
    };

    // Step 7: Return detection results
    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: detectionResult.detected ? 201 : 200 } // 201 if alert created, 200 if no deforestation
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/satellite/deforestation/check:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
