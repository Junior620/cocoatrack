// CocoaTrack V2 - Satellite Imagery Validation Schemas
// Zod schemas for satellite imagery API request validation

import { z } from 'zod';

// ============================================================================
// SATELLITE IMAGERY REQUEST VALIDATION
// ============================================================================

/**
 * Schema for GET /api/satellite/imagery request validation
 * 
 * Query parameters:
 * - parcelleId: UUID of the parcelle (required)
 * - date: ISO 8601 date string (optional, defaults to most recent)
 * - cloudCoverThreshold: Maximum acceptable cloud cover percentage 0-100 (optional, defaults to 20)
 * 
 * Validation rules:
 * - parcelleId must be a valid UUID
 * - date must be a valid ISO 8601 date string (YYYY-MM-DD or full ISO format)
 * - cloudCoverThreshold must be a number between 0 and 100 (inclusive)
 */
export const satelliteImageryRequestSchema = z.object({
  /**
   * Parcelle ID (UUID format)
   * Required - identifies which parcelle to retrieve imagery for
   */
  parcelleId: z
    .string()
    .uuid('Invalid parcelle ID format. Must be a valid UUID'),
  
  /**
   * Acquisition date for imagery (ISO 8601 format)
   * Optional - if not provided, returns most recent available imagery
   * 
   * Accepts formats:
   * - YYYY-MM-DD (e.g., "2024-05-03")
   * - Full ISO 8601 (e.g., "2024-05-03T12:00:00Z")
   */
  date: z
    .string()
    .datetime({ message: 'Invalid date format. Must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)' })
    .optional()
    .or(
      z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'Invalid date format. Must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)'
      )
    )
    .optional(),
  
  /**
   * Maximum acceptable cloud cover percentage
   * Optional - defaults to 20% (suitable for tropical regions)
   * 
   * Range: 0-100 (inclusive)
   * - 0 = only completely cloud-free imagery
   * - 100 = accept any cloud cover
   */
  cloudCoverThreshold: z
    .number()
    .min(0, 'Cloud cover threshold must be at least 0')
    .max(100, 'Cloud cover threshold must be at most 100')
    .optional()
    .default(20),
});

export type SatelliteImageryRequest = z.infer<typeof satelliteImageryRequestSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse and validate query parameters for satellite imagery request
 * Converts string query parameters to appropriate types
 * 
 * @param searchParams - URLSearchParams from Next.js request
 * @returns Validated request parameters or validation error
 */
export function parseSatelliteImageryRequest(
  searchParams: URLSearchParams
): { success: true; data: SatelliteImageryRequest } | { success: false; error: z.ZodError } {
  const rawParams: Record<string, unknown> = {};
  
  // Extract parcelleId (required)
  if (searchParams.has('parcelleId')) {
    rawParams.parcelleId = searchParams.get('parcelleId');
  }
  
  // Extract date (optional)
  if (searchParams.has('date')) {
    rawParams.date = searchParams.get('date');
  }
  
  // Extract cloudCoverThreshold (optional, convert to number)
  if (searchParams.has('cloudCoverThreshold')) {
    const thresholdStr = searchParams.get('cloudCoverThreshold');
    const threshold = thresholdStr ? parseFloat(thresholdStr) : undefined;
    if (threshold !== undefined && !isNaN(threshold)) {
      rawParams.cloudCoverThreshold = threshold;
    }
  }
  
  // Validate with Zod schema
  const parseResult = satelliteImageryRequestSchema.safeParse(rawParams);
  
  if (parseResult.success) {
    return { success: true, data: parseResult.data };
  } else {
    return { success: false, error: parseResult.error };
  }
}

/**
 * Format validation error for API response
 * Extracts the first validation error and formats it for user-friendly display
 * 
 * @param error - Zod validation error
 * @returns Formatted error object with field and message
 */
export function formatValidationError(error: z.ZodError): {
  field: string;
  message: string;
} {
  const firstError = error.errors[0];
  return {
    field: firstError.path.join('.'),
    message: firstError.message,
  };
}
