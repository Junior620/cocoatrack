// CocoaTrack V2 - Parcelles Module Error Handling
// Standardized error codes, types, and helper functions for parcelle operations

import type {
  ParcelleErrorCode,
  ParcelleApiError,
  ShapefileMissingRequiredDetails,
  InvalidGeometryDetails,
  UnsupportedGeometryTypeDetails,
  LikelyProjectedCoordinatesDetails,
  LimitExceededDetails,
  DuplicateFileDetails,
  ValidationErrorDetails,
} from '@/types/parcelles';

// Re-export error codes from types for convenience
export { PARCELLE_ERROR_CODES } from '@/types/parcelles';
export type { ParcelleErrorCode, ParcelleApiError } from '@/types/parcelles';

// =============================================================================
// Error Code Enum (for runtime use)
// =============================================================================

/**
 * Error codes enum for parcelles module
 * 
 * This enum provides runtime access to error codes with full TypeScript support.
 * Use this for creating error responses and checking error types.
 * 
 * @example
 * ```typescript
 * import { ParcelleErrorCodes, createParcelleError } from '@/lib/errors/parcelle-errors';
 * 
 * if (missingFiles.length > 0) {
 *   throw createParcelleError(
 *     ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED,
 *     'Missing required shapefile components',
 *     { missing: missingFiles }
 *   );
 * }
 * ```
 */
export enum ParcelleErrorCodes {
  // Shapefile/Import errors
  SHAPEFILE_MISSING_REQUIRED = 'SHAPEFILE_MISSING_REQUIRED',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  UNSUPPORTED_GEOMETRY_TYPE = 'UNSUPPORTED_GEOMETRY_TYPE',
  LIKELY_PROJECTED_COORDINATES = 'LIKELY_PROJECTED_COORDINATES',
  MISSING_PRJ_ASSUMED_WGS84 = 'MISSING_PRJ_ASSUMED_WGS84',
  DUPLICATE_GEOMETRY = 'DUPLICATE_GEOMETRY',
  DUPLICATE_FILE = 'DUPLICATE_FILE',
  IMPORT_ALREADY_APPLIED = 'IMPORT_ALREADY_APPLIED',
  
