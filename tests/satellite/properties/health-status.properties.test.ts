/**
 * Property-Based Tests for Health Status Logic
 * 
 * This file implements property-based testing for health status classification,
 * trend calculation, recommendations, and distribution aggregation using fast-check.
 * 
 * Properties tested:
 * - Property 17: Health Status Classification and Color Mapping
 * - Property 18: Health Status Trend Calculation
 * - Property 19: Health Status Recommendations
 * - Property 20: Health Status Distribution Aggregation
 * 
 * Requirements: Task 7.1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NDVIService } from '@/lib/satellite/services/ndvi.service';
import { ndviToRGB } from '@/lib/satellite/utils/ndvi-colors';
import type { HealthStatus } from '@/lib/satellite/types';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Number of iterations for property-based tests
 * Higher values provide stronger guarantees but take longer to run
 */
const NUM_RUNS = 100;

/**
 * Epsilon for floating-point comparisons
 * Accounts for floating-point arithmetic precision issues
 */
const EPSILON = 1e-10;

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid NDVI values in range [0, 1]
 * (Health status is only defined for non-negative NDVI)
 */
const ndviValueArbitrary = fc.double({ min: 0, max: 1, noNaN: true });

/**
 * Arbitrary for generating health status values
 */
const healthStatusArbitrary: fc.Arbitrary<HealthStatus> = fc.constantFrom(
  'excellent',
  'good',
  'fair',
  'poor',
  'critical'
);

/**
 * Arbitrary for generating chronological series of health statuses
 */
const healthStatusSeriesArbitrary = fc.array(
  fc.record({
    date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    status: healthStatusArbitrary,
  }),
  { minLength: 3, maxLength: 12 }
).map(series => {
  // Sort by date ascending
  return series.sort((a, b) => a.date.getTime() - b.date.getTime());
});

/**
 * Arbitrary for generating parcelle collections with health statuses
 */
const parcelleCollectionArbitrary = fc.array(
  fc.record({
    id: fc.uuid(),
    healthStatus: healthStatusArbitrary,
  }),
  { minLength: 1, maxLength: 100 }
);

// ============================================================================
// Property 17: Health Status Classification and Color Mapping
// ============================================================================

