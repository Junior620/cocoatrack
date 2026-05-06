/**
 * PATCH /api/satellite/deforestation/:alertId
 * 
 * Update deforestation alert status (acknowledge or dispute).
 * 
 * This endpoint:
 * 1. Validates request body (action, notes, reason)
 * 2. Authenticates the user
 * 3. Authorizes access to the alert's parcelle
 * 4. Updates alert status and metadata
 * 5. Logs action in audit log
 * 6. Returns updated alert
 * 
 * Requirements: Task 4.2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
import { z } from 'zod';
import {
  NDVICalculationError,
  type DeforestationEvent,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for PATCH /api/satellite/deforestation/:alertId request body
 */
const UpdateAlertSchema = z.object({
  action: z.enum(['acknowledge', 'dispute'], {
    errorMap: () => ({ message: 'Action must be either "acknowledge" or "dispute"' }),
  }),
  notes: z.string().optional(),
  reason: z.string().optional(),
}).refine(
  (data) => {
    // If action is 'acknowledge', notes is optional
    // If action is 'dispute', reason is required
    if (data.action === 'dispute' && !data.reason) {
      return false;
    }
    return true;
  },
  {
    message: 'Reason is required when disputing an alert',
    path: ['reason'],
  }
);

type UpdateAlertRequest = z.infer<typeof UpdateAlertSchema>;

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
 * Check if user has access to the parcelle associated with the alert
 * 
 * Access rules:
 * - Admin: Access to all parcelles
 * - Cooperative Manager: Access to parcelles in their cooperative
 * - Agronomist: Access to parcelles they are assigned to
 * - Planteur: Access to their own parcelles
 * - Certification Auditor: Access to all parcelles (for EUDR compliance verification)
 */
async function checkAlertAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  alertId: string
): Promise<{ hasAccess: boolean; parcelleId?: string; error?: string }> {
  try {
    // Get alert with parcelle info
    const { data: alert, error: alertError } = await (supabase as any)
      .from('deforestation_events')
      .select('id, parcelle_id')
      .eq('id', alertId)
      .maybeSingle();

    if (alertError || !alert) {
      return { hasAccess: false, error: 'Alert not found' };
    }

    const parcelleId = (alert as { id: string; parcelle_id: string }).parcelle_id;

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

    // Admin and Certification Auditor have access to all alerts
    if (userProfile.role === 'admin' || userProfile.role === 'certification_auditor') {
      return { hasAccess: true, parcelleId };
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
        return { hasAccess: true, parcelleId };
      }
      return { hasAccess: false, error: 'Parcelle not in your cooperative' };
    }

    // Planteur: Check if they own the parcelle
    if (userProfile.role === 'planteur') {
      if (parcelleData.planteur_id === userId) {
        return { hasAccess: true, parcelleId };
      }
      return { hasAccess: false, error: 'You do not own this parcelle' };
    }

    // Agronomist: Check if they are assigned to the parcelle
    // (This would require an assignment table - for now, allow access to all)
    if (userProfile.role === 'agronomist') {
      return { hasAccess: true, parcelleId };
    }

    return { hasAccess: false, error: 'Insufficient permissions' };
  } catch (error) {
    console.error('Error checking alert access:', error);
    return { hasAccess: false, error: 'Failed to verify access' };
  }
}

/**
 * Log action in audit log
 */
