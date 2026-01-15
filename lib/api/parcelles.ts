// CocoaTrack V2 - Parcelles API
// Client-side API functions for parcelle operations

import { createClient } from '@/lib/supabase/client';
import type { PaginatedResult } from '@/types';
import type { Polygon, MultiPolygon } from 'geojson';
import type {
  Parcelle,
  ParcelleWithPlanteur,
  ParcelleFilters,
  CreateParcelleInput,
  UpdateParcelleInput,
  ExportFormat,
  Certification,
  ConformityStatus,
} from '@/types/parcelles';
import {
  PARCELLE_LIMITS,
  CERTIFICATION_LABELS,
  CONFORMITY_STATUS_LABELS,
  PARCELLE_SOURCE_LABELS,
} from '@/types/parcelles';
import {
  parcelleFiltersSchema,
  createParcelleSchema,
  updateParcelleSchema,
  shouldSimplifyGeometry,
  type ParcelleFiltersOutput,
} from '@/lib/validations/parcelle';
import * as XLSX from 'xlsx';

// Helper to get typed client
const getTypedClient = () => createClient();

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
 * Raw row type from get_parcelle RPC function (single parcelle)
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
 * Parcelles API - Client-side functions for parcelle operations
 */
export const parcellesApi = {
  /**
   * List parcelles with filters, pagination, and bbox
   * 
   * Filters:
   * - planteur_id: Filter by planteur UUID
   * - conformity_status: Filter by conformity status
   * - certification: Filter by certification (parcelle must have this cert)
   * - village: Filter by village name (exact match)
   * - source: Filter by data source (manual, shapefile, kml, geojson)
   * - import_file_id: Filter by import file UUID
   * - search: Search by parcelle code or planteur name/code
   * - bbox: Geographic bounding box filter "minLng,minLat,maxLng,maxLat"
   * - is_active: Filter by active status (default: true)
   * - page: Page number (1-indexed, default: 1)
   * - pageSize: Items per page (default: 20, max: 100)
   * - zoom: Map zoom level (triggers simplification when <= 10)
   * - simplify: Force geometry simplification
   * 
   * Geometry Simplification (Requirement 5.8):
   * - When zoom <= 10 OR bbox area > 10000 km², geometry is simplified
   * - Uses ST_SimplifyPreserveTopology(geometry, 0.001) for ~111m tolerance
   * - Improves map rendering performance for large areas
   * 
   * Note: cooperative_id is NOT a filter - RLS enforces cooperative isolation
   * via planteur.cooperative_id = user.cooperative_id
   */
  async list(filters: ParcelleFilters = {}): Promise<PaginatedResult<ParcelleWithPlanteur>> {
    const supabase = getTypedClient();
    
    // Validate and parse filters
    const validatedFilters = parcelleFiltersSchema.parse({
      ...filters,
      // Convert string page/pageSize/zoom to numbers if needed
      page: filters.page ? Number(filters.page) : undefined,
      pageSize: filters.pageSize ? Number(filters.pageSize) : undefined,
      zoom: filters.zoom !== undefined ? Number(filters.zoom) : undefined,
    }) as ParcelleFiltersOutput;
    
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
      throw new Error(`Failed to fetch parcelles: ${error.message}`);
    }

    // Transform results
    const rows = (data || []) as ListParcellesRow[];
    const transformedData = rows.map(transformRpcRow);
    
    // Get total count from first row (all rows have the same total_count)
    const total = rows.length > 0 ? rows[0].total_count : 0;

    return {
      data: transformedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Get a single parcelle by ID with planteur relation
   * 
   * Returns the parcelle with its associated planteur information.
   * RLS enforces cooperative isolation - only parcelles belonging to
   * planteurs in the user's cooperative are accessible.
   * 
   * @param id - UUID of the parcelle to fetch
   * @returns ParcelleWithPlanteur or null if not found
   * @throws Error if database query fails
   */
  async get(id: string): Promise<ParcelleWithPlanteur | null> {
    const supabase = getTypedClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return null;
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_parcelle', { p_id: id } as any);

    if (error) {
      throw new Error(`Failed to fetch parcelle: ${error.message}`);
    }

    // RPC returns an array, get first row
    const rows = (data || []) as GetParcelleRow[];
    
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Transform to ParcelleWithPlanteur
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
  },

  /**
   * Create a new parcelle with geometry normalization
   * 
   * The geometry is normalized to MultiPolygon format before storage:
   * - Polygon input is wrapped as MultiPolygon
   * - MultiPolygon input is passed through unchanged
   * 
   * PostGIS triggers handle:
   * - Geometry validation (ST_IsValid, ST_MakeValid)
   * - Centroid calculation (ST_PointOnSurface)
   * - Surface area calculation (ST_Area)
   * 
   * RLS enforces cooperative isolation - user can only create parcelles
   * for planteurs in their cooperative.
   * 
   * @param input - CreateParcelleInput with planteur_id and geometry
   * @returns Created ParcelleWithPlanteur
   * @throws Error if validation fails or database operation fails
   */
  async create(input: CreateParcelleInput): Promise<ParcelleWithPlanteur> {
    const supabase = getTypedClient();

    // Validate input with Zod schema
    const validatedInput = createParcelleSchema.parse(input);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Normalize geometry to MultiPolygon
    const normalizedGeometry = normalizeToMultiPolygon(validatedInput.geometry);

    // Generate code if not provided
    let code = validatedInput.code;
    if (!code) {
      code = await generateParcelleCode(supabase, validatedInput.planteur_id);
    }

    // Prepare insert data
    // Note: centroid and surface_hectares are calculated by PostGIS trigger
    const insertData = {
      planteur_id: validatedInput.planteur_id,
      code,
      label: validatedInput.label ?? null,
      village: validatedInput.village ?? null,
      // Convert GeoJSON to PostGIS geometry using ST_GeomFromGeoJSON
      // The geometry column expects a geometry type, so we pass the GeoJSON string
      geometry: `SRID=4326;${JSON.stringify(normalizedGeometry)}`,
      certifications: validatedInput.certifications ?? [],
      conformity_status: validatedInput.conformity_status ?? 'informations_manquantes',
      risk_flags: validatedInput.risk_flags ?? {},
      source: 'manual' as const,
      created_by: user.id,
    };

    // Insert using RPC function that handles geometry conversion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('create_parcelle', {
      p_planteur_id: insertData.planteur_id,
      p_code: insertData.code,
      p_label: insertData.label,
      p_village: insertData.village,
      p_geometry_geojson: JSON.stringify(normalizedGeometry),
      p_certifications: insertData.certifications,
      p_conformity_status: insertData.conformity_status,
      p_risk_flags: insertData.risk_flags,
      p_source: insertData.source,
      p_created_by: insertData.created_by,
    } as any);

    if (error) {
      // Handle specific error cases
      if (error.message.includes('INVALID_GEOMETRY')) {
        throw {
          error_code: 'INVALID_GEOMETRY',
          message: 'Invalid geometry provided',
          details: { reason: error.message },
        };
      }
      if (error.message.includes('parcelles_code_unique')) {
        throw {
          error_code: 'VALIDATION_ERROR',
          message: 'A parcelle with this code already exists for this planteur',
          details: { field: 'code', message: 'Code must be unique per planteur' },
        };
      }
      throw new Error(`Failed to create parcelle: ${error.message}`);
    }

    // The RPC returns the created parcelle with all calculated fields
    const row = data as GetParcelleRow;

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
  },

  /**
   * Update an existing parcelle
   * 
   * Updates only the provided fields - omitted fields are preserved.
   * If geometry is updated, PostGIS triggers recalculate centroid and surface.
   * 
   * Note: planteur_id cannot be changed (parcelle ownership is immutable)
   * Note: source and import_file_id are set by the system, not user-editable
   * 
   * RLS enforces cooperative isolation - user can only update parcelles
   * for planteurs in their cooperative.
   * 
   * @param id - UUID of the parcelle to update
   * @param input - UpdateParcelleInput with fields to update
   * @returns Updated ParcelleWithPlanteur
   * @throws Error if validation fails, parcelle not found, or database operation fails
   */
  async update(id: string, input: UpdateParcelleInput): Promise<ParcelleWithPlanteur> {
    const supabase = getTypedClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw {
        error_code: 'VALIDATION_ERROR',
        message: 'Invalid parcelle ID format',
        details: { field: 'id', message: 'Must be a valid UUID' },
      };
    }

    // Validate input with Zod schema
    const validatedInput = updateParcelleSchema.parse(input);

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
        throw {
          error_code: 'NOT_FOUND',
          message: 'Parcelle not found or access denied',
          details: { id },
        };
      }
      if (error.message.includes('UNAUTHORIZED')) {
        throw {
          error_code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          details: {},
        };
      }
      if (error.message.includes('INVALID_GEOMETRY')) {
        throw {
          error_code: 'INVALID_GEOMETRY',
          message: 'Invalid geometry provided',
          details: { reason: error.message },
        };
      }
      if (error.message.includes('parcelles_code_unique')) {
        throw {
          error_code: 'VALIDATION_ERROR',
          message: 'A parcelle with this code already exists for this planteur',
          details: { field: 'code', message: 'Code must be unique per planteur' },
        };
      }
      throw new Error(`Failed to update parcelle: ${error.message}`);
    }

    // RPC returns an array, get first row
    const rows = (data || []) as GetParcelleRow[];
    
    if (rows.length === 0) {
      throw {
        error_code: 'NOT_FOUND',
        message: 'Parcelle not found after update',
        details: { id },
      };
    }

    const row = rows[0];

    // Transform to ParcelleWithPlanteur
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
  },

  /**
   * Archive (soft-delete) a parcelle
   * 
   * Sets is_active=false on the parcelle. The record remains in the database
   * for audit purposes and can be retrieved with explicit is_active=false filter.
   * 
   * Note: This is a soft-delete - hard delete is reserved for DB admin scripts only.
   * 
   * RLS enforces cooperative isolation - user can only archive parcelles
   * for planteurs in their cooperative.
   * 
   * @param id - UUID of the parcelle to archive
   * @throws Error if parcelle not found, already archived, or database operation fails
   */
  async archive(id: string): Promise<void> {
    const supabase = getTypedClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw {
        error_code: 'VALIDATION_ERROR',
        message: 'Invalid parcelle ID format',
        details: { field: 'id', message: 'Must be a valid UUID' },
      };
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc('archive_parcelle', { p_id: id } as any);

    if (error) {
      // Handle specific error cases
      if (error.message.includes('NOT_FOUND')) {
        throw {
          error_code: 'NOT_FOUND',
          message: 'Parcelle not found or access denied',
          details: { id },
        };
      }
      if (error.message.includes('UNAUTHORIZED')) {
        throw {
          error_code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          details: {},
        };
      }
      if (error.message.includes('already archived')) {
        throw {
          error_code: 'VALIDATION_ERROR',
          message: 'Parcelle is already archived',
          details: { field: 'is_active', message: 'Parcelle is already archived' },
        };
      }
      throw new Error(`Failed to archive parcelle: ${error.message}`);
    }
  },

  /**
   * Export parcelles to xlsx or csv format
   * 
   * Exports parcelles matching the provided filters to a downloadable file.
   * The export includes columns as per requirements:
   * - identifiant (code)
   * - planteur (name)
   * - village
   * - hectares (surface_hectares)
   * - certificats (certifications joined)
   * - statut (conformity_status)
   * - centroid_lat
   * - centroid_lng
   * 
   * Limits:
   * - Maximum 50,000 rows per export
   * - If limit exceeded, returns LIMIT_EXCEEDED error
   * 
   * @param filters - ParcelleFilters to apply (same as list)
   * @param format - Export format: 'xlsx' or 'csv'
   * @returns Blob containing the exported file
   * @throws Error if limit exceeded or database operation fails
   */
  async export(filters: ParcelleFilters = {}, format: ExportFormat = 'csv'): Promise<Blob> {
    const supabase = getTypedClient();
    
    // Validate and parse filters (without pagination limits for export)
    const validatedFilters = parcelleFiltersSchema.parse({
      ...filters,
      page: 1,
      pageSize: PARCELLE_LIMITS.MAX_EXPORT_ROWS, // Use max export limit
    }) as ParcelleFiltersOutput;
    
    const {
      planteur_id,
      conformity_status,
      certification,
      village,
      source,
      import_file_id,
      search,
      bbox,
      is_active,
    } = validatedFilters;

    // Prepare RPC parameters for export (no pagination, just filters)
    const rpcParams: Record<string, unknown> = {
      p_is_active: is_active,
      p_page: 1,
      p_page_size: PARCELLE_LIMITS.MAX_EXPORT_ROWS,
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
      throw new Error(`Failed to fetch parcelles for export: ${error.message}`);
    }

    const rows = (data || []) as ListParcellesRow[];
    
    // Check if total exceeds limit
    const total = rows.length > 0 ? rows[0].total_count : 0;
    if (total > PARCELLE_LIMITS.MAX_EXPORT_ROWS) {
      throw {
        error_code: 'LIMIT_EXCEEDED',
        message: `Export limit exceeded. Maximum ${PARCELLE_LIMITS.MAX_EXPORT_ROWS} rows allowed.`,
        details: {
          limit: PARCELLE_LIMITS.MAX_EXPORT_ROWS,
          actual: total,
          resource: 'export_rows',
        },
      };
    }

    // Transform rows to export format
    const exportData = rows.map((row) => ({
      identifiant: row.code,
      planteur: row.planteur_name,
      village: row.village || '',
      hectares: Number(row.surface_hectares).toFixed(4),
      certificats: (row.certifications || [])
        .map((cert: string) => CERTIFICATION_LABELS[cert as Certification] || cert)
        .join(', '),
      statut: CONFORMITY_STATUS_LABELS[row.conformity_status as ConformityStatus] || row.conformity_status,
      centroid_lat: row.centroid_lat?.toFixed(6) || '',
      centroid_lng: row.centroid_lng?.toFixed(6) || '',
      source: PARCELLE_SOURCE_LABELS[row.source as keyof typeof PARCELLE_SOURCE_LABELS] || row.source,
    }));

    // Generate file based on format
    if (format === 'xlsx') {
      return generateXlsxBlob(exportData);
    } else {
      return generateCsvBlob(exportData);
    }
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize geometry to MultiPolygon format
 * 
 * PostGIS stores all parcelle geometries as MultiPolygon for consistency.
 * This function wraps Polygon geometries as MultiPolygon.
 * 
 * @param geometry - Polygon or MultiPolygon GeoJSON geometry
 * @returns MultiPolygon GeoJSON geometry
 */
export function normalizeToMultiPolygon(geometry: Polygon | MultiPolygon): MultiPolygon {
  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }
  
  // Wrap Polygon as MultiPolygon
  return {
    type: 'MultiPolygon',
    coordinates: [geometry.coordinates],
  };
}

