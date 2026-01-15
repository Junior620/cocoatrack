// CocoaTrack V2 - Shapefile Parser Service
// Parses Shapefile ZIP archives to GeoJSON features
// Uses shpjs for shapefile parsing

import shp from 'shpjs';
import JSZip from 'jszip';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Geometry } from 'geojson';
import { normalizeToMultiPolygon, validateCoordinates, detectProjectedCoordinates } from './geometry-service';
import type { ParseError, ParseWarning } from '@/types/parcelles';
import { PARCELLE_ERROR_CODES } from '@/types/parcelles';

/**
 * Result of coordinate validation
 * Per Requirement 2.9, 2.10, 14.1: Validate WGS84 bounds and detect projected coordinates
 */
export interface CoordinateValidationResult {
  /** Whether all coordinates are within WGS84 bounds */
  valid: boolean;
  /** Warning code if validation issues found */
  warning?: typeof PARCELLE_ERROR_CODES.LIKELY_PROJECTED_COORDINATES;
  /** Sample coordinate that is out of bounds (for error reporting) */
  sampleCoord?: [number, number];
  /** Whether user confirmation is required to proceed */
  requiresConfirmation?: boolean;
}

/**
 * Result of parsing a shapefile
 */
export interface ShapefileParseResult {
  /** Parsed features as GeoJSON */
  features: Feature<MultiPolygon>[];
  /** Errors encountered during parsing */
  errors: ParseError[];
  /** Warnings encountered during parsing */
  warnings: ParseWarning[];
  /** Available attribute fields from DBF */
  availableFields: string[];
  /** Whether .prj file was present */
  hasPrj: boolean;
}

/**
 * Result of extracting a shapefile ZIP
 */
export interface ExtractedShapefileFiles {
  /** .shp file content (geometry) */
  shp: ArrayBuffer;
  /** .shx file content (index) */
  shx: ArrayBuffer;
  /** .dbf file content (attributes) */
  dbf: ArrayBuffer;
  /** .prj file content (projection) - optional */
  prj?: string;
}

/**
 * Result of extractZip operation
 */
export type ExtractZipResult = 
  | { success: true; files: ExtractedShapefileFiles; hasPrj: boolean }
  | { success: false; error: ParseError };

/**
 * Required files in a shapefile ZIP
 */
const REQUIRED_FILES = ['.shp', '.shx', '.dbf'] as const;

/**
 * Validate coordinates of parsed features for WGS84 bounds
 * 
 * Per Requirement 2.9: If .prj is missing, assume WGS84 and include warning
 * Per Requirement 2.10: If .prj is missing AND coordinates are outside WGS84 bounds,
 *                       return warning LIKELY_PROJECTED_COORDINATES with requires_confirmation=true
 * Per Requirement 14.1: Detect likely projected coordinates
 * 
 * @param features - Array of parsed GeoJSON features
 * @param hasPrj - Whether the shapefile had a .prj file
 * @returns Validation result with warnings if coordinates appear projected
 * 
 * @example
 * ```typescript
 * const result = validateShapefileCoordinates(features, false);
 * if (result.warning) {
 *   console.log('Warning:', result.warning);
 *   console.log('Sample coord:', result.sampleCoord);
 *   console.log('Requires confirmation:', result.requiresConfirmation);
 * }
 * ```
 */