async function logAuditEvent(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  parcelleId: string,
  alertId: string,
  action: 'acknowledge' | 'dispute',
  metadata: Record<string, unknown>,
  request: NextRequest
) {
  try {
    // Get IP address and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      null;
    const userAgent = request.headers.get('user-agent') || null;

    // Determine event type based on action
    const eventType = action === 'acknowledge' 
      ? 'deforestation_acknowledged' 
      : 'deforestation_disputed';

    // Create audit log entry
    // Note: satellite_audit_logs table may not be in generated types yet
    const { error } = await (supabase as any)
      .from('satellite_audit_logs')
      .insert({
        user_id: userId,
        parcelle_id: parcelleId,
        event_type: eventType,
        event_description: `User ${action}d deforestation alert ${alertId}`,
        event_metadata: {
          alert_id: alertId,
          action,
          ...metadata,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging failure shouldn't block the main operation
    }
  } catch (error) {
    console.error('Unexpected error logging audit event:', error);
    // Don't throw - audit logging failure shouldn't block the main operation
  }
}

/**
 * Get updated alert from database
 */
async function getUpdatedAlert(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  alertId: string
): Promise<DeforestationEvent | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('deforestation_events')
      .select('*')
      .eq('id', alertId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Convert database row to DeforestationEvent
    return {
      id: data.id,
      parcelleId: data.parcelle_id,
      baselineDate: new Date(data.baseline_date),
      detectionDate: new Date(data.detection_date),
      baselineNDVI: Number(data.baseline_ndvi),
      currentNDVI: Number(data.current_ndvi),
      ndviChange: Number(data.ndvi_change),
      affectedAreaHectares: Number(data.affected_area_hectares),
      affectedAreaPercent: Number(data.affected_area_percent),
      status: data.status,
      acknowledgedBy: data.acknowledged_by,
      acknowledgedAt: data.acknowledged_at ? new Date(data.acknowledged_at) : null,
      acknowledgmentNotes: data.acknowledgment_notes,
      disputedBy: data.disputed_by,
      disputedAt: data.disputed_at ? new Date(data.disputed_at) : null,
      disputeReason: data.dispute_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    console.error('Error fetching updated alert:', error);
    return null;
  }
}

// ============================================================================
// PATCH Handler
// ============================================================================

/**
 * PATCH /api/satellite/deforestation/:alertId
 * 
 * Update deforestation alert status
 * 
 * Path Parameters:
 * - alertId: string (required) - UUID of the deforestation alert
 * 
 * Request Body:
 * {
 *   "action": "acknowledge" | "dispute",
 *   "notes": string (optional, for acknowledge action),
 *   "reason": string (required for dispute action)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "alert": DeforestationEvent
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    // Step 1: Extract and validate alertId from path parameters
    const { alertId } = await params;

    if (!alertId) {
      return errorResponse('Alert ID is required', 400, 'VALIDATION_ERROR');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(alertId)) {
      return errorResponse('Invalid alert ID format', 400, 'VALIDATION_ERROR');
    }

    // Step 2: Parse and validate request body
    let body: UpdateAlertRequest;
    try {
      const rawBody = await request.json();
      const validationResult = UpdateAlertSchema.safeParse(rawBody);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((e) => e.message).join(', ');
        return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
      }

      body = validationResult.data;
    } catch (error) {
      return errorResponse('Invalid JSON in request body', 400, 'VALIDATION_ERROR');
    }

    const { action, notes, reason } = body;

    // Step 3: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Step 4: Authorize access to alert
    const accessCheck = await checkAlertAccess(supabase, user.id, alertId);
    if (!accessCheck.hasAccess) {
      return errorResponse(
        accessCheck.error || 'Access denied',
        403,
        'FORBIDDEN'
      );
    }

    const parcelleId = accessCheck.parcelleId!;

    // Step 5: Update alert status using DeforestationService
    try {
      if (action === 'acknowledge') {
        await deforestationService.acknowledgeAlert(
          alertId,
          user.id,
          notes,
          supabase
        );
      } else if (action === 'dispute') {
        await deforestationService.disputeAlert(
          alertId,
          user.id,
          reason!,
          supabase
        );
      }
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
      console.error('Unexpected error updating alert status:', error);
      return errorResponse(
        'Failed to update alert status',
        500,
        'UPDATE_ERROR'
      );
    }

    // Step 6: Log action in audit log
    await logAuditEvent(
      supabase,
      user.id,
      parcelleId,
      alertId,
      action,
      {
        notes: notes || null,
        reason: reason || null,
      },
      request
    );

    // Step 7: Fetch and return updated alert
    const updatedAlert = await getUpdatedAlert(supabase, alertId);

    if (!updatedAlert) {
      return errorResponse(
        'Failed to retrieve updated alert',
        500,
        'RETRIEVAL_ERROR'
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          alert: updatedAlert,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in PATCH /api/satellite/deforestation/:alertId:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
