// CocoaTrack V2 - Parcelles Module Types
// Types for agricultural plot management with PostGIS geometry support

import type { MultiPolygon, Polygon } from 'geojson';

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Conformity status values for parcelles
 * 
 * CENTRALIZED ENUM - Used in:
 * - Database CHECK constraint (conformity_status IN (...))
 * - Zod validation schema (conformityStatusSchema)
 * - UI components (status badges, selectors)
 * 
 * IMPORTANT: If you modify this list, you MUST also update:
 * - v2/supabase/migrations/20250107000001_parcelles_module.sql (conformity_status CHECK)
 * - Create a new migration to ALTER the CHECK constraint
 * 
 * @see v2/lib/validations/parcelle.ts - conformityStatusSchema
 */
export const CONFORMITY_STATUS_VALUES = [
  'conforme',
  'non_conforme',
  'en_cours',
  'informations_manquantes',
] as const;

/**
 * Conformity status for parcelles
 * - conforme: Meets all environmental and quality standards
 * - non_conforme: Does not meet required standards
 * - en_cours: Under review/evaluation
 * - informations_manquantes: Missing required information
 */
export type ConformityStatus = (typeof CONFORMITY_STATUS_VALUES)[number];

/**
 * Human-readable labels for conformity status (for UI display)
 */
export const CONFORMITY_STATUS_LABELS: Record<ConformityStatus, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  en_cours: 'En cours',
  informations_manquantes: 'Informations manquantes',
};

/**
 * Colors for conformity status (for UI badges/indicators)
 * Uses CocoaTrack brand colors
 */
export const CONFORMITY_STATUS_COLORS: Record<ConformityStatus, string> = {
  conforme: '#6FAF3D',           // CocoaTrack green
  en_cours: '#E68A1F',           // CocoaTrack orange
  non_conforme: '#ef4444',       // red
  informations_manquantes: '#9ca3af', // gray
};

/**
 * Source of parcelle data values
 * 
 * CENTRALIZED ENUM - Used in:
 * - Database CHECK constraint (source IN (...))
 * - Zod validation schema (parcelleSourceSchema)
 * - UI components (source badges)
 * 
 * Note: KMZ files are stored as 'kml' source (KMZ → kml extraction)
 */
export const PARCELLE_SOURCE_VALUES = ['manual', 'shapefile', 'kml', 'geojson'] as const;

/**
 * Source of parcelle data
 * - manual: Created manually via UI
 * - shapefile: Imported from Shapefile ZIP
 * - kml: Imported from KML/KMZ file
 * - geojson: Imported from GeoJSON file
 */
export type ParcelleSource = (typeof PARCELLE_SOURCE_VALUES)[number];

/**
 * Human-readable labels for parcelle source (for UI display)
 */
export const PARCELLE_SOURCE_LABELS: Record<ParcelleSource, string> = {
  manual: 'Manuel',
  shapefile: 'Shapefile',
  kml: 'KML/KMZ',
  geojson: 'GeoJSON',
};

/**
 * Allowed certifications for parcelles
 * 
 * CENTRALIZED WHITELIST - Used in:
 * - Database CHECK constraint (parcelles_certifications_valid)
 * - Zod validation schema (certificationSchema)
 * - UI components (certification selectors, badges)
 * 
 * IMPORTANT: If you modify this list, you MUST also update:
 * - v2/supabase/migrations/20250107000001_parcelles_module.sql (parcelles_certifications_valid CHECK)
 * - Create a new migration to ALTER the CHECK constraint
 * 
 * @see v2/lib/validations/parcelle.ts - certificationSchema
 * @see v2/supabase/migrations/20250107000001_parcelles_module.sql - parcelles_certifications_valid
 */
export const CERTIFICATIONS_WHITELIST = [
  'rainforest_alliance',
  'utz',
  'fairtrade',
  'bio',
  'organic',
  'other',
] as const;

export type Certification = (typeof CERTIFICATIONS_WHITELIST)[number];

/**
 * Human-readable labels for certifications (for UI display)
 * Maps certification codes to display labels
 */
export const CERTIFICATION_LABELS: Record<Certification, string> = {
  rainforest_alliance: 'Rainforest Alliance',
  utz: 'UTZ',
  fairtrade: 'Fairtrade',
  bio: 'Bio',
  organic: 'Organic',
  other: 'Autre',
};