  // Limit errors
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // General errors
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// =============================================================================
// Error Messages (Default messages for each error code)
// =============================================================================

/**
 * Default error messages for each error code
 * These can be overridden when creating errors
 */
export const PARCELLE_ERROR_MESSAGES: Record<ParcelleErrorCodes, string> = {
  [ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED]: 'Missing required shapefile components (.shp, .shx, .dbf)',
  [ParcelleErrorCodes.INVALID_GEOMETRY]: 'Invalid geometry provided',
  [ParcelleErrorCodes.UNSUPPORTED_GEOMETRY_TYPE]: 'Unsupported geometry type. Only Polygon and MultiPolygon are accepted',
  [ParcelleErrorCodes.LIKELY_PROJECTED_COORDINATES]: 'Coordinates appear to be in a projected coordinate system, not WGS84',
  [ParcelleErrorCodes.MISSING_PRJ_ASSUMED_WGS84]: 'Missing .prj file, assuming WGS84 (EPSG:4326)',
  [ParcelleErrorCodes.DUPLICATE_GEOMETRY]: 'A parcelle with this geometry already exists',
  [ParcelleErrorCodes.DUPLICATE_FILE]: 'This file has already been imported',
  [ParcelleErrorCodes.IMPORT_ALREADY_APPLIED]: 'This import has already been applied',
  [ParcelleErrorCodes.LIMIT_EXCEEDED]: 'Resource limit exceeded',
  [ParcelleErrorCodes.VALIDATION_ERROR]: 'Validation error',
  [ParcelleErrorCodes.NOT_FOUND]: 'Resource not found',
  [ParcelleErrorCodes.UNAUTHORIZED]: 'Not authorized to perform this action',
  [ParcelleErrorCodes.INTERNAL_ERROR]: 'An internal error occurred',
};

// =============================================================================
// HTTP Status Codes for each error
// =============================================================================

/**
 * HTTP status codes for each error code
 */
export const PARCELLE_ERROR_STATUS_CODES: Record<ParcelleErrorCodes, number> = {
  [ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED]: 400,
  [ParcelleErrorCodes.INVALID_GEOMETRY]: 400,
  [ParcelleErrorCodes.UNSUPPORTED_GEOMETRY_TYPE]: 400,
  [ParcelleErrorCodes.LIKELY_PROJECTED_COORDINATES]: 400,
  [ParcelleErrorCodes.MISSING_PRJ_ASSUMED_WGS84]: 200, // Warning, not error
  [ParcelleErrorCodes.DUPLICATE_GEOMETRY]: 409,
  [ParcelleErrorCodes.DUPLICATE_FILE]: 409,
  [ParcelleErrorCodes.IMPORT_ALREADY_APPLIED]: 409,
  [ParcelleErrorCodes.LIMIT_EXCEEDED]: 413,
  [ParcelleErrorCodes.VALIDATION_ERROR]: 400,
  [ParcelleErrorCodes.NOT_FOUND]: 404,
  [ParcelleErrorCodes.UNAUTHORIZED]: 401,
  [ParcelleErrorCodes.INTERNAL_ERROR]: 500,
};

// =============================================================================
// Error Response Helpers
// =============================================================================

/**
 * Create a standardized parcelle API error
 * 
 * @param code - Error code from ParcelleErrorCodes enum
 * @param message - Optional custom message (defaults to standard message for code)
 * @param details - Additional error details
 * @param requiresConfirmation - Whether user confirmation is required to proceed
 * @returns ParcelleApiError object
 * 
 * @example
 * ```typescript
 * const error = createParcelleError(
 *   ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED,
 *   'ZIP archive is missing required files',
 *   { missing: ['.shp', '.dbf'] }
 * );
 * ```
 */
export function createParcelleError(
  code: ParcelleErrorCodes | ParcelleErrorCode,
  message?: string,
  details: Record<string, unknown> = {},
  requiresConfirmation?: boolean
): ParcelleApiError {
  const errorCode = code as ParcelleErrorCode;
  return {
    error_code: errorCode,
    message: message || PARCELLE_ERROR_MESSAGES[code as ParcelleErrorCodes] || 'An error occurred',
    details,
    ...(requiresConfirmation !== undefined && { requires_confirmation: requiresConfirmation }),
  };
}

/**
 * Create a SHAPEFILE_MISSING_REQUIRED error
 * 
 * @param missing - Array of missing file extensions (e.g., ['.shp', '.dbf'])
 * @returns ParcelleApiError with ShapefileMissingRequiredDetails
 */
export function createShapefileMissingError(missing: string[]): ParcelleApiError {
  const details: ShapefileMissingRequiredDetails = { missing };
  return createParcelleError(
    ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED,
    `Missing required shapefile components: ${missing.join(', ')}`,
    { ...details }
  );
}

/**
 * Create an INVALID_GEOMETRY error
 * 
 * @param reason - Reason for geometry invalidity
 * @param featureIndex - Optional index of the feature in the import file
 * @returns ParcelleApiError with InvalidGeometryDetails
 */
export function createInvalidGeometryError(reason: string, featureIndex?: number): ParcelleApiError {
  const details: InvalidGeometryDetails = { reason };
  if (featureIndex !== undefined) {
    details.feature_index = featureIndex;
  }
  return createParcelleError(
    ParcelleErrorCodes.INVALID_GEOMETRY,
    `Invalid geometry: ${reason}`,
    { ...details }
  );
}

/**
 * Create an UNSUPPORTED_GEOMETRY_TYPE error
 * 
 * @param type - The unsupported geometry type found
 * @returns ParcelleApiError with UnsupportedGeometryTypeDetails
 */
export function createUnsupportedGeometryTypeError(type: string): ParcelleApiError {
  const details: UnsupportedGeometryTypeDetails = {
    type,
    expected: ['Polygon', 'MultiPolygon'],
  };
  return createParcelleError(
    ParcelleErrorCodes.UNSUPPORTED_GEOMETRY_TYPE,
    `Unsupported geometry type: ${type}. Expected Polygon or MultiPolygon`,
    { ...details }
  );
}

/**
 * Create a LIKELY_PROJECTED_COORDINATES warning
 * 
 * @param sampleCoord - Sample coordinate that appears to be projected
 * @returns ParcelleApiError with LikelyProjectedCoordinatesDetails and requires_confirmation=true
 */
export function createProjectedCoordinatesWarning(sampleCoord: [number, number]): ParcelleApiError {
  const details: LikelyProjectedCoordinatesDetails = { sample_coord: sampleCoord };
  return createParcelleError(
    ParcelleErrorCodes.LIKELY_PROJECTED_COORDINATES,
    'Coordinates appear to be in a projected coordinate system. Please confirm if you want to proceed assuming WGS84.',
    { ...details },
    true // requires_confirmation
  );
}

/**
 * Create a LIMIT_EXCEEDED error
 * 
 * @param limit - The limit that was exceeded
 * @param actual - The actual value that exceeded the limit
 * @param resource - The resource that was limited (e.g., 'features', 'file_size', 'export_rows')
 * @returns ParcelleApiError with LimitExceededDetails
 */
export function createLimitExceededError(
  limit: number,
  actual: number,
  resource: string
): ParcelleApiError {
  const details: LimitExceededDetails = { limit, actual, resource };
  return createParcelleError(
    ParcelleErrorCodes.LIMIT_EXCEEDED,
    `${resource} limit exceeded. Maximum ${limit} allowed, got ${actual}.`,
    { ...details }
  );
}

/**
 * Create a DUPLICATE_FILE error
 * 
 * @param existingImportId - ID of the existing import file with same SHA256
 * @returns ParcelleApiError with DuplicateFileDetails
 */
export function createDuplicateFileError(existingImportId: string): ParcelleApiError {
  const details: DuplicateFileDetails = { existing_import_id: existingImportId };
  return createParcelleError(
    ParcelleErrorCodes.DUPLICATE_FILE,
    'This file has already been imported',
    { ...details }
  );
}

/**
 * Create a VALIDATION_ERROR
 * 
 * @param field - Field that failed validation
 * @param message - Validation error message
 * @returns ParcelleApiError with ValidationErrorDetails
 */
export function createValidationError(field: string, message: string): ParcelleApiError {
  const details: ValidationErrorDetails = { field, message };
  return createParcelleError(
    ParcelleErrorCodes.VALIDATION_ERROR,
    message,
    { ...details }
  );
}

/**
 * Create a NOT_FOUND error
 * 
 * @param resourceType - Type of resource not found (e.g., 'parcelle', 'import_file')
 * @param id - ID of the resource that was not found
 * @returns ParcelleApiError
 */
export function createNotFoundError(resourceType: string, id: string): ParcelleApiError {
  return createParcelleError(
    ParcelleErrorCodes.NOT_FOUND,
    `${resourceType} not found`,
    { resource_type: resourceType, id }
  );
}

/**
 * Create an UNAUTHORIZED error
 * 
 * @param message - Optional custom message
 * @returns ParcelleApiError
 */
export function createUnauthorizedError(message?: string): ParcelleApiError {
  return createParcelleError(
    ParcelleErrorCodes.UNAUTHORIZED,
    message || 'Not authenticated'
  );
}

/**
 * Create an IMPORT_ALREADY_APPLIED error
 * 
 * @param importId - ID of the import that was already applied
 * @returns ParcelleApiError
 */
export function createImportAlreadyAppliedError(importId: string): ParcelleApiError {
  return createParcelleError(
    ParcelleErrorCodes.IMPORT_ALREADY_APPLIED,
    'This import has already been applied and cannot be applied again',
    { import_id: importId }
  );
}

/**
 * Create an INTERNAL_ERROR
 * 
 * @param reason - Internal error reason (for logging, may be sanitized for response)
 * @returns ParcelleApiError
 */
export function createInternalError(reason?: string): ParcelleApiError {
  return createParcelleError(
    ParcelleErrorCodes.INTERNAL_ERROR,
    'An internal error occurred',
    reason ? { reason } : {}
  );
}

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error is a ParcelleApiError
 * 
 * @param error - Unknown error object
 * @returns True if error is a ParcelleApiError
 */
export function isParcelleApiError(error: unknown): error is ParcelleApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error_code' in error &&
    'message' in error &&
    'details' in error
  );
}

