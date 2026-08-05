/**
 * Unit tests for NDMI (Normalized Difference Moisture Index)
 *
 * NDMI = (NIR − SWIR) / (NIR + SWIR), clamp −1…1
 * Inputs: reflectance [0,1] or DN×10000 via toReflectance01
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePixelNDMI,
  calculatePixelWiseNDMI,
  calculateIndexStatistics,
} from '@/lib/satellite/ndmi';
import { toReflectance01 } from '@/lib/satellite/evi';

describe('calculatePixelNDMI', () => {
  it('matches (NIR − SWIR) / (NIR + SWIR) on reflectance [0,1]', () => {
    const nir = 0.4;
    const swir = 0.2;
    const expected = (nir - swir) / (nir + swir);
    expect(calculatePixelNDMI(nir, swir)).toBeCloseTo(expected, 5);
  });

  it('produces same NDMI for raw DN and reflectance after unscale', () => {
    const fromReflectance = calculatePixelNDMI(0.4, 0.2);
    const fromDN = calculatePixelNDMI(4000, 2000);
    expect(fromDN).toBeCloseTo(fromReflectance, 5);
    expect(toReflectance01(4000)).toBeCloseTo(0.4);
  });

  it('clamps to [-1, 1]', () => {
    // Extreme: NIR high, SWIR near 0 → approaches 1
    expect(calculatePixelNDMI(0.9, 0.01)).toBeLessThanOrEqual(1);
    expect(calculatePixelNDMI(0.01, 0.9)).toBeGreaterThanOrEqual(-1);
  });

  it('returns 0 when NIR + SWIR ≈ 0', () => {
    expect(calculatePixelNDMI(0, 0)).toBe(0);
  });

  it('returns NaN for invalid inputs', () => {
    expect(calculatePixelNDMI(NaN, 0.2)).toBeNaN();
    expect(calculatePixelNDMI(0.4, NaN)).toBeNaN();
  });
});

describe('calculatePixelWiseNDMI', () => {
  it('flattens grids and computes per-pixel NDMI', () => {
    const nir = [
      [0.4, 0.5],
      [0.3, 0.6],
    ];
    const swir = [
      [0.2, 0.25],
      [0.15, 0.3],
    ];
    const values = calculatePixelWiseNDMI(nir, swir);
    expect(values).toHaveLength(4);
    expect(values[0]).toBeCloseTo(calculatePixelNDMI(0.4, 0.2), 5);
    expect(values[3]).toBeCloseTo(calculatePixelNDMI(0.6, 0.3), 5);
  });

  it('supports statistics via calculateIndexStatistics', () => {
    const values = calculatePixelWiseNDMI([[0.4, 0.5]], [[0.2, 0.25]]);
    const stats = calculateIndexStatistics(values);
    expect(stats).not.toBeNull();
    expect(stats!.mean).toBeCloseTo(
      (calculatePixelNDMI(0.4, 0.2) + calculatePixelNDMI(0.5, 0.25)) / 2,
      5
    );
  });
});