export function validateShapefileCoordinates(
  features: Feature<MultiPolygon>[],
  hasPrj: boolean
): CoordinateValidationResult {
  // Check each feature for out-of-bounds coordinates
  for (const feature of features) {
    if (!feature.geometry) continue;
    
    // Use the geometry-service validateCoordinates function
    const validation = validateCoordinates(feature.geometry);
    
    if (!validation.valid) {
      // Coordinates are outside WGS84 bounds
      const firstOutOfBounds = validation.outOfBounds[0];
      
      // Per Requirement 2.10: If .prj is missing AND coordinates are outside bounds,
      // return LIKELY_PROJECTED_COORDINATES warning with requires_confirmation=true
      if (!hasPrj) {
        return {
          valid: false,
          warning: PARCELLE_ERROR_CODES.LIKELY_PROJECTED_COORDINATES,
          sampleCoord: [firstOutOfBounds.lng, firstOutOfBounds.lat],
          requiresConfirmation: true,
        };
      }
      
      // If .prj is present but coordinates are still out of bounds,
      // this is likely a data error
      return {
        valid: false,
        sampleCoord: [firstOutOfBounds.lng, firstOutOfBounds.lat],
      };
    }
    
    // Also use detectProjectedCoordinates for additional checks
    const projectedCheck = detectProjectedCoordinates(feature.geometry);
    if (projectedCheck.likely && !hasPrj) {
      return {
        valid: false,
        warning: PARCELLE_ERROR_CODES.LIKELY_PROJECTED_COORDINATES,
        sampleCoord: projectedCheck.sampleCoord,
        requiresConfirmation: true,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check if a ZIP contains required shapefile components
 * 
 * @param zipContents - Object with file names as keys
 * @returns Object with missing files array and hasPrj flag
 */
function checkRequiredFiles(zipContents: Record<string, unknown>): {
  missing: string[];
  hasPrj: boolean;
} {
  const fileNames = Object.keys(zipContents).map((name) => name.toLowerCase());
  const missing: string[] = [];
  
  for (const ext of REQUIRED_FILES) {
    const hasFile = fileNames.some((name) => name.endsWith(ext));
    if (!hasFile) {
      missing.push(ext);
    }
  }
  
  const hasPrj = fileNames.some((name) => name.endsWith('.prj'));
  
  return { missing, hasPrj };
}

/**
 * Find a file in the ZIP by extension (case-insensitive)
 * Handles nested directories by searching all files
 * 
 * @param zip - JSZip instance
 * @param extension - File extension to find (e.g., '.shp')
 * @returns The file name if found, undefined otherwise
 */
function findFileByExtension(zip: JSZip, extension: string): string | undefined {
  const lowerExt = extension.toLowerCase();
  for (const fileName of Object.keys(zip.files)) {
    if (fileName.toLowerCase().endsWith(lowerExt) && !zip.files[fileName].dir) {
      return fileName;
    }
  }
  return undefined;
}

/**
 * Extract and validate a Shapefile ZIP archive
 * 
 * Validates that the ZIP contains the required files (.shp, .shx, .dbf)
 * and extracts them as ArrayBuffers. The optional .prj file is extracted
 * as a string if present.
 * 
 * @param buffer - ZIP file as ArrayBuffer
 * @returns ExtractZipResult with either extracted files or an error
 * 
 * @example
 * ```typescript
 * const result = await extractZip(zipBuffer);
 * if (result.success) {
 *   console.log('Files extracted:', result.files);
 *   console.log('Has .prj:', result.hasPrj);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function extractZip(buffer: ArrayBuffer): Promise<ExtractZipResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    // Check for required files
    const { missing, hasPrj } = checkRequiredFiles(zip.files);
    
    if (missing.length > 0) {
      return {
        success: false,
        error: {
          code: PARCELLE_ERROR_CODES.SHAPEFILE_MISSING_REQUIRED,
          message: `Shapefile ZIP is missing required files: ${missing.join(', ')}`,
          details: { missing },
        },
      };
    }
    
    // Find and extract required files
    const shpFileName = findFileByExtension(zip, '.shp');
    const shxFileName = findFileByExtension(zip, '.shx');
    const dbfFileName = findFileByExtension(zip, '.dbf');
    const prjFileName = findFileByExtension(zip, '.prj');
    
    // This should not happen since we already checked, but TypeScript needs it
    if (!shpFileName || !shxFileName || !dbfFileName) {
      return {
        success: false,
        error: {
          code: PARCELLE_ERROR_CODES.SHAPEFILE_MISSING_REQUIRED,
          message: 'Failed to locate required shapefile components',
          details: { missing: ['.shp', '.shx', '.dbf'].filter((ext) => 
            !findFileByExtension(zip, ext)
          )},
        },
      };
    }
    
    // Extract file contents
    const [shpBuffer, shxBuffer, dbfBuffer] = await Promise.all([
      zip.files[shpFileName].async('arraybuffer'),
      zip.files[shxFileName].async('arraybuffer'),
      zip.files[dbfFileName].async('arraybuffer'),
    ]);
    
    // Extract .prj as string if present
    let prjContent: string | undefined;
    if (prjFileName) {
      prjContent = await zip.files[prjFileName].async('string');
    }
    
    return {
      success: true,
      files: {
        shp: shpBuffer,
        shx: shxBuffer,
        dbf: dbfBuffer,
        prj: prjContent,
      },
      hasPrj,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Failed to extract ZIP archive',
        details: { reason: err instanceof Error ? err.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Result of parsing shapefile geometry (.shp file)
 */
export interface ParseShpResult {
  /** Parsed features as GeoJSON */
  features: Feature<MultiPolygon>[];
  /** Errors encountered during parsing */
  errors: ParseError[];
  /** Warnings encountered during parsing */
  warnings: ParseWarning[];
}

/**
 * Result of parsing DBF attributes
 */
export interface ParseDbfResult {
  /** Array of attribute records, one per feature */
  records: Record<string, unknown>[];
  /** List of field names found in the DBF */
  fieldNames: string[];
  /** Errors encountered during parsing */
  errors: ParseError[];
  /** Warnings encountered during parsing */
  warnings: ParseWarning[];
}

/**
 * Check if a geometry is empty or has no coordinates
 * Per Requirement 14.5: IF geometry is empty or null, return error INVALID_GEOMETRY with reason "empty geometry"
 * 
 * @param geometry - GeoJSON geometry to check
 * @returns true if geometry is empty or has no valid coordinates
 */
function isEmptyGeometry(geometry: Polygon | MultiPolygon): boolean {
  if (!geometry || !geometry.coordinates) {
    return true;
  }
  
  if (geometry.type === 'Polygon') {
    // Polygon: coordinates is an array of rings, each ring is an array of positions
    return geometry.coordinates.length === 0 || 
           geometry.coordinates.every(ring => !ring || ring.length === 0);
  }
  
  if (geometry.type === 'MultiPolygon') {
    // MultiPolygon: coordinates is an array of polygons
    return geometry.coordinates.length === 0 ||
           geometry.coordinates.every(polygon => 
             !polygon || polygon.length === 0 ||
             polygon.every(ring => !ring || ring.length === 0)
           );
  }
  
  return true;
}

/**
 * Parse a .shp file buffer to GeoJSON features
 * 
 * This function converts the binary shapefile geometry data to GeoJSON format.
 * It uses shpjs internally but provides a cleaner interface for working with
 * pre-extracted shapefile components.
 * 
 * Per Requirement 2.7: Convert geometry to GeoJSON format
 * Per Requirement 2.13: Only accept Polygon and MultiPolygon geometry types
 * Per Requirement 3.7: Automatically wrap Polygon as MultiPolygon for storage
 * Per Requirement 14.5: Return INVALID_GEOMETRY error for empty/null geometry
 * 
 * @param shpBuffer - The .shp file content as ArrayBuffer
 * @param dbfBuffer - The .dbf file content as ArrayBuffer (for attributes)
 * @param prjContent - Optional .prj file content as string (for projection info)
 * @returns ParseShpResult with features, errors, and warnings
 * 
 * @example
 * ```typescript
 * const extractResult = await extractZip(zipBuffer);
 * if (extractResult.success) {
 *   const parseResult = await parseShp(
 *     extractResult.files.shp,
 *     extractResult.files.dbf,
 *     extractResult.files.prj
 *   );
 *   console.log('Parsed features:', parseResult.features.length);
 * }
 * ```
 */
export async function parseShp(
  shpBuffer: ArrayBuffer,
  dbfBuffer: ArrayBuffer,
  prjContent?: string
): Promise<ParseShpResult> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const features: Feature<MultiPolygon>[] = [];
  
  try {
    console.log('[parseShp] Parsing SHP buffer, size:', shpBuffer.byteLength);
    console.log('[parseShp] Parsing DBF buffer, size:', dbfBuffer.byteLength);
    console.log('[parseShp] PRJ content:', prjContent ? 'present' : 'missing');
    
    // shpjs.parseShp expects the shp buffer and optionally prj content
    // It returns an array of geometries
    let geometries: ReturnType<typeof shp.parseShp>;
    try {
      geometries = shp.parseShp(shpBuffer, prjContent);
      console.log('[parseShp] Geometries parsed:', geometries.length);
    } catch (shpError) {
      console.error('[parseShp] Error parsing SHP:', shpError);
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Failed to parse SHP file',
        details: { 
          reason: shpError instanceof Error ? shpError.message : 'Unknown error',
        },
      });
      return { features, errors, warnings };
    }
    
    // Parse DBF attributes separately
    // Note: parseDbf requires a cpg buffer for encoding, but we pass undefined
    // to use default encoding (typically UTF-8 or Latin-1)
    let attributes: ReturnType<typeof shp.parseDbf>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attributes = shp.parseDbf(dbfBuffer, undefined as any);
      console.log('[parseShp] Attributes parsed:', attributes.length);
    } catch (dbfError) {
      console.error('[parseShp] Error parsing DBF:', dbfError);
      // Continue without attributes - use empty array
      attributes = [];
      warnings.push({
        code: 'DBF_PARSE_ERROR',
        message: 'Failed to parse DBF attributes, continuing without attributes',
        details: { 
          reason: dbfError instanceof Error ? dbfError.message : 'Unknown error',
        },
      });
    }
    
    // Log first geometry type if available
    if (geometries.length > 0) {
      console.log('[parseShp] First geometry type:', geometries[0]?.type);
    } else {
      console.log('[parseShp] No geometries found in SHP file');
    }
    
    // Validate that we have matching counts
    if (geometries.length !== attributes.length) {
      warnings.push({
        code: 'ATTRIBUTE_COUNT_MISMATCH',
        message: `Geometry count (${geometries.length}) does not match attribute count (${attributes.length}). Some features may have missing attributes.`,
        details: {
          geometry_count: geometries.length,
          attribute_count: attributes.length,
        },
      });
    }
    
    // Process each geometry
    for (let i = 0; i < geometries.length; i++) {
      const geometry = geometries[i];
      const properties = attributes[i] || {};
      
      // Handle null/empty geometry (Requirement 14.5)
      if (!geometry) {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${i} has empty or null geometry`,
          feature_index: i,
          details: { 
            reason: 'empty geometry',
            feature_index: i,
          },
        });
        continue;
      }
      
      // Get geometry type
      const geomType = geometry.type;
      
      // Filter to only Polygon/MultiPolygon (Requirement 2.13)
      if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') {
        errors.push({
          code: PARCELLE_ERROR_CODES.UNSUPPORTED_GEOMETRY_TYPE,
          message: `Feature ${i} has unsupported geometry type: ${geomType}. Only Polygon and MultiPolygon are supported.`,
          feature_index: i,
          details: { 
            type: geomType, 
            expected: ['Polygon', 'MultiPolygon'],
            feature_index: i,
          },
        });
        continue;
      }
      
      // Check for empty geometry coordinates (Requirement 14.5)
      if (isEmptyGeometry(geometry as Polygon | MultiPolygon)) {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${i} has empty geometry (no coordinates)`,
          feature_index: i,
          details: { 
            reason: 'empty geometry',
            feature_index: i,
          },
        });
        continue;
      }
      
      // Normalize to MultiPolygon (Requirement 3.7)
      const normalizedGeom = normalizeToMultiPolygon(
        geometry as Polygon | MultiPolygon
      );
      
      // Verify the normalized geometry is valid
      if (isEmptyGeometry(normalizedGeom)) {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${i} resulted in empty geometry after normalization`,
          feature_index: i,
          details: { 
            reason: 'empty geometry after normalization',
            feature_index: i,
          },
        });
        continue;
      }
      
      features.push({
        type: 'Feature',
        properties: properties,
        geometry: normalizedGeom,
      });
    }
    
    // Add summary warning if some features were skipped
    const skippedCount = geometries.length - features.length;
    if (skippedCount > 0 && errors.length > 0) {
      warnings.push({
        code: 'FEATURES_SKIPPED',
        message: `${skippedCount} feature(s) were skipped due to errors. See errors array for details.`,
        details: {
          skipped_count: skippedCount,
          total_count: geometries.length,
          valid_count: features.length,
        },
      });
    }
  } catch (err) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'Failed to parse shapefile geometry',
      details: { 
        reason: err instanceof Error ? err.message : 'Unknown error',
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      },
    });
  }
  
  return {
    features,
    errors,
    warnings,
  };
}

/**
 * Parse a .dbf file buffer to extract attribute records
 * 
 * This function extracts attribute data from a DBF (dBASE) file, which is
 * the attribute component of a Shapefile. It returns the raw attribute records
 * and the list of available field names for field mapping.
 * 
 * Per Requirement 2.8: Extract attributes from the .dbf file for field mapping
 * Per Requirement 3.8: Allow mapping DBF fields to CocoaTrack fields
 * 
 * @param dbfBuffer - The .dbf file content as ArrayBuffer
 * @param cpgBuffer - Optional .cpg file content as ArrayBuffer (for character encoding)
 * @returns ParseDbfResult with records, field names, errors, and warnings
 * 
 * @example
 * ```typescript
 * const extractResult = await extractZip(zipBuffer);
 * if (extractResult.success) {
 *   const dbfResult = parseDbf(extractResult.files.dbf);
 *   console.log('Available fields:', dbfResult.fieldNames);
 *   console.log('Records:', dbfResult.records.length);
 * }
 * ```
 */
export function parseDbf(
  dbfBuffer: ArrayBuffer,
  cpgBuffer?: ArrayBuffer
): ParseDbfResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const records: Record<string, unknown>[] = [];
  const fieldNames: string[] = [];
  
  try {
    // Parse DBF using shpjs
    // The second parameter is for character encoding (from .cpg file)
    // If not provided, shpjs uses default encoding (typically Latin-1 or UTF-8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedRecords = shp.parseDbf(dbfBuffer, cpgBuffer as any);
    
    // Extract field names from the first record (if available)
    if (parsedRecords.length > 0) {
      const firstRecord = parsedRecords[0];
      if (firstRecord && typeof firstRecord === 'object') {
        fieldNames.push(...Object.keys(firstRecord));
      }
    }
    
    // Track empty/invalid records for summary warning
    let emptyRecordCount = 0;
    
    // Process each record
    for (let i = 0; i < parsedRecords.length; i++) {
      const record = parsedRecords[i];
      
      if (!record || typeof record !== 'object') {
        emptyRecordCount++;
        // Push an empty record to maintain index alignment with geometries
        records.push({});
        continue;
      }
      
      // Clean up the record values
      // DBF files can have trailing spaces in string values
      const cleanedRecord: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'string') {
          // Trim whitespace from string values
          cleanedRecord[key] = value.trim();
        } else {
          cleanedRecord[key] = value;
        }
      }
      
      records.push(cleanedRecord);
    }
    
    // Add warning if some records were empty/invalid
    if (emptyRecordCount > 0) {
      warnings.push({
        code: 'EMPTY_RECORDS',
        message: `${emptyRecordCount} record(s) were empty or invalid`,
        details: {
          empty_count: emptyRecordCount,
          total_count: parsedRecords.length,
        },
      });
    }
    
    // Add warning if no records found
    if (records.length === 0) {
      warnings.push({
        code: 'NO_RECORDS',
        message: 'DBF file contains no attribute records',
        details: {
          record_count: 0,
        },
      });
    }
    
    // Add warning if no fields found
    if (fieldNames.length === 0 && records.length > 0) {
      warnings.push({
        code: 'NO_FIELDS',
        message: 'DBF file contains records but no field definitions',
        details: {
          record_count: records.length,
          field_count: 0,
        },
      });
    }
  } catch (err) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'Failed to parse DBF file',
      details: { 
        reason: err instanceof Error ? err.message : 'Unknown error',
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      },
    });
  }
  
  return {
    records,
    fieldNames,
    errors,
    warnings,
  };
}

/**
 * Parse a Shapefile ZIP archive
 * 
 * This is the main entry point for parsing shapefile ZIP archives.
 * It extracts the ZIP, validates required files, and parses the geometry
 * and attributes to GeoJSON format.
 * 
 * Per Requirement 2.9: If .prj is missing, assume WGS84 and include warning
 * Per Requirement 2.10: If .prj is missing AND coordinates are outside WGS84 bounds,
 *                       return warning LIKELY_PROJECTED_COORDINATES with requires_confirmation=true
 * Per Requirement 13.1: Return errors in format { error_code, message, details, requires_confirmation? }
 * 
 * @param buffer - ZIP file as ArrayBuffer
 * @returns Parsed features with errors and warnings
 */
export async function parseShapefile(buffer: ArrayBuffer): Promise<ShapefileParseResult> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const features: Feature<MultiPolygon>[] = [];
  const fieldSet = new Set<string>();
  let hasPrj = false;
  
  try {
    console.log('[parseShapefile] Starting shapefile parsing, buffer size:', buffer.byteLength);
    
    // First check if ZIP contains required files
    const extractResult = await extractZip(buffer);
    
    if (!extractResult.success) {
      console.log('[parseShapefile] ZIP extraction failed:', extractResult.error);
      errors.push(extractResult.error);
      return { features, errors, warnings, availableFields: [], hasPrj };
    }
    
    hasPrj = extractResult.hasPrj;
    console.log('[parseShapefile] ZIP validated, hasPrj:', hasPrj);
    
    // Add warning if .prj is missing (Requirement 2.9)
    if (!hasPrj) {
      warnings.push({
        code: PARCELLE_ERROR_CODES.MISSING_PRJ_ASSUMED_WGS84,
        message: 'No .prj file found. Assuming WGS84 (EPSG:4326) projection.',
        details: {
          assumed_projection: 'EPSG:4326',
          recommendation: 'Include a .prj file to ensure correct coordinate interpretation.',
        },
      });
    }
    
    // Use shpjs v6 API - it takes the ZIP buffer directly and returns GeoJSON
    console.log('[parseShapefile] Parsing with shpjs...');
    let geojson: FeatureCollection | FeatureCollection[];
    try {
      geojson = await shp(buffer);
      console.log('[parseShapefile] shpjs parse complete');
    } catch (shpError) {
      console.error('[parseShapefile] shpjs error:', shpError);
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Failed to parse shapefile',
        details: { 
          reason: shpError instanceof Error ? shpError.message : 'Unknown error',
        },
      });
      return { features, errors, warnings, availableFields: [], hasPrj };
    }
    
    // shpjs can return a single FeatureCollection or an array of them
    const collections = Array.isArray(geojson) ? geojson : [geojson];
    console.log('[parseShapefile] Found', collections.length, 'feature collection(s)');
    
    // Process each feature collection
    for (const collection of collections) {
      if (!collection || !collection.features) {
        console.log('[parseShapefile] Skipping empty collection');
        continue;
      }
      
      console.log('[parseShapefile] Processing collection with', collection.features.length, 'features');
      
      for (let i = 0; i < collection.features.length; i++) {
        const feature = collection.features[i];
        
        if (!feature || !feature.geometry) {
          errors.push({
            code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
            message: `Feature ${i} has empty or null geometry`,
            feature_index: i,
            details: { reason: 'empty geometry' },
          });
          continue;
        }
        
        const geomType = feature.geometry.type;
        console.log('[parseShapefile] Feature', i, 'type:', geomType);
        
        // Only accept Polygon and MultiPolygon
        if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') {
          errors.push({
            code: PARCELLE_ERROR_CODES.UNSUPPORTED_GEOMETRY_TYPE,
            message: `Feature ${i} has unsupported geometry type: ${geomType}. Only Polygon and MultiPolygon are supported.`,
            feature_index: i,
            details: { 
              type: geomType, 
              expected: ['Polygon', 'MultiPolygon'],
            },
          });
          continue;
        }
        
        // Normalize to MultiPolygon
        const normalizedGeom = normalizeToMultiPolygon(feature.geometry as Polygon | MultiPolygon);
        
        // Collect property fields
        if (feature.properties) {
          Object.keys(feature.properties).forEach((key) => fieldSet.add(key));
        }
        
        features.push({
          type: 'Feature',
          properties: feature.properties || {},
          geometry: normalizedGeom,
        });
      }
    }
    
    console.log('[parseShapefile] Total valid features:', features.length);
    
    // Validate coordinates for WGS84 bounds (Requirement 2.10, 14.1)
    if (features.length > 0) {
      const coordValidation = validateShapefileCoordinates(features, hasPrj);
      
      if (!coordValidation.valid && coordValidation.warning) {
        warnings.push({
          code: coordValidation.warning,
          message: 'Coordinates appear to be in a projected coordinate system, not WGS84 (EPSG:4326). The data may need to be reprojected.',
          requires_confirmation: coordValidation.requiresConfirmation,
          details: {
            sample_coord: coordValidation.sampleCoord,
            expected_bounds: {
              longitude: [-180, 180],
              latitude: [-90, 90],
            },
            recommendation: 'Verify the coordinate system and reproject to WGS84 if necessary.',
          },
        });
      }
    }
    
    // Add summary information
    if (features.length === 0 && errors.length === 0) {
      warnings.push({
        code: 'NO_FEATURES',
        message: 'No valid polygon features found in the shapefile',
        details: {
          feature_count: 0,
        },
      });
    }
  } catch (err) {
    console.error('[parseShapefile] Unexpected error:', err);
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'Failed to parse Shapefile',
      details: { 
        reason: err instanceof Error ? err.message : 'Unknown error',
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      },
    });
  }
  
  return {
    features,
    errors,
    warnings,
    availableFields: Array.from(fieldSet),
    hasPrj,
  };
}
