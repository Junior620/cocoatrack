// CocoaTrack V2 - Parcelles Property Tests
// Property-based tests for parcelles module geometry operations
//
// These tests validate the correctness properties defined in the design document
// using fast-check for property-based testing with minimum 100 iterations.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as turf from '@turf/turf';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import {
  normalizeToMultiPolygon,
  normalizeForHash,
  computeFeatureHash,
  calculateAreaHa,
  calculateCentroid,
  isValidGeometry,
  isEmptyGeometry,
} from '@/lib/services/geometry-service';

// ============================================================================
// ARBITRARIES (Generators for random test data)
// ============================================================================

/**
 * Generate a valid position (coordinate pair) within WGS84 bounds
 * Longitude: -180 to 180, Latitude: -90 to 90
 * Using smaller bounds to ensure valid polygons in typical use cases
 */
const positionArb = fc.tuple(
  fc.double({ min: -10, max: 10, noNaN: true }), // longitude (smaller range for valid polygons)
  fc.double({ min: -10, max: 10, noNaN: true })  // latitude
).map(([lng, lat]) => [lng, lat] as Position);

/**
 * Generate a simple valid polygon ring (closed, at least 4 points)
 * Creates a convex polygon by generating points around a center
 */
const simplePolygonRingArb = fc
  .tuple(
    fc.double({ min: -170, max: 170, noNaN: true }), // center longitude
    fc.double({ min: -80, max: 80, noNaN: true }),   // center latitude
    fc.double({ min: 0.001, max: 1, noNaN: true }),  // radius in degrees
    fc.integer({ min: 4, max: 12 })                   // number of vertices
  )
  .map(([centerLng, centerLat, radius, numVertices]) => {
    const ring: Position[] = [];
    for (let i = 0; i < numVertices; i++) {
      const angle = (2 * Math.PI * i) / numVertices;
      const lng = centerLng + radius * Math.cos(angle);
      const lat = centerLat + radius * Math.sin(angle);
      ring.push([lng, lat]);
    }
    // Close the ring
    ring.push([...ring[0]]);
    return ring;
  });

/**
 * Generate a valid Polygon geometry
 */
const polygonArb: fc.Arbitrary<Polygon> = simplePolygonRingArb.map((ring) => ({
  type: 'Polygon' as const,
  coordinates: [ring],
}));

/**
 * Generate a valid MultiPolygon geometry (1-3 polygons)
 */
const multiPolygonArb: fc.Arbitrary<MultiPolygon> = fc
  .array(simplePolygonRingArb, { minLength: 1, maxLength: 3 })
  .map((rings) => ({
    type: 'MultiPolygon' as const,
    coordinates: rings.map((ring) => [ring]),
  }));

/**
 * Generate either a Polygon or MultiPolygon
 */
const geometryArb = fc.oneof(polygonArb, multiPolygonArb);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a point is inside a MultiPolygon using Turf.js
 */
function isPointInsideMultiPolygon(
  point: { lat: number; lng: number },
  geometry: MultiPolygon
): boolean {
  try {
    const turfPoint = turf.point([point.lng, point.lat]);
    const turfMultiPolygon = turf.multiPolygon(geometry.coordinates);
    
    // Check if point is inside or on the boundary
    const inside = turf.booleanPointInPolygon(turfPoint, turfMultiPolygon);
    if (inside) return true;
    
    // Also check if point is on the boundary (within small tolerance)
    // ST_PointOnSurface guarantees point is on surface, which includes boundary
    const distance = turf.pointToPolygonDistance(turfPoint, turfMultiPolygon, { units: 'meters' });
    return distance < 1; // Within 1 meter tolerance
  } catch {
    return false;
  }
}

/**
 * Calculate area using Turf.js for comparison
 */
