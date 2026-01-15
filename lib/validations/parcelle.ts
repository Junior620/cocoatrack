// CocoaTrack V2 - Parcelle Validation Schemas
// Zod schemas for parcelle data validation with GeoJSON geometry support

import { z } from 'zod';
import {
  CERTIFICATIONS_WHITELIST,
  CONFORMITY_STATUS_VALUES,
  PARCELLE_SOURCE_VALUES,
  PARCELLE_LIMITS,
} from '@/types/parcelles';

// ============================================================================
// ENUMS (Centralized - reused in DB CHECK, Zod, UI)
// ============================================================================

/**
 * Conformity status enum schema
 * Uses centralized CONFORMITY_STATUS_VALUES from types/parcelles.ts
 * Values: conforme, non_conforme, en_cours, informations_manquantes
 */
export const conformityStatusSchema = z.enum(CONFORMITY_STATUS_VALUES);

/**
 * Parcelle source enum schema
 * Uses centralized PARCELLE_SOURCE_VALUES from types/parcelles.ts
 * Values: manual, shapefile, kml, geojson (KMZ → kml)
 */
export const parcelleSourceSchema = z.enum(PARCELLE_SOURCE_VALUES);

/**
 * Certifications whitelist enum schema
 * Uses centralized CERTIFICATIONS_WHITELIST from types/parcelles.ts
 * Reused in DB CHECK constraint and UI
 */
export const certificationSchema = z.enum(CERTIFICATIONS_WHITELIST);

/**
 * Certifications array schema with whitelist validation
 */
export const certificationsArraySchema = z
  .array(certificationSchema)
  .default([])
  .refine(
    (certs) => new Set(certs).size === certs.length,
    { message: 'Certifications must not contain duplicates' }
  );

// ============================================================================
// GEOMETRY VALIDATION SCHEMAS
// ============================================================================

/**
 * GeoJSON Position (coordinate pair or triple)
 * [longitude, latitude] or [longitude, latitude, altitude]
 */
const positionSchema = z
  .array(z.number())
  .min(2, 'Position must have at least 2 coordinates (lng, lat)')
  .max(3, 'Position must have at most 3 coordinates (lng, lat, alt)')
  .refine(
    (pos) => pos[0] >= -180 && pos[0] <= 180,
    { message: 'Longitude must be between -180 and 180' }
  )
  .refine(
    (pos) => pos[1] >= -90 && pos[1] <= 90,
    { message: 'Latitude must be between -90 and 90' }
  );

/**
 * GeoJSON LinearRing (closed ring of positions)
 * Must have at least 4 positions and first/last must be identical
 */
const linearRingSchema = z
  .array(positionSchema)
  .min(4, 'Ring must have at least 4 positions (including closing point)')
  .refine(
    (ring) => {
      if (ring.length < 4) return false;
      const first = ring[0];
      const last = ring[ring.length - 1];
      return first[0] === last[0] && first[1] === last[1];
    },
    { message: 'Ring must be closed (first and last positions must be identical)' }
  );

/**
 * GeoJSON Polygon geometry
 * Array of linear rings: first is exterior, rest are holes
 */
export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(linearRingSchema)
    .min(1, 'Polygon must have at least one ring (exterior)'),
});

/**
 * GeoJSON MultiPolygon geometry
 * Array of polygon coordinate arrays
 */
export const multiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z
    .array(z.array(linearRingSchema).min(1))
    .min(1, 'MultiPolygon must have at least one polygon'),
});

/**
 * Combined geometry schema accepting both Polygon and MultiPolygon
 * Used for input validation - storage always uses MultiPolygon
 */
export const geometrySchema = z.union([polygonGeometrySchema, multiPolygonGeometrySchema]);

// ============================================================================
// RISK FLAGS SCHEMA
// ============================================================================

/**
 * Deforestation risk flag schema
 */
const deforestationRiskSchema = z.object({
  flag: z.boolean(),
  source: z.enum(['manual', 'api', 'import']),
  score: z.number().min(0).max(1).nullable(),
});

/**
 * Protected zone risk flag schema
 */
const zoneProtegeeRiskSchema = z.object({
  flag: z.boolean(),
  name: z.string().nullable(),
});

/**
 * Overlap risk flag schema
 */
