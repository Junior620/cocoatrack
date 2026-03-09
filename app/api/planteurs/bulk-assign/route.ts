// CocoaTrack V2 - Bulk Planteur Assignment API Route
// POST /api/planteurs/bulk-assign - Bulk assign planteurs to chef planteur and/or cooperative
// Requirements: 7.1, 7.3, 9.5

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { bulkAssignmentSchema } from '@/lib/validations/planteur-bulk';
import { bulkAssignPlanteurs } from '@/lib/api/planteurs-bulk';
import type { BulkAssignmentResponse } from '@/types/planteur-bulk';
import { ZodError } from 'zod';

/**
 * Error response helper
 */
function errorResponse(
  message: string,
  status: number,
  details?: unknown
): NextResponse<{ success: false; error: string; details?: unknown }> {
  const responseBody: { success: false; error: string; details?: unknown } = {
    success: false,
    error: message,
  };
  
  if (details !== undefined) {
    responseBody.details = details;
  }
  
  const response = NextResponse.json(responseBody, { status });
  addSecurityHeaders(response);
  return response;
}

/**
 * POST /api/planteurs/bulk-assign
 * 
 * Bulk assign multiple planteurs to a chef planteur and/or cooperative.
 * 
 * Request Body:
 * - planteurIds: Array of planteur UUIDs to update (required, min 1)
 * - chefPlanteurId: UUID of chef planteur to assign (optional, null to clear)
 * - cooperativeId: UUID of cooperative to assign (optional, null to clear)
 * 
 * Response:
 * - success: Overall success status (true if all succeeded)
 * - successCount: Number of planteurs successfully updated
 * - failureCount: Number of planteurs that failed to update
 * - errors: Array of error details for failed updates (if any)
 * 
 * Validation (Requirement 9.5):
 * - At least one planteur must be selected (Requirement 9.1)
 * - At least one assignment field must be specified (Requirement 9.2)
 * - Chef planteur ID must exist if provided (Requirement 7.3, 9.3)
 * - Cooperative ID must exist if provided (Requirement 7.3, 9.4)
 * 
 * Error Handling (Requirement 7.1):
 * - 400: Validation errors with specific messages
 * - 401: Not authenticated
 * - 500: Database or server errors
 * 
 * @see Requirements 7.1, 7.3, 9.5
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON', 400);
    }

    // Validate input with Zod schema (Requirement 9.5)
    const parseResult = bulkAssignmentSchema.safeParse(body);
    
    if (!parseResult.success) {
      // Extract first validation error for specific error message (Requirement 9.5)
      const firstError = parseResult.error.errors[0];
      const errorMessage = firstError.message;
      const errorPath = firstError.path.join('.');
      
      return errorResponse(
        `Validation failed: ${errorMessage}`,
        400,
        {
          field: errorPath,
          errors: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        }
      );
    }

    const validatedInput = parseResult.data;

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user (authentication check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Not authenticated', 401);
    }

    // Execute bulk assignment
    // This function handles:
    // - Referential integrity validation (Requirements 7.3, 9.3, 9.4)
    // - RLS policy enforcement (Requirement 4.2)
    // - Partial failure handling (Requirement 4.3)
    // - Audit logging (Requirements 6.1-6.7)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bulkAssignPlanteurs(supabase as any, validatedInput);

    // Return success response with appropriate status code
    const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial success
    const response = NextResponse.json<BulkAssignmentResponse>(result, { status: statusCode });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    // Handle specific error types
    if (error instanceof ZodError) {
      // Zod validation error (shouldn't happen after safeParse, but just in case)
      return errorResponse(
        'Validation failed',
        400,
        { errors: error.errors }
      );
    }

    // Handle known error messages from bulkAssignPlanteurs
    if (error instanceof Error) {
      // Check for specific validation errors (Requirements 7.3, 9.3, 9.4)
      if (error.message.includes('Invalid chef planteur ID')) {
        return errorResponse(error.message, 400);
      }
      if (error.message.includes('Invalid cooperative ID')) {
        return errorResponse(error.message, 400);
      }
      if (error.message.includes('Not authenticated')) {
        return errorResponse('Not authenticated', 401);
      }
      if (error.message.includes('At least one assignment field')) {
        return errorResponse(error.message, 400);
      }

      // Check for database connection errors (Requirement 7.1)
      if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
        return errorResponse('Database connection failed', 503);
      }

      // Log unexpected errors for debugging
      console.error('Unexpected error in POST /api/planteurs/bulk-assign:', error);
      return errorResponse('An unexpected error occurred', 500, {
        message: error.message,
      });
    }

    // Unknown error type
    console.error('Unknown error in POST /api/planteurs/bulk-assign:', error);
    return errorResponse('An unexpected error occurred', 500);
  }
}
