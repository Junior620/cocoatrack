/**
 * Property-Based Tests for NDVI Calculation
 * 
 * This file implements property-based testing for NDVI calculation logic using fast-check.
 * Property-based testing validates that certain properties hold true across a wide range
 * of randomly generated inputs, providing stronger correctness guarantees than example-based tests.
 * 
 * Properties tested:
 * - Property 2: NDVI calculation formula correctness
 * - Property 4: NDVI statistics calculation correctness
 * 
 * Requirements: Task 2.1.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NDVIService } from '@/lib/satellite/services/ndvi.service';

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
 * Arbitrary for generating valid band values (0-10000)
 * Sentinel-2 bands typically have values in this range
 */
const bandValueArbitrary = fc.integer({ min: 0, max: 10000 });

/**
 * Arbitrary for generating NDVI values in valid range [-1, 1]
 */
const ndviValueArbitrary = fc.double({ min: -1, max: 1, noNaN: true });

/**
 * Arbitrary for generating arrays of NDVI values
 * Includes some NaN values to test filtering
 */
const ndviArrayArbitrary = fc.array(
  fc.oneof(
    ndviValueArbitrary,
    fc.constant(NaN).map(() => NaN)
  ),
  { minLength: 1, maxLength: 1000 }
);

/**
 * Arbitrary for generating 2D band arrays (pixel grids)
 * Represents satellite imagery band data
 */
const bandArrayArbitrary = fc.array(
  fc.array(bandValueArbitrary, { minLength: 1, maxLength: 100 }),
  { minLength: 1, maxLength: 100 }
);

// ============================================================================
// Property 2: NDVI Calculation Formula Correctness
// ============================================================================