/**
 * Helper to generate SQL array literal from CERTIFICATIONS_WHITELIST
 * Useful for documentation and testing consistency
 * 
 * @returns SQL array literal string, e.g., "ARRAY['rainforest_alliance', 'utz', ...]::TEXT[]"
 */
export function getCertificationsWhitelistSQL(): string {
  const values = CERTIFICATIONS_WHITELIST.map((c) => `'${c}'`).join(', ');
  return `ARRAY[${values}]::TEXT[]`;
}

// =============================================================================
// Risk Flags
// =============================================================================

/**
 * Deforestation risk indicator
 */
export interface DeforestationRisk {
  flag: boolean;
  source: 'manual' | 'api' | 'import';
  score: number | null; // 0-1 scale
}

/**
 * Protected zone risk indicator
 */
export interface ZoneProtegeeRisk {
  flag: boolean;
  name: string | null;
}

/**
 * Overlap risk indicator (parcelle overlaps with another)
 */
export interface OverlapRisk {
  flag: boolean;
  with_parcelle_id: string | null;
  overlap_pct: number | null; // 0-100 percentage
}

/**
 * Risk flags for a parcelle
 * Stored as JSONB in database
 */
export interface RiskFlags {
  deforestation?: DeforestationRisk;
  zone_protegee?: ZoneProtegeeRisk;
  overlap?: OverlapRisk;
}

// =============================================================================
// Centroid
// =============================================================================

/**
 * Centroid coordinates (point inside the polygon)
 * Calculated via ST_PointOnSurface in PostGIS
 */
export interface Centroid {
  lat: number;
  lng: number;
}

// =============================================================================
// Parcelle Interface
// =============================================================================

/**
 * Planteur relation (minimal info for display)
 */
export interface PlanteurRelation {
  id: string;
  name: string;
  code: string;
  cooperative_id: string;
}

/**
 * Main Parcelle interface
 * Represents an agricultural plot belonging to a planteur
 * 
 * Note: cooperative_id is NOT stored directly on parcelle.
 * It is inherited via planteur.cooperative_id OR via import_file.cooperative_id for orphan parcelles
 * 
 * Orphan parcelles: planteur_id = null, import_file_id required (for RLS)
 */
export interface Parcelle {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Foreign key to planteurs table (nullable for orphan parcelles) */
  planteur_id: string | null;
  
  /** Unique code per planteur (nullable for orphan parcelles) */
  code: string | null;
  
  /** Optional label/description */
  label: string | null;
  
  /** Village location */
  village: string | null;
  
  /** Polygon geometry as GeoJSON MultiPolygon (always MultiPolygon in storage) */
  geometry: MultiPolygon;
  
  /** Centroid point (calculated by PostGIS ST_PointOnSurface) */
  centroid: Centroid;
  
  /** Surface area in hectares (calculated by PostGIS ST_Area) */
  surface_hectares: number;
  
  /** Quality/sustainability certifications */
  certifications: Certification[];
  
  /** Conformity status */
  conformity_status: ConformityStatus;
  
  /** Risk indicators (deforestation, protected zone, overlap) */
  risk_flags: RiskFlags;
  
  /** Data source (manual, shapefile, kml, geojson) */
  source: ParcelleSource;
  
  /** Reference to import file (if imported) */
  import_file_id: string | null;
  
  /** SHA256 hash of normalized geometry for deduplication */
  feature_hash: string | null;
  
  /** Soft-delete flag (false = archived) */
  is_active: boolean;
  
  /** User who created the parcelle */
  created_by: string;
  
  /** Name of the user who created the parcelle (from profiles.full_name) */
  created_by_name: string | null;
  
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
  
  // ==========================================================================
  // Relations (optional, populated when fetching with relations)
  // ==========================================================================
  
  /** Planteur relation (populated on fetch with relations) */
  planteur?: PlanteurRelation;
}

/**
 * Parcelle with required planteur relation
 * Used when planteur data is always needed
 */
export interface ParcelleWithPlanteur extends Parcelle {
  planteur: PlanteurRelation;
}

// =============================================================================
// Import File Types
// =============================================================================

