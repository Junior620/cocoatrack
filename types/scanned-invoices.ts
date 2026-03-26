// CocoaTrack V2 - Scanned Invoices Types
// Types for scanned invoice file management with Supabase Storage

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Allowed MIME types for scanned invoice files
 * 
 * CENTRALIZED WHITELIST - Used in:
 * - Database CHECK constraint (mime_type IN (...))
 * - Zod validation schema (uploadScannedInvoiceSchema)
 * - UI components (file input accept attribute)
 * - Storage bucket configuration
 * 
 * IMPORTANT: If you modify this list, you MUST also update:
 * - v2/supabase/migrations/20260320000001_scanned_invoices.sql (mime_type CHECK)
 * - Create a new migration to ALTER the CHECK constraint
 * 
 * @see v2/lib/validations/scanned-invoice.ts - uploadScannedInvoiceSchema
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Maximum file size in bytes (10MB)
 * Used for client and server-side validation
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum number of scanned files per invoice
 * Used to enforce attachment limit
 */
export const MAX_SCANS_PER_INVOICE = 10;

/**
 * Supabase Storage bucket name for invoice scans
 */
export const INVOICE_SCANS_BUCKET = 'invoice-scans';

/**
 * Signed URL expiration time in seconds (60 seconds)
 * Used for temporary download URLs
 */
export const SIGNED_URL_EXPIRATION_SECONDS = 60;

/**
 * Human-readable labels for MIME types (for UI display)
 */
export const MIME_TYPE_LABELS: Record<AllowedMimeType, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

/**
 * File extensions for allowed MIME types
 * Used for file input accept attribute
 */
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;

// =============================================================================
// Scanned Invoice Interface
// =============================================================================

/**
 * User relation (minimal info for display)
 */
export interface UserRelation {
  id: string;
  full_name: string;
}

/**
 * Main ScannedInvoice interface
 * Represents a scanned invoice file (PDF or image) attached to an invoice
 * 
 * Storage path structure: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}
 */
export interface ScannedInvoice {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Foreign key to invoices table (CASCADE DELETE) */
  invoice_id: string;
  
  /** Storage path in Supabase Storage bucket */
  storage_path: string;
  
  /** Original filename (preserved for download) */
  original_filename: string;
  
  /** File size in bytes (max 10MB) */
  file_size_bytes: number;
  
  /** MIME type (application/pdf, image/jpeg, image/png, image/webp) */
  mime_type: AllowedMimeType;
  
  /** Optional thumbnail path (for PDF first page preview) */
  thumbnail_path: string | null;
  
  /** User who uploaded the file */
  created_by: string;
  
  /** Name of the user who uploaded the file (from profiles.full_name) */
  created_by_name?: string;
  
  /** Upload timestamp (ISO 8601) */
  created_at: string;
}

/**
 * ScannedInvoice with required user relation
 * Used when user data is always needed
 */
export interface ScannedInvoiceWithUser extends ScannedInvoice {
  created_by_name: string;
}

// =============================================================================
// API Input Types
// =============================================================================

/**
 * Input for uploading a scanned invoice
 * Used by POST /api/invoices/[id]/scans
 * 
 * Note: This is a FormData multipart/form-data request
 */
export interface UploadScannedInvoiceInput {
  /** File to upload (PDF or image) */
  file: File;
}

/**
 * Input for bulk deletion of scanned invoices
 * Used by DELETE /api/invoices/scans/bulk
 */
export interface BulkDeleteScannedInvoicesInput {
  /** Array of scanned invoice IDs to delete */
  scan_ids: string[];
}

// =============================================================================
// API Output Types
// =============================================================================

/**
 * Response for listing scanned invoices
 * Returned by GET /api/invoices/[id]/scans
 */
export interface ScannedInvoiceListResponse {
  /** List of scanned invoices */
  data: ScannedInvoiceWithUser[];
  
  /** Total number of scanned invoices for this invoice */
  total: number;
}

/**
 * Response for download URL generation
 * Returned by GET /api/invoices/scans/[scanId]/download
 */
export interface ScannedInvoiceDownloadResponse {
  /** Signed URL valid for 60 seconds */
  url: string;
  
  /** Original filename for download */
  filename: string;
}

/**
 * Response for bulk deletion
 * Returned by DELETE /api/invoices/scans/bulk
 */
