/**
 * Unit tests for EVI (Enhanced Vegetation Index)
 *
 * NASA MODIS / USGS: EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
 * Backup EVI2 when blue missing/saturated.
 * Inputs must be reflectance [0,1] (DN×10000 auto-unscaled).
 */

import { describe, it, expect } from 'vitest';
import {
  toReflectance01,
  calculatePixelEVI,
  calculatePixelEVI2,
  calculatePixelEVIAuto,
  calculatePixelWiseEVI,
  calculateIndexStatistics,
} from '@/lib/satellite/evi';

describe('toReflectance01', () => {
  it('leaves values already in [0,1] unchanged', () => {
    expect(toReflectance01(0.12)).toBeCloseTo(0.12);
    expect(toReflectance01(0)).toBe(0);
    expect(toReflectance01(1)).toBe(1);
  });

  it('unscales Sentinel-2 / GEE DN × 10000', () => {
    expect(toReflectance01(1200)).toBeCloseTo(0.12);
    expect(toReflectance01(2500)).toBeCloseTo(0.25);
  });

  it('returns NaN for invalid inputs', () => {
    expect(toReflectance01(NaN)).toBeNaN();
    expect(toReflectance01(Infinity)).toBeNaN();
  });
});

describe('calculatePixelEVI', () => {
  it('matches NASA formula on reflectance [0,1]', () => {
    const nir = 0.3;
    const red = 0.05;
    const blue = 0.03;
    const expected =
      (2.5 * (nir - red)) / (nir + 6 * red - 7.5 * blue + 1);
    expect(calculatePixelEVI(nir, red, blue)).toBeCloseTo(expected, 5);
  });

  it('produces same EVI for raw DN and reflectance after unscale', () => {
    const fromReflectance = calculatePixelEVI(0.3, 0.05, 0.03);
    const fromDN = calculatePixelEVI(3000, 500, 300);
    expect(fromDN).toBeCloseTo(fromReflectance, 5);
  });

  it('falls back to EVI2 when blue is saturated', () => {
    const eviSat = calculatePixelEVI(0.3, 0.05, 0.98);
    const evi2 = calculatePixelEVI2(0.3, 0.05);
    expect(eviSat).toBeCloseTo(evi2, 5);
  });
});

describe('calculatePixelEVI2 / Auto', () => {
  it('computes EVI2 without blue', () => {
    const nir = 0.3;
    const red = 0.05;
    const expected = (2.5 * (nir - red)) / (nir + 2.4 * red + 1);
    expect(calculatePixelEVI2(nir, red)).toBeCloseTo(expected, 5);
  });

  it('Auto uses EVI2 when blue is missing', () => {
    expect(calculatePixelEVIAuto(0.3, 0.05, null)).toBeCloseTo(
      calculatePixelEVI2(0.3, 0.05),
      5
    );
    expect(calculatePixelEVIAuto(0.3, 0.05, undefined)).toBeCloseTo(
      calculatePixelEVI2(0.3, 0.05),
      5
    );
  });

  it('Auto uses full EVI when blue is present', () => {
    expect(calculatePixelEVIAuto(0.3, 0.05, 0.03)).toBeCloseTo(
      calculatePixelEVI(0.3, 0.05, 0.03),
      5
    );
  });
});

describe('calculatePixelWiseEVI + statistics', () => {
  it('aggregates pixel grids', () => {
    const red = [[500, 600], [550, 580]];
    const nir = [[3000, 2800], [2900, 3100]];
    const blue = [[300, 320], [310, 290]];
    const values = calculatePixelWiseEVI(red, nir, blue);
    expect(values).toHaveLength(4);
    const stats = calculateIndexStatistics(values);
    expect(stats).not.toBeNull();
    expect(stats!.mean).toBeGreaterThan(0);
    expect(stats!.mean).toBeLessThanOrEqual(1);
  });
});

describe('NDVI health_status non-regression (EVI independent)', () => {
  it('does not use EVI for NDVI ratio health thresholds conceptually', () => {
    // NDVI remains (NIR-Red)/(NIR+Red) regardless of EVI scale
    const nir = 3000;
    const red = 500;
    const ndvi = (nir - red) / (nir + red);
    const evi = calculatePixelEVI(nir, red, 300);
    expect(ndvi).toBeCloseTo(0.714, 2);
    // EVI is typically lower than NDVI for dense canopy — complementary signal
    expect(evi).toBeLessThan(ndvi);
    expect(evi).toBeGreaterThan(0);
  });
});
