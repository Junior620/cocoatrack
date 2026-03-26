// CocoaTrack V2 - Scanned Invoice Error Handling
// Centralized error handling and logging for scanned invoice operations

import {
  SCANNED_INVOICE_ERROR_MESSAGES,
  SCANNED_INVOICE_ERROR_CODES,
  type ScannedInvoiceErrorCode,
} from '@/types/scanned-invoices';

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base error class for scanned invoice operations
 */
export class ScannedInvoiceError extends Error {
  public readonly code: ScannedInvoiceErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ScannedInvoiceErrorCode,
    message?: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message || SCANNED_INVOICE_ERROR_MESSAGES[code as keyof typeof SCANNED_INVOICE_ERROR_MESSAGES] || 'Unknown error');
    this.name = 'ScannedInvoiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validation error for scanned invoice operations
 */
export class ScannedInvoiceValidationError extends ScannedInvoiceError {
  constructor(
    code: ScannedInvoiceErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, 400, details);
    this.name = 'ScannedInvoiceValidationError';
  }
}

/**
 * Storage error for scanned invoice operations
 */
export class ScannedInvoiceStorageError extends ScannedInvoiceError {
  constructor(
    code: ScannedInvoiceErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, 500, details);
    this.name = 'ScannedInvoiceStorageError';
  }
}

/**
 * Authorization error for scanned invoice operations
 */
export class ScannedInvoiceAuthError extends ScannedInvoiceError {
  constructor(
    code: ScannedInvoiceErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, 403, details);
    this.name = 'ScannedInvoiceAuthError';
  }
}

/**
 * Not found error for scanned invoice operations
 */
export class ScannedInvoiceNotFoundError extends ScannedInvoiceError {
  constructor(
    code: ScannedInvoiceErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, 404, details);
    this.name = 'ScannedInvoiceNotFoundError';
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  timestamp: string;
  operation: string;
  error_code: ScannedInvoiceErrorCode;
  error_message: string;
  user_id?: string;
  invoice_id?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  ip_address?: string;
  stack_trace?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an error to console with structured format
 * 
 * In production, this should be sent to a logging service like Sentry, DataDog, etc.
 * 
 * @param entry - Error log entry
 * 
 * @see Requirements 9.6
 */
export function logScannedInvoiceError(entry: ErrorLogEntry): void {
  const logEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
    module: 'scanned-invoices',
  };

  // Log to console with structured format
  console.error('[SCANNED_INVOICE_ERROR]', JSON.stringify(logEntry, null, 2));

  // TODO: In production, send to external logging service
  // Example: Sentry.captureException(new Error(entry.error_message), { extra: logEntry });
}

/**
 * Log an upload error with full context
 * 
 * @param error - The error object
 * @param context - Additional context
 * 
 * @see Requirements 9.6
 */
export function logUploadError(
  error: Error | ScannedInvoiceError,
  context: {
    user_id?: string;
    invoice_id?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    ip_address?: string;
  }
): void {
  const errorCode = error instanceof ScannedInvoiceError
    ? error.code
    : SCANNED_INVOICE_ERROR_CODES.UPLOAD_FAILED;

  logScannedInvoiceError({
    timestamp: new Date().toISOString(),
    operation: 'upload',
    error_code: errorCode,
    error_message: error.message,
    user_id: context.user_id,
    invoice_id: context.invoice_id,
    file_name: context.file_name,
    file_size: context.file_size,
    mime_type: context.mime_type,
    ip_address: context.ip_address,
    stack_trace: error.stack,
    details: error instanceof ScannedInvoiceError ? error.details : undefined,
  });
}

/**
 * Log a download error with full context
 * 
 * @param error - The error object
 * @param context - Additional context
 */
