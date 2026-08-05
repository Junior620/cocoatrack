/**
 * EVI (Enhanced Vegetation Index) — NASA MODIS / USGS coefficients.
 *
 * EVI  = G * (NIR - Red) / (NIR + C1*Red - C2*Blue + L)
 * EVI2 = G * (NIR - Red) / (NIR + 2.4*Red + L)   // backup without blue
 *
 * G=2.5, C1=6, C2=7.5, L=1
 *
 * CRITICAL: inputs must be surface reflectance in [0, 1].
 * Sentinel-2 / GEE S2_SR_HARMONIZED often returns DN scaled by 10000.
 */

export const EVI_GAIN = 2.5;
export const EVI_C1 = 6;
export const EVI_C2 = 7.5;
export const EVI_L = 1;
export const EVI2_C = 2.4;
export const EVI_EPSILON = 1e-10;

/**
 * Convert Sentinel-2 / GEE band value to reflectance [0, 1].
 * Values > 1.5 are treated as DN×10000 (typical S2_SR_HARMONIZED).
 */
export function toReflectance01(value: number): number {
  if (isNaN(value) || !Number.isFinite(value)) return NaN;
  if (value > 1.5) return value / 10000;
  return value;
}

export function clampIndex(value: number, min = -1, max = 1): number {
  if (isNaN(value)) return NaN;
  return Math.max(min, Math.min(max, value));
}

/**
 * Standard 3-band EVI (NASA MODIS). Requires blue band.
 */
export function calculatePixelEVI(nir: number, red: number, blue: number): number {
  const n = toReflectance01(nir);
  const r = toReflectance01(red);
  const b = toReflectance01(blue);

  if (isNaN(n) || isNaN(r) || isNaN(b)) return NaN;

  // Bright / saturated blue → prefer EVI2 (MODIS backup behaviour)
  if (b > 0.95) {
    return calculatePixelEVI2(nir, red);
  }

  const denominator = n + EVI_C1 * r - EVI_C2 * b + EVI_L;
  if (Math.abs(denominator) < EVI_EPSILON) return 0;

  return clampIndex((EVI_GAIN * (n - r)) / denominator);
}

/**
 * 2-band EVI backup (no blue) — MODIS Collection 5+.
 */
export function calculatePixelEVI2(nir: number, red: number): number {
  const n = toReflectance01(nir);
  const r = toReflectance01(red);

  if (isNaN(n) || isNaN(r)) return NaN;

  const denominator = n + EVI2_C * r + EVI_L;
  if (Math.abs(denominator) < EVI_EPSILON) return 0;

  return clampIndex((EVI_GAIN * (n - r)) / denominator);
}

/**
 * Prefer EVI when blue is available, else EVI2.
 */
export function calculatePixelEVIAuto(
  nir: number,
  red: number,
  blue?: number | null
): number {
  if (blue === null || blue === undefined || isNaN(blue)) {
    return calculatePixelEVI2(nir, red);
  }
  return calculatePixelEVI(nir, red, blue);
}

export interface IndexStatistics {
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  validCount: number;
}

export function calculateIndexStatistics(values: number[]): IndexStatistics | null {
  const valid = values.filter((v) => !isNaN(v) && Number.isFinite(v));
  if (valid.length === 0) return null;

  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  let min = valid[0];
  let max = valid[0];
  for (const v of valid) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const variance =
    valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean: clampIndex(mean),
    min: clampIndex(min),
    max: clampIndex(max),
    stdDev: Math.max(0, stdDev),
    validCount: valid.length,
  };
}

/**
 * Flatten band grids and compute EVI per pixel.
 */
export function calculatePixelWiseEVI(
  red: number[][],
  nir: number[][],
  blue?: number[][] | null
): number[] {
  const values: number[] = [];
  const height = Math.min(red.length, nir.length, blue?.length ?? red.length);

  for (let i = 0; i < height; i++) {
    const redRow = red[i] || [];
    const nirRow = nir[i] || [];
    const blueRow = blue?.[i];
    const width = Math.min(
      redRow.length,
      nirRow.length,
      blueRow?.length ?? redRow.length
    );

    for (let j = 0; j < width; j++) {
      values.push(
        calculatePixelEVIAuto(nirRow[j], redRow[j], blueRow ? blueRow[j] : null)
      );
    }
  }

  return values;
}