/**
 * File types supported for parcelle import
 * - shapefile_zip: ZIP archive containing .shp, .shx, .dbf (and optionally .prj)
 * - kml: Keyhole Markup Language file
 * - kmz: Compressed KML file
 * - geojson: GeoJSON file
 */
export type ImportFileType = 'shapefile_zip' | 'kml' | 'kmz' | 'geojson';

/**
 * Import workflow status
 * - uploaded: File uploaded, awaiting parsing
 * - parsed: File parsed successfully, awaiting apply
 * - failed: Parsing or apply failed
 * - applied: Parcelles created from import
 */
export type ImportStatus = 'uploaded' | 'parsed' | 'failed' | 'applied';

/**
 * Parse error from import file processing
 */
export interface ParseError {
  /** Error code (e.g., INVALID_GEOMETRY, UNSUPPORTED_GEOMETRY_TYPE) */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Feature index in the file (if applicable) */
  feature_index?: number;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Parse warning from import file processing
 */
export interface ParseWarning {
  /** Warning code (e.g., MISSING_PRJ_ASSUMED_WGS84, LIKELY_PROJECTED_COORDINATES) */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Feature index in the file (if applicable) */
  feature_index?: number;
  /** Whether user confirmation is required to proceed */
  requires_confirmation?: boolean;
  /** Additional warning details */
  details?: Record<string, unknown>;
}

/**
 * Parse report containing results of file parsing
 * Stored as JSONB in parcel_import_files.parse_report
 */
export interface ParseReport {
  /** Number of features found in the file */
  nb_features: number;
  /** Errors encountered during parsing */
  errors: ParseError[];
  /** Warnings encountered during parsing */
  warnings: ParseWarning[];
  /** Field mapping configuration (if set during preview) */
  field_mapping?: FieldMapping;
}

/**
 * Field mapping for import
 * Maps DBF/attribute fields to CocoaTrack parcelle fields
 */
export interface FieldMapping {
  /** DBF field to use for parcelle label */
  label_field?: string;
  /** DBF field to use for parcelle code */
  code_field?: string;
  /** DBF field to use for parcelle village */
  village_field?: string;
  /** DBF field to use for conformity status (auto-detection if not set) */
  conformity_status_field?: string;
}

// =============================================================================
// Parsed Feature (Import Preview)
// =============================================================================

/**
 * Validation result for a parsed feature
 */
export interface FeatureValidation {
  /** Whether the feature passed all validation checks */
  ok: boolean;
  /** List of validation errors (blocking) */
  errors: string[];
  /** List of validation warnings (non-blocking) */
  warnings: string[];
}

/**
 * Parsed feature from import file
 * Represents a single feature extracted during the Parse step of the import workflow
 * Used in the Preview step to show users what will be imported
 * 
 * Workflow context: Upload → Parse → **Preview (uses ParsedFeature)** → Apply
 */
export interface ParsedFeature {
  /** Temporary ID for tracking during import (not persisted) */
  temp_id: string;
  
  /** Extracted label from DBF/attributes (may be null if not mapped) */
  label: string | null;
  
  /** Raw attributes from DBF file or GeoJSON properties */
  dbf_attributes: Record<string, unknown>;
  
  /** Geometry as GeoJSON MultiPolygon (normalized from Polygon if needed) */
  geom_geojson: MultiPolygon;
  
  /** Original geometry was valid before any fixes */
  geom_original_valid?: boolean;
  
  /** Fixed geometry if original was invalid (after ST_MakeValid equivalent) */
  geom_fixed?: MultiPolygon;
  
  /** Calculated area in hectares (client-side approximation) */
  area_ha: number;
  
  /** Calculated centroid point */
  centroid: Centroid;
  
  /** Validation result (errors and warnings) */
  validation: FeatureValidation;
  
  /** SHA256 hash of normalized geometry for deduplication */
  feature_hash: string;
  
  /** Whether this feature is a duplicate of an existing parcelle */
  is_duplicate: boolean;
  
  /** ID of existing parcelle if this is a duplicate */
  existing_parcelle_id?: string;
}

// =============================================================================
// Filters
// =============================================================================

/**
 * Filters for querying parcelles
 * Used by the list API endpoint and UI filter components
 * 
 * Note: cooperative_id is NOT a filter - RLS enforces cooperative isolation
 * via planteur.cooperative_id = user.cooperative_id
 */
export interface ParcelleFilters {
  /** Filter by planteur ID */
  planteur_id?: string;
  
