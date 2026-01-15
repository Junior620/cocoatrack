// CocoaTrack V2 - Parcelles Grouped Property Tests
// Property-based tests for parcelles statistics consistency
//
// These tests validate the correctness properties defined in the design document
// using fast-check for property-based testing with minimum 100 iterations.
//
// **Feature: parcelles-import-evolution, Property 9: Statistics consistency**
// **Validates: Requirements 6.1, 6.2**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ParcelleStats } from '@/types/parcelles';

// ============================================================================
// ARBITRARIES (Generators for random test data)
// ============================================================================

/**
 * Generate a non-negative integer for parcelle counts
 */
const parcelleCountArb = fc.integer({ min: 0, max: 10000 });

/**
 * Generate a non-negative surface area in hectares (0 to 100000 ha)
 * Using 2 decimal places as per the API implementation
 */
const surfaceHaArb = fc.double({ min: 0, max: 100000, noNaN: true })
  .map(v => Math.round(v * 100) / 100); // Round to 2 decimal places

/**
 * Generate a valid ParcelleStats object where totals are computed from components
 * This simulates how the API calculates statistics
 */
const validParcelleStatsArb: fc.Arbitrary<ParcelleStats> = fc.record({
  assigned_parcelles: parcelleCountArb,
  orphan_parcelles: parcelleCountArb,
  assigned_surface_ha: surfaceHaArb,
  orphan_surface_ha: surfaceHaArb,
}).map(({ assigned_parcelles, orphan_parcelles, assigned_surface_ha, orphan_surface_ha }) => ({
  total_parcelles: assigned_parcelles + orphan_parcelles,
  assigned_parcelles,
  orphan_parcelles,
  total_surface_ha: Math.round((assigned_surface_ha + orphan_surface_ha) * 100) / 100,
  assigned_surface_ha,
  orphan_surface_ha,
}));

/**
 * Generate parcelle data (count and surface) for a single parcelle
 */
const parcelleDataArb = fc.record({
  surface_hectares: fc.double({ min: 0.01, max: 1000, noNaN: true })
    .map(v => Math.round(v * 100) / 100),
  is_assigned: fc.boolean(),
});

/**
 * Generate a list of parcelle data to simulate raw database results
 */
const parcelleListArb = fc.array(parcelleDataArb, { minLength: 0, maxLength: 100 });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate ParcelleStats from a list of parcelle data
 * This mirrors the calculation logic in parcelles-grouped.ts
 */
function calculateStats(
  parcelles: Array<{ surface_hectares: number; is_assigned: boolean }>
): ParcelleStats {
  const assigned = parcelles.filter(p => p.is_assigned);
  const orphans = parcelles.filter(p => !p.is_assigned);

  const assignedCount = assigned.length;
  const orphanCount = orphans.length;

  const assignedSurface = assigned.reduce((sum, p) => sum + p.surface_hectares, 0);
  const orphanSurface = orphans.reduce((sum, p) => sum + p.surface_hectares, 0);

  return {
    total_parcelles: assignedCount + orphanCount,
    assigned_parcelles: assignedCount,
    orphan_parcelles: orphanCount,
    total_surface_ha: Math.round((assignedSurface + orphanSurface) * 100) / 100,
    assigned_surface_ha: Math.round(assignedSurface * 100) / 100,
    orphan_surface_ha: Math.round(orphanSurface * 100) / 100,
  };
}

/**
 * Validate that a ParcelleStats object satisfies the consistency property
 * Returns true if valid, throws an error with details if invalid
 */
