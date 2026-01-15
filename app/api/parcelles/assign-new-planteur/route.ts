// CocoaTrack V2 - Parcelles Assign New Planteur API Route
// POST /api/parcelles/assign-new-planteur - Create a new planteur and assign orphan parcelles to it
// @see Requirements 5.3

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { assignNewPlanteurSchema } from '@/lib/validations/parcelle';
import { normalizePlanteurName } from '@/lib/api/parcelles-import';
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
 * Response type for POST /api/parcelles/assign-new-planteur
 */
interface AssignNewPlanteurResponse {
  /** ID of the newly created planteur */
  planteur_id: string;
  /** Name of the newly created planteur */
  planteur_name: string;
  /** Code of the newly created planteur */
  planteur_code: string;
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
 * POST /api/parcelles/assign-new-planteur
 * 
 * Create a new planteur and assign orphan parcelles to it in one operation.
 * 
 * Request Body:
 * - parcelle_ids: Array of parcelle UUIDs to assign (must be orphan parcelles)
 * - planteur: Object with planteur data
 *   - name: Planteur name (required)
 *   - code: Planteur code (optional, auto-generated if not provided)
 *   - chef_planteur_id: UUID of the chef planteur (required)
 * 
 * Response:
 * - planteur_id: ID of the newly created planteur
 * - planteur_name: Name of the newly created planteur
 * - planteur_code: Code of the newly created planteur
 * - updated_count: Number of parcelles successfully assigned
 * - assigned_ids: IDs of parcelles that were assigned
 * - audit_log_id: Audit log entry ID
 * 
 * Validation:
 * - All parcelles must be orphan (planteur_id IS NULL) unless user is admin/manager
 * - Chef planteur must exist and be active
 * - Chef planteur must belong to the same cooperative as the user
 * - Planteur name must be unique in the cooperative (by name_norm)
 * 
 * @see Requirements 5.3, 5.4, 5.5
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

    const parseResult = assignNewPlanteurSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const { parcelle_ids, planteur: planteurData } = parseResult.data;

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Get user's role and cooperative_id
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

    // Verify chef_planteur exists and get cooperative_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chefPlanteur, error: chefError } = await (supabase as any)
      .from('chef_planteurs')
      .select('id, cooperative_id')
      .eq('id', planteurData.chef_planteur_id)
      .eq('is_active', true)
      .single();

    if (chefError || !chefPlanteur) {
      return notFoundResponse('chef_planteur', planteurData.chef_planteur_id);
    }

    const typedChefPlanteur = chefPlanteur as { id: string; cooperative_id: string };
    const cooperativeId = typedChefPlanteur.cooperative_id;

    // Verify user has access to this cooperative
    if (userCooperativeId && userCooperativeId !== cooperativeId) {
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.UNAUTHORIZED,
        'Chef planteur does not belong to your cooperative',
        { chef_planteur_id: planteurData.chef_planteur_id }
      ));
    }

    // Calculate name_norm for uniqueness check
    const nameNorm = normalizePlanteurName(planteurData.name);

    // Check if a planteur with the same name_norm already exists in the cooperative
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingPlanteur, error: existingError } = await (supabase as any)
      .from('planteurs')
      .select('id, name')
      .eq('cooperative_id', cooperativeId)
      .eq('name_norm', nameNorm)
      .eq('is_active', true)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking for existing planteur:', existingError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to check for existing planteur',
        { reason: existingError.message }
      ));
    }

    if (existingPlanteur) {
      const typedExisting = existingPlanteur as { id: string; name: string };
      return validationErrorResponse(
        'planteur.name',
        `A planteur with this name already exists: "${typedExisting.name}"`
      );
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

    // Generate planteur code if not provided
    const planteurCode = planteurData.code || 
      `PLT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create the new planteur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newPlanteur, error: createPlanteurError } = await (supabase as any)
      .from('planteurs')
      .insert({
        name: planteurData.name.trim(),
        code: planteurCode,
        cooperative_id: cooperativeId,
        chef_planteur_id: planteurData.chef_planteur_id,
        auto_created: false, // Not auto-created, user explicitly created
        is_active: true,
        created_by: user.id,
      })
      .select('id, name, code')
      .single();

    if (createPlanteurError) {
      // Check for unique constraint violations
      if (createPlanteurError.code === '23505') {
        if (createPlanteurError.message?.includes('planteurs_unique_name_norm_per_coop')) {
          return validationErrorResponse(
            'planteur.name',
            'A planteur with this name already exists in the cooperative'
          );
        }
        if (createPlanteurError.message?.includes('planteurs_code_key') || 
            createPlanteurError.message?.includes('code')) {
          return validationErrorResponse(
            'planteur.code',
            'A planteur with this code already exists'
          );
        }
      }
      console.error('Error creating planteur:', createPlanteurError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to create planteur',
        { reason: createPlanteurError.message }
      ));
    }

    if (!newPlanteur) {
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to create planteur: No data returned',
        {}
      ));
    }

    const typedNewPlanteur = newPlanteur as { id: string; name: string; code: string };
    const planteurId = typedNewPlanteur.id;

    // Assign parcelles to the new planteur
    const assignedIds: string[] = [];
    let updatedCount = 0;

    for (const parcelle of typedParcelles) {
      // Generate code if null
      let code = parcelle.code;
      if (!code) {
        code = await generateParcelleCode(supabase, planteurId);
      }

      // Update the parcelle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('parcelles')
        .update({
          planteur_id: planteurId,
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
            operation: 'assign_with_new_planteur',
            parcelle_ids: parcelle_ids,
            previous_planteur_id: null, // All were orphan
          },
          new_data: {
            operation: 'assign_with_new_planteur',
            parcelle_ids: assignedIds,
            planteur_id: planteurId,
            planteur_name: typedNewPlanteur.name,
            planteur_code: typedNewPlanteur.code,
            planteur_created: true,
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
    const responseData: AssignNewPlanteurResponse = {
      planteur_id: planteurId,
      planteur_name: typedNewPlanteur.name,
      planteur_code: typedNewPlanteur.code,
      updated_count: updatedCount,
      assigned_ids: assignedIds,
      audit_log_id: auditLogId,
    };

    const response = NextResponse.json(responseData, { status: 201 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/assign-new-planteur');
  }
}
