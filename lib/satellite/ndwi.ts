/**
 * NDWI — Normalized Difference Water Index (McFeeters 1996)
 *
 * NDWI = (Green − NIR) / (Green + NIR)
 *
 * Sentinel-2 V1: B3 (Green 10 m) + B8 (NIR 10 m).
 * Complements NDMI (foliar moisture via SWIR): NDWI emphasises open water / wet soil.
 * Inputs: surface reflectance [0,1] (DN×10000 via toReflectance01).
 */

import {
  toReflectance01,
  clampIndex,
  calculateIndexStatistics,
  type IndexStatistics,
} from './evi';

export const NDWI_EPSILON = 1e-10;

/**
 * NDWI from Green + NIR reflectance (or DN×10000).
 */
export function calculatePixelNDWI(green: number, nir: number): number {
  const g = toReflectance01(green);
  const n = toReflectance01(nir);

  if (isNaN(g) || isNaN(n)) return NaN;

  const sum = g + n;
  if (Math.abs(sum) < NDWI_EPSILON) return 0;

  return clampIndex((g - n) / sum);
}

/**
 * Flatten band grids and compute NDWI per pixel.
 */
export function calculatePixelWiseNDWI(
  green: number[][],
  nir: number[][]
): number[] {
  const values: number[] = [];
  const height = Math.min(green.length, nir.length);

  for (let i = 0; i < height; i++) {
    const greenRow = green[i] || [];
    const nirRow = nir[i] || [];
    const width = Math.min(greenRow.length, nirRow.length);

    for (let j = 0; j < width; j++) {
      values.push(calculatePixelNDWI(greenRow[j], nirRow[j]));
    }
  }

  return values;
}

export { calculateIndexStatistics, type IndexStatistics };
