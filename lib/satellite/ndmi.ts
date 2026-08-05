/**
 * NDMI (Normalized Difference Moisture Index)
 *
 * NDMI = (NIR - SWIR) / (NIR + SWIR)
 *
 * Sentinel-2 V1: B8A (NIR narrow, 20 m) + B11 (SWIR1, 20 m).
 * Inputs must be surface reflectance in [0, 1] (DN×10000 via toReflectance01).
 */

import {
  toReflectance01,
  clampIndex,
  calculateIndexStatistics,
  type IndexStatistics,
} from './evi';

export const NDMI_EPSILON = 1e-10;

/**
 * NDMI from NIR + SWIR reflectance (or DN×10000).
 */
export function calculatePixelNDMI(nir: number, swir: number): number {
  const n = toReflectance01(nir);
  const s = toReflectance01(swir);

  if (isNaN(n) || isNaN(s)) return NaN;

  const sum = n + s;
  if (Math.abs(sum) < NDMI_EPSILON) return 0;

  return clampIndex((n - s) / sum);
}

/**
 * Flatten band grids and compute NDMI per pixel.
 */
export function calculatePixelWiseNDMI(
  nir: number[][],
  swir: number[][]
): number[] {
  const values: number[] = [];
  const height = Math.min(nir.length, swir.length);

  for (let i = 0; i < height; i++) {
    const nirRow = nir[i] || [];
    const swirRow = swir[i] || [];
    const width = Math.min(nirRow.length, swirRow.length);

    for (let j = 0; j < width; j++) {
      values.push(calculatePixelNDMI(nirRow[j], swirRow[j]));
    }
  }

  return values;
}

export { calculateIndexStatistics, type IndexStatistics };
