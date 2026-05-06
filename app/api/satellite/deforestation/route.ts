/**
 * GET /api/satellite/deforestation
 * 
 * Retrieve deforestation alerts for a parcelle.
 * 
 * This endpoint:
 * 1. Validates query parameters (parcelleId, status)
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Calls DeforestationService to retrieve alerts
 * 5. Returns alerts with summary statistics
 * 
 * Requirements: Task 4.2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
import { z } from 'zod';
import {
  NDVICalculationError,
  type DeforestationCheckResponse,
  type DeforestationEvent,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for GET /api/satellite/deforestation query parameters
 */
const DeforestationQuerySchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  status: z
    .enum(['pending', 'acknowledged', 'disputed', 'resolved'])
    .nullable()
    .optional()
    .transform((val) => val || undefined), // Convert null to undefined
});

type DeforestationQuery = z.infer<typeof DeforestationQuerySchema>;

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
 * Calculate summary statistics from alerts
 */
function calculateSummary(alerts: DeforestationEvent[]) {
  return {
    totalAlerts: alerts.length,
    pendingAlerts: alerts.filter((a) => a.status === 'pending').length,
    acknowledgedAlerts: alerts.filter((a) => a.status === 'acknowledged').length,
    disputedAlerts: alerts.filter((a) => a.status === 'disputed').length,
  };
}

/**
 * Determine EUDR compliance status
 * 
 * A parcelle is compliant if:
 * - No pending or disputed alerts exist
 * - All alerts have been acknowledged or resolved
 */
function determineCompliance(alerts: DeforestationEvent[]): boolean {
  const pendingOrDisputed = alerts.filter(
    (a) => a.status === 'pending' || a.status === 'disputed'
  );
  return pendingOrDisputed.length === 0;
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/satellite/deforestation
 * 
 * Retrieve deforestation alerts for a parcelle
 * 
 * Query Parameters:
 * - parcelleId: string (required) - UUID of the parcelle
 * - status: 'pending' | 'acknowledged' | 'disputed' | 'resolved' (optional) - Filter by status
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "alerts": DeforestationEvent[],
 *     "compliant": boolean,
 *     "summary": {
 *       "totalAlerts": number,
 *       "pendingAlerts": number,
 *       "acknowledgedAlerts": number,
 *       "disputedAlerts": number
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const parcelleIdParam = searchParams.get('parcelleId');
    const statusParam = searchParams.get('status');

    // Validate parcelleId is provided
    if (!parcelleIdParam) {
      return errorResponse('parcelleId query parameter is required', 400, 'VALIDATION_ERROR');
    }

    const validationResult = DeforestationQuerySchema.safeParse({
      parcelleId: parcelleIdParam,
      status: statusParam,
    });

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleId, status } = validationResult.data;

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

    // Step 4: Retrieve deforestation alerts using DeforestationService
    let alerts: DeforestationEvent[];

    try {
      alerts = await deforestationService.getAlerts(
        parcelleId,
        status,
        supabase
      );
    } catch (error) {
      // Handle known errors
      if (error instanceof NDVICalculationError) {
        return errorResponse(
          error.message,
          error.statusCode,
          error.code
        );
      }

      // Handle unknown errors
      console.error('Unexpected error retrieving deforestation alerts:', error);
      return errorResponse(
        'Failed to retrieve deforestation alerts',
        500,
        'RETRIEVAL_ERROR'
      );
    }

    // Step 5: Calculate summary statistics
    const summary = calculateSummary(alerts);

    // Step 6: Determine EUDR compliance status
    const compliant = determineCompliance(alerts);

    // Step 7: Return alerts with summary
    const response: DeforestationCheckResponse = {
      alerts,
      compliant,
      summary,
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/satellite/deforestation:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
