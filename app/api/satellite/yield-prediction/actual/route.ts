/**
 * PATCH /api/satellite/yield-prediction/actual
 * 
 * Update the actual yield for a yield prediction after harvest.
 * 
 * This endpoint:
 * 1. Validates request body (predictionId, actualYieldKgPerHa)
 * 2. Authenticates the user
 * 3. Authorizes access to the prediction's parcelle
 * 4. Updates the actual_yield_kg_per_ha field in the database
 * 5. Returns the updated prediction
 * 
 * Requirements: Task 5.5.4, Task 5.5.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { YieldPrediction } from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for PATCH /api/satellite/yield-prediction/actual request body
 */
const ActualYieldUpdateSchema = z.object({
  predictionId: z.string().uuid('Invalid prediction ID format'),
  actualYieldKgPerHa: z.number().positive('Actual yield must be positive'),
});

type ActualYieldUpdateBody = z.infer<typeof ActualYieldUpdateSchema>;

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
 * Check if user has access to the prediction's parcelle
 */
async function checkPredictionAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  predictionId: string
): Promise<{ hasAccess: boolean; parcelleId?: string; error?: string }> {
  try {
    // Get prediction with parcelle info
    const { data: prediction, error: predictionError } = await supabase
      .from('yield_predictions')
      .select('parcelle_id')
      .eq('id', predictionId)
      .maybeSingle();

    if (predictionError || !prediction) {
      return { hasAccess: false, error: 'Prediction not found' };
    }

    const predictionData = prediction as any;
    const parcelleId = predictionData.parcelle_id;

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    const userProfile = profile as {
      role: string;
      cooperative_id: string | null;
    };

    // Admin has access to all predictions
    if (userProfile.role === 'admin') {
      return { hasAccess: true, parcelleId };
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

    const parcelleData = {
      id: parcelle.id,
      planteur_id: parcelle.planteur_id,
      cooperative_id: (parcelle.planteurs as { cooperative_id: string | null } | null)?.cooperative_id ?? null,
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

    // Agronomist: Allow access to all
    if (userProfile.role === 'agronomist') {
      return { hasAccess: true, parcelleId };
    }

    return { hasAccess: false, error: 'Insufficient permissions' };
  } catch (error) {
    console.error('Error checking prediction access:', error);
    return { hasAccess: false, error: 'Failed to verify access' };
  }
}

// ============================================================================
// PATCH Handler
// ============================================================================

/**
 * PATCH /api/satellite/yield-prediction/actual
 * 
 * Update actual yield for a prediction
 * 
 * Request Body:
 * {
 *   "predictionId": "uuid",
 *   "actualYieldKgPerHa": 520.5
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "prediction": YieldPrediction
 *   }
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    const validationResult = ActualYieldUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { predictionId, actualYieldKgPerHa } = validationResult.data;

    // Step 2: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Step 3: Authorize access to prediction
    const accessCheck = await checkPredictionAccess(supabase, user.id, predictionId);
    if (!accessCheck.hasAccess) {
      return errorResponse(accessCheck.error || 'Access denied', 403, 'FORBIDDEN');
    }

    // Step 4: Update actual yield in database
    const { data: updatedRow, error: updateError } = await (supabase
      .from('yield_predictions') as any)
      .update({
        actual_yield_kg_per_ha: actualYieldKgPerHa,
      })
      .eq('id', predictionId)
      .select()
      .single();

    if (updateError || !updatedRow) {
      console.error('Error updating actual yield:', updateError);
      return errorResponse('Failed to update actual yield', 500, 'UPDATE_ERROR');
    }

    // Step 5: Convert database row to YieldPrediction type
    const prediction: YieldPrediction = {
      id: updatedRow.id,
      parcelleId: updatedRow.parcelle_id,
      predictionDate: new Date(updatedRow.prediction_date),
      harvestSeason: updatedRow.harvest_season,
      predictedYieldKgPerHa: updatedRow.predicted_yield_kg_per_ha,
      confidenceLevel: updatedRow.confidence_level as 'high' | 'medium' | 'low',
      confidenceIntervalLower: updatedRow.confidence_interval_lower,
      confidenceIntervalUpper: updatedRow.confidence_interval_upper,
      modelVersion: updatedRow.model_version,
      inputFeatures: updatedRow.input_features as {
        meanNDVI: number;
        ndviTrend: number;
        historicalYield: number[];
        surfaceHectares: number;
      },
      actualYieldKgPerHa: updatedRow.actual_yield_kg_per_ha,
      createdAt: new Date(updatedRow.created_at),
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
    console.error('Unexpected error in PATCH /api/satellite/yield-prediction/actual:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