  /** Filter by conformity status */
  conformity_status?: ConformityStatus;
  
  /** Filter by certification (parcelle must have this certification) */
  certification?: Certification;
  
  /** Filter by village name (exact match) */
  village?: string;
  
  /** Filter by data source (manual, shapefile, kml, geojson) */
  source?: ParcelleSource;
  
  /** Filter by import file ID (show parcelles from specific import) */
  import_file_id?: string;
  
  /** Search by parcelle code or planteur name/code */
  search?: string;
  
  /** 
   * Bounding box for geographic filtering
   * Format: "minLng,minLat,maxLng,maxLat"
   * Uses ST_Intersects(geometry, ST_MakeEnvelope(...)) in PostGIS
   */
  bbox?: string;
  
  /** Filter by active status (default: true = only active parcelles) */
  is_active?: boolean;
  
  /** Page number for pagination (1-indexed) */
  page?: number;
  
  /** Number of items per page (default: 20, max: 100) */
  pageSize?: number;
  
  /**
   * Map zoom level for geometry simplification
   * When zoom <= 10, geometry is simplified for better map performance
   * @see Requirement 5.8
   */
  zoom?: number;
  
  /**
   * Force geometry simplification regardless of zoom/bbox
   * When true, uses ST_SimplifyPreserveTopology(geometry, 0.001)
   * Automatically set to true when zoom <= 10 or bbox area > 10000 km²
   */
  simplify?: boolean;
}

/**
 * Parsed bounding box coordinates
 * Result of parsing the bbox string filter
 */
export interface ParsedBBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// =============================================================================
// Import File Types
// =============================================================================

/**
 * Parcel import file record
 * Tracks uploaded files and their processing status through the import workflow
 * 
 * Workflow: Upload → Parse → Preview → Apply
 */
export interface ParcelImportFile {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Foreign key to planteurs table (optional, set if import from planteur form) */
  planteur_id: string | null;
  
  /** Foreign key to cooperatives table (required for RLS isolation) */
  cooperative_id: string;
  
  /** Original filename */
  filename: string;
  
  /** Storage URL (Supabase storage path) */
  storage_url: string;
  
  /** File type (shapefile_zip, kml, kmz, geojson) */
  file_type: ImportFileType;
  
  /** SHA256 hash of file content (for preventing re-import of same file) */
  file_sha256: string;
  
  /** Current import status */
  import_status: ImportStatus;
  
  /** Parse report with features, errors, warnings */
  parse_report: ParseReport;
  
  /** Top-level failure reason (for easy filtering/display) */
  failed_reason: string | null;
  
  /** Number of features found in file */
  nb_features: number;
  
  /** Number of parcelles successfully created */
  nb_applied: number;
  
  /** Number of features skipped due to duplicates */
  nb_skipped_duplicates: number;
  
  /** User who applied the import (created parcelles) */
  applied_by: string | null;
  
  /** Timestamp when import was applied */
  applied_at: string | null;
  
  /** User who uploaded the file */
  created_by: string;
  
  /** Upload timestamp (ISO 8601) */
  created_at: string;
}

// =============================================================================
// API Input Types
// =============================================================================

/**
 * Input for creating a new parcelle
 * Used by POST /api/parcelles
 */
export interface CreateParcelleInput {
  /** Foreign key to planteurs table (required) */
  planteur_id: string;
  
  /** Unique code per planteur (auto-generated if not provided) */
  code?: string;
  
  /** Optional label/description */
  label?: string;
  
  /** Village location */
  village?: string;
  
  /** Polygon geometry as GeoJSON (Polygon or MultiPolygon) */
  geometry: Polygon | MultiPolygon;
  
  /** Quality/sustainability certifications */
  certifications?: Certification[];
  
  /** Conformity status (defaults to 'informations_manquantes') */
  conformity_status?: ConformityStatus;
  
  /** Risk indicators */
  risk_flags?: RiskFlags;
}

/**
 * Input for updating an existing parcelle
 * Used by PATCH /api/parcelles/[id]
 * All fields are optional - only provided fields are updated
 */
export interface UpdateParcelleInput {
  /** Unique code per planteur */
  code?: string;
  
