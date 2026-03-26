// CocoaTrack V2 - Scanned Invoice File Validation Service
// Server-side validation for scanned invoice file uploads

import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_SCANS_PER_INVOICE,
  SCANNED_INVOICE_ERROR_MESSAGES,
  type AllowedMimeType,
} from '@/types/scanned-invoices';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * Result of file validation
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Result of attachment limit validation
 */
export interface AttachmentLimitResult {
  canUpload: boolean;
  currentCount: number;
  maxCount: number;
  error?: string;
}

// ============================================================================
// MIME TYPE VALIDATION
// ============================================================================

/**
 * Validate file MIME type on server-side
 * 
 * IMPORTANT: This validates the MIME type provided by the client.
 * For production, you should also inspect the actual file content
 * using a library like 'file-type' to prevent MIME type spoofing.
 * 
 * @param mimeType - The MIME type to validate
 * @returns Validation result
 * 
 * @see Requirements 1.1, 7.6
 */
export function validateMimeType(mimeType: string): FileValidationResult {
  const isValid = ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
  
  if (!isValid) {
    return {
      valid: false,
      error: SCANNED_INVOICE_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
    };
  }
  
  return { valid: true };
}

// ============================================================================
// FILE SIZE VALIDATION
// ============================================================================

/**
 * Validate file size on server-side
 * 
 * @param sizeBytes - The file size in bytes
 * @returns Validation result
 * 
 * @see Requirements 1.2
 */
export function validateFileSize(sizeBytes: number): FileValidationResult {
  if (sizeBytes <= 0) {
    return {
      valid: false,
      error: 'Le fichier est vide',
      errorCode: 'FILE_EMPTY',
    };
  }
  
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: SCANNED_INVOICE_ERROR_MESSAGES.FILE_TOO_LARGE,
      errorCode: 'FILE_TOO_LARGE',
    };
  }
  
  return { valid: true };
}

// ============================================================================
// ATTACHMENT LIMIT VALIDATION
// ============================================================================

/**
 * Validate attachment limit for an invoice
 * 
 * @param currentCount - Current number of scanned invoices for the invoice
 * @returns Validation result with limit information
 * 
 * @see Requirements 7.7
 */
export function validateAttachmentLimit(currentCount: number): AttachmentLimitResult {
  const canUpload = currentCount < MAX_SCANS_PER_INVOICE;
  
  return {
    canUpload,
    currentCount,
    maxCount: MAX_SCANS_PER_INVOICE,
    error: canUpload ? undefined : SCANNED_INVOICE_ERROR_MESSAGES.LIMIT_REACHED,
  };
}

// ============================================================================
// COMPREHENSIVE FILE VALIDATION
// ============================================================================

/**
 * Comprehensive file validation
 * Validates MIME type, file size, and attachment limit
 * 
 * @param file - The file metadata to validate
 * @param currentScanCount - Current number of scans for the invoice
 * @returns Validation result with error message if invalid
 * 
 * @see Requirements 1.1, 1.2, 7.6, 7.7
 */
export function validateScannedInvoiceFile(
  file: { type: string; size: number },
  currentScanCount: number
): FileValidationResult {
  // Check MIME type
  const mimeTypeResult = validateMimeType(file.type);
  if (!mimeTypeResult.valid) {
    return mimeTypeResult;
  }

  // Check file size
  const fileSizeResult = validateFileSize(file.size);
  if (!fileSizeResult.valid) {
    return fileSizeResult;
  }

  // Check attachment limit
  const limitResult = validateAttachmentLimit(currentScanCount);
  if (!limitResult.canUpload) {
    return {
      valid: false,
      error: limitResult.error,
      errorCode: 'LIMIT_REACHED',
    };
  }

  return { valid: true };
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Sanitize filename to prevent path traversal and other security issues
 * 
 * @param filename - The original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[/\\:\0]/g, '_');
  
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Limit length to 255 characters (common filesystem limit)
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }
  
  // If filename becomes empty after sanitization, use a default
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed_file';
  }
  
  return sanitized;
}

// ============================================================================
// ADVANCED MIME TYPE DETECTION (Optional Enhancement)
// ============================================================================

/**
 * Detect MIME type from file buffer (first few bytes)
 * This is a basic implementation. For production, use a library like 'file-type'
 * 
 * @param buffer - The first few bytes of the file
 * @returns Detected MIME type or null
 */
export function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
  // PDF signature
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46    // F
  ) {
    return 'application/pdf';
  }
  
  // JPEG signature
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return 'image/jpeg';
  }
  
  // PNG signature
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 && // P
    buffer[2] === 0x4E && // N
    buffer[3] === 0x47 && // G
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }
  
  // WEBP signature (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50   // P
  ) {
    return 'image/webp';
  }
  
  return null;
}

/**
 * Validate file by inspecting its content (magic bytes)
 * This provides additional security against MIME type spoofing
 * 
 * @param buffer - The first few bytes of the file
 * @param declaredMimeType - The MIME type declared by the client
 * @returns Validation result
 */
export function validateFileContent(
  buffer: Uint8Array,
  declaredMimeType: string
): FileValidationResult {
  const detectedMimeType = detectMimeTypeFromBuffer(buffer);
  
  if (!detectedMimeType) {
    return {
      valid: false,
      error: 'Impossible de détecter le type de fichier',
      errorCode: 'MIME_TYPE_DETECTION_FAILED',
    };
  }
  
  if (detectedMimeType !== declaredMimeType) {
    return {
      valid: false,
      error: `Le type de fichier ne correspond pas. Détecté: ${detectedMimeType}, Déclaré: ${declaredMimeType}`,
      errorCode: 'MIME_TYPE_MISMATCH',
    };
  }
  
  return { valid: true };
}