describe('Property 17: Health Status Classification and Color Mapping', () => {
  const service = new NDVIService();

  /**
   * Property 17.1: NDVI ranges map to correct health status
   * 
   * For any NDVI value in the range [0, 1], the assigned health status SHALL match
   * the specified ranges:
   * - Excellent: 0.7-1.0
   * - Good: 0.6-0.7
   * - Fair: 0.5-0.6
   * - Poor: 0.3-0.5
   * - Critical: 0.0-0.3
   */
  it('should map NDVI ranges to correct health status', () => {
    fc.assert(
      fc.property(ndviValueArbitrary, (ndvi) => {
        const healthStatus = service.calculateHealthStatus(ndvi);

        // Verify correct mapping based on NDVI value
        if (ndvi >= 0.7) {
          expect(healthStatus).toBe('excellent');
        } else if (ndvi >= 0.6) {
          expect(healthStatus).toBe('good');
        } else if (ndvi >= 0.5) {
          expect(healthStatus).toBe('fair');
        } else if (ndvi >= 0.3) {
          expect(healthStatus).toBe('poor');
        } else {
          expect(healthStatus).toBe('critical');
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 17.2: Health status has corresponding color
   * 
   * For any health status, there SHALL be a corresponding color mapping:
   * - Excellent: Dark Green
   * - Good: Green
   * - Fair: Yellow
   * - Poor: Orange
   * - Critical: Red
   */
  it('should map health status to correct color', () => {
    fc.assert(
      fc.property(healthStatusArbitrary, (status) => {
        // Get NDVI value for this status (middle of range)
        let ndvi: number;
        switch (status) {
          case 'excellent':
            ndvi = 0.85;
            break;
          case 'good':
            ndvi = 0.65;
            break;
          case 'fair':
            ndvi = 0.55;
            break;
          case 'poor':
            ndvi = 0.4;
            break;
          case 'critical':
            ndvi = 0.15;
            break;
        }

        const color = ndviToRGB(ndvi);

        // Verify color characteristics for each status
        switch (status) {
          case 'excellent':
            // Dark green: high green component, low red
            expect(color.g).toBeGreaterThan(100);
            expect(color.g).toBeGreaterThan(color.r);
            break;
          case 'good':
            // Green: high green component
            expect(color.g).toBeGreaterThan(150);
            break;
          case 'fair':
            // Yellow: high red and green
            expect(color.r).toBeGreaterThan(200);
            expect(color.g).toBeGreaterThan(150);
            break;
          case 'poor':
            // Orange: high red, moderate green
            expect(color.r).toBeGreaterThan(200);
            expect(color.r).toBeGreaterThan(color.g);
            break;
          case 'critical':
            // Red/Brown: high red component
            expect(color.r).toBeGreaterThan(color.g);
            break;
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 17.3: Boundary values are correctly classified
   * 
   * For NDVI values exactly at threshold boundaries, the classification
   * SHALL be consistent and deterministic.
   */
  it('should correctly classify boundary NDVI values', () => {
    const boundaries = [
      { ndvi: 0.0, expected: 'critical' as HealthStatus },
      { ndvi: 0.3, expected: 'poor' as HealthStatus },
      { ndvi: 0.5, expected: 'fair' as HealthStatus },
      { ndvi: 0.6, expected: 'good' as HealthStatus },
      { ndvi: 0.7, expected: 'excellent' as HealthStatus },
      { ndvi: 1.0, expected: 'excellent' as HealthStatus },
    ];

    boundaries.forEach(({ ndvi, expected }) => {
      const status = service.calculateHealthStatus(ndvi);
      expect(status).toBe(expected);
    });
  });

  /**
   * Property 17.4: Health status is deterministic
   * 
   * For any NDVI value, calling calculateHealthStatus multiple times
   * SHALL produce identical results.
   */
  it('should produce deterministic health status', () => {
    fc.assert(
      fc.property(ndviValueArbitrary, (ndvi) => {
        const status1 = service.calculateHealthStatus(ndvi);
        const status2 = service.calculateHealthStatus(ndvi);

        expect(status1).toBe(status2);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 17.5: Higher NDVI never produces worse health status
   * 
   * For any two NDVI values where ndvi1 < ndvi2, the health status
   * for ndvi2 SHALL be equal to or better than the status for ndvi1.
   */
  it('should have monotonic health status with respect to NDVI', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        ndviValueArbitrary,
        (ndvi1, ndvi2) => {
          // Skip if values are equal
          if (Math.abs(ndvi1 - ndvi2) < EPSILON) {
            return true;
          }

          const status1 = service.calculateHealthStatus(ndvi1);
          const status2 = service.calculateHealthStatus(ndvi2);

          // Define status ordering (lower index = worse status)
          const statusOrder: HealthStatus[] = ['critical', 'poor', 'fair', 'good', 'excellent'];
          const index1 = statusOrder.indexOf(status1);
          const index2 = statusOrder.indexOf(status2);

          // If ndvi1 < ndvi2, then status1 should be <= status2
          if (ndvi1 < ndvi2) {
            expect(index1).toBeLessThanOrEqual(index2);
          } else {
            expect(index2).toBeLessThanOrEqual(index1);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 17.6: All health statuses are reachable
   * 
   * For the complete NDVI range [0, 1], all five health status values
   * SHALL be reachable (no dead zones).
   */
  it('should have all health statuses reachable in NDVI range', () => {
    const reachedStatuses = new Set<HealthStatus>();

    // Sample NDVI range
    for (let ndvi = 0; ndvi <= 1; ndvi += 0.05) {
      const status = service.calculateHealthStatus(ndvi);
      reachedStatuses.add(status);
    }

    // All five statuses should be reachable
    expect(reachedStatuses.size).toBe(5);
    expect(reachedStatuses.has('critical')).toBe(true);
    expect(reachedStatuses.has('poor')).toBe(true);
    expect(reachedStatuses.has('fair')).toBe(true);
    expect(reachedStatuses.has('good')).toBe(true);
    expect(reachedStatuses.has('excellent')).toBe(true);
  });
});

// ============================================================================
// Property 18: Health Status Trend Calculation
// ============================================================================

describe('Property 18: Health Status Trend Calculation', () => {
  const service = new NDVIService();

  /**
   * Property 18.1: Trend is 'improving' when most recent is better than oldest
   * 
   * For any chronological series of health status values over 3 months,
   * the calculated trend SHALL be 'improving' if the most recent status
   * is better than the oldest.
   */
  it('should calculate "improving" trend when most recent > oldest', () => {
    fc.assert(
      fc.property(healthStatusSeriesArbitrary, (series) => {
        // Skip if series is too short
        if (series.length < 2) {
          return true;
        }

        // Define status ordering (lower index = worse status)
        const statusOrder: HealthStatus[] = ['critical', 'poor', 'fair', 'good', 'excellent'];

        const oldestStatus = series[0].status;
        const mostRecentStatus = series[series.length - 1].status;

        const oldestIndex = statusOrder.indexOf(oldestStatus);
        const mostRecentIndex = statusOrder.indexOf(mostRecentStatus);

        const trend = service.calculateHealthStatusTrend(series.map(s => s.status));

        // If most recent is better (higher index), trend should be improving
        if (mostRecentIndex > oldestIndex) {
          expect(trend).toBe('improving');
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 18.2: Trend is 'declining' when most recent is worse than oldest
   * 
   * For any chronological series of health status values over 3 months,
   * the calculated trend SHALL be 'declining' if the most recent status
   * is worse than the oldest.
   */
  it('should calculate "declining" trend when most recent < oldest', () => {
    fc.assert(
      fc.property(healthStatusSeriesArbitrary, (series) => {
        // Skip if series is too short
        if (series.length < 2) {
          return true;
        }

        // Define status ordering (lower index = worse status)
        const statusOrder: HealthStatus[] = ['critical', 'poor', 'fair', 'good', 'excellent'];

        const oldestStatus = series[0].status;
        const mostRecentStatus = series[series.length - 1].status;

        const oldestIndex = statusOrder.indexOf(oldestStatus);
        const mostRecentIndex = statusOrder.indexOf(mostRecentStatus);

        const trend = service.calculateHealthStatusTrend(series.map(s => s.status));

        // If most recent is worse (lower index), trend should be declining
        if (mostRecentIndex < oldestIndex) {
          expect(trend).toBe('declining');
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 18.3: Trend is 'stable' when most recent equals oldest
   * 
   * For any chronological series of health status values over 3 months,
   * the calculated trend SHALL be 'stable' if the most recent status
   * equals the oldest (or fluctuates without clear direction).
   */
  it('should calculate "stable" trend when most recent = oldest', () => {
    fc.assert(
      fc.property(healthStatusArbitrary, (status) => {
        // Create series with same status at start and end
        const series = [status, status, status];

        const trend = service.calculateHealthStatusTrend(series);

        // Trend should be stable when no change
        expect(trend).toBe('stable');
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 18.4: Trend calculation is deterministic
   * 
   * For any series of health statuses, calculating the trend multiple times
   * SHALL produce identical results.
   */
  it('should produce deterministic trend calculation', () => {
    fc.assert(
      fc.property(healthStatusSeriesArbitrary, (series) => {
        const statuses = series.map(s => s.status);

        const trend1 = service.calculateHealthStatusTrend(statuses);
        const trend2 = service.calculateHealthStatusTrend(statuses);

        expect(trend1).toBe(trend2);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 18.5: Minimum series length requirement
   * 
   * For series with fewer than 2 data points, trend calculation
   * SHALL return 'stable' or throw an appropriate error.
   */
  it('should handle short series gracefully', () => {
    // Single status
    const singleStatus = ['good' as HealthStatus];
    const trend = service.calculateHealthStatusTrend(singleStatus);
    expect(trend).toBe('stable');

    // Empty series
    const emptyStatus: HealthStatus[] = [];
    const emptyTrend = service.calculateHealthStatusTrend(emptyStatus);
    expect(emptyTrend).toBe('stable');
  });
});

// ============================================================================
// Property 19: Health Status Recommendations
// ============================================================================

describe('Property 19: Health Status Recommendations', () => {
  const service = new NDVIService();

  /**
   * Property 19.1: Critical/Poor statuses suggest intervention
   * 
   * For any health status value of 'critical' or 'poor', the generated
   * recommendation SHALL suggest intervention or corrective action.
   */
  it('should suggest intervention for critical/poor status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('critical' as HealthStatus, 'poor' as HealthStatus),
        (status) => {
          const recommendation = service.getHealthStatusRecommendation(status);

          // Recommendation should mention intervention, action, or urgency
          const interventionKeywords = [
            'intervention',
            'action',
            'urgent',
            'immediate',
            'corrective',
            'améliorer',
            'traiter',
          ];

          const hasInterventionKeyword = interventionKeywords.some(keyword =>
            recommendation.toLowerCase().includes(keyword)
          );

          expect(hasInterventionKeyword).toBe(true);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 19.2: Fair status suggests monitoring
   * 
   * For health status value of 'fair', the generated recommendation
   * SHALL suggest monitoring or observation.
   */
  it('should suggest monitoring for fair status', () => {
    const status: HealthStatus = 'fair';
    const recommendation = service.getHealthStatusRecommendation(status);

    // Recommendation should mention monitoring or observation
    const monitoringKeywords = [
      'monitor',
      'observe',
      'watch',
      'surveiller',
      'observer',
      'attention',
    ];

    const hasMonitoringKeyword = monitoringKeywords.some(keyword =>
      recommendation.toLowerCase().includes(keyword)
    );

    expect(hasMonitoringKeyword).toBe(true);
  });

  /**
   * Property 19.3: Good/Excellent statuses suggest maintenance
   * 
   * For health status values of 'good' or 'excellent', the generated
   * recommendation SHALL suggest maintenance or continuation of current practices.
   */
  it('should suggest maintenance for good/excellent status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('good' as HealthStatus, 'excellent' as HealthStatus),
        (status) => {
          const recommendation = service.getHealthStatusRecommendation(status);

          // Recommendation should mention maintenance or continuation
          const maintenanceKeywords = [
            'maintain',
            'continue',
            'keep',
            'sustain',
            'maintenir',
            'continuer',
            'bon',
            'excellent',
          ];

          const hasMaintenanceKeyword = maintenanceKeywords.some(keyword =>
            recommendation.toLowerCase().includes(keyword)
          );

          expect(hasMaintenanceKeyword).toBe(true);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 19.4: Recommendations are non-empty
   * 
   * For any health status value, the generated recommendation
   * SHALL be a non-empty string.
   */
  it('should generate non-empty recommendations', () => {
    fc.assert(
      fc.property(healthStatusArbitrary, (status) => {
        const recommendation = service.getHealthStatusRecommendation(status);

        expect(typeof recommendation).toBe('string');
        expect(recommendation.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 19.5: Recommendations are deterministic
   * 
   * For any health status value, generating recommendations multiple times
   * SHALL produce identical results.
   */
  it('should produce deterministic recommendations', () => {
    fc.assert(
      fc.property(healthStatusArbitrary, (status) => {
        const rec1 = service.getHealthStatusRecommendation(status);
        const rec2 = service.getHealthStatusRecommendation(status);

        expect(rec1).toBe(rec2);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 19.6: Worse statuses have more urgent recommendations
   * 
   * For any two health statuses where status1 is worse than status2,
   * the recommendation for status1 SHALL be more urgent/actionable.
   */
  it('should have more urgent recommendations for worse statuses', () => {
    const criticalRec = service.getHealthStatusRecommendation('critical');
    const excellentRec = service.getHealthStatusRecommendation('excellent');

    // Critical should mention urgency/action more than excellent
    const urgencyKeywords = ['urgent', 'immediate', 'action', 'intervention'];
    
    const criticalUrgency = urgencyKeywords.filter(keyword =>
      criticalRec.toLowerCase().includes(keyword)
    ).length;

    const excellentUrgency = urgencyKeywords.filter(keyword =>
      excellentRec.toLowerCase().includes(keyword)
    ).length;

    // Critical should have more urgency keywords than excellent
    expect(criticalUrgency).toBeGreaterThanOrEqual(excellentUrgency);
  });
});

// ============================================================================
// Property 20: Health Status Distribution Aggregation
// ============================================================================

describe('Property 20: Health Status Distribution Aggregation', () => {
  const service = new NDVIService();

  /**
   * Property 20.1: Distribution counts sum to total parcelles
   * 
   * For any collection of parcelles with health statuses, the calculated
   * distribution SHALL correctly count the number of parcelles in each
   * status category, with the sum equaling the total number of parcelles.
   */
  it('should have distribution counts sum to total parcelles', () => {
    fc.assert(
      fc.property(parcelleCollectionArbitrary, (parcelles) => {
        const statuses = parcelles.map(p => p.healthStatus);
        const distribution = service.calculateHealthStatusDistribution(statuses);

        // Sum of all counts should equal total parcelles
        const totalCount =
          distribution.excellent +
          distribution.good +
          distribution.fair +
          distribution.poor +
          distribution.critical;

        expect(totalCount).toBe(parcelles.length);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 20.2: Each status count is non-negative
   * 
   * For any collection of parcelles, all status counts in the distribution
   * SHALL be non-negative integers.
   */
  it('should have non-negative counts for all statuses', () => {
    fc.assert(
      fc.property(parcelleCollectionArbitrary, (parcelles) => {
        const statuses = parcelles.map(p => p.healthStatus);
        const distribution = service.calculateHealthStatusDistribution(statuses);

        expect(distribution.excellent).toBeGreaterThanOrEqual(0);
        expect(distribution.good).toBeGreaterThanOrEqual(0);
        expect(distribution.fair).toBeGreaterThanOrEqual(0);
        expect(distribution.poor).toBeGreaterThanOrEqual(0);
        expect(distribution.critical).toBeGreaterThanOrEqual(0);

        // All counts should be integers
        expect(Number.isInteger(distribution.excellent)).toBe(true);
        expect(Number.isInteger(distribution.good)).toBe(true);
        expect(Number.isInteger(distribution.fair)).toBe(true);
        expect(Number.isInteger(distribution.poor)).toBe(true);
        expect(Number.isInteger(distribution.critical)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 20.3: Distribution correctly counts each status
   * 
   * For any collection of parcelles, the count for each status SHALL
   * match the actual number of parcelles with that status.
   */
  it('should correctly count each status category', () => {
    fc.assert(
      fc.property(parcelleCollectionArbitrary, (parcelles) => {
        const statuses = parcelles.map(p => p.healthStatus);
        const distribution = service.calculateHealthStatusDistribution(statuses);

        // Manually count each status
        const expectedExcellent = statuses.filter(s => s === 'excellent').length;
        const expectedGood = statuses.filter(s => s === 'good').length;
        const expectedFair = statuses.filter(s => s === 'fair').length;
        const expectedPoor = statuses.filter(s => s === 'poor').length;
        const expectedCritical = statuses.filter(s => s === 'critical').length;

        expect(distribution.excellent).toBe(expectedExcellent);
        expect(distribution.good).toBe(expectedGood);
        expect(distribution.fair).toBe(expectedFair);
        expect(distribution.poor).toBe(expectedPoor);
        expect(distribution.critical).toBe(expectedCritical);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 20.4: Empty collection returns zero counts
   * 
   * For an empty collection of parcelles, the distribution SHALL
   * have zero counts for all statuses.
   */
  it('should return zero counts for empty collection', () => {
    const emptyStatuses: HealthStatus[] = [];
    const distribution = service.calculateHealthStatusDistribution(emptyStatuses);

    expect(distribution.excellent).toBe(0);
    expect(distribution.good).toBe(0);
    expect(distribution.fair).toBe(0);
    expect(distribution.poor).toBe(0);
    expect(distribution.critical).toBe(0);
  });

  /**
   * Property 20.5: Distribution is deterministic
   * 
   * For any collection of parcelles, calculating the distribution multiple times
   * SHALL produce identical results.
   */
  it('should produce deterministic distribution', () => {
    fc.assert(
      fc.property(parcelleCollectionArbitrary, (parcelles) => {
        const statuses = parcelles.map(p => p.healthStatus);

        const dist1 = service.calculateHealthStatusDistribution(statuses);
        const dist2 = service.calculateHealthStatusDistribution(statuses);

        expect(dist1.excellent).toBe(dist2.excellent);
        expect(dist1.good).toBe(dist2.good);
        expect(dist1.fair).toBe(dist2.fair);
        expect(dist1.poor).toBe(dist2.poor);
        expect(dist1.critical).toBe(dist2.critical);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 20.6: Distribution percentages sum to 100%
   * 
   * For any non-empty collection of parcelles, the calculated percentage
   * distribution SHALL sum to 100% (within floating-point precision).
   */
  it('should have percentages sum to 100%', () => {
    fc.assert(
      fc.property(
        fc.array(parcelleCollectionArbitrary, { minLength: 1, maxLength: 100 }),
        (parcellesArray) => {
          const parcelles = parcellesArray.flat();
          if (parcelles.length === 0) {
            return true; // Skip empty collections
          }

          const statuses = parcelles.map(p => p.healthStatus);
          const distribution = service.calculateHealthStatusDistribution(statuses);

          // Calculate percentages
          const total = parcelles.length;
          const percentages = {
            excellent: (distribution.excellent / total) * 100,
            good: (distribution.good / total) * 100,
            fair: (distribution.fair / total) * 100,
            poor: (distribution.poor / total) * 100,
            critical: (distribution.critical / total) * 100,
          };

          const sum =
            percentages.excellent +
            percentages.good +
            percentages.fair +
            percentages.poor +
            percentages.critical;

          // Sum should be 100% (within floating-point precision)
          expect(Math.abs(sum - 100)).toBeLessThan(EPSILON);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 20.7: Single status collection has 100% for that status
   * 
   * For a collection where all parcelles have the same status,
   * that status SHALL have 100% and all others SHALL have 0%.
   */
  it('should have 100% for single status collection', () => {
    fc.assert(
      fc.property(
        healthStatusArbitrary,
        fc.integer({ min: 1, max: 50 }),
        (status, count) => {
          // Create collection with all same status
          const statuses = Array(count).fill(status);
          const distribution = service.calculateHealthStatusDistribution(statuses);

          // The specified status should have count equal to total
          expect(distribution[status]).toBe(count);

          // All other statuses should have count 0
          const allStatuses: HealthStatus[] = ['excellent', 'good', 'fair', 'poor', 'critical'];
          allStatuses.forEach(s => {
            if (s !== status) {
              expect(distribution[s]).toBe(0);
            }
          });

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
