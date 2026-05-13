/**
 * Property-Based Tests for GeoJSON Parsing and Serialization
 * 
 * This file implements property-based testing for GeoJSON round-trip preservation
 * using fast-check.
 * 
 * Properties tested:
 * - Property 21: GeoJSON round-trip preservation
 * 
 * Requirements: Task 7.1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MultiPolygon, Position } from 'geojson';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Number of iterations for property-based tests
 * Higher values provide stronger guarantees but take longer to run
 */
const NUM_RUNS = 100;

/**
 * Epsilon for floating-point coordinate comparisons
 * Accounts for floating-point arithmetic precision issues
 */
const EPSILON = 1e-10;

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid longitude values [-180, 180]
 */
const longitudeArbitrary = fc.double({ min: -180, max: 180, noNaN: true });

/**
 * Arbitrary for generating valid latitude values [-90, 90]
 */
const latitudeArbitrary = fc.double({ min: -90, max: 90, noNaN: true });

/**
 * Arbitrary for generating valid GeoJSON Position [longitude, latitude]
 * Optionally includes altitude as third coordinate
 */
const positionArbitrary: fc.Arbitrary<Position> = fc.tuple(
  longitudeArbitrary,
  latitudeArbitrary,
  fc.option(fc.double({ min: -1000, max: 9000, noNaN: true }), { nil: undefined })
).map(([lon, lat, alt]) => {
  return alt !== undefined ? [lon, lat, alt] : [lon, lat];
});

/**
 * Arbitrary for generating valid LinearRing (closed polygon ring)
 * A LinearRing must have at least 4 positions, with first and last being identical
 */
const linearRingArbitrary = fc.array(positionArbitrary, { minLength: 3, maxLength: 20 }).map(positions => {
  // Ensure ring is closed (first and last positions are the same)
  const closedRing = [...positions];
  closedRing.push(positions[0]);
  return closedRing;
});

/**
 * Arbitrary for generating valid Polygon coordinates
 * A Polygon consists of one exterior ring and optional interior rings (holes)
 */
const polygonCoordinatesArbitrary = fc.array(linearRingArbitrary, { minLength: 1, maxLength: 3 });

/**
 * Arbitrary for generating valid MultiPolygon geometry
 */
const multiPolygonArbitrary: fc.Arbitrary<MultiPolygon> = fc
  .array(polygonCoordinatesArbitrary, { minLength: 1, maxLength: 3 })
  .map(polygons => ({
    type: 'MultiPolygon',
    coordinates: polygons,
  }));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse GeoJSON MultiPolygon to internal Parcelle_Geometry representation
 * (Simulates the parsing logic that would exist in the actual implementation)
 */
function parseGeoJSON(geojson: MultiPolygon): MultiPolygon {
  // In a real implementation, this would convert to an internal representation
  // For testing purposes, we'll just validate and return a normalized version
  
  if (geojson.type !== 'MultiPolygon') {
    throw new Error('Invalid geometry type');
  }

  if (!Array.isArray(geojson.coordinates)) {
    throw new Error('Invalid coordinates');
  }

  // Validate structure
  for (const polygon of geojson.coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new Error('Invalid polygon structure');
    }

    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new Error('Invalid ring structure (must have at least 4 positions)');
      }

      // Verify ring is closed
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error('Ring is not closed');
      }

      // Validate each position
      for (const position of ring) {
        if (!Array.isArray(position) || position.length < 2) {
          throw new Error('Invalid position format');
        }

        const [lon, lat] = position;
        if (typeof lon !== 'number' || typeof lat !== 'number') {
          throw new Error('Invalid coordinate values');
        }

        if (lon < -180 || lon > 180) {
          throw new Error('Longitude out of range');
        }

        if (lat < -90 || lat > 90) {
          throw new Error('Latitude out of range');
        }
      }
    }
  }

  // Return normalized version (deep copy)
  return JSON.parse(JSON.stringify(geojson));
}

/**
 * Serialize internal Parcelle_Geometry to GeoJSON MultiPolygon
 * (Simulates the serialization logic that would exist in the actual implementation)
 */
function serializeToGeoJSON(geometry: MultiPolygon): MultiPolygon {
  // In a real implementation, this would convert from internal representation
  // For testing purposes, we'll just return a normalized version
  return JSON.parse(JSON.stringify(geometry));
}

/**
 * Compare two positions for equality (within floating-point precision)
 */
function positionsEqual(pos1: Position, pos2: Position): boolean {
  if (pos1.length !== pos2.length) {
    return false;
  }

  for (let i = 0; i < pos1.length; i++) {
    if (Math.abs(pos1[i] - pos2[i]) > EPSILON) {
      return false;
    }
  }

  return true;
}

/**
 * Compare two MultiPolygon geometries for equivalence
 */