export function logDownloadError(
  error: Error | ScannedInvoiceError,
  context: {
    user_id?: string;
    scanned_invoice_id?: string;
    storage_path?: string;
    ip_address?: string;
  }
): void {
  const errorCode = error instanceof ScannedInvoiceError
    ? error.code
    : SCANNED_INVOICE_ERROR_CODES.DOWNLOAD_FAILED;

  logScannedInvoiceError({
    timestamp: new Date().toISOString(),
    operation: 'download',
    error_code: errorCode,
    error_message: error.message,
    user_id: context.user_id,
    ip_address: context.ip_address,
    stack_trace: error.stack,
    details: {
      scanned_invoice_id: context.scanned_invoice_id,
      storage_path: context.storage_path,
      ...(error instanceof ScannedInvoiceError ? error.details : {}),
    },
  });
}

/**
 * Log a delete error with full context
 * 
 * @param error - The error object
 * @param context - Additional context
 */
export function logDeleteError(
  error: Error | ScannedInvoiceError,
  context: {
    user_id?: string;
    scanned_invoice_id?: string;
    storage_path?: string;
    ip_address?: string;
  }
): void {
  const errorCode = error instanceof ScannedInvoiceError
    ? error.code
    : SCANNED_INVOICE_ERROR_CODES.DELETE_FAILED;

  logScannedInvoiceError({
    timestamp: new Date().toISOString(),
    operation: 'delete',
    error_code: errorCode,
    error_message: error.message,
    user_id: context.user_id,
    ip_address: context.ip_address,
    stack_trace: error.stack,
    details: {
      scanned_invoice_id: context.scanned_invoice_id,
      storage_path: context.storage_path,
      ...(error instanceof ScannedInvoiceError ? error.details : {}),
    },
  });
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format error for API response
 * 
 * @param error - The error object
 * @returns Formatted error response
 */
export function formatErrorResponse(error: Error | ScannedInvoiceError): {
  error: string;
  error_code?: ScannedInvoiceErrorCode;
  details?: Record<string, unknown>;
} {
  if (error instanceof ScannedInvoiceError) {
    return {
      error: error.message,
      error_code: error.code,
      details: error.details,
    };
  }

  return {
    error: error.message || 'Une erreur inattendue s\'est produite',
  };
}

/**
 * Get HTTP status code from error
 * 
 * @param error - The error object
 * @returns HTTP status code
 */
export function getErrorStatusCode(error: Error | ScannedInvoiceError): number {
  if (error instanceof ScannedInvoiceError) {
    return error.statusCode;
  }

  // Default to 500 for unknown errors
  return 500;
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Check if an error is a network error
 * 
 * @param error - The error object
 * @returns True if network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  if (error instanceof ScannedInvoiceError) {
    return error.code === SCANNED_INVOICE_ERROR_CODES.NETWORK_ERROR;
  }

  return false;
}

/**
 * Check if an error is a validation error
 * 
 * @param error - The error object
 * @returns True if validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof ScannedInvoiceValidationError) {
    return true;
  }

  if (error instanceof ScannedInvoiceError) {
    const validationErrorCodes: string[] = [
      SCANNED_INVOICE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      SCANNED_INVOICE_ERROR_CODES.FILE_TOO_LARGE,
      SCANNED_INVOICE_ERROR_CODES.LIMIT_REACHED,
    ];
    return validationErrorCodes.includes(error.code);
  }

  return false;
}

/**
 * Check if an error is a storage error
 * 
 * @param error - The error object
 * @returns True if storage error
 */
export function isStorageError(error: unknown): boolean {
  if (error instanceof ScannedInvoiceStorageError) {
    return true;
  }

  if (error instanceof ScannedInvoiceError) {
    const storageErrorCodes: string[] = [
      SCANNED_INVOICE_ERROR_CODES.STORAGE_ERROR,
      SCANNED_INVOICE_ERROR_CODES.STORAGE_FULL,
    ];
    return storageErrorCodes.includes(error.code);
  }

  return false;
}

/**
 * Get user-friendly error message
 * 
 * @param error - The error object
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ScannedInvoiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Map common error messages to user-friendly versions
    if (error.message.includes('fetch')) {
      return SCANNED_INVOICE_ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (error.message.includes('storage')) {
      return SCANNED_INVOICE_ERROR_MESSAGES.STORAGE_FULL;
    }

    return error.message;
  }

  return 'Une erreur inattendue s\'est produite';
}