/**
 * Check if an error has a specific error code
 * 
 * @param error - Unknown error object
 * @param code - Error code to check for
 * @returns True if error has the specified code
 */
export function hasErrorCode(error: unknown, code: ParcelleErrorCodes | ParcelleErrorCode): boolean {
  return isParcelleApiError(error) && error.error_code === code;
}

/**
 * Get HTTP status code for an error
 * 
 * @param error - ParcelleApiError or error code
 * @returns HTTP status code (defaults to 500 for unknown errors)
 */
export function getErrorStatusCode(error: ParcelleApiError | ParcelleErrorCodes | ParcelleErrorCode): number {
  const code = typeof error === 'string' ? error : error.error_code;
  return PARCELLE_ERROR_STATUS_CODES[code as ParcelleErrorCodes] || 500;
}

// =============================================================================
// Error Response Formatting (for API routes)
// =============================================================================

/**
 * Format error for API response
 * Ensures consistent error format across all endpoints
 * 
 * @param error - Error to format (can be ParcelleApiError, Error, or unknown)
 * @returns Formatted ParcelleApiError
 */
export function formatErrorResponse(error: unknown): ParcelleApiError {
  // Already a ParcelleApiError
  if (isParcelleApiError(error)) {
    return error;
  }
  
  // Standard Error object
  if (error instanceof Error) {
    // Check for specific error patterns in message
    if (error.message.includes('INVALID_GEOMETRY')) {
      return createInvalidGeometryError(error.message);
    }
    if (error.message.includes('NOT_FOUND')) {
      return createNotFoundError('resource', 'unknown');
    }
    if (error.message.includes('UNAUTHORIZED')) {
      return createUnauthorizedError();
    }
    
    // Generic internal error
    return createInternalError(error.message);
  }
  
  // Unknown error type
  return createInternalError('An unexpected error occurred');
}