describe('Property 2: NDVI Calculation Formula Correctness', () => {
  const service = new NDVIService();

  /**
   * Property 2.1: NDVI formula produces values in range [-1, 1]
   * 
   * For any valid NIR and Red band values, the calculated NDVI must be
   * within the valid range of [-1, 1].
   * 
   * This property validates that the NDVI formula:
   *   NDVI = (NIR - Red) / (NIR + Red)
   * 
   * Always produces values in the mathematically correct range.
   */
  it('should always produce NDVI values in range [-1, 1] for valid inputs', () => {
    fc.assert(
      fc.property(bandValueArbitrary, bandValueArbitrary, (nir, red) => {
        // Access private method for testing
        const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
        const ndvi = calculatePixelNDVI(nir, red);

        // Skip NaN results (when both values are 0)
        if (isNaN(ndvi)) {
          return true;
        }

        // NDVI must be in range [-1, 1]
        expect(ndvi).toBeGreaterThanOrEqual(-1);
        expect(ndvi).toBeLessThanOrEqual(1);
        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.2: NDVI formula correctness
   * 
   * For any valid NIR and Red band values where NIR + Red > 0,
   * the calculated NDVI must equal (NIR - Red) / (NIR + Red).
   * 
   * This property validates the mathematical correctness of the NDVI formula.
   */
  it('should calculate NDVI using formula (NIR - Red) / (NIR + Red)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (nir, red) => {
          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          const ndvi = calculatePixelNDVI(nir, red);

          // Calculate expected NDVI manually
          const expected = (nir - red) / (nir + red);

          // NDVI should match expected value (within floating-point precision)
          expect(Math.abs(ndvi - expected)).toBeLessThan(EPSILON);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.3: NDVI symmetry property
   * 
   * For any NIR and Red values, swapping them should produce the negative NDVI.
   * 
   * Mathematical property:
   *   NDVI(NIR, Red) = -NDVI(Red, NIR)
   * 
   * This validates the symmetry of the NDVI formula.
   */
  it('should satisfy symmetry property: NDVI(NIR, Red) = -NDVI(Red, NIR)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (nir, red) => {
          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          
          const ndvi1 = calculatePixelNDVI(nir, red);
          const ndvi2 = calculatePixelNDVI(red, nir);

          // NDVI(NIR, Red) should equal -NDVI(Red, NIR)
          expect(Math.abs(ndvi1 + ndvi2)).toBeLessThan(EPSILON);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.4: NDVI monotonicity with respect to NIR
   * 
   * For fixed Red value, increasing NIR should increase NDVI.
   * 
   * This validates that NDVI correctly reflects vegetation health:
   * higher NIR reflectance (more vegetation) → higher NDVI.
   */
  it('should increase NDVI when NIR increases (for fixed Red)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 1, max: 100 }),
        (nir, red, delta) => {
          // Ensure NIR > Red for meaningful comparison
          if (nir <= red) {
            return true;
          }

          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          
          const ndvi1 = calculatePixelNDVI(nir, red);
          const ndvi2 = calculatePixelNDVI(nir + delta, red);

          // Increasing NIR should increase NDVI
          expect(ndvi2).toBeGreaterThanOrEqual(ndvi1);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.5: NDVI monotonicity with respect to Red
   * 
   * For fixed NIR value, increasing Red should decrease NDVI.
   * 
   * This validates that NDVI correctly reflects vegetation health:
   * higher Red reflectance (less vegetation) → lower NDVI.
   */
  it('should decrease NDVI when Red increases (for fixed NIR)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 1, max: 100 }),
        (nir, red, delta) => {
          // Ensure NIR > Red for meaningful comparison
          if (nir <= red) {
            return true;
          }

          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          
          const ndvi1 = calculatePixelNDVI(nir, red);
          const ndvi2 = calculatePixelNDVI(nir, red + delta);

          // Increasing Red should decrease NDVI
          expect(ndvi2).toBeLessThanOrEqual(ndvi1);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.6: NDVI edge case - division by zero handling
   * 
   * When NIR + Red ≈ 0, NDVI should be 0 (not NaN or Infinity).
   * 
   * This validates proper edge case handling in the NDVI formula.
   */
  it('should return 0 when NIR + Red ≈ 0 (division by zero case)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e-11, max: 1e-11 }),
        fc.double({ min: -1e-11, max: 1e-11 }),
        (nir, red) => {
          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          const ndvi = calculatePixelNDVI(nir, red);

          // When denominator is near zero, NDVI should be 0
          if (Math.abs(nir + red) < 1e-10) {
            expect(ndvi).toBe(0);
          }
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.7: NDVI with NaN inputs
   * 
   * When either NIR or Red is NaN, NDVI should be NaN.
   * 
   * This validates proper handling of invalid/missing data.
   */
  it('should return NaN when either input is NaN', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(NaN), bandValueArbitrary),
        fc.oneof(fc.constant(NaN), bandValueArbitrary),
        (nir, red) => {
          // Skip case where both are valid numbers
          if (!isNaN(nir) && !isNaN(red)) {
            return true;
          }

          // Access private method for testing
          const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);
          const ndvi = calculatePixelNDVI(nir, red);

          // If either input is NaN, result should be NaN
          if (isNaN(nir) || isNaN(red)) {
            expect(ndvi).toBeNaN();
          }
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 2.8: Pixel-wise NDVI calculation preserves array length
   * 
   * For any 2D band arrays with matching dimensions, the output NDVI array
   * should have length equal to the total number of pixels.
   * 
   * This validates that pixel-wise calculation processes all pixels.
   */
  it('should produce NDVI array with length equal to total pixels', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.nat({ max: 50 }),
        (rows, cols) => {
          // Skip empty arrays
          if (rows === 0 || cols === 0) {
            return true;
          }

          // Generate matching Red and NIR band arrays
          const redBand = Array(rows).fill(0).map(() => 
            Array(cols).fill(0).map(() => Math.floor(Math.random() * 1000))
          );
          const nirBand = Array(rows).fill(0).map(() => 
            Array(cols).fill(0).map(() => Math.floor(Math.random() * 1000))
          );

          // Access private method for testing
          const calculatePixelWiseNDVI = (service as any).calculatePixelWiseNDVI.bind(service);
          const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

          // Output array length should equal total pixels
          expect(ndviValues.length).toBe(rows * cols);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================================
// Property 4: NDVI Statistics Calculation Correctness
// ============================================================================

describe('Property 4: NDVI Statistics Calculation Correctness', () => {
  const service = new NDVIService();

  /**
   * Property 4.1: Mean is within [min, max] range
   * 
   * For any array of NDVI values, the calculated mean must be
   * between the minimum and maximum values (inclusive).
   * 
   * Mathematical property:
   *   min(values) ≤ mean(values) ≤ max(values)
   */
  it('should calculate mean within [min, max] range', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Mean should be between min and max
            expect(stats.mean).toBeGreaterThanOrEqual(stats.min);
            expect(stats.mean).toBeLessThanOrEqual(stats.max);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.2: Min is the smallest value
   * 
   * For any array of NDVI values, the calculated min must be
   * less than or equal to all values in the array.
   * 
   * Mathematical property:
   *   ∀v ∈ values: min(values) ≤ v
   */
  it('should calculate min as the smallest value', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Filter valid values
            const validValues = ndviValues.filter(v => !isNaN(v));

            // Min should be less than or equal to all valid values
            for (const value of validValues) {
              expect(stats.min).toBeLessThanOrEqual(value);
            }
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.3: Max is the largest value
   * 
   * For any array of NDVI values, the calculated max must be
   * greater than or equal to all values in the array.
   * 
   * Mathematical property:
   *   ∀v ∈ values: max(values) ≥ v
   */
  it('should calculate max as the largest value', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Filter valid values
            const validValues = ndviValues.filter(v => !isNaN(v));

            // Max should be greater than or equal to all valid values
            for (const value of validValues) {
              expect(stats.max).toBeGreaterThanOrEqual(value);
            }
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.4: Standard deviation is non-negative
   * 
   * For any array of NDVI values, the calculated standard deviation
   * must be non-negative (≥ 0).
   * 
   * Mathematical property:
   *   stdDev(values) ≥ 0
   */
  it('should calculate non-negative standard deviation', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Standard deviation must be non-negative
            expect(stats.stdDev).toBeGreaterThanOrEqual(0);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.5: Standard deviation is zero for constant arrays
   * 
   * For any array where all values are the same, the standard deviation
   * must be zero (no variance).
   * 
   * Mathematical property:
   *   ∀i,j: values[i] = values[j] ⟹ stdDev(values) = 0
   */
  it('should calculate zero standard deviation for constant arrays', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.integer({ min: 1, max: 100 }),
        (constantValue, arrayLength) => {
          // Create array with all same values
          const ndviValues = Array(arrayLength).fill(constantValue);

          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          const stats = calculateStatistics(ndviValues);

          // Standard deviation should be zero (within floating-point precision)
          expect(Math.abs(stats.stdDev)).toBeLessThan(EPSILON);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.6: Valid pixel count equals non-NaN values
   * 
   * For any array of NDVI values (including NaN), the valid pixel count
   * must equal the number of non-NaN values.
   * 
   * This validates proper filtering of invalid data.
   */
  it('should count only non-NaN values as valid pixels', () => {
    fc.assert(
      fc.property(ndviArrayArbitrary, (ndviValues) => {
        // Access private method for testing
        const calculateStatistics = (service as any).calculateStatistics.bind(service);
        
        try {
          const stats = calculateStatistics(ndviValues);

          // Count non-NaN values manually
          const expectedCount = ndviValues.filter(v => !isNaN(v)).length;

          // Valid pixel count should match
          expect(stats.validPixelCount).toBe(expectedCount);
          return true;
        } catch (error) {
          // If all values are NaN, InsufficientDataError is expected
          if ((error as Error).message.includes('No valid NDVI values')) {
            // Verify all values are indeed NaN
            const validCount = ndviValues.filter(v => !isNaN(v)).length;
            expect(validCount).toBe(0);
            return true;
          }
          throw error;
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.7: Mean calculation correctness
   * 
   * For any array of NDVI values, the calculated mean must equal
   * the sum of values divided by the count.
   * 
   * Mathematical property:
   *   mean(values) = sum(values) / count(values)
   */
  it('should calculate mean as sum divided by count', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Calculate expected mean manually
            const validValues = ndviValues.filter(v => !isNaN(v));
            const sum = validValues.reduce((acc, val) => acc + val, 0);
            const expectedMean = sum / validValues.length;

            // Mean should match expected value (within floating-point precision)
            expect(Math.abs(stats.mean - expectedMean)).toBeLessThan(EPSILON);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.8: Standard deviation calculation correctness
   * 
   * For any array of NDVI values, the calculated standard deviation
   * must match the mathematical formula:
   *   stdDev = sqrt(sum((x - mean)²) / n)
   * 
   * This validates the correctness of the variance/stdDev calculation.
   */
  it('should calculate standard deviation using correct formula', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Calculate expected standard deviation manually
            const validValues = ndviValues.filter(v => !isNaN(v));
            const mean = validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
            const squaredDiffs = validValues.map(v => Math.pow(v - mean, 2));
            const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / validValues.length;
            const expectedStdDev = Math.sqrt(variance);

            // Standard deviation should match expected value (within floating-point precision)
            expect(Math.abs(stats.stdDev - expectedStdDev)).toBeLessThan(EPSILON);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.9: Statistics are deterministic
   * 
   * For any array of NDVI values, calculating statistics multiple times
   * should produce identical results.
   * 
   * This validates that the calculation is deterministic and has no side effects.
   */
  it('should produce identical results when calculated multiple times', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            // Calculate statistics twice
            const stats1 = calculateStatistics(ndviValues);
            const stats2 = calculateStatistics(ndviValues);

            // Results should be identical
            expect(stats1.mean).toBe(stats2.mean);
            expect(stats1.min).toBe(stats2.min);
            expect(stats1.max).toBe(stats2.max);
            expect(stats1.stdDev).toBe(stats2.stdDev);
            expect(stats1.validPixelCount).toBe(stats2.validPixelCount);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 4.10: Min ≤ Mean ≤ Max relationship
   * 
   * For any array of NDVI values, the relationship min ≤ mean ≤ max
   * must always hold.
   * 
   * This is a fundamental statistical property.
   */
  it('should satisfy min ≤ mean ≤ max relationship', () => {
    fc.assert(
      fc.property(
        fc.array(ndviValueArbitrary, { minLength: 1, maxLength: 1000 }),
        (ndviValues) => {
          // Access private method for testing
          const calculateStatistics = (service as any).calculateStatistics.bind(service);
          
          try {
            const stats = calculateStatistics(ndviValues);

            // Verify min ≤ mean ≤ max
            expect(stats.min).toBeLessThanOrEqual(stats.mean);
            expect(stats.mean).toBeLessThanOrEqual(stats.max);
            return true;
          } catch (error) {
            // If all values are NaN, InsufficientDataError is expected
            if ((error as Error).message.includes('No valid NDVI values')) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
