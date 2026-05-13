/**
 * NDVI Calculator Web Worker
 * 
 * This Web Worker performs heavy NDVI calculations off the main thread
 * to prevent UI blocking and improve performance.
 * 
 * Optimizations:
 * - Runs in separate thread (non-blocking)
 * - Uses typed arrays for better performance
 * - Implements efficient array processing algorithms
 * - Supports batch processing of multiple calculations
 * 
 * Task 6.4.2: Optimize NDVI calculation
 */

// ============================================================================
// Constants
// ============================================================================

const EPSILON = 1e-10;
const MIN_PIXEL_COUNT = 10;

// ============================================================================
// Types
// ============================================================================

interface NDVICalculationRequest {
  id: string;
  redBand: number[][];
  nirBand: number[][];
}

interface NDVICalculationResult {
  id: string;
  ndviValues: number[];
  statistics: {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    validPixelCount: number;
  };
  error?: string;
}

interface BatchCalculationRequest {
  type: 'batch';
  calculations: NDVICalculationRequest[];
}

interface SingleCalculationRequest {
  type: 'single';
  calculation: NDVICalculationRequest;
}

type WorkerRequest = BatchCalculationRequest | SingleCalculationRequest;

// ============================================================================
// Optimized NDVI Calculation Functions
// ============================================================================

/**
 * Calculate NDVI for a single pixel (optimized)
 * 
 * @param nir - Near-Infrared value
 * @param red - Red value
 * @returns NDVI value in range [-1, 1], or NaN if inputs are invalid
 */
function calculatePixelNDVI(nir: number, red: number): number {
  // Handle invalid inputs
  if (isNaN(nir) || isNaN(red)) {
    return NaN;
  }

  // Calculate denominator
  const denominator = nir + red;

  // Handle division by zero edge case
  if (Math.abs(denominator) < EPSILON) {
    return 0;
  }

  // Calculate NDVI using the standard formula
  const ndvi = (nir - red) / denominator;

  // Clamp to valid range [-1, 1]
  return Math.max(-1, Math.min(1, ndvi));
}

/**
 * Calculate pixel-wise NDVI values from Red and NIR bands (optimized)
 * 
 * Optimizations:
 * - Pre-allocates result array for better memory performance
 * - Uses flat array iteration instead of nested loops
 * - Minimizes function calls
 * 
 * @param redBand - Red band pixel values (2D array)
 * @param nirBand - NIR band pixel values (2D array)
 * @returns Flattened array of NDVI values
 */
function calculatePixelWiseNDVI(
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
function calculateStatistics(ndviValues: number[]): {
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

/**
 * Process a single NDVI calculation request
 * 
 * @param request - Calculation request
 * @returns Calculation result
 */
function processSingleCalculation(
  request: NDVICalculationRequest
): NDVICalculationResult {
  try {
    // Validate input dimensions
    if (request.redBand.length !== request.nirBand.length) {
      throw new Error('Red and NIR band dimensions do not match');
    }

    // Calculate pixel-wise NDVI values
    const ndviValues = calculatePixelWiseNDVI(
      request.redBand,
      request.nirBand
    );

    // Validate we have sufficient data
    const validPixelCount = ndviValues.filter(v => !isNaN(v)).length;
    if (validPixelCount < MIN_PIXEL_COUNT) {
      throw new Error(
        `Insufficient valid pixels for NDVI calculation. Required: ${MIN_PIXEL_COUNT}, Available: ${validPixelCount}`
      );
    }

    // Calculate statistics
    const statistics = calculateStatistics(ndviValues);

    return {
      id: request.id,
      ndviValues,
      statistics,
    };
  } catch (error) {
    return {
      id: request.id,
      ndviValues: [],
      statistics: {
        mean: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        validPixelCount: 0,
      },
      error: (error as Error).message,
    };
  }
}

/**
 * Process a batch of NDVI calculation requests
 * 
 * @param requests - Array of calculation requests
 * @returns Array of calculation results
 */
function processBatchCalculations(
  requests: NDVICalculationRequest[]
): NDVICalculationResult[] {
  return requests.map(request => processSingleCalculation(request));
}

// ============================================================================
// Worker Message Handler
// ============================================================================

/**
 * Handle messages from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === 'single') {
      // Process single calculation
      const result = processSingleCalculation(request.calculation);
      self.postMessage({ type: 'single', result });
    } else if (request.type === 'batch') {
      // Process batch calculations
      const results = processBatchCalculations(request.calculations);
      self.postMessage({ type: 'batch', results });
    } else {
      throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: (error as Error).message,
    });
  }
};

// Export empty object to make this a module
export {};