export interface BulkDeleteScannedInvoicesResponse {
  /** Number of successfully deleted files */
  deleted: number;
  
  /** List of failed deletions with error messages */
  failed: Array<{
    id: string;
    error: string;
  }>;
}

// =============================================================================
// Storage Path Helpers
// =============================================================================

/**
 * Parse storage path to extract components
 * Path format: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}
 * 
 * @param storagePath - The storage path to parse
 * @returns Parsed components or null if invalid format
 */
export function parseStoragePath(storagePath: string): {
  cooperative_id: string;
  invoice_id: string;
  filename: string;
} | null {
  const parts = storagePath.split('/');
  if (parts.length !== 3) return null;
  
  return {
    cooperative_id: parts[0],
    invoice_id: parts[1],
    filename: parts[2],
  };
}

/**
 * Generate storage path for a new scanned invoice
 * Path format: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}
 * 
 * @param cooperativeId - The cooperative ID
 * @param invoiceId - The invoice ID
 * @param uuid - Unique identifier for the file
 * @param originalFilename - Original filename
 * @returns Storage path string
 */
export function generateStoragePath(
  cooperativeId: string | null | undefined,
  invoiceId: string,
  uuid: string,
  originalFilename: string
): string {
  return `${cooperativeId ?? 'shared'}/${invoiceId}/${uuid}_${originalFilename}`;
}

// =============================================================================
// File Validation Helpers
// =============================================================================

/**
 * Check if a MIME type is allowed
 * 
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Check if a file size is within the allowed limit
 * 
 * @param sizeBytes - The file size in bytes
 * @returns true if the file size is within the limit
 */
export function isValidFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB", "150 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 * 
 * @param filename - The filename
 * @returns File extension (e.g., ".pdf", ".jpg") or empty string
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
}

/**
 * Check if a file is a PDF
 * 
 * @param mimeType - The MIME type
 * @returns true if the file is a PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Check if a file is an image
 * 
 * @param mimeType - The MIME type
 * @returns true if the file is an image
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// =============================================================================
// Error Messages
// =============================================================================

/**
 * Standardized error messages for scanned invoice operations
 * Used for consistent user feedback across the application
 */
export const SCANNED_INVOICE_ERROR_MESSAGES = {
  UNSUPPORTED_FILE_TYPE: 'Type de fichier non supporté. Formats acceptés: PDF, JPEG, PNG, WEBP',
  FILE_TOO_LARGE: 'Fichier trop volumineux. Taille maximale: 10MB',
  LIMIT_REACHED: 'Limite atteinte. Maximum 10 fichiers par facture',
  NETWORK_ERROR: 'Erreur réseau. Veuillez réessayer',
  STORAGE_FULL: 'Espace de stockage insuffisant',
  INVOICE_NOT_FOUND: 'Facture non trouvée',
  SCAN_NOT_FOUND: 'Fichier scanné non trouvé',
  UNAUTHORIZED: 'Permissions insuffisantes',
  DOWNLOAD_FAILED: 'Impossible de télécharger le fichier',
  UPLOAD_FAILED: 'Échec de l\'upload. Veuillez réessayer',
  DELETE_FAILED: 'Échec de la suppression. Veuillez réessayer',
} as const;

// =============================================================================
// API Error Types
// =============================================================================

/**
 * Error codes for scanned invoices module
 * Used in API error responses
 */
export const SCANNED_INVOICE_ERROR_CODES = {
  // Validation errors
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  LIMIT_REACHED: 'LIMIT_REACHED',
  
  // Resource errors
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  SCAN_NOT_FOUND: 'SCAN_NOT_FOUND',
  
  // Permission errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_FULL: 'STORAGE_FULL',
  
  // General errors
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ScannedInvoiceErrorCode = 
  (typeof SCANNED_INVOICE_ERROR_CODES)[keyof typeof SCANNED_INVOICE_ERROR_CODES];

/**
 * API error response for scanned invoices module
 */
export interface ScannedInvoiceApiError {
  /** Error code from SCANNED_INVOICE_ERROR_CODES */
  error_code: ScannedInvoiceErrorCode;
  
  /** Human-readable error message */
  message: string;
  
  /** Additional error details */
  details?: Record<string, unknown>;
}