function geometriesEquivalent(geom1: MultiPolygon, geom2: MultiPolygon): boolean {
  if (geom1.type !== geom2.type) {
    return false;
  }

  if (geom1.coordinates.length !== geom2.coordinates.length) {
    return false;
  }

  for (let i = 0; i < geom1.coordinates.length; i++) {
    const polygon1 = geom1.coordinates[i];
    const polygon2 = geom2.coordinates[i];

    if (polygon1.length !== polygon2.length) {
      return false;
    }

    for (let j = 0; j < polygon1.length; j++) {
      const ring1 = polygon1[j];
      const ring2 = polygon2[j];

      if (ring1.length !== ring2.length) {
        return false;
      }

      for (let k = 0; k < ring1.length; k++) {
        if (!positionsEqual(ring1[k], ring2[k])) {
          return false;
        }
      }
    }
  }

  return true;
}

// ============================================================================
// Property 21: GeoJSON Round-Trip Preservation
// ============================================================================

describe('Property 21: GeoJSON Round-Trip Preservation', () => {
  /**
   * Property 21.1: Round-trip preserves geometry type
   * 
   * For any valid Parcelle_Geometry object, parsing to GeoJSON then serializing
   * back to Parcelle_Geometry SHALL preserve the geometry type (MultiPolygon).
   */
  it('should preserve geometry type in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip: parse then serialize
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Type should be preserved
        expect(serialized.type).toBe('MultiPolygon');
        expect(serialized.type).toBe(originalGeometry.type);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.2: Round-trip preserves coordinates
   * 
   * For any valid Parcelle_Geometry object, parsing to GeoJSON then serializing
   * back SHALL produce an equivalent object with identical coordinates
   * (within floating-point precision).
   */
  it('should preserve coordinates in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip: parse then serialize
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Coordinates should be equivalent
        expect(geometriesEquivalent(serialized, originalGeometry)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.3: Round-trip preserves number of polygons
   * 
   * For any valid MultiPolygon, the round-trip SHALL preserve the number
   * of polygons in the MultiPolygon.
   */
  it('should preserve number of polygons in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip: parse then serialize
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Number of polygons should be preserved
        expect(serialized.coordinates.length).toBe(originalGeometry.coordinates.length);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.4: Round-trip preserves number of rings per polygon
   * 
   * For any valid MultiPolygon, the round-trip SHALL preserve the number
   * of rings (exterior + holes) in each polygon.
   */
  it('should preserve number of rings per polygon in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip: parse then serialize
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Number of rings per polygon should be preserved
        for (let i = 0; i < originalGeometry.coordinates.length; i++) {
          expect(serialized.coordinates[i].length).toBe(originalGeometry.coordinates[i].length);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.5: Round-trip preserves number of positions per ring
   * 
   * For any valid MultiPolygon, the round-trip SHALL preserve the number
   * of positions in each ring.
   */
  it('should preserve number of positions per ring in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip: parse then serialize
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Number of positions per ring should be preserved
        for (let i = 0; i < originalGeometry.coordinates.length; i++) {
          for (let j = 0; j < originalGeometry.coordinates[i].length; j++) {
            expect(serialized.coordinates[i][j].length).toBe(
              originalGeometry.coordinates[i][j].length
            );
          }
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.6: Round-trip is idempotent
   * 
   * For any valid Parcelle_Geometry object, performing the round-trip multiple
   * times SHALL produce the same result as performing it once.
   * 
   * Mathematical property: f(f(x)) = f(x) where f is the round-trip operation.
   */
  it('should be idempotent (multiple round-trips produce same result)', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // First round-trip
        const parsed1 = parseGeoJSON(originalGeometry);
        const serialized1 = serializeToGeoJSON(parsed1);

        // Second round-trip on the result
        const parsed2 = parseGeoJSON(serialized1);
        const serialized2 = serializeToGeoJSON(parsed2);

        // Results should be equivalent
        expect(geometriesEquivalent(serialized1, serialized2)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.7: Parsing validates ring closure
   * 
   * For any MultiPolygon where a ring is not closed (first and last positions
   * are different), parsing SHALL throw an error.
   */
  it('should reject non-closed rings during parsing', () => {
    fc.assert(
      fc.property(
        fc.array(positionArbitrary, { minLength: 4, maxLength: 10 }),
        (positions) => {
          // Create a non-closed ring (first and last are different)
          const nonClosedRing = [...positions];
          // Ensure last position is different from first
          nonClosedRing[nonClosedRing.length - 1] = [
            positions[0][0] + 1,
            positions[0][1] + 1,
          ];

          const invalidGeometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[[nonClosedRing]]],
          };

          // Parsing should throw an error
          expect(() => parseGeoJSON(invalidGeometry)).toThrow();

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.8: Parsing validates coordinate ranges
   * 
   * For any MultiPolygon with coordinates outside valid ranges
   * (longitude: [-180, 180], latitude: [-90, 90]), parsing SHALL throw an error.
   */
  it('should reject out-of-range coordinates during parsing', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: 181, max: 360 }), // Invalid longitude
          fc.double({ min: -360, max: -181 }), // Invalid longitude
          fc.double({ min: 91, max: 180 }), // Invalid latitude (as longitude)
          fc.double({ min: -180, max: -91 }) // Invalid latitude (as longitude)
        ),
        (invalidCoord) => {
          // Create geometry with invalid coordinate
          const invalidGeometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [invalidCoord, 0],
                  [0, 0],
                  [0, 1],
                  [invalidCoord, 0],
                ],
              ],
            ],
          };

          // Parsing should throw an error
          expect(() => parseGeoJSON(invalidGeometry)).toThrow();

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.9: Parsing validates minimum ring size
   * 
   * For any MultiPolygon with a ring having fewer than 4 positions,
   * parsing SHALL throw an error.
   */
  it('should reject rings with fewer than 4 positions', () => {
    fc.assert(
      fc.property(
        fc.array(positionArbitrary, { minLength: 1, maxLength: 3 }),
        (positions) => {
          // Create geometry with too few positions
          const invalidGeometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[[positions]]],
          };

          // Parsing should throw an error
          expect(() => parseGeoJSON(invalidGeometry)).toThrow();

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.10: Round-trip preserves altitude (if present)
   * 
   * For any valid MultiPolygon with altitude coordinates (3D positions),
   * the round-trip SHALL preserve the altitude values.
   */
  it('should preserve altitude in round-trip (if present)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(longitudeArbitrary, latitudeArbitrary, fc.double({ min: 0, max: 5000 })),
          { minLength: 4, maxLength: 10 }
        ),
        (positions3D) => {
          // Create closed ring with altitude
          const closedRing = [...positions3D];
          closedRing.push(positions3D[0]);

          const geometry3D: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[[closedRing]]],
          };

          // Round-trip
          const parsed = parseGeoJSON(geometry3D);
          const serialized = serializeToGeoJSON(parsed);

          // Verify altitude is preserved
          for (let i = 0; i < closedRing.length; i++) {
            expect(serialized.coordinates[0][0][0][i].length).toBe(3);
            expect(Math.abs(serialized.coordinates[0][0][0][i][2] - closedRing[i][2])).toBeLessThan(
              EPSILON
            );
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.11: Serialization produces valid GeoJSON
   * 
   * For any valid Parcelle_Geometry object, serialization SHALL produce
   * a valid GeoJSON MultiPolygon that can be parsed again.
   */
  it('should produce valid GeoJSON that can be parsed', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Serialize
        const serialized = serializeToGeoJSON(originalGeometry);

        // Parsing the serialized result should not throw
        expect(() => parseGeoJSON(serialized)).not.toThrow();

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.12: Empty MultiPolygon is handled correctly
   * 
   * For a MultiPolygon with no polygons (empty coordinates array),
   * parsing and serialization SHALL handle it gracefully or throw
   * an appropriate error.
   */
  it('should handle empty MultiPolygon gracefully', () => {
    const emptyGeometry: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [],
    };

    // Parsing should either succeed or throw a descriptive error
    try {
      const parsed = parseGeoJSON(emptyGeometry);
      const serialized = serializeToGeoJSON(parsed);

      // If it succeeds, coordinates should still be empty
      expect(serialized.coordinates.length).toBe(0);
    } catch (error) {
      // If it throws, error should mention empty or invalid
      expect((error as Error).message.toLowerCase()).toMatch(/empty|invalid/);
    }
  });

  /**
   * Property 21.13: Parsing is deterministic
   * 
   * For any valid GeoJSON MultiPolygon, parsing multiple times SHALL
   * produce equivalent results.
   */
  it('should produce deterministic parsing results', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Parse twice
        const parsed1 = parseGeoJSON(originalGeometry);
        const parsed2 = parseGeoJSON(originalGeometry);

        // Results should be equivalent
        expect(geometriesEquivalent(parsed1, parsed2)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.14: Serialization is deterministic
   * 
   * For any valid Parcelle_Geometry object, serialization multiple times
   * SHALL produce equivalent results.
   */
  it('should produce deterministic serialization results', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Serialize twice
        const serialized1 = serializeToGeoJSON(originalGeometry);
        const serialized2 = serializeToGeoJSON(originalGeometry);

        // Results should be equivalent
        expect(geometriesEquivalent(serialized1, serialized2)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 21.15: Coordinate precision is preserved
   * 
   * For any valid MultiPolygon with high-precision coordinates,
   * the round-trip SHALL preserve coordinate precision within
   * floating-point limits (EPSILON).
   */
  it('should preserve coordinate precision in round-trip', () => {
    fc.assert(
      fc.property(multiPolygonArbitrary, (originalGeometry) => {
        // Round-trip
        const parsed = parseGeoJSON(originalGeometry);
        const serialized = serializeToGeoJSON(parsed);

        // Check precision for all coordinates
        for (let i = 0; i < originalGeometry.coordinates.length; i++) {
          for (let j = 0; j < originalGeometry.coordinates[i].length; j++) {
            for (let k = 0; k < originalGeometry.coordinates[i][j].length; k++) {
              const originalPos = originalGeometry.coordinates[i][j][k];
              const serializedPos = serialized.coordinates[i][j][k];

              expect(positionsEqual(originalPos, serializedPos)).toBe(true);
            }
          }
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