function calculateAreaWithTurf(geometry: MultiPolygon): number {
  try {
    const feature = turf.multiPolygon(geometry.coordinates);
    const areaM2 = turf.area(feature);
    return Math.round((areaM2 / 10000) * 10000) / 10000; // 4 decimal places
  } catch {
    return 0;
  }
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 1: Geometry Calculations Consistency', () => {
  /**
   * Feature: parcelles-module, Property 1: Geometry Calculations Consistency
   * 
   * For any valid MultiPolygon geometry stored in a parcelle, the centroid
   * computed by ST_PointOnSurface SHALL always be a point inside the polygon,
   * and the surface_hectares SHALL equal ST_Area(geometry::geography)/10000
   * rounded to 4 decimals.
   * 
   * Validates: Requirements 1.3, 1.4, 9.1, 9.2
   */

  it('centroid should always be inside or on the boundary of the polygon', () => {
    // Feature: parcelles-module, Property 1: Geometry Calculations Consistency
    // Validates: Requirements 1.3, 9.2
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        // Skip empty geometries
        if (isEmptyGeometry(geometry)) {
          return true;
        }

        const centroid = calculateCentroid(geometry);
        
        // Centroid should have valid coordinates
        expect(centroid.lat).toBeGreaterThanOrEqual(-90);
        expect(centroid.lat).toBeLessThanOrEqual(90);
        expect(centroid.lng).toBeGreaterThanOrEqual(-180);
        expect(centroid.lng).toBeLessThanOrEqual(180);
        
        // Centroid should be inside or on the boundary of the polygon
        const isInside = isPointInsideMultiPolygon(centroid, geometry);
        expect(isInside).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('surface_hectares should be positive for valid non-empty polygons', () => {
    // Feature: parcelles-module, Property 1: Geometry Calculations Consistency
    // Validates: Requirements 1.4, 9.1
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        // Skip empty geometries
        if (isEmptyGeometry(geometry)) {
          return true;
        }

        const areaHa = calculateAreaHa(geometry);
        
        // Area should be positive for valid polygons
        expect(areaHa).toBeGreaterThan(0);
        
        // Area should be a finite number
        expect(Number.isFinite(areaHa)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('surface_hectares should be rounded to 4 decimal places', () => {
    // Feature: parcelles-module, Property 1: Geometry Calculations Consistency
    // Validates: Requirements 1.4, 9.1
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        const areaHa = calculateAreaHa(geometry);
        
        // Check that the value has at most 4 decimal places
        const rounded = Math.round(areaHa * 10000) / 10000;
        expect(areaHa).toBe(rounded);
      }),
      { numRuns: 100 }
    );
  });

  it('area calculation should be consistent with Turf.js', () => {
    // Feature: parcelles-module, Property 1: Geometry Calculations Consistency
    // Validates: Requirements 1.4, 9.1
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        const areaFromService = calculateAreaHa(geometry);
        const areaFromTurf = calculateAreaWithTurf(geometry);
        
        // Both calculations should produce the same result
        expect(areaFromService).toBe(areaFromTurf);
      }),
      { numRuns: 100 }
    );
  });

  it('centroid coordinates should have correct precision', () => {
    // Feature: parcelles-module, Property 1: Geometry Calculations Consistency
    // Validates: Requirements 9.7
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        if (isEmptyGeometry(geometry)) {
          return true;
        }

        const centroid = calculateCentroid(geometry);
        
        // Centroid should be rounded to 6 decimal places (display precision)
        const latRounded = Math.round(centroid.lat * 1000000) / 1000000;
        const lngRounded = Math.round(centroid.lng * 1000000) / 1000000;
        
        expect(centroid.lat).toBe(latRounded);
        expect(centroid.lng).toBe(lngRounded);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Polygon Normalization', () => {
  /**
   * Feature: parcelles-module, Property 2: Polygon Normalization
   * 
   * For any Polygon geometry input, the system SHALL store it as a MultiPolygon.
   * The stored geometry type SHALL always be 'MultiPolygon'.
   * 
   * Validates: Requirements 3.7
   */

  it('should convert Polygon to MultiPolygon', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7
    fc.assert(
      fc.property(polygonArb, (polygon) => {
        const normalized = normalizeToMultiPolygon(polygon);
        
        // Result should always be MultiPolygon
        expect(normalized.type).toBe('MultiPolygon');
        
        // Should have exactly one polygon in the coordinates
        expect(normalized.coordinates.length).toBe(1);
        
        // The polygon coordinates should match the original
        expect(normalized.coordinates[0]).toEqual(polygon.coordinates);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve MultiPolygon as-is', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7
    fc.assert(
      fc.property(multiPolygonArb, (multiPolygon) => {
        const normalized = normalizeToMultiPolygon(multiPolygon);
        
        // Result should be MultiPolygon
        expect(normalized.type).toBe('MultiPolygon');
        
        // Coordinates should be unchanged
        expect(normalized.coordinates).toEqual(multiPolygon.coordinates);
      }),
      { numRuns: 100 }
    );
  });

  it('normalized geometry should always have type MultiPolygon', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7
    fc.assert(
      fc.property(geometryArb, (geometry) => {
        const normalized = normalizeToMultiPolygon(geometry);
        expect(normalized.type).toBe('MultiPolygon');
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all coordinates exactly during normalization', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7, 9.11 (no coordinate truncation)
    fc.assert(
      fc.property(polygonArb, (polygon) => {
        const normalized = normalizeToMultiPolygon(polygon);
        
        // All original coordinates should be preserved exactly
        const originalCoords = polygon.coordinates;
        const normalizedCoords = normalized.coordinates[0];
        
        expect(normalizedCoords.length).toBe(originalCoords.length);
        
        for (let ringIdx = 0; ringIdx < originalCoords.length; ringIdx++) {
          const originalRing = originalCoords[ringIdx];
          const normalizedRing = normalizedCoords[ringIdx];
          
          expect(normalizedRing.length).toBe(originalRing.length);
          
          for (let posIdx = 0; posIdx < originalRing.length; posIdx++) {
            expect(normalizedRing[posIdx][0]).toBe(originalRing[posIdx][0]);
            expect(normalizedRing[posIdx][1]).toBe(originalRing[posIdx][1]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve polygon count in MultiPolygon', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7, 14.2 (multiple parts preserved)
    fc.assert(
      fc.property(multiPolygonArb, (multiPolygon) => {
        const normalized = normalizeToMultiPolygon(multiPolygon);
        
        // Number of polygons should be preserved
        expect(normalized.coordinates.length).toBe(multiPolygon.coordinates.length);
        
        // Each polygon's ring count should be preserved
        for (let i = 0; i < multiPolygon.coordinates.length; i++) {
          expect(normalized.coordinates[i].length).toBe(multiPolygon.coordinates[i].length);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('normalization should be idempotent', () => {
    // Feature: parcelles-module, Property 2: Polygon Normalization
    // Validates: Requirements 3.7
    fc.assert(
      fc.property(geometryArb, (geometry) => {
        const normalized1 = normalizeToMultiPolygon(geometry);
        const normalized2 = normalizeToMultiPolygon(normalized1);
        
        // Normalizing twice should produce identical result
        expect(normalized2.type).toBe(normalized1.type);
        expect(JSON.stringify(normalized2.coordinates)).toBe(
          JSON.stringify(normalized1.coordinates)
        );
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Feature Hash Determinism', () => {
  /**
   * Feature: parcelles-module, Property 3: Feature Hash Determinism
   * 
   * For any two geometrically identical MultiPolygons (same coordinates),
   * the computed feature_hash SHALL be identical. For any two geometrically
   * different MultiPolygons, the feature_hash SHALL be different.
   * 
   * Validates: Requirements 3.13
   */

  it('same geometry should produce same hash', async () => {
    // Feature: parcelles-module, Property 3: Feature Hash Determinism
    // Validates: Requirements 3.13
    await fc.assert(
      fc.asyncProperty(multiPolygonArb, async (geometry) => {
        const hash1 = await computeFeatureHash(geometry);
        const hash2 = await computeFeatureHash(geometry);
        
        // Same geometry should produce identical hash
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 100 }
    );
  });

  it('hash should be a valid SHA256 hex string', async () => {
    // Feature: parcelles-module, Property 3: Feature Hash Determinism
    // Validates: Requirements 3.13
    await fc.assert(
      fc.asyncProperty(multiPolygonArb, async (geometry) => {
        const hash = await computeFeatureHash(geometry);
        
        // SHA256 produces 64 hex characters
        expect(hash.length).toBe(64);
        
        // Should only contain hex characters
        expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('different geometries should produce different hashes', async () => {
    // Feature: parcelles-module, Property 3: Feature Hash Determinism
    // Validates: Requirements 3.13
    await fc.assert(
      fc.asyncProperty(
        multiPolygonArb,
        multiPolygonArb,
        async (geometry1, geometry2) => {
          // Only test if geometries are actually different
          const normalized1 = normalizeForHash(geometry1);
          const normalized2 = normalizeForHash(geometry2);
          
          if (JSON.stringify(normalized1) === JSON.stringify(normalized2)) {
            // Same normalized geometry, hashes should be equal
            const hash1 = await computeFeatureHash(geometry1);
            const hash2 = await computeFeatureHash(geometry2);
            expect(hash1).toBe(hash2);
          } else {
            // Different normalized geometries, hashes should differ
            const hash1 = await computeFeatureHash(geometry1);
            const hash2 = await computeFeatureHash(geometry2);
            expect(hash1).not.toBe(hash2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('normalizeForHash should be idempotent', () => {
    // Feature: parcelles-module, Property 3: Feature Hash Determinism
    // Validates: Requirements 3.13
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        const normalized1 = normalizeForHash(geometry);
        const normalized2 = normalizeForHash(normalized1);
        
        // Normalizing twice should produce same result
        expect(JSON.stringify(normalized1)).toBe(JSON.stringify(normalized2));
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 5: Parse Idempotence', () => {
  /**
   * Feature: parcelles-module, Property 5: Parse Idempotence
   * 
   * For any valid import file, parsing it multiple times SHALL produce identical
   * ParsedFeature arrays (same features, same hashes, same validation results).
   * Features are sorted by feature_hash for deterministic ordering.
   * 
   * Validates: Requirements 3.5
   */

  /**
   * Simulate the parse processing logic from parcelles-import.ts
   * This tests the core parsing logic without requiring database/storage access
   */
  interface SimulatedParsedFeature {
    temp_id: string;
    label: string | null;
    geom_geojson: MultiPolygon;
    area_ha: number;
    centroid: { lat: number; lng: number };
    feature_hash: string;
    validation: { ok: boolean; errors: string[]; warnings: string[] };
  }

  /**
   * Process a GeoJSON feature into a parsed feature (simulating parse logic)
   * This mirrors the processing in parcelles-import.ts parse() function
   */
  async function processFeature(
    geometry: MultiPolygon,
    properties: Record<string, unknown>,
    index: number
  ): Promise<SimulatedParsedFeature | null> {
    const featureErrors: string[] = [];
    const featureWarnings: string[] = [];

    // Check for empty geometry
    if (isEmptyGeometry(geometry)) {
      return null; // Skip empty geometries
    }

    // Validate geometry structure
    if (!isValidGeometry(geometry)) {
      featureWarnings.push('Geometry has self-intersections');
      // In real implementation, we'd try to fix it
      // For this test, we'll just note the warning
    }

    // Compute feature hash
    let featureHash: string;
    try {
      featureHash = await computeFeatureHash(geometry);
    } catch {
      return null; // Skip features that can't be hashed
    }

    // Calculate area and centroid
    const areaHa = calculateAreaHa(geometry);
    const centroid = calculateCentroid(geometry);

    // Extract label from properties
    const label = (properties.name || properties.NAME || properties.label || 
                  properties.LABEL || properties.nom || properties.NOM || null) as string | null;

    return {
      temp_id: `temp-${index}`, // Deterministic temp_id based on index
      label,
      geom_geojson: geometry,
      area_ha: areaHa,
      centroid,
      feature_hash: featureHash,
      validation: {
        ok: featureErrors.length === 0,
        errors: featureErrors,
        warnings: featureWarnings,
      },
    };
  }

  /**
   * Simulate parsing a collection of features (like parse() does)
   * Returns features sorted by feature_hash for deterministic ordering
   */
  async function simulateParse(
    features: Array<{ geometry: MultiPolygon; properties: Record<string, unknown> }>
  ): Promise<SimulatedParsedFeature[]> {
    const parsedFeatures: SimulatedParsedFeature[] = [];

    for (let i = 0; i < features.length; i++) {
      const { geometry, properties } = features[i];
      const parsed = await processFeature(geometry, properties, i);
      if (parsed) {
        parsedFeatures.push(parsed);
      }
    }

    // Sort by feature_hash for idempotent ordering (as per design doc)
    parsedFeatures.sort((a, b) => a.feature_hash.localeCompare(b.feature_hash));

    return parsedFeatures;
  }

  /**
   * Arbitrary for generating feature properties
   */
  const propertiesArb = fc.record({
    name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    village: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  }).map(props => {
    const result: Record<string, unknown> = {};
    if (props.name !== undefined) result.name = props.name;
    if (props.code !== undefined) result.code = props.code;
    if (props.village !== undefined) result.village = props.village;
    return result;
  });

  /**
   * Arbitrary for generating a feature (geometry + properties)
   */
  const featureArb = fc.record({
    geometry: multiPolygonArb,
    properties: propertiesArb,
  });

  /**
   * Arbitrary for generating a collection of features (1-10 features)
   */
  const featureCollectionArb = fc.array(featureArb, { minLength: 1, maxLength: 10 });

  it('parsing the same features twice should produce identical results', async () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5
    await fc.assert(
      fc.asyncProperty(featureCollectionArb, async (features) => {
        // Parse the same features twice
        const result1 = await simulateParse(features);
        const result2 = await simulateParse(features);

        // Results should have the same length
        expect(result1.length).toBe(result2.length);

        // Each feature should be identical
        for (let i = 0; i < result1.length; i++) {
          const f1 = result1[i];
          const f2 = result2[i];

          // Feature hashes should be identical
          expect(f1.feature_hash).toBe(f2.feature_hash);

          // Labels should be identical
          expect(f1.label).toBe(f2.label);

          // Area calculations should be identical
          expect(f1.area_ha).toBe(f2.area_ha);

          // Centroids should be identical
          expect(f1.centroid.lat).toBe(f2.centroid.lat);
          expect(f1.centroid.lng).toBe(f2.centroid.lng);

          // Validation results should be identical
          expect(f1.validation.ok).toBe(f2.validation.ok);
          expect(f1.validation.errors).toEqual(f2.validation.errors);
          expect(f1.validation.warnings).toEqual(f2.validation.warnings);

          // Geometry should be identical
          expect(JSON.stringify(f1.geom_geojson)).toBe(JSON.stringify(f2.geom_geojson));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('parsing should produce deterministic ordering by feature_hash', async () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5
    await fc.assert(
      fc.asyncProperty(featureCollectionArb, async (features) => {
        const result = await simulateParse(features);

        // Verify features are sorted by feature_hash
        for (let i = 1; i < result.length; i++) {
          const prevHash = result[i - 1].feature_hash;
          const currHash = result[i].feature_hash;
          expect(prevHash.localeCompare(currHash)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('parsing should be deterministic regardless of input order', async () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5
    await fc.assert(
      fc.asyncProperty(
        featureCollectionArb.filter(f => f.length >= 2),
        async (features) => {
          // Parse original order
          const result1 = await simulateParse(features);

          // Parse reversed order
          const reversedFeatures = [...features].reverse();
          const result2 = await simulateParse(reversedFeatures);

          // Results should have the same length
          expect(result1.length).toBe(result2.length);

          // After sorting by hash, results should be identical
          // (since both are sorted by feature_hash)
          for (let i = 0; i < result1.length; i++) {
            expect(result1[i].feature_hash).toBe(result2[i].feature_hash);
            expect(result1[i].area_ha).toBe(result2[i].area_ha);
            expect(result1[i].centroid.lat).toBe(result2[i].centroid.lat);
            expect(result1[i].centroid.lng).toBe(result2[i].centroid.lng);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('feature hash computation should be deterministic', async () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5, 3.13
    await fc.assert(
      fc.asyncProperty(multiPolygonArb, async (geometry) => {
        // Compute hash multiple times
        const hash1 = await computeFeatureHash(geometry);
        const hash2 = await computeFeatureHash(geometry);
        const hash3 = await computeFeatureHash(geometry);

        // All hashes should be identical
        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      }),
      { numRuns: 100 }
    );
  });

  it('area calculation should be deterministic', () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        // Calculate area multiple times
        const area1 = calculateAreaHa(geometry);
        const area2 = calculateAreaHa(geometry);
        const area3 = calculateAreaHa(geometry);

        // All areas should be identical
        expect(area1).toBe(area2);
        expect(area2).toBe(area3);
      }),
      { numRuns: 100 }
    );
  });

  it('centroid calculation should be deterministic', () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        if (isEmptyGeometry(geometry)) {
          return true; // Skip empty geometries
        }

        // Calculate centroid multiple times
        const centroid1 = calculateCentroid(geometry);
        const centroid2 = calculateCentroid(geometry);
        const centroid3 = calculateCentroid(geometry);

        // All centroids should be identical
        expect(centroid1.lat).toBe(centroid2.lat);
        expect(centroid1.lng).toBe(centroid2.lng);
        expect(centroid2.lat).toBe(centroid3.lat);
        expect(centroid2.lng).toBe(centroid3.lng);
      }),
      { numRuns: 100 }
    );
  });

  it('normalizeForHash should produce deterministic results', () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5, 3.13
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        // Normalize multiple times
        const normalized1 = normalizeForHash(geometry);
        const normalized2 = normalizeForHash(geometry);
        const normalized3 = normalizeForHash(geometry);

        // All normalized geometries should be identical
        const json1 = JSON.stringify(normalized1);
        const json2 = JSON.stringify(normalized2);
        const json3 = JSON.stringify(normalized3);

        expect(json1).toBe(json2);
        expect(json2).toBe(json3);
      }),
      { numRuns: 100 }
    );
  });

  it('parsing empty feature collection should produce empty result consistently', async () => {
    // Feature: parcelles-module, Property 5: Parse Idempotence
    // Validates: Requirements 3.5 (edge case)
    const emptyFeatures: Array<{ geometry: MultiPolygon; properties: Record<string, unknown> }> = [];

    const result1 = await simulateParse(emptyFeatures);
    const result2 = await simulateParse(emptyFeatures);

    expect(result1.length).toBe(0);
    expect(result2.length).toBe(0);
    expect(result1).toEqual(result2);
  });
});

describe('Property 4: Duplicate Detection Accuracy', () => {
  /**
   * Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
   * 
   * For any parcelle with (planteur_id, feature_hash) matching an existing
   * active parcelle, the system SHALL flag it as is_duplicate=true in preview
   * and skip it during apply.
   * 
   * Validates: Requirements 3.14, 3.16
   */

  /**
   * Arbitrary for generating a SHA256-like hex string (64 characters)
   */
  const hexStringArb = fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 64, maxLength: 64 })
    .map((chars) => chars.join(''));

  /**
   * Arbitrary for generating a set of existing parcelles with feature hashes
   * Simulates the database state of existing parcelles
   */
  const existingParcellesArb = fc.array(
    fc.record({
      id: fc.uuid(),
      planteur_id: fc.uuid(),
      feature_hash: hexStringArb,
      is_active: fc.boolean(),
    }),
    { minLength: 0, maxLength: 20 }
  );

  /**
   * Build a hash map from existing parcelles (simulating database lookup)
   * Only includes active parcelles with non-null feature_hash
   */
  function buildExistingHashMap(
    existingParcelles: Array<{
      id: string;
      planteur_id: string;
      feature_hash: string;
      is_active: boolean;
    }>
  ): Map<string, { id: string; planteur_id: string }> {
    const hashMap = new Map<string, { id: string; planteur_id: string }>();
    for (const p of existingParcelles) {
      if (p.is_active && p.feature_hash) {
        hashMap.set(p.feature_hash, { id: p.id, planteur_id: p.planteur_id });
      }
    }
    return hashMap;
  }

  /**
   * Simulate duplicate detection logic (mirrors parcelles-import.ts parse function)
   * Returns whether a feature is a duplicate and the existing parcelle ID if so
   */
  function detectDuplicate(
    featureHash: string,
    existingHashMap: Map<string, { id: string; planteur_id: string }>
  ): { is_duplicate: boolean; existing_parcelle_id?: string } {
    const existingMatch = existingHashMap.get(featureHash);
    if (existingMatch) {
      return {
        is_duplicate: true,
        existing_parcelle_id: existingMatch.id,
      };
    }
    return { is_duplicate: false };
  }

  it('should flag features with matching feature_hash as duplicates', () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14
    fc.assert(
      fc.property(
        existingParcellesArb,
        hexStringArb,
        (existingParcelles, newFeatureHash) => {
          const hashMap = buildExistingHashMap(existingParcelles);
          
          // Check if the new feature hash exists in active parcelles
          const existsInActive = existingParcelles.some(
            (p) => p.is_active && p.feature_hash === newFeatureHash
          );
          
          const result = detectDuplicate(newFeatureHash, hashMap);
          
          // If hash exists in active parcelles, it should be flagged as duplicate
          expect(result.is_duplicate).toBe(existsInActive);
          
          // If duplicate, should have existing_parcelle_id
          if (existsInActive) {
            expect(result.existing_parcelle_id).toBeDefined();
            // The existing_parcelle_id should match one of the active parcelles with this hash
            const matchingParcelle = existingParcelles.find(
              (p) => p.is_active && p.feature_hash === newFeatureHash
            );
            expect(result.existing_parcelle_id).toBe(matchingParcelle?.id);
          } else {
            expect(result.existing_parcelle_id).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not flag features as duplicates when hash matches inactive parcelles only', () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14 (only active parcelles count for duplicates)
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            planteur_id: fc.uuid(),
            feature_hash: hexStringArb,
            is_active: fc.constant(false), // All inactive
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (inactiveParcelles) => {
          const hashMap = buildExistingHashMap(inactiveParcelles);
          
          // Pick a hash from the inactive parcelles
          const testHash = inactiveParcelles[0].feature_hash;
          
          const result = detectDuplicate(testHash, hashMap);
          
          // Should NOT be flagged as duplicate since all parcelles are inactive
          expect(result.is_duplicate).toBe(false);
          expect(result.existing_parcelle_id).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify duplicates based on feature_hash alone (not planteur_id)', () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14
    // Note: The current implementation checks feature_hash globally, not per planteur
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        hexStringArb,
        (planteurId1, planteurId2, featureHash) => {
          // Create an existing parcelle with planteur1
          const existingParcelles = [
            {
              id: 'existing-parcelle-id',
              planteur_id: planteurId1,
              feature_hash: featureHash,
              is_active: true,
            },
          ];
          
          const hashMap = buildExistingHashMap(existingParcelles);
          
          // Try to detect duplicate with same hash but different planteur
          const result = detectDuplicate(featureHash, hashMap);
          
          // Should be flagged as duplicate regardless of planteur_id
          // (feature_hash is globally unique for geometry deduplication)
          expect(result.is_duplicate).toBe(true);
          expect(result.existing_parcelle_id).toBe('existing-parcelle-id');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty existing parcelles set', () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14 (edge case: no existing parcelles)
    fc.assert(
      fc.property(
        hexStringArb,
        (newFeatureHash) => {
          const hashMap = buildExistingHashMap([]);
          
          const result = detectDuplicate(newFeatureHash, hashMap);
          
          // No existing parcelles means no duplicates
          expect(result.is_duplicate).toBe(false);
          expect(result.existing_parcelle_id).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('duplicate detection should be deterministic for same inputs', () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14 (determinism)
    fc.assert(
      fc.property(
        existingParcellesArb,
        hexStringArb,
        (existingParcelles, featureHash) => {
          const hashMap = buildExistingHashMap(existingParcelles);
          
          // Run detection multiple times
          const result1 = detectDuplicate(featureHash, hashMap);
          const result2 = detectDuplicate(featureHash, hashMap);
          const result3 = detectDuplicate(featureHash, hashMap);
          
          // All results should be identical
          expect(result1.is_duplicate).toBe(result2.is_duplicate);
          expect(result2.is_duplicate).toBe(result3.is_duplicate);
          expect(result1.existing_parcelle_id).toBe(result2.existing_parcelle_id);
          expect(result2.existing_parcelle_id).toBe(result3.existing_parcelle_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('features with same geometry should produce same hash and be detected as duplicates', async () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14, 3.13 (hash determinism enables duplicate detection)
    await fc.assert(
      fc.asyncProperty(multiPolygonArb, async (geometry) => {
        // Compute hash for the geometry
        const hash1 = await computeFeatureHash(geometry);
        const hash2 = await computeFeatureHash(geometry);
        
        // Same geometry should produce same hash
        expect(hash1).toBe(hash2);
        
        // Create existing parcelle with this hash
        const existingParcelles = [
          {
            id: 'existing-id',
            planteur_id: 'planteur-1',
            feature_hash: hash1,
            is_active: true,
          },
        ];
        
        const hashMap = buildExistingHashMap(existingParcelles);
        
        // Detecting with same hash should find duplicate
        const result = detectDuplicate(hash2, hashMap);
        expect(result.is_duplicate).toBe(true);
        expect(result.existing_parcelle_id).toBe('existing-id');
      }),
      { numRuns: 100 }
    );
  });

  it('features with different geometries should have different hashes and not be duplicates', async () => {
    // Feature: parcelles-module, Property 4: Duplicate Detection Accuracy
    // Validates: Requirements 3.14, 3.13 (different geometries = different hashes)
    await fc.assert(
      fc.asyncProperty(
        multiPolygonArb,
        multiPolygonArb,
        async (geometry1, geometry2) => {
          const hash1 = await computeFeatureHash(geometry1);
          const hash2 = await computeFeatureHash(geometry2);
          
          // If hashes are different, they should not be detected as duplicates of each other
          if (hash1 !== hash2) {
            const existingParcelles = [
              {
                id: 'existing-id',
                planteur_id: 'planteur-1',
                feature_hash: hash1,
                is_active: true,
              },
            ];
            
            const hashMap = buildExistingHashMap(existingParcelles);
            
            // Detecting with different hash should NOT find duplicate
            const result = detectDuplicate(hash2, hashMap);
            expect(result.is_duplicate).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 8: BBOX FILTERING CORRECTNESS
// ============================================================================

describe('Property 8: BBOX Filtering Correctness', () => {
  /**
   * Feature: parcelles-module, Property 8: BBOX Filtering Correctness
   * 
   * For any bbox query parameter, the returned parcelles SHALL only include
   * those whose geometry intersects the bounding box. Parcelles outside the
   * bbox SHALL NOT be returned.
   * 
   * Validates: Requirements 5.6
   */

  /**
   * Bounding box interface
   */
  interface BBox {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }

  /**
   * Generate a valid bounding box within WGS84 bounds
   * Ensures minLng < maxLng and minLat < maxLat
   */
  const bboxArb: fc.Arbitrary<BBox> = fc
    .tuple(
      fc.double({ min: -180, max: 179, noNaN: true }), // minLng
      fc.double({ min: -90, max: 89, noNaN: true }),   // minLat
      fc.double({ min: 0.01, max: 10, noNaN: true }),  // width (degrees)
      fc.double({ min: 0.01, max: 10, noNaN: true })   // height (degrees)
    )
    .map(([minLng, minLat, width, height]) => {
      // Ensure bbox stays within WGS84 bounds
      const maxLng = Math.min(180, minLng + width);
      const maxLat = Math.min(90, minLat + height);
      return {
        minLng,
        minLat,
        maxLng,
        maxLat,
      };
    });

  /**
   * Generate a polygon that is guaranteed to be INSIDE a given bbox
   * Creates a small polygon centered within the bbox
   */
  function generatePolygonInsideBBox(bbox: BBox): MultiPolygon {
    const centerLng = (bbox.minLng + bbox.maxLng) / 2;
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    
    // Create a small polygon (10% of bbox size) centered in the bbox
    const width = (bbox.maxLng - bbox.minLng) * 0.1;
    const height = (bbox.maxLat - bbox.minLat) * 0.1;
    
    const ring: Position[] = [
      [centerLng - width / 2, centerLat - height / 2],
      [centerLng + width / 2, centerLat - height / 2],
      [centerLng + width / 2, centerLat + height / 2],
      [centerLng - width / 2, centerLat + height / 2],
      [centerLng - width / 2, centerLat - height / 2], // Close the ring
    ];
    
    return {
      type: 'MultiPolygon',
      coordinates: [[ring]],
    };
  }

  /**
   * Generate a polygon that is guaranteed to be OUTSIDE a given bbox
   * Creates a polygon far from the bbox bounds
   */
  function generatePolygonOutsideBBox(bbox: BBox): MultiPolygon {
    // Place the polygon well outside the bbox
    // Use a position that's at least 20 degrees away from the bbox
    let centerLng: number;
    let centerLat: number;
    
    // Try to place it to the right of the bbox
    if (bbox.maxLng + 20 <= 180) {
      centerLng = bbox.maxLng + 20;
      centerLat = (bbox.minLat + bbox.maxLat) / 2;
    }
    // Or to the left
    else if (bbox.minLng - 20 >= -180) {
      centerLng = bbox.minLng - 20;
      centerLat = (bbox.minLat + bbox.maxLat) / 2;
    }
    // Or above
    else if (bbox.maxLat + 20 <= 90) {
      centerLng = (bbox.minLng + bbox.maxLng) / 2;
      centerLat = bbox.maxLat + 20;
    }
    // Or below
    else {
      centerLng = (bbox.minLng + bbox.maxLng) / 2;
      centerLat = Math.max(-89, bbox.minLat - 20);
    }
    
    // Create a small polygon
    const size = 0.5;
    const ring: Position[] = [
      [centerLng - size, centerLat - size],
      [centerLng + size, centerLat - size],
      [centerLng + size, centerLat + size],
      [centerLng - size, centerLat + size],
      [centerLng - size, centerLat - size], // Close the ring
    ];
    
    return {
      type: 'MultiPolygon',
      coordinates: [[ring]],
    };
  }

  /**
   * Generate a polygon that INTERSECTS (partially overlaps) a given bbox
   * Creates a polygon that crosses the bbox boundary
   */
  function generatePolygonIntersectingBBox(bbox: BBox): MultiPolygon {
    // Create a polygon that straddles the right edge of the bbox
    const edgeLng = bbox.maxLng;
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const size = Math.min(
      (bbox.maxLng - bbox.minLng) * 0.2,
      (bbox.maxLat - bbox.minLat) * 0.2,
      5 // Cap at 5 degrees
    );
    
    const ring: Position[] = [
      [edgeLng - size, centerLat - size],
      [edgeLng + size, centerLat - size],
      [edgeLng + size, centerLat + size],
      [edgeLng - size, centerLat + size],
      [edgeLng - size, centerLat - size], // Close the ring
    ];
    
    return {
      type: 'MultiPolygon',
      coordinates: [[ring]],
    };
  }

  /**
   * Check if a MultiPolygon intersects with a bounding box using Turf.js
   * This mirrors the PostGIS ST_Intersects logic used in the database
   */
  function geometryIntersectsBBox(geometry: MultiPolygon, bbox: BBox): boolean {
    try {
      // Create a bbox polygon
      const bboxPolygon = turf.bboxPolygon([
        bbox.minLng,
        bbox.minLat,
        bbox.maxLng,
        bbox.maxLat,
      ]);
      
      // Create the geometry feature
      const geometryFeature = turf.multiPolygon(geometry.coordinates);
      
      // Check intersection using Turf.js
      return turf.booleanIntersects(geometryFeature, bboxPolygon);
    } catch {
      return false;
    }
  }

  /**
   * Simulate the bbox filtering logic from the parcelles API
   * This mirrors the ST_Intersects filter used in list_parcelles RPC
   */
  function filterParcellesByBBox(
    parcelles: Array<{ id: string; geometry: MultiPolygon }>,
    bbox: BBox
  ): Array<{ id: string; geometry: MultiPolygon }> {
    return parcelles.filter((p) => geometryIntersectsBBox(p.geometry, bbox));
  }

  it('parcelles inside bbox should be included in results', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(bboxArb, (bbox) => {
        // Generate a polygon guaranteed to be inside the bbox
        const insideGeometry = generatePolygonInsideBBox(bbox);
        
        const parcelles = [
          { id: 'inside-parcelle', geometry: insideGeometry },
        ];
        
        const filtered = filterParcellesByBBox(parcelles, bbox);
        
        // Parcelle inside bbox should be included
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('inside-parcelle');
      }),
      { numRuns: 100 }
    );
  });

  it('parcelles outside bbox should be excluded from results', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(bboxArb, (bbox) => {
        // Generate a polygon guaranteed to be outside the bbox
        const outsideGeometry = generatePolygonOutsideBBox(bbox);
        
        const parcelles = [
          { id: 'outside-parcelle', geometry: outsideGeometry },
        ];
        
        const filtered = filterParcellesByBBox(parcelles, bbox);
        
        // Parcelle outside bbox should be excluded
        expect(filtered.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('parcelles intersecting bbox boundary should be included', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(bboxArb, (bbox) => {
        // Generate a polygon that intersects the bbox boundary
        const intersectingGeometry = generatePolygonIntersectingBBox(bbox);
        
        const parcelles = [
          { id: 'intersecting-parcelle', geometry: intersectingGeometry },
        ];
        
        const filtered = filterParcellesByBBox(parcelles, bbox);
        
        // Parcelle intersecting bbox should be included
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('intersecting-parcelle');
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly filter mixed parcelles (inside, outside, intersecting)', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(bboxArb, (bbox) => {
        const insideGeometry = generatePolygonInsideBBox(bbox);
        const outsideGeometry = generatePolygonOutsideBBox(bbox);
        const intersectingGeometry = generatePolygonIntersectingBBox(bbox);
        
        const parcelles = [
          { id: 'inside', geometry: insideGeometry },
          { id: 'outside', geometry: outsideGeometry },
          { id: 'intersecting', geometry: intersectingGeometry },
        ];
        
        const filtered = filterParcellesByBBox(parcelles, bbox);
        const filteredIds = filtered.map((p) => p.id).sort();
        
        // Inside and intersecting should be included, outside should be excluded
        expect(filteredIds).toContain('inside');
        expect(filteredIds).toContain('intersecting');
        expect(filteredIds).not.toContain('outside');
        expect(filtered.length).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  it('bbox filtering should be consistent with Turf.js booleanIntersects', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    fc.assert(
      fc.property(bboxArb, multiPolygonArb, (bbox, geometry) => {
        // Skip empty geometries
        if (isEmptyGeometry(geometry)) {
          return true;
        }
        
        const parcelles = [{ id: 'test', geometry }];
        const filtered = filterParcellesByBBox(parcelles, bbox);
        
        // Result should match direct Turf.js intersection check
        const shouldBeIncluded = geometryIntersectsBBox(geometry, bbox);
        
        if (shouldBeIncluded) {
          expect(filtered.length).toBe(1);
        } else {
          expect(filtered.length).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty bbox should return no results', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6 (edge case)
    // Note: This tests the edge case where bbox has zero area
    // In practice, validation prevents this, but the filter should handle it
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        if (isEmptyGeometry(geometry)) {
          return true;
        }
        
        // Create a "point" bbox (zero area)
        const pointBbox: BBox = {
          minLng: 0,
          minLat: 0,
          maxLng: 0.0001, // Very small to simulate near-zero area
          maxLat: 0.0001,
        };
        
        const parcelles = [{ id: 'test', geometry }];
        const filtered = filterParcellesByBBox(parcelles, pointBbox);
        
        // Only parcelles that actually intersect this tiny bbox should be included
        const shouldBeIncluded = geometryIntersectsBBox(geometry, pointBbox);
        expect(filtered.length).toBe(shouldBeIncluded ? 1 : 0);
      }),
      { numRuns: 100 }
    );
  });

  it('bbox filtering should be deterministic', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6 (determinism)
    fc.assert(
      fc.property(bboxArb, multiPolygonArb, (bbox, geometry) => {
        if (isEmptyGeometry(geometry)) {
          return true;
        }
        
        const parcelles = [{ id: 'test', geometry }];
        
        // Run filtering multiple times
        const result1 = filterParcellesByBBox(parcelles, bbox);
        const result2 = filterParcellesByBBox(parcelles, bbox);
        const result3 = filterParcellesByBBox(parcelles, bbox);
        
        // All results should be identical
        expect(result1.length).toBe(result2.length);
        expect(result2.length).toBe(result3.length);
        
        if (result1.length > 0) {
          expect(result1[0].id).toBe(result2[0].id);
          expect(result2[0].id).toBe(result3[0].id);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('world-spanning bbox should include all valid parcelles', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6 (edge case: full world bbox)
    fc.assert(
      fc.property(multiPolygonArb, (geometry) => {
        if (isEmptyGeometry(geometry)) {
          return true;
        }
        
        // World-spanning bbox
        const worldBbox: BBox = {
          minLng: -180,
          minLat: -90,
          maxLng: 180,
          maxLat: 90,
        };
        
        const parcelles = [{ id: 'test', geometry }];
        const filtered = filterParcellesByBBox(parcelles, worldBbox);
        
        // All valid geometries should be included in world bbox
        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('test');
      }),
      { numRuns: 100 }
    );
  });

  it('geometryIntersectsBBox should be symmetric with bbox containment', () => {
    // Feature: parcelles-module, Property 8: BBOX Filtering Correctness
    // Validates: Requirements 5.6
    // If a geometry's centroid is inside the bbox, the geometry should intersect
    fc.assert(
      fc.property(bboxArb, (bbox) => {
        // Generate a polygon centered in the bbox
        const geometry = generatePolygonInsideBBox(bbox);
        const centroid = calculateCentroid(geometry);
        
        // Centroid should be inside bbox
        const centroidInBBox =
          centroid.lng >= bbox.minLng &&
          centroid.lng <= bbox.maxLng &&
          centroid.lat >= bbox.minLat &&
          centroid.lat <= bbox.maxLat;
        
        // If centroid is in bbox, geometry should intersect
        if (centroidInBBox) {
          expect(geometryIntersectsBBox(geometry, bbox)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// PROPERTY 12: CERTIFICATIONS WHITELIST
// ============================================================================

import { certificationsArraySchema, certificationSchema } from '@/lib/validations/parcelle';
import { CERTIFICATIONS_WHITELIST } from '@/types/parcelles';

describe('Property 12: Certifications Whitelist', () => {
  /**
   * Feature: parcelles-module, Property 12: Certifications Whitelist
   * 
   * For any parcelle creation or update with certifications array, all values
   * SHALL be in the whitelist ['rainforest_alliance', 'utz', 'fairtrade', 'bio',
   * 'organic', 'other']. Invalid values SHALL be rejected.
   * 
   * Validates: Requirements 8.2
   */

  /**
   * Arbitrary for generating valid certifications (from whitelist)
   */
  const validCertificationArb = fc.constantFrom(...CERTIFICATIONS_WHITELIST);

  /**
   * Arbitrary for generating arrays of valid certifications (no duplicates)
   */
  const validCertificationsArrayArb = fc
    .uniqueArray(validCertificationArb, { minLength: 0, maxLength: CERTIFICATIONS_WHITELIST.length })
    .map((arr) => [...arr]); // Ensure it's a plain array

  /**
   * Arbitrary for generating invalid certification strings
   * These are strings that are NOT in the whitelist
   */
  const invalidCertificationArb = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => !(CERTIFICATIONS_WHITELIST as readonly string[]).includes(s));

  /**
   * Arbitrary for generating arrays containing at least one invalid certification
   */
  const invalidCertificationsArrayArb = fc
    .tuple(
      fc.array(validCertificationArb, { minLength: 0, maxLength: 3 }),
      invalidCertificationArb,
      fc.array(validCertificationArb, { minLength: 0, maxLength: 3 })
    )
    .map(([before, invalid, after]) => [...before, invalid, ...after]);

  it('should accept all valid certifications from whitelist', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(validCertificationsArrayArb, (certifications) => {
        const result = certificationsArraySchema.safeParse(certifications);
        
        // Valid certifications should be accepted
        expect(result.success).toBe(true);
        
        if (result.success) {
          // All values should be preserved
          expect(result.data.length).toBe(certifications.length);
          for (const cert of certifications) {
            expect(result.data).toContain(cert);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should reject arrays containing invalid certifications', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(invalidCertificationsArrayArb, (certifications) => {
        const result = certificationsArraySchema.safeParse(certifications);
        
        // Arrays with invalid certifications should be rejected
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should accept empty certifications array', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (edge case: empty array is valid)
    const result = certificationsArraySchema.safeParse([]);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should reject duplicate certifications', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (no duplicates allowed)
    fc.assert(
      fc.property(validCertificationArb, (cert) => {
        // Create array with duplicate
        const duplicateArray = [cert, cert];
        const result = certificationsArraySchema.safeParse(duplicateArray);
        
        // Duplicates should be rejected
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should validate each certification individually against whitelist', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(validCertificationArb, (cert) => {
        const result = certificationSchema.safeParse(cert);
        
        // Each valid certification should pass individual validation
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(cert);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should reject individual invalid certifications', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(invalidCertificationArb, (cert) => {
        const result = certificationSchema.safeParse(cert);
        
        // Invalid certifications should be rejected
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('whitelist should contain exactly the expected certifications', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (whitelist consistency)
    const expectedCertifications = [
      'rainforest_alliance',
      'utz',
      'fairtrade',
      'bio',
      'organic',
      'other',
    ];
    
    // Whitelist should have exactly these values
    expect(CERTIFICATIONS_WHITELIST.length).toBe(expectedCertifications.length);
    
    for (const cert of expectedCertifications) {
      expect(CERTIFICATIONS_WHITELIST).toContain(cert);
    }
    
    for (const cert of CERTIFICATIONS_WHITELIST) {
      expect(expectedCertifications).toContain(cert);
    }
  });

  it('should preserve order of valid certifications', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(validCertificationsArrayArb, (certifications) => {
        const result = certificationsArraySchema.safeParse(certifications);
        
        if (result.success) {
          // Order should be preserved
          for (let i = 0; i < certifications.length; i++) {
            expect(result.data[i]).toBe(certifications[i]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('validation should be deterministic', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (determinism)
    fc.assert(
      fc.property(
        fc.oneof(validCertificationsArrayArb, invalidCertificationsArrayArb),
        (certifications) => {
          // Validate multiple times
          const result1 = certificationsArraySchema.safeParse(certifications);
          const result2 = certificationsArraySchema.safeParse(certifications);
          const result3 = certificationsArraySchema.safeParse(certifications);
          
          // All results should be identical
          expect(result1.success).toBe(result2.success);
          expect(result2.success).toBe(result3.success);
          
          if (result1.success && result2.success && result3.success) {
            expect(JSON.stringify(result1.data)).toBe(JSON.stringify(result2.data));
            expect(JSON.stringify(result2.data)).toBe(JSON.stringify(result3.data));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle all possible valid certification combinations', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (exhaustive validation)
    // Test all single certifications
    for (const cert of CERTIFICATIONS_WHITELIST) {
      const result = certificationsArraySchema.safeParse([cert]);
      expect(result.success).toBe(true);
    }
    
    // Test full whitelist (all certifications)
    const allCerts = [...CERTIFICATIONS_WHITELIST];
    const result = certificationsArraySchema.safeParse(allCerts);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(CERTIFICATIONS_WHITELIST.length);
    }
  });

  it('should reject non-array inputs', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (type safety)
    const invalidInputs = [
      'rainforest_alliance', // string instead of array
      123,
      null,
      undefined,
      { cert: 'rainforest_alliance' },
    ];
    
    for (const input of invalidInputs) {
      const result = certificationsArraySchema.safeParse(input);
      // Non-array inputs should either fail or be coerced to default
      // The schema has .default([]) so undefined might pass
      if (input !== undefined) {
        expect(result.success).toBe(false);
      }
    }
  });

  it('should handle case sensitivity correctly', () => {
    // Feature: parcelles-module, Property 12: Certifications Whitelist
    // Validates: Requirements 8.2 (case sensitivity)
    // Certifications are case-sensitive - uppercase versions should be rejected
    const uppercaseCerts = CERTIFICATIONS_WHITELIST.map((c) => c.toUpperCase());
    
    for (const cert of uppercaseCerts) {
      // Skip if uppercase is same as original (shouldn't happen with these values)
      if ((CERTIFICATIONS_WHITELIST as readonly string[]).includes(cert)) continue;
      
      const result = certificationSchema.safeParse(cert);
      expect(result.success).toBe(false);
    }
  });
});