const overlapRiskSchema = z.object({
  flag: z.boolean(),
  with_parcelle_id: z.string().uuid().nullable(),
  overlap_pct: z.number().min(0).max(100).nullable(),
});

/**
 * Risk flags schema (all optional)
 */
export const riskFlagsSchema = z
  .object({
    deforestation: deforestationRiskSchema.optional(),
    zone_protegee: zoneProtegeeRiskSchema.optional(),
    overlap: overlapRiskSchema.optional(),
  })
  .default({});

// ============================================================================
// CREATE PARCELLE SCHEMA
// ============================================================================

/**
 * Schema for creating a new parcelle
 * Used by POST /api/parcelles
 * 
 * Required fields:
 * - planteur_id: UUID of the planteur who owns this parcelle
 * - geometry: GeoJSON Polygon or MultiPolygon
 * 
 * Optional fields:
 * - code: Unique code per planteur (auto-generated if not provided)
 * - label: Description/name of the parcelle
 * - village: Village location
 * - certifications: Array of certification labels
 * - conformity_status: Status (defaults to 'informations_manquantes')
 * - risk_flags: Risk indicators
 */
export const createParcelleSchema = z.object({
  planteur_id: z.string().uuid('Invalid planteur ID'),
  
  code: z
    .string()
    .min(1, 'Code must not be empty')
    .max(50, 'Code must be at most 50 characters')
    .optional(),
  
  label: z
    .string()
    .max(200, 'Label must be at most 200 characters')
    .optional()
    .nullable(),
  
  village: z
    .string()
    .max(100, 'Village must be at most 100 characters')
    .optional()
    .nullable(),
  
  geometry: geometrySchema,
  
  certifications: certificationsArraySchema.optional(),
  
  conformity_status: conformityStatusSchema.optional().default('informations_manquantes'),
  
  risk_flags: riskFlagsSchema.optional(),
});

export type CreateParcelleInput = z.infer<typeof createParcelleSchema>;

// ============================================================================
// UPDATE PARCELLE SCHEMA
// ============================================================================

/**
 * Schema for updating an existing parcelle
 * Used by PATCH /api/parcelles/[id]
 * 
 * All fields are optional - only provided fields will be updated.
 * Note: planteur_id cannot be changed after creation (parcelle ownership is immutable)
 * Note: source and import_file_id are set by the system, not user-editable
 * 
 * Updatable fields:
 * - code: Unique code per planteur
 * - label: Description/name of the parcelle
 * - village: Village location
 * - geometry: GeoJSON Polygon or MultiPolygon (triggers recalculation of centroid/surface)
 * - certifications: Array of certification labels
 * - conformity_status: Status (triggers audit log entry)
 * - risk_flags: Risk indicators
 */
export const updateParcelleSchema = z.object({
  code: z
    .string()
    .min(1, 'Code must not be empty')
    .max(50, 'Code must be at most 50 characters')
    .optional(),
  
  label: z
    .string()
    .max(200, 'Label must be at most 200 characters')
    .optional()
    .nullable(),
  
  village: z
    .string()
    .max(100, 'Village must be at most 100 characters')
    .optional()
    .nullable(),
  
  geometry: geometrySchema.optional(),
  
  certifications: certificationsArraySchema.optional(),
  
  conformity_status: conformityStatusSchema.optional(),
  
  risk_flags: riskFlagsSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export type UpdateParcelleInput = z.infer<typeof updateParcelleSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate that a geometry has valid WGS84 coordinates
 * Returns validation result with any out-of-bounds coordinates
 */
export function validateGeometryCoordinates(
  geometry: z.infer<typeof geometrySchema>
): { valid: boolean; outOfBounds: Array<{ lng: number; lat: number }> } {
  const outOfBounds: Array<{ lng: number; lat: number }> = [];
  
  const checkPosition = (pos: number[]) => {
    const [lng, lat] = pos;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      outOfBounds.push({ lng, lat });
    }
  };
  
  const checkRing = (ring: number[][]) => {
    ring.forEach(checkPosition);
  };
  
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(checkRing);
  } else {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach(checkRing);
    });
  }
  
  return {
    valid: outOfBounds.length === 0,
    outOfBounds,
  };
}