  /** Optional label/description */
  label?: string | null;
  
  /** Village location */
  village?: string | null;
  
  /** Polygon geometry as GeoJSON (Polygon or MultiPolygon) */
  geometry?: Polygon | MultiPolygon;
  
  /** Quality/sustainability certifications */
  certifications?: Certification[];
  
  /** Conformity status */
  conformity_status?: ConformityStatus;
  
  /** Risk indicators */
  risk_flags?: RiskFlags;
}

/**
 * Default values for imported parcelles
 * Used during the Apply step of import workflow
 */
export interface ImportDefaults {
  /** Default conformity status for imported parcelles */
  conformity_status?: ConformityStatus;
  
  /** Default certifications for imported parcelles */
  certifications?: Certification[];
  
  /** 
   * Enable automatic conformity status detection based on DBF attributes
   * When true, the system analyzes each feature's attributes to determine status:
   * - 'conforme': All required fields are present and valid
   * - 'informations_manquantes': Some required fields are missing
   * - 'en_cours': Partial data available
   */
  auto_detect_conformity?: boolean;
}

/**
 * Input for applying an import (creating parcelles from parsed features)
 * Used by POST /api/parcelles/import/[id]/apply
 */
export interface ApplyImportInput {
  /** Foreign key to planteurs table (required - all parcelles will belong to this planteur) */
  planteur_id: string;
  
  /** Field mapping from DBF/attributes to CocoaTrack fields */
  mapping: FieldMapping;
  
  /** Default values for imported parcelles */
  defaults: ImportDefaults;
}

// =============================================================================
// Import Mode Types (Parcelles Import Evolution)
// =============================================================================

/**
 * Import mode for parcelles
 * - auto_create: Create planteurs automatically from DBF attributes
 * - orphan: Create parcelles without planteur assignment (orphan parcelles)
 * - assign: Assign all parcelles to a single existing planteur
 * 
 * @see Requirements 3.1
 */
export const IMPORT_MODE_VALUES = ['auto_create', 'orphan', 'assign'] as const;

export type ImportMode = (typeof IMPORT_MODE_VALUES)[number];

/**
 * Human-readable labels for import modes (for UI display)
 */
export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  auto_create: 'Créer planteurs automatiquement',
  orphan: 'Importer sans planteur (orphelines)',
  assign: 'Assigner à un planteur existant',
};

/**
 * Descriptions for import modes (for UI tooltips/help)
 */
export const IMPORT_MODE_DESCRIPTIONS: Record<ImportMode, string> = {
  auto_create: 'Crée automatiquement les planteurs à partir des attributs du fichier. Les planteurs existants avec le même nom seront réutilisés.',
  orphan: 'Importe les parcelles sans les assigner à un planteur. Vous pourrez les assigner ultérieurement.',
  assign: 'Assigne toutes les parcelles importées à un seul planteur existant.',
};

/**
 * Input for applying an import with flexible modes (V2)
 * Used by POST /api/parcelles/import/[id]/apply
 * 
 * @see Requirements 3.1, 3.2, 3.3
 */
export interface ApplyImportInputV2 {
  /** Import mode: auto_create, orphan, or assign */
  mode: ImportMode;
  
  /** For mode 'assign' - planteur ID to assign all parcelles to */
  planteur_id?: string;
  
  /** For mode 'auto_create' - DBF field containing planteur name */
  planteur_name_field?: string;
  
  /** For mode 'auto_create' - default chef planteur for auto-created planteurs */
  default_chef_planteur_id?: string;
  
  /** Field mapping from DBF/attributes to CocoaTrack fields */
  mapping: FieldMapping;
  
  /** Default values for imported parcelles */
  defaults: ImportDefaults;
}

/**
 * Preview of auto-create mode results
 * Shows which planteurs will be created vs reused
 * 
 * @see Requirements 3.5
 */
export interface AutoCreatePreview {
  /** Planteurs that will be created (new) */
  new_planteurs: Array<{
    /** Name from DBF field */
    name: string;
    /** Normalized name (lower, trim, unaccent) for debug/verification */
    name_norm: string;
    /** Number of parcelles that will be assigned to this planteur */
    parcelle_count: number;
  }>;
  
