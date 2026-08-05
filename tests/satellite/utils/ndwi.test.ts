/**
 * Unit tests for NDWI (McFeeters)
 *
 * NDWI = (Green − NIR) / (Green + NIR), clamp −1…1
 * Inputs: reflectance [0,1] or DN×10000 via toReflectance01
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePixelNDWI,
  calculatePixelWiseNDWI,
  calculateIndexStatistics,
} from '@/lib/satellite/ndwi';
import { toReflectance01 } from '@/lib/satellite/evi';

describe('calculatePixelNDWI', () => {
  it('matches (Green − NIR) / (Green + NIR) on reflectance [0,1]', () => {
    const green = 0.2;
    const nir = 0.4;
    const expected = (green - nir) / (green + nir);
    expect(calculatePixelNDWI(green, nir)).toBeCloseTo(expected, 5);
  });

  it('produces same NDWI for raw DN and reflectance after unscale', () => {
    const fromReflectance = calculatePixelNDWI(0.2, 0.4);
    const fromDN = calculatePixelNDWI(2000, 4000);
    expect(fromDN).toBeCloseTo(fromReflectance, 5);
    expect(toReflectance01(2000)).toBeCloseTo(0.2);
  });

  it('clamps to [-1, 1]', () => {
    expect(calculatePixelNDWI(0.9, 0.01)).toBeLessThanOrEqual(1);
    expect(calculatePixelNDWI(0.01, 0.9)).toBeGreaterThanOrEqual(-1);
  });

  it('returns 0 when Green + NIR ≈ 0', () => {
    expect(calculatePixelNDWI(0, 0)).toBe(0);
  });

  it('returns NaN for invalid inputs', () => {
    expect(calculatePixelNDWI(NaN, 0.4)).toBeNaN();
    expect(calculatePixelNDWI(0.2, NaN)).toBeNaN();
  });
});

describe('calculatePixelWiseNDWI', () => {
  it('flattens grids and computes per-pixel NDWI', () => {
    const green = [
      [0.2, 0.25],
      [0.15, 0.3],
    ];
    const nir = [
      [0.4, 0.5],
      [0.3, 0.6],
    ];
    const values = calculatePixelWiseNDWI(green, nir);
    expect(values).toHaveLength(4);
    expect(values[0]).toBeCloseTo(calculatePixelNDWI(0.2, 0.4), 5);
    expect(values[3]).toBeCloseTo(calculatePixelNDWI(0.3, 0.6), 5);
  });

  it('supports statistics via calculateIndexStatistics', () => {
    const values = calculatePixelWiseNDWI([[0.2, 0.25]], [[0.4, 0.5]]);
    const stats = calculateIndexStatistics(values);
    expect(stats).not.toBeNull();
    expect(stats!.mean).toBeCloseTo(
      (calculatePixelNDWI(0.2, 0.4) + calculatePixelNDWI(0.25, 0.5)) / 2,
      5
    );
  });
});