/**
 * Create a JSON response object for API routes
 * 
 * @param error - ParcelleApiError to convert to response
 * @returns Object with error response and status code
 */
export function createErrorResponse(error: ParcelleApiError): {
  body: ParcelleApiError;
  status: number;
} {
  return {
    body: error,
    status: getErrorStatusCode(error),
  };
}

// =============================================================================
// Next.js Response Helpers (for API Route Handlers)
// =============================================================================

/**
 * Convert a ParcelleApiError to a NextResponse
 * 
 * This is the primary helper for returning errors from Next.js API routes.
 * It automatically sets the correct HTTP status code based on the error code.
 * 
 * @param error - ParcelleApiError to convert to NextResponse
 * @returns NextResponse with JSON body and appropriate status code
 * 
 * @example
 * ```typescript
 * import { createValidationError, toNextResponse } from '@/lib/errors/parcelle-errors';
 * 
 * export async function POST(request: NextRequest) {
 *   if (!isValid) {
 *     return toNextResponse(createValidationError('email', 'Invalid email format'));
 *   }
 *   // ...
 * }
 * ```
 */
export function toNextResponse(error: ParcelleApiError): Response {
  const status = getErrorStatusCode(error);
  return Response.json(error, { status });
}

/**
 * Create and return a validation error NextResponse
 * Convenience function combining createValidationError + toNextResponse
 * 
 * @param field - Field that failed validation
 * @param message - Validation error message
 * @returns NextResponse with 400 status
 */
export function validationErrorResponse(field: string, message: string): Response {
  return toNextResponse(createValidationError(field, message));
}