/**
 * Check if coordinates appear to be projected (not WGS84)
 * Projected coordinates typically have values outside WGS84 bounds
 */
export function detectProjectedCoordinates(
  geometry: z.infer<typeof geometrySchema>
): { likely: boolean; sampleCoord?: [number, number] } {
  const checkPosition = (pos: number[]): [number, number] | null => {
    const [lng, lat] = pos;
    // WGS84 bounds: lng [-180, 180], lat [-90, 90]
    // If any coordinate is outside these bounds, it's likely projected
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      return [lng, lat];
    }
    return null;
  };
  
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const pos of ring) {
        const sample = checkPosition(pos);
        if (sample) {
          return { likely: true, sampleCoord: sample };
        }
      }
    }
  } else {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const pos of ring) {
          const sample = checkPosition(pos);
          if (sample) {
            return { likely: true, sampleCoord: sample };
          }
        }
      }
    }
  }
  
  return { likely: false };
}


// ============================================================================
// PARCELLE FILTERS SCHEMA
// ============================================================================

/**
 * Parsed bounding box result
 */
export interface ParsedBBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Parse and validate bbox string
 * Format: "minLng,minLat,maxLng,maxLat"
 * 
 * Validation rules:
 * - Must have exactly 4 comma-separated numbers
 * - minLng < maxLng
 * - minLat < maxLat
 * - Clamps values to WGS84 bounds: lng [-180, 180], lat [-90, 90]
 * 
 * @param bbox - Bbox string in format "minLng,minLat,maxLng,maxLat"
 * @returns Parsed and clamped bbox coordinates
 * @throws Error with VALIDATION_ERROR details if invalid
 */
export function parseBBox(bbox: string): ParsedBBox {
  const parts = bbox.split(',').map((s) => s.trim());
  
  if (parts.length !== 4) {
    throw {
      error_code: 'VALIDATION_ERROR',
      message: 'Invalid bbox format. Expected "minLng,minLat,maxLng,maxLat"',
      details: {
        field: 'bbox',
        message: `Expected 4 comma-separated numbers, got ${parts.length}`,
      },
    };
  }
  
  const [minLngStr, minLatStr, maxLngStr, maxLatStr] = parts;
  const minLng = parseFloat(minLngStr);
  const minLat = parseFloat(minLatStr);
  const maxLng = parseFloat(maxLngStr);
  const maxLat = parseFloat(maxLatStr);
  
  // Check for NaN values
  if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
    throw {
      error_code: 'VALIDATION_ERROR',
      message: 'Invalid bbox format. All values must be valid numbers',
      details: {
        field: 'bbox',
        message: 'One or more values are not valid numbers',
      },
    };
  }
  
  // Validate min < max
  if (minLng >= maxLng) {
    throw {
      error_code: 'VALIDATION_ERROR',
      message: 'Invalid bbox: minLng must be less than maxLng',
      details: {
        field: 'bbox',
        message: `minLng (${minLng}) must be less than maxLng (${maxLng})`,
      },
    };
  }
  
  if (minLat >= maxLat) {
    throw {
      error_code: 'VALIDATION_ERROR',
      message: 'Invalid bbox: minLat must be less than maxLat',
      details: {
        field: 'bbox',
        message: `minLat (${minLat}) must be less than maxLat (${maxLat})`,
      },
    };
  }
  
  // Clamp to WGS84 bounds
  return {
    minLng: Math.max(-180, Math.min(180, minLng)),
    minLat: Math.max(-90, Math.min(90, minLat)),
    maxLng: Math.max(-180, Math.min(180, maxLng)),
    maxLat: Math.max(-90, Math.min(90, maxLat)),
  };
}

/**
 * Bbox string schema with validation
 * Parses "minLng,minLat,maxLng,maxLat" format and validates:
 * - 4 comma-separated numbers
 * - min < max for both lng and lat
 * - Clamps to WGS84 bounds [-180..180], [-90..90]
 */
export const bboxSchema = z
  .string()
  .transform((val, ctx) => {
    try {
      return parseBBox(val);
    } catch (error: unknown) {
      const err = error as { details?: { message?: string } };
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err?.details?.message || 'Invalid bbox format',
      });
      return z.NEVER;
    }
  });

