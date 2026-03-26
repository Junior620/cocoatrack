// CocoaTrack V2 - Scanned Invoice Validation Schemas
// Zod schemas for scanned invoice file validation

import { z } from 'zod';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_SCANS_PER_INVOICE,
  SCANNED_INVOICE_ERROR_MESSAGES,
  type AllowedMimeType,
} from '@/types/scanned-invoices';

// ============================================================================
// FILE VALIDATION SCHEMA
// ============================================================================

/**
 * Schema for validating uploaded scanned invoice files
 * Validates:
 * - File is a File instance
 * - MIME type is in ALLOWED_MIME_TYPES
 * - File size is within MAX_FILE_SIZE_BYTES
 * 
 * @see Requirements 1.1, 1.2, 7.6
 */
export const uploadScannedInvoiceSchema = z.object({
  file: z
    .custom<File>((val) => val instanceof File, {
      message: 'File is required',
    })
    .refine(
      (file) => ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType),
      {
        message: SCANNED_INVOICE_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE,
      }
    )
    .refine(
      (file) => file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES,
      {
        message: SCANNED_INVOICE_ERROR_MESSAGES.FILE_TOO_LARGE,
      }
    ),
});

export type UploadScannedInvoiceInput = z.infer<typeof uploadScannedInvoiceSchema>;

// ============================================================================
// BULK DELETE SCHEMA
// ============================================================================

/**
 * Schema for bulk deletion of scanned invoices
 * Validates:
 * - scan_ids is an array of UUIDs
 * - At least one ID is provided
 * - Maximum 50 IDs per request (to prevent abuse)
 * 
 * @see Requirements 6.2
 */
export const bulkDeleteScannedInvoicesSchema = z.object({
  scan_ids: z
    .array(z.string().uuid('Invalid scan ID'))
    .min(1, 'At least one scan ID is required')
    .max(50, 'Maximum 50 scans can be deleted at once'),
});

export type BulkDeleteScannedInvoicesInput = z.infer<typeof bulkDeleteScannedInvoicesSchema>;

// ============================================================================
// SERVER-SIDE FILE VALIDATION
// ============================================================================

/**
 * Validate file MIME type on server-side
 * IMPORTANT: Never trust client-provided MIME type
 * This should be used with actual file content inspection
 * 
 * @param mimeType - The MIME type to validate
 * @returns true if valid, false otherwise
 * 
 * @see Requirements 7.6
 */
export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Validate file size on server-side
 * 
 * @param sizeBytes - The file size in bytes
 * @returns true if valid, false otherwise
 * 
 * @see Requirements 1.2
 */
export function validateFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Validate attachment limit for an invoice
 * 
 * @param currentCount - Current number of scanned invoices for the invoice
 * @returns true if under limit, false otherwise
 * 
 * @see Requirements 7.7
 */
export function validateAttachmentLimit(currentCount: number): boolean {
  return currentCount < MAX_SCANS_PER_INVOICE;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of file validation
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Comprehensive file validation
 * Validates MIME type, file size, and attachment limit
 * 
 * @param file - The file to validate
 * @param currentScanCount - Current number of scans for the invoice
 * @returns Validation result with error message if invalid
 */
export function validateScannedInvoiceFile(
  file: File,
  currentScanCount: number
): FileValidationResult {
  // Check MIME type
  if (!validateMimeType(file.type)) {
    return {
      valid: false,
      error: SCANNED_INVOICE_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE,
    };
  }

  // Check file size
  if (!validateFileSize(file.size)) {
    return {
      valid: false,
      error: SCANNED_INVOICE_ERROR_MESSAGES.FILE_TOO_LARGE,
    };
  }

  // Check attachment limit
  if (!validateAttachmentLimit(currentScanCount)) {
    return {
      valid: false,
      error: SCANNED_INVOICE_ERROR_MESSAGES.LIMIT_REACHED,
    };
  }

  return { valid: true };
}

// ============================================================================
// CONSTANTS EXPORT
// ============================================================================

/**
 * Re-export constants for convenience
 */
export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_SCANS_PER_INVOICE,
  SCANNED_INVOICE_ERROR_MESSAGES,
};