  /** Existing planteurs that will be reused (matched by name_norm) */
  existing_planteurs: Array<{
    /** Existing planteur ID */
    id: string;
    /** Existing planteur name */
    name: string;
    /** Number of parcelles that will be assigned to this planteur */
    parcelle_count: number;
  }>;
  
  /** Number of parcelles without planteur name (will be orphan) */
  orphan_count: number;
}

// =============================================================================
// Grouped View Types (Vue par Planteur)
// =============================================================================

/**
 * Planteur with their parcelles for grouped view
 * Used in "Vue par Planteur" display mode
 * 
 * @see Requirements 4.2, 4.3
 */
export interface PlanteurWithParcelles {
  /** Planteur info (null for orphan parcelles group) */
  planteur: {
    id: string;
    name: string;
    code: string;
  } | null;
  
  /** Number of parcelles belonging to this planteur */
  parcelles_count: number;
  
  /** Total surface in hectares */
  total_surface_ha: number;
  
  /** List of parcelles (populated when expanded) */
  parcelles?: Parcelle[];
}

/**
 * Statistics for parcelles (total, assigned, orphan)
 * Used by ParcelleStatsCards component
 * 
 * @see Requirements 6.1, 6.2
 */
export interface ParcelleStats {
  /** Total number of parcelles */
  total_parcelles: number;
  
  /** Number of assigned parcelles (planteur_id IS NOT NULL) */
  assigned_parcelles: number;
  
  /** Number of orphan parcelles (planteur_id IS NULL) */
  orphan_parcelles: number;
  
  /** Total surface in hectares */
  total_surface_ha: number;
  
  /** Surface of assigned parcelles in hectares */
  assigned_surface_ha: number;
  
  /** Surface of orphan parcelles in hectares */
  orphan_surface_ha: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a parcelle is orphan (no planteur assigned)
 * Orphan status is computed from planteur_id, not stored as a column
 * 
 * @param parcelle - The parcelle to check
 * @returns true if the parcelle has no planteur assigned
 * 
 * @see Property 2: Orphan status is computed, not stored
 * @see Requirements 1.1, 1.2
 */
export function isOrphanParcelle(parcelle: Parcelle): boolean {
  return parcelle.planteur_id === null;
}

// =============================================================================
// API Output Types
// =============================================================================

/**
 * Result of applying an import
 * Returned by POST /api/parcelles/import/[id]/apply
 */
export interface ApplyImportResult {
  /** Number of parcelles successfully created */
  nb_applied: number;
  
  /** Number of features skipped due to duplicates */
  nb_skipped: number;
  
  /** IDs of created parcelles */
  created_ids: string[];
}

/**
 * Result of parsing an import file
 * Returned by POST /api/parcelles/import/[id]/parse
 */
export interface ParseResult {
  /** Parsed features ready for preview */
  features: ParsedFeature[];
  
  /** Parse report with errors and warnings */
  report: ParseReport;
  