/**
 * Schema for filtering parcelles
 * Used by GET /api/parcelles
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
 * - zoom: Map zoom level (used to determine if geometry should be simplified)
 * - simplify: Force geometry simplification (auto-set based on zoom/bbox)
 * 
 * Note: cooperative_id is NOT a filter - RLS enforces cooperative isolation
 */
export const parcelleFiltersSchema = z.object({
  planteur_id: z.string().uuid('Invalid planteur ID').optional(),
  
  conformity_status: conformityStatusSchema.optional(),
  
  certification: certificationSchema.optional(),
  
  village: z.string().max(100, 'Village must be at most 100 characters').optional(),
  
  source: parcelleSourceSchema.optional(),
  
  import_file_id: z.string().uuid('Invalid import file ID').optional(),
  
  search: z.string().max(200, 'Search query must be at most 200 characters').optional(),
  
  bbox: bboxSchema.optional(),
  
  is_active: z.boolean().optional().default(true),
  
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .optional()
    .default(1),
  
  pageSize: z
    .number()
    .int('Page size must be an integer')
    .min(1, 'Page size must be at least 1')
    .max(PARCELLE_LIMITS.MAX_PAGE_SIZE, `Page size must be at most ${PARCELLE_LIMITS.MAX_PAGE_SIZE}`)
    .optional()
    .default(PARCELLE_LIMITS.DEFAULT_PAGE_SIZE),
  
  zoom: z
    .number()
    .int('Zoom must be an integer')
    .min(0, 'Zoom must be at least 0')
    .max(22, 'Zoom must be at most 22')
    .optional(),
  
  simplify: z.boolean().optional(),
});

export type ParcelleFiltersInput = z.input<typeof parcelleFiltersSchema>;
export type ParcelleFiltersOutput = z.output<typeof parcelleFiltersSchema>;

// ============================================================================
// GEOMETRY SIMPLIFICATION HELPERS
// ============================================================================

/**
 * Threshold for bbox area in km² above which geometry should be simplified
 * Per Requirement 5.8: bbox area > 10000 km² triggers simplification
 */
export const SIMPLIFY_BBOX_AREA_THRESHOLD_KM2 = 10000;

/**
 * Zoom level threshold below which geometry should be simplified
 * Per Requirement 5.8: zoom levels <= 10 triggers simplification
 */
export const SIMPLIFY_ZOOM_THRESHOLD = 10;

/**
 * Calculate the approximate area of a bounding box in square kilometers
 * Uses the Haversine formula approximation for small areas
 * 
 * @param bbox - Parsed bounding box with minLng, minLat, maxLng, maxLat
 * @returns Area in square kilometers
 */
export function calculateBBoxAreaKm2(bbox: ParsedBBox): number {
  const { minLng, minLat, maxLng, maxLat } = bbox;
  
  // Earth's radius in km
  const R = 6371;
  
  // Convert to radians
  const lat1 = minLat * Math.PI / 180;
  const lat2 = maxLat * Math.PI / 180;
  const dLng = (maxLng - minLng) * Math.PI / 180;
  
  // Width at average latitude (in km)
  const avgLat = (lat1 + lat2) / 2;
  const width = R * dLng * Math.cos(avgLat);
  
  // Height (in km)
  const height = R * (lat2 - lat1);
  
  return Math.abs(width * height);
}

/**
 * Determine if geometry should be simplified based on zoom level and bbox area
 * Per Requirement 5.8: FOR zoom levels <= 10 OR bbox area > 10000 km²,
 * THE API SHALL return simplified geometry
 * 
 * @param zoom - Optional map zoom level
 * @param bbox - Optional parsed bounding box
 * @param forceSimplify - Optional flag to force simplification
 * @returns true if geometry should be simplified
 */
