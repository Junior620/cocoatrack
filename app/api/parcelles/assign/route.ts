// CocoaTrack V2 - Parcelles Assign API Route
// POST /api/parcelles/assign - Assign orphan parcelles to an existing planteur
// @see Requirements 5.4

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { assignParcellesSchema } from '@/lib/validations/parcelle';
import {
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';

/**
 * Response type for POST /api/parcelles/assign
 */
interface AssignParcellesResponse {
  /** Number of parcelles successfully assigned */
  updated_count: number;
  /** IDs of parcelles that were assigned */
  assigned_ids: string[];
  /** Audit log entry ID */
  audit_log_id: string | null;
}

/**
 * Generate a unique code for a parcelle
 * Format: PARC-XXXX where XXXX is a zero-padded number
 */
async function generateParcelleCode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  planteurId: string
): Promise<string> {
  const { count, error } = await supabase
    .from('parcelles')
    .select('*', { count: 'exact', head: true })
    .eq('planteur_id', planteurId);

  if (error) {
    throw new Error(`Failed to generate parcelle code: ${error.message}`);
  }

  const nextNumber = (count || 0) + 1;
  return `PARC-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * POST /api/parcelles/assign
 * 
 * Assign orphan parcelles to an existing planteur.
 * 
 * Request Body:
 * - parcelle_ids: Array of parcelle UUIDs to assign (must be orphan parcelles)
 * - planteur_id: UUID of the planteur to assign parcelles to
 * 
 * Response:
 * - updated_count: Number of parcelles successfully assigned
 * - assigned_ids: IDs of parcelles that were assigned
 * - audit_log_id: Audit log entry ID
 * 
 * Validation:
 * - All parcelles must be orphan (planteur_id IS NULL) unless user is admin/manager
 * - Planteur must exist and be active
 * - Planteur must belong to the same cooperative as the user
 * 
 * @see Requirements 5.4, 5.5
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse('body', 'Request body must be valid JSON');
    }

    const parseResult = assignParcellesSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const { parcelle_ids, planteur_id } = parseResult.data;

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Get user's role to check if admin/manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch user profile',
        { reason: profileError.message }
      ));
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const userCooperativeId = profile?.cooperative_id;

    // Verify planteur exists and get cooperative_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: planteur, error: planteurError } = await (supabase as any)
      .from('planteurs')
      .select('id, name, code, cooperative_id')
      .eq('id', planteur_id)
      .eq('is_active', true)
      .single();

    if (planteurError || !planteur) {
      return notFoundResponse('planteur', planteur_id);
    }

    const typedPlanteur = planteur as { id: string; name: string; code: string; cooperative_id: string };

    // Verify user has access to this cooperative
    if (userCooperativeId && userCooperativeId !== typedPlanteur.cooperative_id) {
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.UNAUTHORIZED,
        'Planteur does not belong to your cooperative',
        { planteur_id }
      ));
    }

    // Fetch all parcelles to verify they exist and are orphan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parcelles, error: parcellesError } = await (supabase as any)
      .from('parcelles')
      .select('id, planteur_id, code, label')
      .in('id', parcelle_ids)
      .eq('is_active', true);

    if (parcellesError) {
      console.error('Error fetching parcelles:', parcellesError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch parcelles',
        { reason: parcellesError.message }
      ));
    }

    const typedParcelles = (parcelles || []) as Array<{
      id: string;
      planteur_id: string | null;
      code: string | null;
      label: string | null;
    }>;

    if (typedParcelles.length === 0) {
      return notFoundResponse('parcelles', parcelle_ids.join(', '));
    }

    // Check if all requested parcelles were found
    if (typedParcelles.length !== parcelle_ids.length) {
      const foundIds = new Set(typedParcelles.map(p => p.id));
      const missingIds = parcelle_ids.filter(id => !foundIds.has(id));
      return validationErrorResponse(
        'parcelle_ids',
        `Some parcelles were not found: ${missingIds.join(', ')}`
      );
    }

    // Verify all parcelles are orphan (unless admin/manager)
    if (!isAdmin) {
      const nonOrphanParcelles = typedParcelles.filter(p => p.planteur_id !== null);
      if (nonOrphanParcelles.length > 0) {
        const nonOrphanCodes = nonOrphanParcelles.map(p => p.code || p.id);
        return validationErrorResponse(
          'parcelle_ids',
          `Cannot assign non-orphan parcelles: ${nonOrphanCodes.join(', ')}. These parcelles are already assigned to a planteur.`
        );
      }
    }

    // Assign parcelles to the planteur
    const assignedIds: string[] = [];
    let updatedCount = 0;

    for (const parcelle of typedParcelles) {
      // Generate code if null
      let code = parcelle.code;
      if (!code) {
        code = await generateParcelleCode(supabase, planteur_id);
      }

      // Update the parcelle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('parcelles')
        .update({
          planteur_id: planteur_id,
          code: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parcelle.id);

      if (updateError) {
        console.error(`Failed to update parcelle ${parcelle.id}:`, updateError);
        continue;
      }

      assignedIds.push(parcelle.id);
      updatedCount++;
    }

    // Create audit log entry
    let auditLogId: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: auditData, error: auditError } = await (supabase as any)
        .from('audit_logs')
        .insert({
          actor_id: user.id,
          actor_type: 'user',
          table_name: 'parcelles',
          row_id: assignedIds.join(','), // Store all affected IDs
          action: 'UPDATE',
          old_data: {
            operation: 'assign_parcelles',
            parcelle_ids: parcelle_ids,
            previous_planteur_id: null, // All were orphan
          },
          new_data: {
            operation: 'assign_parcelles',
            parcelle_ids: assignedIds,
            planteur_id: planteur_id,
            planteur_name: typedPlanteur.name,
            updated_count: updatedCount,
          },
        })
        .select('id')
        .single();

      if (!auditError && auditData) {
        auditLogId = (auditData as { id: string }).id;
      }
    } catch (auditErr) {
      // Log but don't fail the operation if audit logging fails
      console.error('Failed to create audit log entry:', auditErr);
    }

    // Build response
    const responseData: AssignParcellesResponse = {
      updated_count: updatedCount,
      assigned_ids: assignedIds,
      audit_log_id: auditLogId,
    };

    const response = NextResponse.json(responseData, { status: 200 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/assign');
  }
}
