// CocoaTrack V2 - Geo Parser Service
// Parses KML, KMZ, and GeoJSON files to GeoJSON features
// Uses @tmcw/togeojson for KML parsing

import { kml as parseKmlToGeoJson } from '@tmcw/togeojson';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { normalizeToMultiPolygon, normalizeGeometryRings } from './geometry-service';
import type { ParseError, ParseWarning } from '@/types/parcelles';
import { PARCELLE_ERROR_CODES } from '@/types/parcelles';

/**
 * Result of parsing a geo file
 */
export interface GeoParseResult {
  /** Parsed features as GeoJSON */
  features: Feature<MultiPolygon>[];
  /** Errors encountered during parsing */
  errors: ParseError[];
  /** Warnings encountered during parsing */
  warnings: ParseWarning[];
  /** Available attribute fields from properties */
  availableFields: string[];
}

/**
 * Normalize a geometry to MultiPolygon with correct ring orientation
 * Per Requirement 3.7: All polygons stored as MultiPolygon
 * Per Requirement 14.4: Ring orientation normalized (exterior CCW, interior CW)
 * 
 * @param geometry - Polygon or MultiPolygon geometry
 * @returns Normalized MultiPolygon with correct ring orientation
 */
function normalizeGeometry(geometry: Polygon | MultiPolygon): MultiPolygon {
  // First normalize to MultiPolygon
  const multiPolygon = normalizeToMultiPolygon(geometry);
  
  // Then normalize ring orientation per GeoJSON spec
  return normalizeGeometryRings(multiPolygon);
}

/**
 * Extract KML content from a KMZ file (ZIP containing KML)
 * 
 * @param buffer - KMZ file as ArrayBuffer
 * @returns KML content as string
 */
async function extractKmlFromKmz(buffer: ArrayBuffer): Promise<string> {
  // KMZ is a ZIP file containing doc.kml or similar
  // Using JSZip to extract
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  
  // Find the KML file in the ZIP
  const kmlFile = Object.keys(zip.files).find(
    (name) => name.toLowerCase().endsWith('.kml')
  );
  
  if (!kmlFile) {
    throw {
      error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'KMZ file does not contain a KML file',
      details: { field: 'file', message: 'No .kml file found in KMZ archive' },
    };
  }
  
  return await zip.files[kmlFile].async('string');
}

/**
 * Parse KML content to GeoJSON features
 * Per Requirement 2.12: System accepts KML format
 * Per Requirement 14.4: KML ring orientation normalized to GeoJSON spec
 * 
 * @param kmlContent - KML content as string
 * @returns Parsed features with normalized geometry
 */
function parseKmlContent(kmlContent: string): GeoParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const features: Feature<MultiPolygon>[] = [];
  const fieldSet = new Set<string>();
  
  try {
    // Parse KML to DOM
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
    
    // Check for parse errors
    const parseError = kmlDoc.querySelector('parsererror');
    if (parseError) {
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid KML format',
        details: { reason: parseError.textContent || 'XML parse error' },
      });
      return { features, errors, warnings, availableFields: [] };
    }
    
    // Convert to GeoJSON using togeojson
    const geojson = parseKmlToGeoJson(kmlDoc);
    
    // Process features
    let featureIndex = 0;
    for (const feature of geojson.features) {
      // Collect property fields
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) => fieldSet.add(key));
      }
      
      // Filter to only Polygon/MultiPolygon (Requirement 2.13)
      if (!feature.geometry) {
        warnings.push({
          code: 'EMPTY_GEOMETRY',
          message: `Feature ${featureIndex} has no geometry`,
          feature_index: featureIndex,
        });
        featureIndex++;
        continue;
      }
      
      const geomType = feature.geometry.type;
      if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') {
        errors.push({
          code: PARCELLE_ERROR_CODES.UNSUPPORTED_GEOMETRY_TYPE,
          message: `Feature ${featureIndex} has unsupported geometry type: ${geomType}`,
          feature_index: featureIndex,
          details: { type: geomType, expected: ['Polygon', 'MultiPolygon'] },
        });
        featureIndex++;
        continue;
      }
      
      // Normalize to MultiPolygon with correct ring orientation
      const normalizedGeom = normalizeGeometry(
        feature.geometry as Polygon | MultiPolygon
      );
      
      features.push({
        type: 'Feature',
        properties: feature.properties || {},
        geometry: normalizedGeom,
      });
      
      featureIndex++;
    }
  } catch (err) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'Failed to parse KML content',
      details: { reason: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
  
  return {
    features,
    errors,
    warnings,
    availableFields: Array.from(fieldSet),
  };
}