export function shouldSimplifyGeometry(
  zoom?: number,
  bbox?: ParsedBBox,
  forceSimplify?: boolean
): boolean {
  // If explicitly set, use that value
  if (forceSimplify !== undefined) {
    return forceSimplify;
  }
  
  // Check zoom level threshold
  if (zoom !== undefined && zoom <= SIMPLIFY_ZOOM_THRESHOLD) {
    return true;
  }
  
  // Check bbox area threshold
  if (bbox) {
    const areaKm2 = calculateBBoxAreaKm2(bbox);
    if (areaKm2 > SIMPLIFY_BBOX_AREA_THRESHOLD_KM2) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// FIELD MAPPING SCHEMA
// ============================================================================

/**
 * Schema for field mapping during import
 * Maps DBF/attribute fields from imported files to CocoaTrack parcelle fields
 * 
 * Used during the Preview step of the import workflow to configure
 * how source file attributes map to parcelle fields.
 * 
 * All fields are optional - unmapped fields will use default values or be null.
 * Field names must be non-empty strings if provided.
 */
export const fieldMappingSchema = z.object({
  /** DBF/attribute field to use for parcelle label */
  label_field: z
    .string()
    .min(1, 'Label field name must not be empty')
    .max(100, 'Label field name must be at most 100 characters')
    .optional(),
  
  /** DBF/attribute field to use for parcelle code */
  code_field: z
    .string()
    .min(1, 'Code field name must not be empty')
    .max(100, 'Code field name must be at most 100 characters')
    .optional(),
  
  /** DBF/attribute field to use for parcelle village */
  village_field: z
    .string()
    .min(1, 'Village field name must not be empty')
    .max(100, 'Village field name must be at most 100 characters')
    .optional(),
  
  /** DBF/attribute field to use for conformity status (auto-detection if not set) */
  conformity_status_field: z
    .string()
    .min(1, 'Conformity status field name must not be empty')
    .max(100, 'Conformity status field name must be at most 100 characters')
    .optional(),
});

export type FieldMappingInput = z.infer<typeof fieldMappingSchema>;

// ============================================================================
// IMPORT DEFAULTS SCHEMA
// ============================================================================

/**
 * Schema for default values applied to imported parcelles
 * Used during the Apply step of the import workflow
 * 
 * All fields are optional - if not provided, system defaults are used:
 * - conformity_status defaults to 'informations_manquantes'
 * - certifications defaults to empty array []
 * - auto_detect_conformity defaults to false
 */
export const importDefaultsSchema = z.object({
  /** Default conformity status for imported parcelles */
  conformity_status: conformityStatusSchema.optional(),
  
  /** Default certifications for imported parcelles */
  certifications: certificationsArraySchema.optional(),
  
  /** Enable automatic conformity status detection based on DBF attributes */
  auto_detect_conformity: z.boolean().optional(),
});

export type ImportDefaultsInput = z.infer<typeof importDefaultsSchema>;

// ============================================================================
// APPLY IMPORT SCHEMA
// ============================================================================

/**
 * Schema for applying an import (creating parcelles from parsed features)
 * Used by POST /api/parcelles/import/[id]/apply
 * 
 * Workflow context: Upload → Parse → Preview → **Apply (uses ApplyImportInput)**
 * 
 * Required fields:
 * - planteur_id: UUID of the planteur who will own all imported parcelles
 * - mapping: Field mapping from DBF/attributes to CocoaTrack fields
 * - defaults: Default values for imported parcelles
 * 
 * Validation rules:
 * - planteur_id must be a valid UUID
 * - mapping must be a valid FieldMapping object
 * - defaults must be a valid ImportDefaults object
 * - Import file must have status='parsed' (not 'uploaded', 'failed', or 'applied')
 * - Import file must not have been applied already (status != 'applied')
 */
export const applyImportSchema = z.object({
  /** 
   * Foreign key to planteurs table (required)
   * All parcelles created from this import will belong to this planteur
   */
  planteur_id: z.string().uuid('Invalid planteur ID'),
  
  /**
   * Field mapping from DBF/attributes to CocoaTrack fields
   * Maps source file attributes to parcelle fields (label, code, village)
   */
  mapping: fieldMappingSchema,
  
  /**
   * Default values for imported parcelles
   * Applied to all parcelles created from this import
   */
  defaults: importDefaultsSchema,
});

export type ApplyImportInput = z.infer<typeof applyImportSchema>;

// ============================================================================
// IMPORT MODE SCHEMA (V2)
// ============================================================================

import { IMPORT_MODE_VALUES } from '@/types/parcelles';

/**
 * Import mode enum schema
 * Uses centralized IMPORT_MODE_VALUES from types/parcelles.ts
 * Values: auto_create, orphan, assign
 * 
 * @see Requirements 3.1
 */
export const importModeSchema = z.enum(IMPORT_MODE_VALUES);

/**
 * Schema for applying an import with flexible modes (V2)
 * Used by POST /api/parcelles/import/[id]/apply
 * 
 * Supports three import modes:
 * - auto_create: Create planteurs automatically from DBF attributes
 * - orphan: Create parcelles without planteur assignment
 * - assign: Assign all parcelles to a single existing planteur
 * 
 * @see Requirements 3.1, 3.2, 3.3
 */
export const applyImportV2Schema = z.object({
  /**
   * Import mode: auto_create, orphan, or assign
   */
  mode: importModeSchema,
  
  /**
   * For mode 'assign' - planteur ID to assign all parcelles to
   * Required when mode is 'assign'
   */
  planteur_id: z.string().uuid('Invalid planteur ID').optional(),
  
  /**
   * For mode 'auto_create' - DBF field containing planteur name
   * Required when mode is 'auto_create'
   */
  planteur_name_field: z
    .string()
    .min(1, 'Planteur name field must not be empty')
    .max(100, 'Planteur name field must be at most 100 characters')
    .optional(),
  
  /**
   * For mode 'auto_create' - default chef planteur for auto-created planteurs
   * Required when mode is 'auto_create'
   */
  default_chef_planteur_id: z.string().uuid('Invalid chef planteur ID').optional(),
  
  /**
   * Field mapping from DBF/attributes to CocoaTrack fields
   * Maps source file attributes to parcelle fields (label, code, village)
   */
  mapping: fieldMappingSchema,
  
  /**
   * Default values for imported parcelles
   * Applied to all parcelles created from this import
   */
  defaults: importDefaultsSchema,
}).superRefine((data, ctx) => {
  // Validate mode-specific required fields
  if (data.mode === 'assign' && !data.planteur_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'planteur_id is required when mode is "assign"',
      path: ['planteur_id'],
    });
  }
  
  if (data.mode === 'auto_create') {
    if (!data.planteur_name_field) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'planteur_name_field is required when mode is "auto_create"',
        path: ['planteur_name_field'],
      });
    }
    // Note: default_chef_planteur_id is optional - planteurs can be created without a supplier
  }
});

