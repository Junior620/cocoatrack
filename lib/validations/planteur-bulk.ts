// CocoaTrack V2 - Bulk Planteur Assignment Validation Schemas
// Zod schemas for bulk assignment operations

import { z } from 'zod';

// ============================================================================
// BULK ASSIGNMENT REQUEST SCHEMA
// ============================================================================

/**
 * Schema for bulk planteur assignment requests
 * Used by POST /api/planteurs/bulk-assign
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 * 
 * Validation rules:
 * - At least one planteur must be selected (Requirement 9.1)
 * - At least one assignment field must be specified or being cleared (Requirement 9.2)
 * - Chef planteur ID must be a valid UUID if provided (Requirement 9.3)
 * - Cooperative ID must be a valid UUID if provided (Requirement 9.4)
 * 
 * Assignment behavior:
 * - Both fields can be set simultaneously
 * - Setting a field to null explicitly clears the assignment
 * - Omitting a field leaves it unchanged
 */
export const bulkAssignmentSchema = z.object({
  /**
   * Array of planteur UUIDs to update
   * Must contain at least one ID
   */
  planteurIds: z
    .array(z.string().uuid('Invalid planteur ID'))
    .min(1, 'At least one planteur must be selected'),
  
  /**
   * Chef planteur ID to assign (optional)
   * - undefined: field not modified
   * - null: clear existing assignment
   * - UUID string: assign to this chef planteur
   */
  chefPlanteurId: z
    .string()
    .uuid('Invalid chef planteur ID')
    .nullable()
    .optional(),
  
  /**
   * Cooperative ID to assign (optional)
   * - undefined: field not modified
   * - null: clear existing assignment
   * - UUID string: assign to this cooperative
   */
  cooperativeId: z
    .string()
    .uuid('Invalid cooperative ID')
    .nullable()
    .optional(),
}).refine(
  (data) => data.chefPlanteurId !== undefined || data.cooperativeId !== undefined,
  {
    message: 'At least one assignment field (chef planteur or cooperative) must be specified',
    path: ['chefPlanteurId'],
  }
);

export type BulkAssignmentInput = z.infer<typeof bulkAssignmentSchema>;

// ============================================================================
// BULK ASSIGNMENT RESPONSE TYPES
// ============================================================================

/**
 * Individual error for a failed planteur update
 */
export interface BulkAssignmentError {
  planteurId: string;
  planteurName?: string;
  error: string;
}

/**
 * Response from bulk assignment operation
 * Contains success/failure counts and detailed error information
 */
export interface BulkAssignmentResponse {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: BulkAssignmentError[];
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Error codes for bulk assignment operations
 */
export const BULK_ASSIGNMENT_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_CHEF_PLANTEUR: 'INVALID_CHEF_PLANTEUR',
  INVALID_COOPERATIVE: 'INVALID_COOPERATIVE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
} as const;

export type BulkAssignmentErrorCode = typeof BULK_ASSIGNMENT_ERROR_CODES[keyof typeof BULK_ASSIGNMENT_ERROR_CODES];

/**
 * Error messages for bulk assignment operations
 */
export const BULK_ASSIGNMENT_ERROR_MESSAGES: Record<BulkAssignmentErrorCode, string> = {
  VALIDATION_ERROR: 'Validation failed for bulk assignment request',
  PERMISSION_DENIED: 'You do not have permission to update one or more planteurs',
  INVALID_CHEF_PLANTEUR: 'The specified chef planteur does not exist',
  INVALID_COOPERATIVE: 'The specified cooperative does not exist',
  DATABASE_ERROR: 'A database error occurred during bulk assignment',
  TRANSACTION_FAILED: 'The bulk assignment transaction failed',
};