/**
 * Generate a unique code for a parcelle
 * Format: PARC-XXXX where XXXX is a sequential number per planteur
 * 
 * @param supabase - Supabase client
 * @param planteurId - UUID of the planteur
 * @returns Generated code string
 */
async function generateParcelleCode(
  supabase: ReturnType<typeof createClient>,
  planteurId: string
): Promise<string> {
  // Count existing parcelles for this planteur
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

// =============================================================================
// Export Helper Functions
// =============================================================================

/**
 * Export row data structure
 */
interface ExportRow {
  identifiant: string;
  planteur: string;
  village: string;
  hectares: string;
  certificats: string;
  statut: string;
  centroid_lat: string;
  centroid_lng: string;
  source: string;
}

/**
 * Column headers for export (French labels)
 */
const EXPORT_HEADERS = {
  identifiant: 'Identifiant',
  planteur: 'Planteur',
  village: 'Village',
  hectares: 'Hectares',
  certificats: 'Certificats',
  statut: 'Statut',
  centroid_lat: 'Latitude',
  centroid_lng: 'Longitude',
  source: 'Source',
};

/**
 * Generate XLSX blob from export data
 * 
 * @param data - Array of export rows
 * @returns Blob containing the XLSX file
 */
function generateXlsxBlob(data: ExportRow[]): Blob {
  // Create header row
  const headers = Object.values(EXPORT_HEADERS);
  
  // Create data rows
  const rows = data.map((row) => [
    row.identifiant,
    row.planteur,
    row.village,
    row.hectares,
    row.certificats,
    row.statut,
    row.centroid_lat,
    row.centroid_lng,
    row.source,
  ]);
  
  // Combine header and data
  const sheetData = [headers, ...rows];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // identifiant
    { wch: 25 }, // planteur
    { wch: 20 }, // village
    { wch: 12 }, // hectares
    { wch: 30 }, // certificats
    { wch: 20 }, // statut
    { wch: 12 }, // centroid_lat
    { wch: 12 }, // centroid_lng
    { wch: 12 }, // source
  ];
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parcelles');
  
  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate CSV blob from export data
 * 
 * @param data - Array of export rows
 * @returns Blob containing the CSV file
 */
function generateCsvBlob(data: ExportRow[]): Blob {
  // Create header row
  const headers = Object.values(EXPORT_HEADERS);
  
  // Escape CSV value (handle commas, quotes, newlines)
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  // Create CSV lines
  const lines: string[] = [];
  
  // Add header
  lines.push(headers.map(escapeCSV).join(','));
  
  // Add data rows
  for (const row of data) {
    const values = [
      row.identifiant,
      row.planteur,
      row.village,
      row.hectares,
      row.certificats,
      row.statut,
      row.centroid_lat,
      row.centroid_lng,
      row.source,
    ];
    lines.push(values.map(escapeCSV).join(','));
  }
  
  // Join with newlines and add BOM for Excel compatibility
  const csvContent = '\uFEFF' + lines.join('\r\n');
  
  return new Blob([csvContent], {
    type: 'text/csv;charset=utf-8',
  });
}

// =============================================================================
// KPI Functions
// =============================================================================

/**
 * KPI statistics for parcelles
 */
export interface ParcelleKPIStats {
  /** Total number of parcelles */
  total: number;
  /** Number of parcelles with status 'conforme' */
  conformes: number;
  /** Percentage of conformes (0-100) */
  conformes_pct: number;
  /** Number of parcelles with status 'non_conforme' */
  non_conformes: number;
  /** Percentage of non_conformes (0-100) */
  non_conformes_pct: number;
  /** Number of parcelles with status 'en_cours' */
  en_cours: number;
  /** Percentage of en_cours (0-100) */
  en_cours_pct: number;
  /** Number of parcelles with status 'informations_manquantes' */
  informations_manquantes: number;
  /** Percentage of informations_manquantes (0-100) */
  informations_manquantes_pct: number;
  /** Total surface in hectares */
  total_hectares: number;
}

/**
 * Get KPI statistics for parcelles
 * 
 * Returns aggregated statistics for all active parcelles in the user's cooperative:
 * - Total count
 * - Count and percentage by conformity status
 * - Total surface in hectares
 * 
 * RLS enforces cooperative isolation - only parcelles belonging to
 * planteurs in the user's cooperative are counted.
 * 
 * @returns ParcelleKPIStats with aggregated statistics
 * @throws Error if database query fails
 */
export async function getParcelleKPIs(): Promise<ParcelleKPIStats> {
  const supabase = getTypedClient();

  // Query to get counts by conformity status and total hectares
  // Uses RLS to filter by cooperative
  const { data, error } = await supabase
    .from('parcelles')
    .select('conformity_status, surface_hectares')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch parcelle KPIs: ${error.message}`);
  }

  // Type the rows explicitly
  const rows = (data || []) as Array<{ conformity_status: string; surface_hectares: number }>;
  
  // Calculate statistics
  const total = rows.length;
  let conformes = 0;
  let non_conformes = 0;
  let en_cours = 0;
  let informations_manquantes = 0;
  let total_hectares = 0;

  for (const row of rows) {
    total_hectares += Number(row.surface_hectares) || 0;
    
    switch (row.conformity_status) {
      case 'conforme':
        conformes++;
        break;
      case 'non_conforme':
        non_conformes++;
        break;
      case 'en_cours':
        en_cours++;
        break;
      case 'informations_manquantes':
        informations_manquantes++;
        break;
    }
  }

  // Calculate percentages (avoid division by zero)
  const calcPct = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100 * 10) / 10; // 1 decimal place
  };

  return {
    total,
    conformes,
    conformes_pct: calcPct(conformes),
    non_conformes,
    non_conformes_pct: calcPct(non_conformes),
    en_cours,
    en_cours_pct: calcPct(en_cours),
    informations_manquantes,
    informations_manquantes_pct: calcPct(informations_manquantes),
    total_hectares: Math.round(total_hectares * 100) / 100, // 2 decimal places
  };
}


// =============================================================================
// Filter Options Functions
// =============================================================================

/**
 * Row type for village query
 */
interface VillageRow {
  village: string | null;
}

/**
 * Get distinct villages from parcelles
 * 
 * Returns a list of unique village names from all active parcelles
 * in the user's cooperative. Useful for populating filter dropdowns.
 * 
 * RLS enforces cooperative isolation - only villages from parcelles
 * belonging to planteurs in the user's cooperative are returned.
 * 
 * @returns Array of distinct village names (sorted alphabetically)
 * @throws Error if database query fails
 */
export async function getDistinctVillages(): Promise<string[]> {
  const supabase = getTypedClient();

  // Query distinct villages from active parcelles
  const { data, error } = await supabase
    .from('parcelles')
    .select('village')
    .eq('is_active', true)
    .not('village', 'is', null)
    .order('village', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch distinct villages: ${error.message}`);
  }

  // Extract unique villages (Supabase doesn't have DISTINCT, so we dedupe in JS)
  const villages = new Set<string>();
  const rows = (data || []) as VillageRow[];
  for (const row of rows) {
    if (row.village && row.village.trim()) {
      villages.add(row.village.trim());
    }
  }

  return Array.from(villages).sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Import file option for filter dropdown
 */
export interface ImportFileOption {
  id: string;
  filename: string;
  created_at: string;
  nb_applied: number;
}

/**
 * Row type for import file query
 */
interface ImportFileRow {
  id: string;
  filename: string;
  created_at: string;
  nb_applied: number | null;
}

/**
 * Get import files for filter dropdown
 * 
 * Returns a list of import files that have been applied (status='applied')
 * in the user's cooperative. Useful for filtering parcelles by import source.
 * 
 * RLS enforces cooperative isolation - only import files from the user's
 * cooperative are returned.
 * 
 * @returns Array of import file options (sorted by creation date, newest first)
 * @throws Error if database query fails
 */
export async function getImportFileOptions(): Promise<ImportFileOption[]> {
  const supabase = getTypedClient();

  // Query applied import files
  const { data, error } = await supabase
    .from('parcel_import_files')
    .select('id, filename, created_at, nb_applied')
    .eq('import_status', 'applied')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch import files: ${error.message}`);
  }

  const rows = (data || []) as ImportFileRow[];
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    created_at: row.created_at,
    nb_applied: row.nb_applied || 0,
  }));
}