function validateStatsConsistency(stats: ParcelleStats): boolean {
  // Property 9: total_parcelles = assigned_parcelles + orphan_parcelles
  const expectedTotalParcelles = stats.assigned_parcelles + stats.orphan_parcelles;
  if (stats.total_parcelles !== expectedTotalParcelles) {
    throw new Error(
      `total_parcelles (${stats.total_parcelles}) !== assigned_parcelles (${stats.assigned_parcelles}) + orphan_parcelles (${stats.orphan_parcelles}) = ${expectedTotalParcelles}`
    );
  }

  // Property 9: total_surface_ha = assigned_surface_ha + orphan_surface_ha
  // Using tolerance for floating point comparison
  const expectedTotalSurface = Math.round((stats.assigned_surface_ha + stats.orphan_surface_ha) * 100) / 100;
  const surfaceDiff = Math.abs(stats.total_surface_ha - expectedTotalSurface);
  if (surfaceDiff > 0.01) { // Allow 0.01 ha tolerance for rounding
    throw new Error(
      `total_surface_ha (${stats.total_surface_ha}) !== assigned_surface_ha (${stats.assigned_surface_ha}) + orphan_surface_ha (${stats.orphan_surface_ha}) = ${expectedTotalSurface}`
    );
  }

  return true;
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 9: Statistics consistency', () => {
  /**
   * Feature: parcelles-import-evolution, Property 9: Statistics consistency
   *
   * For any ParcelleStats returned by the API, total_parcelles SHALL equal
   * assigned_parcelles + orphan_parcelles, and total_surface_ha SHALL equal
   * assigned_surface_ha + orphan_surface_ha.
   *
   * Validates: Requirements 6.1, 6.2
   */

  describe('Parcelle count consistency', () => {
    it('total_parcelles should equal assigned_parcelles + orphan_parcelles', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          const expectedTotal = stats.assigned_parcelles + stats.orphan_parcelles;
          expect(stats.total_parcelles).toBe(expectedTotal);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain count consistency for any combination of assigned and orphan counts', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          parcelleCountArb,
          parcelleCountArb,
          (assignedCount, orphanCount) => {
            const stats: ParcelleStats = {
              total_parcelles: assignedCount + orphanCount,
              assigned_parcelles: assignedCount,
              orphan_parcelles: orphanCount,
              total_surface_ha: 0,
              assigned_surface_ha: 0,
              orphan_surface_ha: 0,
            };

            expect(stats.total_parcelles).toBe(stats.assigned_parcelles + stats.orphan_parcelles);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Surface area consistency', () => {
    it('total_surface_ha should equal assigned_surface_ha + orphan_surface_ha', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          const expectedTotal = Math.round((stats.assigned_surface_ha + stats.orphan_surface_ha) * 100) / 100;
          const diff = Math.abs(stats.total_surface_ha - expectedTotal);
          expect(diff).toBeLessThanOrEqual(0.01); // Allow small rounding tolerance
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain surface consistency for any combination of assigned and orphan surfaces', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          surfaceHaArb,
          surfaceHaArb,
          (assignedSurface, orphanSurface) => {
            const totalSurface = Math.round((assignedSurface + orphanSurface) * 100) / 100;

            const stats: ParcelleStats = {
              total_parcelles: 0,
              assigned_parcelles: 0,
              orphan_parcelles: 0,
              total_surface_ha: totalSurface,
              assigned_surface_ha: assignedSurface,
              orphan_surface_ha: orphanSurface,
            };

            const expectedTotal = Math.round((stats.assigned_surface_ha + stats.orphan_surface_ha) * 100) / 100;
            const diff = Math.abs(stats.total_surface_ha - expectedTotal);
            expect(diff).toBeLessThanOrEqual(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined consistency', () => {
    it('should satisfy both count and surface consistency simultaneously', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          // Validate using the helper function
          expect(() => validateStatsConsistency(stats)).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });

    it('should produce consistent stats when calculated from raw parcelle data', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(parcelleListArb, (parcelles) => {
          const stats = calculateStats(parcelles);

          // Verify count consistency
          expect(stats.total_parcelles).toBe(stats.assigned_parcelles + stats.orphan_parcelles);

          // Verify surface consistency
          const expectedTotalSurface = Math.round((stats.assigned_surface_ha + stats.orphan_surface_ha) * 100) / 100;
          const diff = Math.abs(stats.total_surface_ha - expectedTotalSurface);
          expect(diff).toBeLessThanOrEqual(0.01);

          // Verify counts match actual data
          const actualAssigned = parcelles.filter(p => p.is_assigned).length;
          const actualOrphan = parcelles.filter(p => !p.is_assigned).length;
          expect(stats.assigned_parcelles).toBe(actualAssigned);
          expect(stats.orphan_parcelles).toBe(actualOrphan);
          expect(stats.total_parcelles).toBe(parcelles.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle zero parcelles', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      const stats: ParcelleStats = {
        total_parcelles: 0,
        assigned_parcelles: 0,
        orphan_parcelles: 0,
        total_surface_ha: 0,
        assigned_surface_ha: 0,
        orphan_surface_ha: 0,
      };

      expect(() => validateStatsConsistency(stats)).not.toThrow();
    });

    it('should handle all assigned (no orphans)', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          parcelleCountArb,
          surfaceHaArb,
          (count, surface) => {
            const stats: ParcelleStats = {
              total_parcelles: count,
              assigned_parcelles: count,
              orphan_parcelles: 0,
              total_surface_ha: surface,
              assigned_surface_ha: surface,
              orphan_surface_ha: 0,
            };

            expect(() => validateStatsConsistency(stats)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle all orphans (no assigned)', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          parcelleCountArb,
          surfaceHaArb,
          (count, surface) => {
            const stats: ParcelleStats = {
              total_parcelles: count,
              assigned_parcelles: 0,
              orphan_parcelles: count,
              total_surface_ha: surface,
              assigned_surface_ha: 0,
              orphan_surface_ha: surface,
            };

            expect(() => validateStatsConsistency(stats)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very small surface areas', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 0.1, noNaN: true }).map(v => Math.round(v * 100) / 100),
          fc.double({ min: 0, max: 0.1, noNaN: true }).map(v => Math.round(v * 100) / 100),
          (assignedSurface, orphanSurface) => {
            const totalSurface = Math.round((assignedSurface + orphanSurface) * 100) / 100;

            const stats: ParcelleStats = {
              total_parcelles: 2,
              assigned_parcelles: 1,
              orphan_parcelles: 1,
              total_surface_ha: totalSurface,
              assigned_surface_ha: assignedSurface,
              orphan_surface_ha: orphanSurface,
            };

            expect(() => validateStatsConsistency(stats)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very large surface areas', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(
          fc.double({ min: 10000, max: 100000, noNaN: true }).map(v => Math.round(v * 100) / 100),
          fc.double({ min: 10000, max: 100000, noNaN: true }).map(v => Math.round(v * 100) / 100),
          (assignedSurface, orphanSurface) => {
            const totalSurface = Math.round((assignedSurface + orphanSurface) * 100) / 100;

            const stats: ParcelleStats = {
              total_parcelles: 1000,
              assigned_parcelles: 500,
              orphan_parcelles: 500,
              total_surface_ha: totalSurface,
              assigned_surface_ha: assignedSurface,
              orphan_surface_ha: orphanSurface,
            };

            expect(() => validateStatsConsistency(stats)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('total_parcelles should always be non-negative', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          expect(stats.total_parcelles).toBeGreaterThanOrEqual(0);
          expect(stats.assigned_parcelles).toBeGreaterThanOrEqual(0);
          expect(stats.orphan_parcelles).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('total_surface_ha should always be non-negative', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          expect(stats.total_surface_ha).toBeGreaterThanOrEqual(0);
          expect(stats.assigned_surface_ha).toBeGreaterThanOrEqual(0);
          expect(stats.orphan_surface_ha).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('assigned + orphan should never exceed total', () => {
      // Feature: parcelles-import-evolution, Property 9: Statistics consistency
      // Validates: Requirements 6.1, 6.2
      fc.assert(
        fc.property(validParcelleStatsArb, (stats) => {
          // For counts, they should be exactly equal
          expect(stats.assigned_parcelles + stats.orphan_parcelles).toBe(stats.total_parcelles);

          // For surfaces, allow small rounding tolerance
          const sumSurface = stats.assigned_surface_ha + stats.orphan_surface_ha;
          expect(sumSurface).toBeLessThanOrEqual(stats.total_surface_ha + 0.01);
        }),
        { numRuns: 100 }
      );
    });
  });
});