export type ApplyImportV2Input = z.infer<typeof applyImportV2Schema>;

// ============================================================================
// ASSIGN PARCELLES SCHEMA
// ============================================================================

/**
 * Schema for assigning orphan parcelles to a planteur
 * Used by POST /api/parcelles/assign
 * 
 * @see Requirements 5.4
 */
export const assignParcellesSchema = z.object({
  /**
   * IDs of parcelles to assign (must be orphan parcelles)
   */
  parcelle_ids: z
    .array(z.string().uuid('Invalid parcelle ID'))
    .min(1, 'At least one parcelle must be selected'),
  
  /**
   * Planteur ID to assign parcelles to
   */
  planteur_id: z.string().uuid('Invalid planteur ID'),
});

export type AssignParcellesInput = z.infer<typeof assignParcellesSchema>;

/**
 * Schema for assigning orphan parcelles to a new planteur
 * Used by POST /api/parcelles/assign-new-planteur
 * 
 * @see Requirements 5.3
 */
export const assignNewPlanteurSchema = z.object({
  /**
   * IDs of parcelles to assign (must be orphan parcelles)
   */
  parcelle_ids: z
    .array(z.string().uuid('Invalid parcelle ID'))
    .min(1, 'At least one parcelle must be selected'),
  
  /**
   * New planteur data
   */
  planteur: z.object({
    /**
     * Planteur name (required)
     */
    name: z
      .string()
      .min(1, 'Name must not be empty')
      .max(200, 'Name must be at most 200 characters'),
    
    /**
     * Planteur code (optional, auto-generated if not provided)
     */
    code: z
      .string()
      .min(1, 'Code must not be empty')
      .max(50, 'Code must be at most 50 characters')
      .optional(),
    
    /**
     * Chef planteur ID (required)
     */
    chef_planteur_id: z.string().uuid('Invalid chef planteur ID'),
  }),
});

export type AssignNewPlanteurInput = z.infer<typeof assignNewPlanteurSchema>;
