/**
 * POST /api/satellite/ndvi/batch
 * 
 * Calculate NDVI for multiple parcelles in batch.
 * 
 * This endpoint:
 * 1. Validates request body (parcelleIds array)
 * 2. Authenticates the user
 * 3. Retrieves parcelle geometries from database
 * 4. Calculates NDVI for each parcelle in parallel (with concurrency limit)
 * 5. Returns results with success/failure status for each parcelle
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  InvalidGeometryError,
} from '@/lib/satellite/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of parcelles that can be processed in a single batch request
 */
const MAX_BATCH_SIZE = 100;

/**
 * Maximum number of concurrent NDVI calculations
 */
const MAX_CONCURRENCY = 5;

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for POST /api/satellite/ndvi/batch request body
 */
const BatchNDVIRequestSchema = z.object({
  parcelleIds: z
    .array(z.string().uuid('Invalid parcelle ID format'))
    .min(1, 'At least one parcelle ID is required')
    .max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} parcelles per batch`),
  date: z
    .string()
    .datetime({ message: 'Invalid date format. Use ISO 8601 format.' })
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  forceRecalculate: z.boolean().optional().default(false),
});

type BatchNDVIRequestBody = z.infer<typeof BatchNDVIRequestSchema>;

// ============================================================================
// Types
// ============================================================================

/**
 * Result for a single parcelle in the batch
 */
interface BatchParcelleResult {
  parcelleId: string;
  success: boolean;
  healthStatus?: string;
  meanNDVI?: number;
  error?: string;
  cached?: boolean;
}

/**
 * Batch response
 */
interface BatchNDVIResponse {
  totalRequested: number;
  successful: number;
  failed: number;
  results: BatchParcelleResult[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create error response with consistent format
 */
function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || 'UNKNOWN_ERROR',
    },
    { status }
  );
}

/**
 * Retrieve parcelle geometry from database
 */
async function getParcelleGeometry(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<MultiPolygon | null> {
  try {
    const { data: parcelle, error } = await supabase
      .from('parcelles')
      .select('geometry')
      .eq('id', parcelleId)
      .maybeSingle();

    if (error || !parcelle) {
      return null;
    }

    const parcelleData = parcelle as { geometry: unknown };

    if (!parcelleData.geometry) {
      return null;
    }

    const geometry = parcelleData.geometry as MultiPolygon;
    if (geometry.type !== 'MultiPolygon') {
      return null;
    }

    return geometry;
  } catch (error) {
    console.error('Error retrieving parcelle geometry:', error);
    return null;
  }
}

/**
 * Process a single parcelle NDVI calculation
 */
async function processParcelleNDVI(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string,
  date: Date,
  forceRecalculate: boolean
): Promise<BatchParcelleResult> {
  try {
    // Check cache first if not forcing recalculation
    if (!forceRecalculate) {
      const cachedResult = await ndviService.getCachedNDVI(parcelleId, date, supabase);
      if (cachedResult) {
        return {
          parcelleId,
          success: true,
          healthStatus: cachedResult.healthStatus,
          meanNDVI: cachedResult.meanNDVI,
          cached: true,
        };
      }
    }

    // Retrieve parcelle geometry
    const geometry = await getParcelleGeometry(supabase, parcelleId);
    if (!geometry) {
      return {
        parcelleId,
        success: false,
        error: 'Parcelle geometry not found',
      };
    }

    // Calculate NDVI
    const ndviResult = await ndviService.calculateNDVI(
      parcelleId,
      geometry,
      date,
      {
        forceRecalculate,
        storeResult: true,
        generateRaster: true, // Generate raster for visualization
      }
    );

    // Cache the result
    await ndviService.cacheNDVI(ndviResult);

    return {
      parcelleId,
      success: true,
      healthStatus: ndviResult.healthStatus,
      meanNDVI: ndviResult.meanNDVI,
      cached: false,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof NDVICalculationError) {
      errorMessage = error.message;
    } else if (error instanceof InsufficientDataError) {
      errorMessage = error.message;
    } else if (error instanceof InvalidGeometryError) {
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      parcelleId,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Process parcelles in batches with concurrency limit
 */
async function processBatchWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/satellite/ndvi/batch
 * 
 * Calculate NDVI for multiple parcelles
 * 
 * Request Body:
 * {
 *   "parcelleIds": ["uuid1", "uuid2", ...],
 *   "date": "2024-01-15T00:00:00Z", // Optional, defaults to current date
 *   "forceRecalculate": false // Optional, defaults to false
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalRequested": 10,
 *     "successful": 8,
 *     "failed": 2,
 *     "results": [
 *       {
 *         "parcelleId": "uuid1",
 *         "success": true,
 *         "healthStatus": "good",
 *         "meanNDVI": 0.65,
 *         "cached": false
 *       },
 *       {
 *         "parcelleId": "uuid2",
 *         "success": false,
 *         "error": "Geometry not found"
 *       }
 *     ]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    const validationResult = BatchNDVIRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleIds, date, forceRecalculate } = validationResult.data;

    // Step 2: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Step 3: Process parcelles with concurrency limit
    console.log(`[Batch NDVI] Processing ${parcelleIds.length} parcelles with concurrency ${MAX_CONCURRENCY}`);
    
    const results = await processBatchWithConcurrency(
      parcelleIds,
      (parcelleId) => processParcelleNDVI(supabase, parcelleId, date, forceRecalculate),
      MAX_CONCURRENCY
    );

    // Step 4: Calculate statistics
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const response: BatchNDVIResponse = {
      totalRequested: parcelleIds.length,
      successful,
      failed,
      results,
    };

    console.log(`[Batch NDVI] Completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/satellite/ndvi/batch:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