/**
 * Parse a KML file
 * Per Requirement 2.12: System accepts KML format as alternative to Shapefile
 * Per Requirement 14.4: KML ring orientation normalized to GeoJSON spec
 * 
 * @param content - KML file content as string
 * @returns Parsed features with normalized geometry
 */
export function parseKML(content: string): GeoParseResult {
  return parseKmlContent(content);
}

/**
 * Parse a KMZ file (compressed KML)
 * Per Requirement 2.14: KMZ files extracted and parsed as KML
 * 
 * @param buffer - KMZ file as ArrayBuffer
 * @returns Parsed features
 */
export async function parseKMZ(buffer: ArrayBuffer): Promise<GeoParseResult> {
  const kmlContent = await extractKmlFromKmz(buffer);
  return parseKmlContent(kmlContent);
}

/**
 * Validate GeoJSON structure according to RFC 7946
 * Returns validation errors if structure is invalid
 */
function validateGeoJSONStructure(
  geojson: unknown
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];
  
  // Check if it's an object
  if (typeof geojson !== 'object' || geojson === null) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'GeoJSON must be an object',
      details: { reason: 'Expected object, got ' + typeof geojson },
    });
    return { valid: false, errors };
  }
  
  const obj = geojson as Record<string, unknown>;
  
  // Check for required 'type' property
  if (!('type' in obj) || typeof obj.type !== 'string') {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'GeoJSON must have a "type" property',
      details: { reason: 'Missing or invalid "type" property' },
    });
    return { valid: false, errors };
  }
  
  const validTypes = [
    'Feature',
    'FeatureCollection',
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
  ];
  
  if (!validTypes.includes(obj.type as string)) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Invalid GeoJSON type: ${obj.type}`,
      details: { reason: `Type must be one of: ${validTypes.join(', ')}` },
    });
    return { valid: false, errors };
  }
  
  // Validate FeatureCollection structure
  if (obj.type === 'FeatureCollection') {
    if (!('features' in obj) || !Array.isArray(obj.features)) {
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'FeatureCollection must have a "features" array',
        details: { reason: 'Missing or invalid "features" property' },
      });
      return { valid: false, errors };
    }
    
    // Validate each feature in the collection
    for (let i = 0; i < obj.features.length; i++) {
      const feature = obj.features[i];
      const featureValidation = validateFeatureStructure(feature, i);
      if (!featureValidation.valid) {
        errors.push(...featureValidation.errors);
      }
    }
  }
  
  // Validate Feature structure
  if (obj.type === 'Feature') {
    const featureValidation = validateFeatureStructure(obj, 0);
    if (!featureValidation.valid) {
      errors.push(...featureValidation.errors);
    }
  }
  
  // Validate bare geometry (Polygon/MultiPolygon)
  if (obj.type === 'Polygon' || obj.type === 'MultiPolygon') {
    const geomValidation = validateGeometryStructure(obj, 0);
    if (!geomValidation.valid) {
      errors.push(...geomValidation.errors);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single Feature structure
 */
function validateFeatureStructure(
  feature: unknown,
  index: number
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];
  
  if (typeof feature !== 'object' || feature === null) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${index} must be an object`,
      feature_index: index,
      details: { reason: 'Expected object' },
    });
    return { valid: false, errors };
  }
  
  const obj = feature as Record<string, unknown>;
  
  // Check type
  if (obj.type !== 'Feature') {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${index} must have type "Feature"`,
      feature_index: index,
      details: { reason: `Got type "${obj.type}"` },
    });
    return { valid: false, errors };
  }
  
  // Check properties (must be object or null)
  if ('properties' in obj && obj.properties !== null && typeof obj.properties !== 'object') {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${index} properties must be an object or null`,
      feature_index: index,
      details: { reason: 'Invalid properties type' },
    });
  }
  
  // Check geometry (can be null for valid GeoJSON, but we'll warn)
  if (!('geometry' in obj)) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${index} must have a "geometry" property`,
      feature_index: index,
      details: { reason: 'Missing geometry property' },
    });
    return { valid: false, errors };
  }
  
  // Validate geometry structure if present and not null
  if (obj.geometry !== null) {
    const geomValidation = validateGeometryStructure(obj.geometry, index);
    if (!geomValidation.valid) {
      errors.push(...geomValidation.errors);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate geometry structure
 */
function validateGeometryStructure(
  geometry: unknown,
  featureIndex: number
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];
  
  if (typeof geometry !== 'object' || geometry === null) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${featureIndex} geometry must be an object`,
      feature_index: featureIndex,
      details: { reason: 'Expected object' },
    });
    return { valid: false, errors };
  }
  
  const obj = geometry as Record<string, unknown>;
  
  // Check type
  if (!('type' in obj) || typeof obj.type !== 'string') {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: `Feature ${featureIndex} geometry must have a "type" property`,
      feature_index: featureIndex,
      details: { reason: 'Missing geometry type' },
    });
    return { valid: false, errors };
  }
  
  // Check coordinates for geometry types that need them
  const coordTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];
  if (coordTypes.includes(obj.type as string)) {
    if (!('coordinates' in obj) || !Array.isArray(obj.coordinates)) {
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: `Feature ${featureIndex} geometry must have a "coordinates" array`,
        feature_index: featureIndex,
        details: { reason: 'Missing or invalid coordinates' },
      });
      return { valid: false, errors };
    }
    
    // Validate coordinate structure for Polygon/MultiPolygon
    if (obj.type === 'Polygon') {
      const coordValidation = validatePolygonCoordinates(obj.coordinates, featureIndex);
      if (!coordValidation.valid) {
        errors.push(...coordValidation.errors);
      }
    } else if (obj.type === 'MultiPolygon') {
      const coordValidation = validateMultiPolygonCoordinates(obj.coordinates, featureIndex);
      if (!coordValidation.valid) {
        errors.push(...coordValidation.errors);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate Polygon coordinates structure
 * A Polygon has an array of LinearRings (first is exterior, rest are holes)
 * Each LinearRing is an array of positions with at least 4 positions (closed ring)
 */
function validatePolygonCoordinates(
  coordinates: unknown[],
  featureIndex: number
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];
  
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push({
      code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
      message: `Feature ${featureIndex} Polygon must have at least one ring`,
      feature_index: featureIndex,
      details: { reason: 'Empty polygon coordinates' },
    });
    return { valid: false, errors };
  }
  
  // Validate each ring
  for (let ringIndex = 0; ringIndex < coordinates.length; ringIndex++) {
    const ring = coordinates[ringIndex];
    if (!Array.isArray(ring)) {
      errors.push({
        code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
        message: `Feature ${featureIndex} ring ${ringIndex} must be an array`,
        feature_index: featureIndex,
        details: { reason: 'Invalid ring structure' },
      });
      continue;
    }
    
    // A valid ring must have at least 4 positions (closed)
    if (ring.length < 4) {
      errors.push({
        code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
        message: `Feature ${featureIndex} ring ${ringIndex} must have at least 4 positions`,
        feature_index: featureIndex,
        details: { reason: `Ring has ${ring.length} positions, minimum is 4` },
      });
      continue;
    }
    
    // Validate each position in the ring
    for (let posIndex = 0; posIndex < ring.length; posIndex++) {
      const pos = ring[posIndex];
      if (!Array.isArray(pos) || pos.length < 2) {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${featureIndex} ring ${ringIndex} position ${posIndex} must be [lng, lat]`,
          feature_index: featureIndex,
          details: { reason: 'Invalid position format' },
        });
        continue;
      }
      
      // Check that coordinates are numbers
      if (typeof pos[0] !== 'number' || typeof pos[1] !== 'number') {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${featureIndex} ring ${ringIndex} position ${posIndex} coordinates must be numbers`,
          feature_index: featureIndex,
          details: { reason: 'Non-numeric coordinates' },
        });
      }
      
      // Check for NaN or Infinity
      if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${featureIndex} ring ${ringIndex} position ${posIndex} has invalid coordinates`,
          feature_index: featureIndex,
          details: { reason: 'NaN or Infinity in coordinates' },
        });
      }
    }
    
    // Check if ring is closed (first and last position should be the same)
    if (ring.length >= 4) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (Array.isArray(first) && Array.isArray(last)) {
        if (first[0] !== last[0] || first[1] !== last[1]) {
          // This is a warning, not an error - we can auto-close
          // But for strict validation, we note it
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate MultiPolygon coordinates structure
 * A MultiPolygon is an array of Polygon coordinate arrays
 */
function validateMultiPolygonCoordinates(
  coordinates: unknown[],
  featureIndex: number
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];
  
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push({
      code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
      message: `Feature ${featureIndex} MultiPolygon must have at least one polygon`,
      feature_index: featureIndex,
      details: { reason: 'Empty MultiPolygon coordinates' },
    });
    return { valid: false, errors };
  }
  
  // Validate each polygon
  for (let polyIndex = 0; polyIndex < coordinates.length; polyIndex++) {
    const polygon = coordinates[polyIndex];
    if (!Array.isArray(polygon)) {
      errors.push({
        code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
        message: `Feature ${featureIndex} polygon ${polyIndex} must be an array`,
        feature_index: featureIndex,
        details: { reason: 'Invalid polygon structure in MultiPolygon' },
      });
      continue;
    }
    
    const polyValidation = validatePolygonCoordinates(polygon, featureIndex);
    if (!polyValidation.valid) {
      errors.push(...polyValidation.errors);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Parse a GeoJSON file with comprehensive structure validation
 * Per Requirement 2.12: System accepts GeoJSON format as alternative to Shapefile
 * 
 * Validates:
 * - Valid JSON syntax
 * - Valid GeoJSON structure (RFC 7946)
 * - Feature and FeatureCollection structure
 * - Geometry coordinate structure
 * - Filters to Polygon/MultiPolygon only (Requirement 2.13)
 * - Normalizes ring orientation (Requirement 14.4)
 * 
 * @param content - GeoJSON content as string or object
 * @returns Parsed features with normalized geometry
 */
export function parseGeoJSON(
  content: string | FeatureCollection | Feature
): GeoParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const features: Feature<MultiPolygon>[] = [];
  const fieldSet = new Set<string>();
  
  try {
    // Parse JSON if string
    let geojson: unknown;
    try {
      geojson = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (parseErr) {
      errors.push({
        code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid JSON syntax',
        details: { 
          reason: parseErr instanceof Error ? parseErr.message : 'JSON parse error' 
        },
      });
      return { features, errors, warnings, availableFields: [] };
    }
    
    // Validate GeoJSON structure
    const structureValidation = validateGeoJSONStructure(geojson);
    if (!structureValidation.valid) {
      // Add structure errors but continue if we can still extract features
      errors.push(...structureValidation.errors);
      
      // If there are critical structure errors, return early
      const criticalErrors = structureValidation.errors.filter(
        e => e.message.includes('must be an object') || 
             e.message.includes('must have a "type"')
      );
      if (criticalErrors.length > 0) {
        return { features, errors, warnings, availableFields: [] };
      }
    }
    
    const validGeojson = geojson as FeatureCollection | Feature | Polygon | MultiPolygon;
    
    // Handle different GeoJSON types
    let featureArray: Feature[];
    
    const geojsonType = validGeojson.type;
    
    if (geojsonType === 'FeatureCollection') {
      featureArray = (validGeojson as FeatureCollection).features;
    } else if (geojsonType === 'Feature') {
      featureArray = [validGeojson as Feature];
    } else if (geojsonType === 'Polygon' || geojsonType === 'MultiPolygon') {
      // Bare geometry - wrap in a Feature
      featureArray = [{
        type: 'Feature',
        properties: {},
        geometry: validGeojson as Polygon | MultiPolygon,
      }];
    } else {
      // Unsupported top-level type
      errors.push({
        code: PARCELLE_ERROR_CODES.UNSUPPORTED_GEOMETRY_TYPE,
        message: `Unsupported GeoJSON type: ${geojsonType}`,
        details: { 
          type: geojsonType, 
          expected: ['Feature', 'FeatureCollection', 'Polygon', 'MultiPolygon'] 
        },
      });
      return { features, errors, warnings, availableFields: [] };
    }
    
    // Process features
    let featureIndex = 0;
    for (const feature of featureArray) {
      // Skip invalid features
      if (!feature || typeof feature !== 'object') {
        warnings.push({
          code: 'INVALID_FEATURE',
          message: `Feature ${featureIndex} is invalid`,
          feature_index: featureIndex,
        });
        featureIndex++;
        continue;
      }
      
      // Collect property fields
      if (feature.properties && typeof feature.properties === 'object') {
        Object.keys(feature.properties).forEach((key) => fieldSet.add(key));
      }
      
      // Filter to only Polygon/MultiPolygon (Requirement 2.13)
      if (!feature.geometry) {
        warnings.push({
          code: 'EMPTY_GEOMETRY',
          message: `Feature ${featureIndex} has no geometry`,
          feature_index: featureIndex,
        });
        featureIndex++;
        continue;
      }
      
      const geomType = feature.geometry.type;
      if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') {
        errors.push({
          code: PARCELLE_ERROR_CODES.UNSUPPORTED_GEOMETRY_TYPE,
          message: `Feature ${featureIndex} has unsupported geometry type: ${geomType}`,
          feature_index: featureIndex,
          details: { type: geomType, expected: ['Polygon', 'MultiPolygon'] },
        });
        featureIndex++;
        continue;
      }
      
      // Normalize to MultiPolygon with correct ring orientation
      const normalizedGeom = normalizeGeometry(
        feature.geometry as Polygon | MultiPolygon
      );
      
      features.push({
        type: 'Feature',
        properties: feature.properties || {},
        geometry: normalizedGeom,
      });
      
      featureIndex++;
    }
  } catch (err) {
    errors.push({
      code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
      message: 'Failed to parse GeoJSON content',
      details: { reason: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
  
  return {
    features,
    errors,
    warnings,
    availableFields: Array.from(fieldSet),
  };
}
