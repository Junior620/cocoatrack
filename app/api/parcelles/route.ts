// CocoaTrack V2 - Parcelles API Route
// GET /api/parcelles - List parcelles with filters
// POST /api/parcelles - Create a new parcelle

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import {
  parcelleFiltersSchema,
  createParcelleSchema,
  shouldSimplifyGeometry,
  type ParcelleFiltersOutput,
} from '@/lib/validations/parcelle';
import type { Parcelle, ParcelleWithPlanteur } from '@/types/parcelles';
import { PARCELLE_LIMITS } from '@/types/parcelles';
import type { Polygon, MultiPolygon } from 'geojson';
import {
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
  invalidGeometryResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';

/**
 * Raw row type from list_parcelles RPC function
 */
interface ListParcellesRow {
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
  total_count: number;
}

/**
 * Transform RPC row to ParcelleWithPlanteur type
 */
function transformRpcRow(row: ListParcellesRow): ParcelleWithPlanteur {
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
 * GET /api/parcelles
 * 
 * List parcelles with filters, pagination, and bbox.
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const rawFilters: Record<string, unknown> = {};

    // Extract all filter parameters
    if (searchParams.has('planteur_id')) {
      rawFilters.planteur_id = searchParams.get('planteur_id');
    }
    if (searchParams.has('conformity_status')) {
      rawFilters.conformity_status = searchParams.get('conformity_status');
    }
    if (searchParams.has('certification')) {
      rawFilters.certification = searchParams.get('certification');
    }
    if (searchParams.has('village')) {
      rawFilters.village = searchParams.get('village');
    }
    if (searchParams.has('source')) {
      rawFilters.source = searchParams.get('source');
    }
    if (searchParams.has('import_file_id')) {
      rawFilters.import_file_id = searchParams.get('import_file_id');
    }
    if (searchParams.has('search')) {
      rawFilters.search = searchParams.get('search');
    }
    if (searchParams.has('bbox')) {
      rawFilters.bbox = searchParams.get('bbox');
    }
    if (searchParams.has('is_active')) {
      rawFilters.is_active = searchParams.get('is_active') === 'true';
    }
    if (searchParams.has('page')) {
      rawFilters.page = parseInt(searchParams.get('page') || '1', 10);
    }
    if (searchParams.has('pageSize')) {
      rawFilters.pageSize = parseInt(searchParams.get('pageSize') || String(PARCELLE_LIMITS.DEFAULT_PAGE_SIZE), 10);
    }
    if (searchParams.has('zoom')) {
      rawFilters.zoom = parseInt(searchParams.get('zoom') || '0', 10);
    }
    if (searchParams.has('simplify')) {
      rawFilters.simplify = searchParams.get('simplify') === 'true';
    }

    // Validate filters with Zod schema
    const parseResult = parcelleFiltersSchema.safeParse(rawFilters);
    
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const validatedFilters = parseResult.data as ParcelleFiltersOutput;
    
    const {
      page,
      pageSize,
      planteur_id,
      conformity_status,
      certification,
      village,
      source,
      import_file_id,
      search,
      bbox,
      is_active,
      zoom,
      simplify,
    } = validatedFilters;

    // Determine if geometry should be simplified based on zoom/bbox
    const shouldSimplify = shouldSimplifyGeometry(zoom, bbox, simplify);

    // Prepare RPC parameters
    const rpcParams: Record<string, unknown> = {
      p_is_active: is_active,
      p_page: page,
      p_page_size: pageSize,
      p_simplify: shouldSimplify,
    };

    // Add optional filters
    if (planteur_id) {
      rpcParams.p_planteur_id = planteur_id;
    }
    if (conformity_status) {
      rpcParams.p_conformity_status = conformity_status;
    }
    if (certification) {
      rpcParams.p_certification = certification;
    }
    if (village) {
      rpcParams.p_village = village;
    }
    if (source) {
      rpcParams.p_source = source;
    }
    if (import_file_id) {
      rpcParams.p_import_file_id = import_file_id;
    }
    if (search) {
      rpcParams.p_search = search;
    }
    
    // Add bbox parameters if provided
    if (bbox) {
      rpcParams.p_bbox_min_lng = bbox.minLng;
      rpcParams.p_bbox_min_lat = bbox.minLat;
      rpcParams.p_bbox_max_lng = bbox.maxLng;
      rpcParams.p_bbox_max_lat = bbox.maxLat;
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('list_parcelles', rpcParams as any);

    if (error) {
      console.error('Error fetching parcelles:', error);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch parcelles',
        { reason: error.message }
      ));
    }

    // Transform results
    const rows = (data || []) as ListParcellesRow[];
    const transformedData = rows.map(transformRpcRow);
    
    // Get total count from first row (all rows have the same total_count)
    const total = rows.length > 0 ? rows[0].total_count : 0;

    // Build response
    const response = NextResponse.json({
      data: transformedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'GET /api/parcelles');
  }
}

/**
 * Raw row type from create_parcelle RPC function
 */
interface CreateParcelleRow {
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
 * Generate a unique code for a parcelle
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
 * POST /api/parcelles
 * 
 * Create a new parcelle with geometry normalization.
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
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
    const parseResult = createParcelleSchema.safeParse(body);
    
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const validatedInput = parseResult.data;

    // Normalize geometry to MultiPolygon
    const normalizedGeometry = normalizeToMultiPolygon(validatedInput.geometry);

    // Generate code if not provided
    let code = validatedInput.code;
    if (!code) {
      code = await generateParcelleCode(supabase, validatedInput.planteur_id);
    }

    // Call the RPC function to create the parcelle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('create_parcelle', {
      p_planteur_id: validatedInput.planteur_id,
      p_code: code,
      p_label: validatedInput.label ?? null,
      p_village: validatedInput.village ?? null,
      p_geometry_geojson: JSON.stringify(normalizedGeometry),
      p_certifications: validatedInput.certifications ?? [],
      p_conformity_status: validatedInput.conformity_status ?? 'informations_manquantes',
      p_risk_flags: validatedInput.risk_flags ?? {},
      p_source: 'manual',
      p_created_by: user.id,
    } as any);

    if (error) {
      console.error('Error creating parcelle:', error);
      
      // Handle specific error cases
      if (error.message.includes('INVALID_GEOMETRY')) {
        return invalidGeometryResponse(error.message);
      }
      if (error.message.includes('parcelles_code_unique')) {
        return validationErrorResponse('code', 'Code must be unique per planteur');
      }
      if (error.message.includes('UNAUTHORIZED')) {
        return unauthorizedResponse();
      }
      
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to create parcelle',
        { reason: error.message }
      ));
    }

    // RPC returns an array, get first row
    const rows = (data || []) as CreateParcelleRow[];
    
    if (rows.length === 0) {
      return internalErrorResponse('Parcelle created but no data returned');
    }

    const row = rows[0];

    // Transform to ParcelleWithPlanteur response
    const createdParcelle: ParcelleWithPlanteur = {
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

    // Build response with 201 Created status
    const response = NextResponse.json(createdParcelle, { status: 201 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles');
  }
}