  /** Available DBF/attribute fields for mapping */
  available_fields: string[];
}

/**
 * Export format options
 */
export type ExportFormat = 'xlsx' | 'csv';

/**
 * Export request parameters
 */
export interface ExportParams extends ParcelleFilters {
  /** Export format (xlsx or csv) */
  format: ExportFormat;
}

// =============================================================================
// API Error Types
// =============================================================================

/**
 * Error codes for parcelles module
 * Used in API error responses
 */
export const PARCELLE_ERROR_CODES = {
  // Shapefile/Import errors
  SHAPEFILE_MISSING_REQUIRED: 'SHAPEFILE_MISSING_REQUIRED',
  INVALID_GEOMETRY: 'INVALID_GEOMETRY',
  UNSUPPORTED_GEOMETRY_TYPE: 'UNSUPPORTED_GEOMETRY_TYPE',
  LIKELY_PROJECTED_COORDINATES: 'LIKELY_PROJECTED_COORDINATES',
  MISSING_PRJ_ASSUMED_WGS84: 'MISSING_PRJ_ASSUMED_WGS84',
  DUPLICATE_GEOMETRY: 'DUPLICATE_GEOMETRY',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
  IMPORT_ALREADY_APPLIED: 'IMPORT_ALREADY_APPLIED',
  
  // Limit errors
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // General errors
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type ParcelleErrorCode = (typeof PARCELLE_ERROR_CODES)[keyof typeof PARCELLE_ERROR_CODES];

/**
 * API error response for parcelles module
 * Extends the base ApiError with parcelle-specific fields
 */
export interface ParcelleApiError {
  /** Error code from PARCELLE_ERROR_CODES */
  error_code: ParcelleErrorCode;
  
  /** Human-readable error message */
  message: string;
  
  /** Additional error details */
  details: Record<string, unknown>;
  
  /** Whether user confirmation is required to proceed (e.g., for projected coordinates) */
  requires_confirmation?: boolean;
}

/**
 * Details for SHAPEFILE_MISSING_REQUIRED error
 */
export interface ShapefileMissingRequiredDetails {
  /** List of missing file extensions (e.g., ['.shp', '.dbf']) */
  missing: string[];
}

/**
 * Details for INVALID_GEOMETRY error
 */
export interface InvalidGeometryDetails {
  /** Reason for geometry invalidity */
  reason: string;
  /** Feature index in the import file (if applicable) */
  feature_index?: number;
}

/**
 * Details for UNSUPPORTED_GEOMETRY_TYPE error
 */
export interface UnsupportedGeometryTypeDetails {
  /** The unsupported geometry type found */
  type: string;
  /** Expected geometry types */
  expected: ['Polygon', 'MultiPolygon'];
}

/**
 * Details for LIKELY_PROJECTED_COORDINATES warning
 */
export interface LikelyProjectedCoordinatesDetails {
  /** Sample coordinate that appears to be projected */
  sample_coord: [number, number];
}

/**
 * Details for LIMIT_EXCEEDED error
 */
export interface LimitExceededDetails {
  /** The limit that was exceeded */
  limit: number;
  /** The actual value that exceeded the limit */
  actual: number;
  /** The resource that was limited (e.g., 'features', 'file_size', 'export_rows') */
  resource: string;
}

/**
 * Details for DUPLICATE_FILE error
 */
export interface DuplicateFileDetails {
  /** ID of the existing import file with same SHA256 */
  existing_import_id: string;
}

/**
 * Details for VALIDATION_ERROR
 */
export interface ValidationErrorDetails {
  /** Field that failed validation */
  field: string;
  /** Validation error message */
  message: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Paginated list response for parcelles
 * Returned by GET /api/parcelles
 */
export interface ParcelleListResponse {
  /** List of parcelles */
  data: Parcelle[];
  
  /** Total number of parcelles matching filters */
  total: number;
  
  /** Current page number (1-indexed) */
  page: number;
  
  /** Number of items per page */
  pageSize: number;
  
  /** Total number of pages */
  totalPages: number;
}

/**
 * KPI statistics for parcelles
 * Used by the ParcelleKPIs component
 */
export interface ParcelleKPIs {
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
 * Import file list response
 * Returned by GET /api/parcelles/import
 */
export interface ImportFileListResponse {
  /** List of import files */
  data: ParcelImportFile[];
  
  /** Total number of import files */
  total: number;
  
  /** Current page number (1-indexed) */
  page: number;
  
  /** Number of items per page */
  pageSize: number;
  
  /** Total number of pages */
  totalPages: number;
}

// =============================================================================
// Limits and Constants
// =============================================================================

/**
 * System limits for parcelles module
 * Enforced by API and database constraints
 */
export const PARCELLE_LIMITS = {
  /** Maximum upload file size in bytes (50MB) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  
  /** Maximum number of features per import */
  MAX_FEATURES_PER_IMPORT: 500,
  
  /** Maximum items per API page */
  MAX_PAGE_SIZE: 100,
  
  /** Default items per API page */
  DEFAULT_PAGE_SIZE: 20,
  
  /** Maximum rows for export */
  MAX_EXPORT_ROWS: 50000,
  
  /** Coordinate precision for display (6 decimals ≈ 0.1m) */
  DISPLAY_COORDINATE_PRECISION: 6,
  
  /** Coordinate precision for hash computation (8 decimals) */
  HASH_COORDINATE_PRECISION: 8,
} as const;
