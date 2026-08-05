/**
 * NDRE — Normalized Difference Red Edge (Sentinel-2 B8A + B5 @ 20 m)
 *
 * NDRE = (NIR_narrow − RedEdge) / (NIR_narrow + RedEdge)
 * Sensitive to chlorophyll / nutritional stress under dense canopy.
 */

import {
  toReflectance01,
  clampIndex,
  calculateIndexStatistics,
  type IndexStatistics,
} from './evi';

export const NDRE_EPSILON = 1e-10;

export function calculatePixelNDRE(nirNarrow: number, redEdge: number): number {
  const n = toReflectance01(nirNarrow);
  const re = toReflectance01(redEdge);
  if (isNaN(n) || isNaN(re)) return NaN;
  const sum = n + re;
  if (Math.abs(sum) < NDRE_EPSILON) return 0;
  return clampIndex((n - re) / sum);
}

export function calculatePixelWiseNDRE(
  nirNarrow: number[][],
  redEdge: number[][]
): number[] {
  const values: number[] = [];
  const height = Math.min(nirNarrow.length, redEdge.length);
  for (let i = 0; i < height; i++) {
    const nRow = nirNarrow[i] || [];
    const reRow = redEdge[i] || [];
    const width = Math.min(nRow.length, reRow.length);
    for (let j = 0; j < width; j++) {
      values.push(calculatePixelNDRE(nRow[j], reRow[j]));
    }
  }
  return values;
}

export { calculateIndexStatistics, type IndexStatistics };