/**
 * Create and return a not found error NextResponse
 * Convenience function combining createNotFoundError + toNextResponse
 * 
 * @param resourceType - Type of resource not found
 * @param id - ID of the resource
 * @returns NextResponse with 404 status
 */
export function notFoundResponse(resourceType: string, id: string): Response {
  return toNextResponse(createNotFoundError(resourceType, id));
}

/**
 * Create and return an unauthorized error NextResponse
 * Convenience function combining createUnauthorizedError + toNextResponse
 * 
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function unauthorizedResponse(message?: string): Response {
  return toNextResponse(createUnauthorizedError(message));
}

/**
 * Create and return an internal error NextResponse
 * Convenience function combining createInternalError + toNextResponse
 * 
 * @param reason - Optional reason (for logging)
 * @returns NextResponse with 500 status
 */
export function internalErrorResponse(reason?: string): Response {
  return toNextResponse(createInternalError(reason));
}

/**
 * Create and return a limit exceeded error NextResponse
 * Convenience function combining createLimitExceededError + toNextResponse
 * 
 * @param limit - The limit that was exceeded
 * @param actual - The actual value
 * @param resource - The resource type
 * @returns NextResponse with 413 status
 */
export function limitExceededResponse(limit: number, actual: number, resource: string): Response {
  return toNextResponse(createLimitExceededError(limit, actual, resource));
}

/**
 * Create and return an invalid geometry error NextResponse
 * Convenience function combining createInvalidGeometryError + toNextResponse
 * 
 * @param reason - Reason for geometry invalidity
 * @param featureIndex - Optional feature index
 * @returns NextResponse with 400 status
 */
export function invalidGeometryResponse(reason: string, featureIndex?: number): Response {
  return toNextResponse(createInvalidGeometryError(reason, featureIndex));
}

/**
 * Create and return a shapefile missing required error NextResponse
 * Convenience function combining createShapefileMissingError + toNextResponse
 * 
 * @param missing - Array of missing file extensions
 * @returns NextResponse with 400 status
 */
export function shapefileMissingResponse(missing: string[]): Response {
  return toNextResponse(createShapefileMissingError(missing));
}

/**
 * Create and return an unsupported geometry type error NextResponse
 * Convenience function combining createUnsupportedGeometryTypeError + toNextResponse
 * 
 * @param type - The unsupported geometry type
 * @returns NextResponse with 400 status
 */
export function unsupportedGeometryTypeResponse(type: string): Response {
  return toNextResponse(createUnsupportedGeometryTypeError(type));
}

/**
 * Create and return a duplicate file error NextResponse
 * Convenience function combining createDuplicateFileError + toNextResponse
 * 
 * @param existingImportId - ID of the existing import
 * @returns NextResponse with 409 status
 */
export function duplicateFileResponse(existingImportId: string): Response {
  return toNextResponse(createDuplicateFileError(existingImportId));
}

/**
 * Create and return an import already applied error NextResponse
 * Convenience function combining createImportAlreadyAppliedError + toNextResponse
 * 
 * @param importId - ID of the import
 * @returns NextResponse with 409 status
 */
export function importAlreadyAppliedResponse(importId: string): Response {
  return toNextResponse(createImportAlreadyAppliedError(importId));
}

/**
 * Handle unknown errors and convert to NextResponse
 * 
 * This is useful in catch blocks where the error type is unknown.
 * It will format the error appropriately and return a NextResponse.
 * 
 * @param error - Unknown error to handle
 * @param logPrefix - Optional prefix for console.error logging
 * @returns NextResponse with appropriate status code
 * 
 * @example
 * ```typescript
 * try {
 *   // ... operation
 * } catch (error) {
 *   return handleErrorResponse(error, 'POST /api/parcelles');
 * }
 * ```
 */
export function handleErrorResponse(error: unknown, logPrefix?: string): Response {
  // Log the error
  if (logPrefix) {
    console.error(`${logPrefix}:`, error);
  } else {
    console.error('API Error:', error);
  }

  // Format and return
  const formattedError = formatErrorResponse(error);
  return toNextResponse(formattedError);
}
