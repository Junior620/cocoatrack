/**
 * SAVI — Soil-Adjusted Vegetation Index (Huete 1988)
 *
 * SAVI = ((NIR − Red) / (NIR + Red + L)) × (1 + L)
 *
 * Sentinel-2 V1: B8 (NIR 10 m) + B4 (Red 10 m), same bands as NDVI.
 * L = 0.5 (moderate vegetation / soil mixing — young plants, sparse stand).
 * Complements NDVI/EVI where soil bias is high; less useful under dense shade cocoa.
 * Inputs: surface reflectance [0,1] (DN×10000 via toReflectance01).
 */

import {
  toReflectance01,
  clampIndex,
  calculateIndexStatistics,
  type IndexStatistics,
} from './evi';

export const SAVI_L = 0.5;
export const SAVI_EPSILON = 1e-10;

/**
 * SAVI from NIR + Red reflectance (or DN×10000).
 */
export function calculatePixelSAVI(
  nir: number,
  red: number,
  L: number = SAVI_L
): number {
  const n = toReflectance01(nir);
  const r = toReflectance01(red);

  if (isNaN(n) || isNaN(r) || isNaN(L)) return NaN;

  const denom = n + r + L;
  if (Math.abs(denom) < SAVI_EPSILON) return 0;

  return clampIndex(((n - r) / denom) * (1 + L));
}

/**
 * Flatten band grids and compute SAVI per pixel.
 */
export function calculatePixelWiseSAVI(
  nir: number[][],
  red: number[][],
  L: number = SAVI_L
): number[] {
  const values: number[] = [];
  const height = Math.min(nir.length, red.length);

  for (let i = 0; i < height; i++) {
    const nirRow = nir[i] || [];
    const redRow = red[i] || [];
    const width = Math.min(nirRow.length, redRow.length);

    for (let j = 0; j < width; j++) {
      values.push(calculatePixelSAVI(nirRow[j], redRow[j], L));
    }
  }

  return values;
}

export { calculateIndexStatistics, type IndexStatistics };
