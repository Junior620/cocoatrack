// CocoaTrack V2 - Error Handling Module
// Re-exports all error handling utilities

// Export everything from parcelle-errors
export * from './parcelle-errors';

// Export scanned-invoice-errors with explicit re-exports to avoid conflicts
export {
  ScannedInvoiceError,
  ScannedInvoiceValidationError,
  ScannedInvoiceStorageError,
  ScannedInvoiceAuthError,
  ScannedInvoiceNotFoundError,
  type ErrorLogEntry,
  logScannedInvoiceError,
  logUploadError,
  logDownloadError,
  logDeleteError,
  formatErrorResponse as formatScannedInvoiceErrorResponse,
  getErrorStatusCode as getScannedInvoiceErrorStatusCode,
  isNetworkError,
  isValidationError,
  isStorageError,
  getUserFriendlyErrorMessage,
} from './scanned-invoice-errors';
