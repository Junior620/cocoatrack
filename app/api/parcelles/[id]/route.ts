// CocoaTrack V2 - Parcelles API Route (Single Parcelle)
// GET /api/parcelles/[id] - Get a single parcelle by ID
// PATCH /api/parcelles/[id] - Update a parcelle
// DELETE /api/parcelles/[id] - Archive (soft-delete) a parcelle

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { updateParcelleSchema } from '@/lib/validations/parcelle';
import type { Parcelle, ParcelleWithPlanteur } from '@/types/parcelles';
import type { MultiPolygon, Polygon } from 'geojson';
import {
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  invalidGeometryResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';

/**
 * Raw row type from get_parcelle RPC function
 */
interface GetParcelleRow {
  id: string;
  planteur_id: string;
  code: string;
  label: string | null;
  village: string | null;
  geometry_geojson: Record<string, unknown>;
  centroid_lat: number;
  centroid_lng: number;
  surface_hectares: number;
  certifications: string[];
  conformity_status: string;
  risk_flags: Record<string, unknown>;
  source: string;
  import_file_id: string | null;
  feature_hash: string | null;
  is_active: boolean;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  planteur_name: string;
  planteur_code: string;
  planteur_cooperative_id: string;
}

/**
 * Transform RPC row to ParcelleWithPlanteur type
 */
function transformRpcRow(row: GetParcelleRow): ParcelleWithPlanteur {
  return {
    id: row.id,
    planteur_id: row.planteur_id,
    code: row.code,
    label: row.label,
    village: row.village,
    geometry: row.geometry_geojson as unknown as Parcelle['geometry'],
    centroid: {
      lat: row.centroid_lat,
      lng: row.centroid_lng,
    },
    surface_hectares: Number(row.surface_hectares),
    certifications: (row.certifications || []) as Parcelle['certifications'],
    conformity_status: row.conformity_status as Parcelle['conformity_status'],
    risk_flags: (row.risk_flags as unknown as Parcelle['risk_flags']) || {},
    source: row.source as Parcelle['source'],
    import_file_id: row.import_file_id,
    feature_hash: row.feature_hash,
    is_active: row.is_active,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    planteur: {
      id: row.planteur_id,
      name: row.planteur_name,
      code: row.planteur_code,
      cooperative_id: row.planteur_cooperative_id,
    },
  };
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * GET /api/parcelles/[id]
 * 
 * Get a single parcelle by ID with planteur relation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get the id from params
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return validationErrorResponse('id', 'Must be a valid UUID');
    }

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_parcelle', { p_id: id } as any);

    if (error) {
      console.error('Error fetching parcelle:', error);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch parcelle',
        { reason: error.message }
      ));
    }

    // RPC returns an array, get first row
    const rows = (data || []) as GetParcelleRow[];
    
    if (rows.length === 0) {
      return notFoundResponse('parcelle', id);
    }

    const row = rows[0];

    // Transform to ParcelleWithPlanteur response
    const parcelle = transformRpcRow(row);

    // Build response
    const response = NextResponse.json(parcelle);

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'GET /api/parcelles/[id]');
  }
}

/**
 * Normalize geometry to MultiPolygon format
 */
function normalizeToMultiPolygon(geometry: Polygon | MultiPolygon): MultiPolygon {
  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }
  
  return {
    type: 'MultiPolygon',
    coordinates: [geometry.coordinates],
  };
}

/**
 * DELETE /api/parcelles/[id]
 * 
 * Archive (soft-delete) a parcelle by setting is_active=false.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get the id from params
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return validationErrorResponse('id', 'Must be a valid UUID');
    }

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Call the RPC function to archive (soft-delete)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc('archive_parcelle', { p_id: id } as any);

    if (error) {
      // Handle specific error cases
      if (error.message.includes('NOT_FOUND')) {
        return notFoundResponse('parcelle', id);
      }
      if (error.message.includes('UNAUTHORIZED')) {
        return unauthorizedResponse();
      }
      if (error.message.includes('already archived')) {
        return validationErrorResponse('is_active', 'Parcelle is already archived');
      }

      console.error('Error archiving parcelle:', error);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to archive parcelle',
        { reason: error.message }
      ));
    }

    // Return 204 No Content on successful archive
    const response = new NextResponse(null, { status: 204 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'DELETE /api/parcelles/[id]');
  }
}

/**
 * PATCH /api/parcelles/[id]
 * 
 * Update an existing parcelle.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get the id from params
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return validationErrorResponse('id', 'Must be a valid UUID');
    }

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse('body', 'Request body must be valid JSON');
    }

    // Validate input with Zod schema
    const parseResult = updateParcelleSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(
        firstError.path.join('.') || 'body',
        firstError.message
      );
    }

    const validatedInput = parseResult.data;

    // Prepare RPC parameters - only include non-undefined values
    const rpcParams: Record<string, unknown> = {
      p_id: id,
    };

    // Add optional fields only if provided
    if (validatedInput.code !== undefined) {
      rpcParams.p_code = validatedInput.code;
    }
    if (validatedInput.label !== undefined) {
      rpcParams.p_label = validatedInput.label;
    }
    if (validatedInput.village !== undefined) {
      rpcParams.p_village = validatedInput.village;
    }
    if (validatedInput.geometry !== undefined) {
      // Normalize geometry to MultiPolygon and convert to JSON string
      const normalizedGeometry = normalizeToMultiPolygon(validatedInput.geometry);
      rpcParams.p_geometry_geojson = JSON.stringify(normalizedGeometry);
    }
    if (validatedInput.certifications !== undefined) {
      rpcParams.p_certifications = validatedInput.certifications;
    }
    if (validatedInput.conformity_status !== undefined) {
      rpcParams.p_conformity_status = validatedInput.conformity_status;
    }
    if (validatedInput.risk_flags !== undefined) {
      rpcParams.p_risk_flags = validatedInput.risk_flags;
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('update_parcelle', rpcParams as any);

    if (error) {
      // Handle specific error cases
      if (error.message.includes('NOT_FOUND')) {
        return notFoundResponse('parcelle', id);
      }
      if (error.message.includes('UNAUTHORIZED')) {
        return unauthorizedResponse();
      }
      if (error.message.includes('INVALID_GEOMETRY')) {
        return invalidGeometryResponse(error.message);
      }
      if (error.message.includes('parcelles_code_unique')) {
        return validationErrorResponse('code', 'Code must be unique per planteur');
      }

      console.error('Error updating parcelle:', error);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to update parcelle',
        { reason: error.message }
      ));
    }

    // RPC returns an array, get first row
    const rows = (data || []) as GetParcelleRow[];
    
    if (rows.length === 0) {
      return notFoundResponse('parcelle', id);
    }

    const row = rows[0];

    // Transform to ParcelleWithPlanteur response
    const parcelle = transformRpcRow(row);

    // Build response
    const response = NextResponse.json(parcelle);

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'PATCH /api/parcelles/[id]');
  }
}
