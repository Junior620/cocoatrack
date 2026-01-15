// CocoaTrack V2 - Geometry Service
// Client-side geometry operations using Turf.js
// Handles normalization, hashing, area calculation, and simplification

import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { PARCELLE_LIMITS } from '@/types/parcelles';
import type { Centroid } from '@/types/parcelles';

/**
 * Normalize a Polygon or MultiPolygon to always be MultiPolygon
 * Per Requirement 3.7: All polygons are stored as MultiPolygon
 * 
 * @param geometry - Input geometry (Polygon or MultiPolygon)
 * @returns MultiPolygon geometry
 */
export function normalizeToMultiPolygon(
  geometry: Polygon | MultiPolygon
): MultiPolygon {
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
 * Normalize a MultiPolygon geometry with correct ring orientation
 * Per Requirement 14.4: KML ring orientation must be normalized to GeoJSON spec
 * - Exterior rings: counter-clockwise (CCW)
 * - Interior rings (holes): clockwise (CW)
 * 
 * @param geometry - MultiPolygon geometry to normalize
 * @returns MultiPolygon with normalized ring orientation
 */
export function normalizeGeometryRings(geometry: MultiPolygon): MultiPolygon {
  const normalizedCoords = geometry.coordinates.map((polygon) => {
    return normalizeRingOrientationInternal(polygon);
  });
  
  return {
    type: 'MultiPolygon',
    coordinates: normalizedCoords,
  };
}

/**
 * Internal helper to normalize ring orientation for a single polygon's rings
 */
function normalizeRingOrientationInternal(rings: Position[][]): Position[][] {
  return rings.map((ring, index) => {
    const isExterior = index === 0;
    const clockwise = isClockwiseRing(ring);
    
    // Exterior should be CCW (not clockwise)
    // Interior should be CW (clockwise)
    if (isExterior && clockwise) {
      return reverseRingCoords(ring);
    }
    if (!isExterior && !clockwise) {
      return reverseRingCoords(ring);
    }
    return ring;
  });
}

/**
 * Check if a ring is clockwise using the shoelace formula
 */
function isClockwiseRing(ring: Position[]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

/**
 * Reverse a ring's coordinate order
 */
function reverseRingCoords(ring: Position[]): Position[] {
  return [...ring].reverse();
}

/**
 * Round coordinates to specified precision
 * Used for hash computation (8 decimals) and display (6 decimals)
 * 
 * @param coord - Coordinate value
 * @param precision - Number of decimal places
 * @returns Rounded coordinate
 */
function roundCoord(coord: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(coord * factor) / factor;
}

/**
 * Round all coordinates in a position array
 */
function roundPosition(pos: Position, precision: number): Position {
  return pos.map((c) => roundCoord(c, precision)) as Position;
}

/**
 * Round all coordinates in a ring
 */
function roundRing(ring: Position[], precision: number): Position[] {
  return ring.map((pos) => roundPosition(pos, precision));
}

/**
 * Sort rings by their first coordinate for deterministic ordering
 * This ensures the same geometry always produces the same hash
 */
function sortRings(rings: Position[][]): Position[][] {
  return [...rings].sort((a, b) => {
    const aFirst = a[0];
    const bFirst = b[0];
    if (aFirst[0] !== bFirst[0]) return aFirst[0] - bFirst[0];
    return aFirst[1] - bFirst[1];
  });
}

/**
 * Check if a ring is clockwise
 * Uses the shoelace formula to determine winding order
 */
function isClockwise(ring: Position[]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

/**
 * Reverse a ring's winding order
 */
function reverseRing(ring: Position[]): Position[] {
  return [...ring].reverse();
}

/**
 * Normalize ring orientation per GeoJSON spec:
 * - Exterior rings: counter-clockwise (CCW)
 * - Interior rings (holes): clockwise (CW)
 * 
 * Per Requirement 14.4: KML ring orientation must be normalized
 * 
 * @param rings - Array of rings (first is exterior, rest are holes)
 * @returns Normalized rings with correct orientation
 */
export function normalizeRingOrientation(rings: Position[][]): Position[][] {
  return rings.map((ring, index) => {
    const isExterior = index === 0;
    const clockwise = isClockwise(ring);
    
    // Exterior should be CCW (not clockwise)
    // Interior should be CW (clockwise)
    if (isExterior && clockwise) {
      return reverseRing(ring);
    }
    if (!isExterior && !clockwise) {
      return reverseRing(ring);
    }
    return ring;
  });
}

/**
 * Normalize a MultiPolygon for hash computation
 * Per Requirement 3.13: Normalization includes:
 * - Coordinates rounded to 8 decimals
 * - Rings sorted by first coordinate
 * - Exterior rings CCW, interior rings CW
 * 
 * @param geometry - MultiPolygon to normalize
 * @returns Normalized MultiPolygon
 */
export function normalizeForHash(geometry: MultiPolygon): MultiPolygon {
  const precision = PARCELLE_LIMITS.HASH_COORDINATE_PRECISION;
  
  // Process each polygon in the MultiPolygon
  const normalizedCoords = geometry.coordinates.map((polygon) => {
    // Round coordinates
    const roundedRings = polygon.map((ring) => roundRing(ring, precision));
    
    // Normalize ring orientation
    const orientedRings = normalizeRingOrientation(roundedRings);
    
    // Sort interior rings (keep exterior first)
    const [exterior, ...interiors] = orientedRings;
    const sortedInteriors = sortRings(interiors);
    
    return [exterior, ...sortedInteriors];
  });
  
  // Sort polygons by their first coordinate
  const sortedPolygons = [...normalizedCoords].sort((a, b) => {
    const aFirst = a[0][0];
    const bFirst = b[0][0];
    if (aFirst[0] !== bFirst[0]) return aFirst[0] - bFirst[0];
    return aFirst[1] - bFirst[1];
  });
  
  return {
    type: 'MultiPolygon',
    coordinates: sortedPolygons,
  };
}

/**
 * Compute SHA256 hash of normalized GeoJSON geometry
 * Per Requirement 3.13: feature_hash = SHA256(normalized_geojson)
 * 
 * @param geometry - MultiPolygon geometry
 * @returns SHA256 hash as hex string
 */
export async function computeFeatureHash(geometry: MultiPolygon): Promise<string> {
  const normalized = normalizeForHash(geometry);
  const jsonStr = JSON.stringify(normalized);
  
  // Use Web Crypto API for SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate area in hectares using Turf.js
 * Client-side approximation (PostGIS is source of truth)
 * 
 * @param geometry - MultiPolygon geometry
 * @returns Area in hectares
 */
export function calculateAreaHa(geometry: MultiPolygon): number {
  try {
    const feature = turf.multiPolygon(geometry.coordinates);
    const areaM2 = turf.area(feature);
    return Math.round((areaM2 / 10000) * 10000) / 10000; // 4 decimal places
  } catch {
    return 0;
  }
}

/**
 * Calculate centroid point inside the polygon
 * Uses Turf.js pointOnFeature (equivalent to PostGIS ST_PointOnSurface)
 * 
 * @param geometry - MultiPolygon geometry
 * @returns Centroid as { lat, lng }
 */
export function calculateCentroid(geometry: MultiPolygon): Centroid {
  try {
    const feature = turf.multiPolygon(geometry.coordinates);
    const point = turf.pointOnFeature(feature);
    const [lng, lat] = point.geometry.coordinates;
    return {
      lat: roundCoord(lat, PARCELLE_LIMITS.DISPLAY_COORDINATE_PRECISION),
      lng: roundCoord(lng, PARCELLE_LIMITS.DISPLAY_COORDINATE_PRECISION),
    };
  } catch {
    // Fallback to simple centroid
    const feature = turf.multiPolygon(geometry.coordinates);
    const centroid = turf.centroid(feature);
    const [lng, lat] = centroid.geometry.coordinates;
    return {
      lat: roundCoord(lat, PARCELLE_LIMITS.DISPLAY_COORDINATE_PRECISION),
      lng: roundCoord(lng, PARCELLE_LIMITS.DISPLAY_COORDINATE_PRECISION),
    };
  }
}

/**
 * Simplify geometry for map display at low zoom levels
 * Per Requirement 5.8: Use tolerance 0.001 for simplification
 * 
 * @param geometry - MultiPolygon geometry
 * @param tolerance - Simplification tolerance (default 0.001)
 * @returns Simplified MultiPolygon
 */
export function simplifyGeometry(
  geometry: MultiPolygon,
  tolerance: number = 0.001
): MultiPolygon {
  try {
    const feature = turf.multiPolygon(geometry.coordinates);
    const simplified = turf.simplify(feature, {
      tolerance,
      highQuality: true,
    });
    return simplified.geometry as MultiPolygon;
  } catch {
    return geometry;
  }
}

/**
 * Validate that a geometry has valid WGS84 coordinates
 * 
 * @param geometry - Geometry to validate
 * @returns Validation result with any out-of-bounds coordinates
 */
export function validateCoordinates(
  geometry: Polygon | MultiPolygon
): { valid: boolean; outOfBounds: Array<{ lng: number; lat: number }> } {
  const outOfBounds: Array<{ lng: number; lat: number }> = [];
  
  const checkPosition = (pos: Position) => {
    const [lng, lat] = pos;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      outOfBounds.push({ lng, lat });
    }
  };
  
  const checkRing = (ring: Position[]) => {
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
 * 
 * @param geometry - Geometry to check
 * @returns Detection result with sample coordinate if likely projected
 */
export function detectProjectedCoordinates(
  geometry: Polygon | MultiPolygon
): { likely: boolean; sampleCoord?: [number, number] } {
  const checkPosition = (pos: Position): [number, number] | null => {
    const [lng, lat] = pos;
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

/**
 * Attempt to fix an invalid geometry using Turf.js
 * Note: This is a client-side approximation; PostGIS ST_MakeValid is more robust
 * 
 * @param geometry - Geometry to fix
 * @returns Fixed geometry or null if unfixable
 */
export function tryFixGeometry(
  geometry: Polygon | MultiPolygon
): MultiPolygon | null {
  try {
    // Convert to feature for Turf operations
    const feature =
      geometry.type === 'Polygon'
        ? turf.polygon(geometry.coordinates)
        : turf.multiPolygon(geometry.coordinates);
    
    // Try to clean the geometry using buffer(0) trick
    const buffered = turf.buffer(feature, 0, { units: 'meters' });
    
    if (!buffered || !buffered.geometry) {
      return null;
    }
    
    // Normalize to MultiPolygon
    return normalizeToMultiPolygon(buffered.geometry as Polygon | MultiPolygon);
  } catch {
    return null;
  }
}

/**
 * Check if a geometry is valid
 * Uses Turf.js kinks detection for self-intersections
 * 
 * @param geometry - Geometry to validate
 * @returns true if valid, false otherwise
 */
export function isValidGeometry(geometry: Polygon | MultiPolygon): boolean {
  try {
    const feature =
      geometry.type === 'Polygon'
        ? turf.polygon(geometry.coordinates)
        : turf.multiPolygon(geometry.coordinates);
    
    // Check for self-intersections (kinks)
    const kinks = turf.kinks(feature as Feature<Polygon>);
    return kinks.features.length === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a geometry is empty (no coordinates)
 * 
 * @param geometry - Geometry to check
 * @returns true if empty, false otherwise
 */
export function isEmptyGeometry(geometry: Polygon | MultiPolygon): boolean {
  if (geometry.type === 'Polygon') {
    return (
      !geometry.coordinates ||
      geometry.coordinates.length === 0 ||
      geometry.coordinates[0].length === 0
    );
  }
  
  return (
    !geometry.coordinates ||
    geometry.coordinates.length === 0 ||
    geometry.coordinates.every(
      (poly) => !poly || poly.length === 0 || poly[0].length === 0
    )
  );
}

/**
 * Strip Z dimension from coordinates
 * Shapefiles can contain 3D coordinates (X, Y, Z) but PostGIS columns
 * may only accept 2D coordinates. This function recursively removes
 * the Z dimension from all coordinates.
 * 
 * @param geometry - MultiPolygon geometry that may have Z coordinates
 * @returns MultiPolygon with only 2D coordinates [lng, lat]
 */
export function stripZDimension(geometry: MultiPolygon): MultiPolygon {
  const strip2D = (pos: Position): Position => {
    // Keep only first 2 values (lng, lat), discard Z if present
    return [pos[0], pos[1]];
  };

  const stripRing = (ring: Position[]): Position[] => {
    return ring.map(strip2D);
  };

  const stripPolygon = (polygon: Position[][]): Position[][] => {
    return polygon.map(stripRing);
  };

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map(stripPolygon),
  };
}

/**
 * Zoom level threshold for geometry simplification
 * Per Requirement 5.8: FOR zoom levels <= 10, geometry is simplified
 */
export const SIMPLIFY_ZOOM_THRESHOLD = 10;

/**
 * Default simplification tolerance (in degrees)
 * Per Requirement 5.8: Use tolerance 0.001 (~111m at equator)
 */
export const DEFAULT_SIMPLIFY_TOLERANCE = 0.001;

/**
 * Calculate simplification tolerance based on zoom level
 * Higher zoom = less simplification (smaller tolerance)
 * Lower zoom = more simplification (larger tolerance)
 * 
 * Tolerance values (in degrees, approximate meters at equator):
 * - zoom <= 5:  0.01   (~1.1km)
 * - zoom 6-8:   0.005  (~550m)
 * - zoom 9-10:  0.001  (~111m) - default per Requirement 5.8
 * - zoom > 10:  no simplification (returns original geometry)
 * 
 * @param zoom - Map zoom level
 * @returns Tolerance value in degrees, or null if no simplification needed
 */
export function getToleranceForZoom(zoom: number): number | null {
  if (zoom > SIMPLIFY_ZOOM_THRESHOLD) {
    return null; // No simplification needed at high zoom
  }
  
  if (zoom <= 5) {
    return 0.01; // ~1.1km at equator
  }
  
  if (zoom <= 8) {
    return 0.005; // ~550m at equator
  }
  
  // zoom 9-10
  return DEFAULT_SIMPLIFY_TOLERANCE; // ~111m at equator
}

/**
 * Simplify geometry for map display based on zoom level
 * Per Requirement 5.8: FOR zoom levels <= 10, THE API SHALL return simplified geometry
 * 
 * Uses Turf.js simplify with topology preservation to reduce vertex count
 * while maintaining the overall shape of the polygon.
 * 
 * @param geometry - MultiPolygon geometry to simplify
 * @param zoom - Map zoom level (simplification applied when zoom <= 10)
 * @returns Simplified MultiPolygon, or original if zoom > 10 or simplification fails
 */
export function simplifyForZoom(
  geometry: MultiPolygon,
  zoom: number
): MultiPolygon {
  const tolerance = getToleranceForZoom(zoom);
  
  // No simplification needed at high zoom levels
  if (tolerance === null) {
    return geometry;
  }
  
  try {
    const feature = turf.multiPolygon(geometry.coordinates);
    const simplified = turf.simplify(feature, {
      tolerance,
      highQuality: true, // Use Douglas-Peucker algorithm for better results
    });
    
    // Ensure we still have a valid MultiPolygon
    if (
      simplified &&
      simplified.geometry &&
      simplified.geometry.type === 'MultiPolygon' &&
      simplified.geometry.coordinates.length > 0
    ) {
      return simplified.geometry as MultiPolygon;
    }
    
    // If simplification resulted in empty geometry, return original
    return geometry;
  } catch {
    // On error, return original geometry
    return geometry;
  }
}
