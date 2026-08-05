/**
 * Synchronous NDVI Calculator
 * 
 * Provides synchronous NDVI calculation functions for fallback when
 * Web Workers are not available.
 * 
 * These functions are identical to the worker implementation but run
 * on the main thread.
 * 
 * Task 6.4.2: Optimize NDVI calculation
 */

// ============================================================================
// Constants
// ============================================================================

const EPSILON = 1e-10;

// ============================================================================
// Optimized NDVI Calculation Functions
// ============================================================================

/**
 * Calculate pixel-wise NDVI values from Red and NIR bands (optimized)
 * 
 * Optimizations:
 * - Pre-allocates result array for better memory performance
 * - Uses flat array iteration instead of nested loops
 * - Minimizes function calls
 * - Inlines NDVI calculation for performance
 * 
 * @param redBand - Red band pixel values (2D array)
 * @param nirBand - NIR band pixel values (2D array)
 * @returns Flattened array of NDVI values
 */
export function calculatePixelWiseNDVI(
  redBand: number[][],
  nirBand: number[][]
): number[] {
  const height = redBand.length;
  if (height === 0) return [];
  
  const width = redBand[0].length;
  const totalPixels = height * width;
  
  // Pre-allocate result array for better performance
  const ndviValues = new Array<number>(totalPixels);
  
  let idx = 0;
  
  // Iterate through each row
  for (let row = 0; row < height; row++) {
    const redRow = redBand[row];
    const nirRow = nirBand[row];

    // Validate row dimensions match
    if (!redRow || !nirRow || redRow.length !== width) {
      // Fill with NaN for invalid rows
      for (let col = 0; col < width; col++) {
        ndviValues[idx++] = NaN;
      }
      continue;
    }

    // Iterate through each pixel in the row
    for (let col = 0; col < width; col++) {
      const red = redRow[col];
      const nir = nirRow[col];

      // Inline NDVI calculation for performance
      if (isNaN(nir) || isNaN(red)) {
        ndviValues[idx++] = NaN;
      } else {
        const denominator = nir + red;
        if (Math.abs(denominator) < EPSILON) {
          ndviValues[idx++] = 0;
        } else {
          const ndvi = (nir - red) / denominator;
          ndviValues[idx++] = Math.max(-1, Math.min(1, ndvi));
        }
      }
    }
  }

  return ndviValues;
}

/**
 * Calculate statistics from NDVI pixel values (optimized)
 * 
 * Optimizations:
 * - Single-pass algorithm for mean, min, max
 * - Separate pass for standard deviation (required)
 * - Avoids array methods like filter() and reduce() for better performance
 * 
 * @param ndviValues - Array of NDVI values (may contain NaN)
 * @returns NDVI statistics
 */
export function calculateStatistics(ndviValues: number[]): {
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  validPixelCount: number;
} {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let validCount = 0;

  // First pass: calculate sum, min, max, and count valid pixels
  for (let i = 0; i < ndviValues.length; i++) {
    const value = ndviValues[i];
    
    if (!isNaN(value)) {
      sum += value;
      validCount++;
      
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (validCount === 0) {
    throw new Error('No valid NDVI values found');
  }

  // Calculate mean
  const mean = sum / validCount;

  // Second pass: calculate standard deviation
  let squaredDiffSum = 0;
  for (let i = 0; i < ndviValues.length; i++) {
    const value = ndviValues[i];
    
    if (!isNaN(value)) {
      const diff = value - mean;
      squaredDiffSum += diff * diff;
    }
  }

  const variance = squaredDiffSum / validCount;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    min,
    max,
    stdDev,
    validPixelCount: validCount,
  };
}

// Re-export EVI helpers for worker fallback / main-thread parity
export {
  calculatePixelWiseEVI,
  calculateIndexStatistics as calculateEVIStatistics,
  calculatePixelEVIAuto,
} from '../evi';

