/**
 * Unit tests for SAVI (Soil-Adjusted Vegetation Index, Huete)
 *
 * SAVI = ((NIR − Red) / (NIR + Red + L)) × (1 + L), L = 0.5
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePixelSAVI,
  calculatePixelWiseSAVI,
  calculateIndexStatistics,
  SAVI_L,
} from '@/lib/satellite/savi';
import { toReflectance01 } from '@/lib/satellite/evi';

describe('calculatePixelSAVI', () => {
  it('matches Huete formula with L=0.5 on reflectance [0,1]', () => {
    const nir = 0.4;
    const red = 0.1;
    const L = SAVI_L;
    const expected = ((nir - red) / (nir + red + L)) * (1 + L);
    expect(calculatePixelSAVI(nir, red)).toBeCloseTo(expected, 5);
    expect(SAVI_L).toBe(0.5);
  });

  it('produces same SAVI for raw DN and reflectance after unscale', () => {
    const fromReflectance = calculatePixelSAVI(0.4, 0.1);
    const fromDN = calculatePixelSAVI(4000, 1000);
    expect(fromDN).toBeCloseTo(fromReflectance, 5);
    expect(toReflectance01(4000)).toBeCloseTo(0.4);
  });

  it('clamps to [-1, 1]', () => {
    expect(calculatePixelSAVI(0.9, 0.01)).toBeLessThanOrEqual(1);
    expect(calculatePixelSAVI(0.01, 0.9)).toBeGreaterThanOrEqual(-1);
  });

  it('returns 0 when NIR + Red + L ≈ 0 (degenerate)', () => {
    // With L=0.5, denom is never ~0 for non-negative reflectance; force L=-0
    expect(calculatePixelSAVI(0, 0, 0)).toBe(0);
  });

  it('returns NaN for invalid inputs', () => {
    expect(calculatePixelSAVI(NaN, 0.1)).toBeNaN();
    expect(calculatePixelSAVI(0.4, NaN)).toBeNaN();
  });
});

describe('calculatePixelWiseSAVI', () => {
  it('flattens grids and computes per-pixel SAVI', () => {
    const nir = [
      [0.4, 0.5],
      [0.3, 0.6],
    ];
    const red = [
      [0.1, 0.12],
      [0.08, 0.15],
    ];
    const values = calculatePixelWiseSAVI(nir, red);
    expect(values).toHaveLength(4);
    expect(values[0]).toBeCloseTo(calculatePixelSAVI(0.4, 0.1), 5);
    expect(values[3]).toBeCloseTo(calculatePixelSAVI(0.6, 0.15), 5);
  });

  it('supports statistics via calculateIndexStatistics', () => {
    const values = calculatePixelWiseSAVI([[0.4, 0.5]], [[0.1, 0.12]]);
    const stats = calculateIndexStatistics(values);
    expect(stats).not.toBeNull();
    expect(stats!.mean).toBeCloseTo(
      (calculatePixelSAVI(0.4, 0.1) + calculatePixelSAVI(0.5, 0.12)) / 2,
      5
    );
  });
});
