/**
 * GET /api/satellite/deforestation
 * POST /api/satellite/deforestation
 * 
 * GET  - Retrieve deforestation alerts for a parcelle.
 * POST - Trigger deforestation detection via GEE for a parcelle.
 * 
 * Requirements: Task 4.2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
import { z } from 'zod';
import {
  NDVICalculationError,
  InsufficientDataError,
  type DeforestationCheckResponse,
  type DeforestationEvent,
} from '@/lib/satellite/types';
import type { MultiPolygon } from 'geojson';

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

// ============================================================================
// POST Handler, Trigger deforestation detection via GEE
// ============================================================================

const DetectRequestSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  baselineDate: z.string().optional(), // ISO date string, defaults to 2020-12-31
  currentDate: z.string().optional(),  // ISO date string, defaults to today
  forceRedetect: z.boolean().optional().default(false),
});

/**
 * POST /api/satellite/deforestation
 *
 * Triggers deforestation detection for a parcelle using GEE.
 * Compares baseline NDVI (Dec 31, 2020 by default) with current NDVI.
 *
 * Accepts either:
 *   a) A valid Supabase session cookie (browser users)
 *   b) Authorization: Bearer <CRON_SECRET> (CLI / cron jobs)
 *
 * Request Body:
 * {
 *   "parcelleId": "uuid",
 *   "baselineDate": "2020-12-31",  // optional
 *   "currentDate": "2026-05-13",   // optional
 *   "forceRedetect": false         // optional
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate
    const body = await request.json();
    const validation = DetectRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors.map(e => e.message).join(', '),
        400,
        'VALIDATION_ERROR'
      );
    }

    const { parcelleId, baselineDate, currentDate, forceRedetect } = validation.data;

    // Step 2: Authenticate, session cookie or CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    const supabase = isCronAuth
      ? createServiceRoleSupabaseClient()
      : await createServerSupabaseClient();

    if (!isCronAuth) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
      }
    }

    // Step 3: Get parcelle geometry and surface
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, geometry, surface_hectares')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      return errorResponse('Parcelle not found', 404, 'NOT_FOUND');
    }

    const geometry = parcelle.geometry as unknown as MultiPolygon;
    if (!geometry || geometry.type !== 'MultiPolygon') {
      return errorResponse('Parcelle has no valid geometry', 422, 'INVALID_GEOMETRY');
    }

    const surfaceHectares = (parcelle as any).surface_hectares ?? 1.0;

    // Step 4: Check if already detected recently (unless forceRedetect)
    if (!forceRedetect) {
      const existing = await deforestationService.getAlerts(parcelleId, undefined, supabase);
      if (existing.length > 0) {
        const mostRecent = existing.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        const hoursSince = (Date.now() - new Date(mostRecent.createdAt).getTime()) / 3600000;
        if (hoursSince < 24) {
          return NextResponse.json({
            success: true,
            data: {
              message: 'Detection already run recently (< 24h). Use forceRedetect: true to override.',
              lastDetection: mostRecent.createdAt,
              alertCount: existing.length,
            },
          });
        }
      }
    }

    // Step 5: Run detection via GEE
    console.log(`[Deforestation API] Starting detection for parcelle ${parcelleId}`);

    const result = await deforestationService.detectDeforestation(
      parcelleId,
      geometry,
      surfaceHectares,
      {
        baselineDate: baselineDate ? new Date(baselineDate) : undefined,
        currentDate: currentDate ? new Date(currentDate) : undefined,
        storeEvents: true,
        supabase,
      }
    );

    console.log(
      `[Deforestation API] Detection complete for ${parcelleId}: ` +
      `detected=${result.detected}, ndviChange=${result.ndviChange.toFixed(4)}`
    );

    return NextResponse.json({
      success: true,
      data: {
        detected: result.detected,
        baselineNDVI: result.baselineNDVI,
        currentNDVI: result.currentNDVI,
        ndviChange: result.ndviChange,
        affectedAreaHectares: result.affectedAreaHectares,
        affectedAreaPercent: result.affectedAreaPercent,
        event: result.event ?? null,
        message: result.detected
          ? `⚠️ Déforestation détectée, perte NDVI de ${Math.abs(result.ndviChange * 100).toFixed(1)}% sur ${result.affectedAreaHectares.toFixed(2)} ha`
          : `✅ Aucune déforestation détectée (variation NDVI: ${result.ndviChange.toFixed(4)})`,
      },
    });

  } catch (error) {
    if (error instanceof NDVICalculationError || error instanceof InsufficientDataError) {
      return errorResponse(error.message, 422, 'DETECTION_ERROR');
    }
    console.error('[Deforestation API] Unexpected error in POST:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
