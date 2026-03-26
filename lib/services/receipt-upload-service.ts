// CocoaTrack V2 - Receipt PDF Upload Service
// Manages PDF file uploads for collection receipts with validation, retry logic, and progress tracking

import { createServerSupabaseClient } from '@/lib/supabase/server';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Storage bucket name for collection receipts
 * Requirements: 9.1
 */
export const COLLECTION_RECEIPTS_BUCKET = 'collection-receipts';

/**
 * Maximum file size for PDF uploads (10MB in bytes)
 * Requirements: 2.4, 9.5
 */
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Allowed MIME type for PDF files
 * Requirements: 2.2, 9.4
 */
export const ALLOWED_PDF_MIME_TYPE = 'application/pdf';

/**
 * Maximum retry attempts for upload
 * Requirements: 2.6
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial retry delay in milliseconds
 * Requirements: 2.6
 */
export const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Signed URL expiration time in seconds (60 seconds)
 */
export const SIGNED_URL_EXPIRATION_SECONDS = 60;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of file upload operation
 */
export interface UploadResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  fileSize?: number;
  fileName?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Upload progress callback
 * Requirements: 2.5
 */
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
}) => void;

/**
 * Upload options
 */
export interface UploadOptions {
  onProgress?: UploadProgressCallback;
  maxRetries?: number;
  retryDelay?: number;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate PDF file type
 * 
 * Checks that the file has .pdf extension and application/pdf MIME type
 * 
 * @param file - The file to validate
 * @returns True if valid PDF, false otherwise
 * 
 * Requirements: 2.2, 9.4
 */
export function validatePdfFileType(file: File): boolean {
  const hasValidExtension = file.name.toLowerCase().endsWith('.pdf');
  const hasValidMimeType = file.type === ALLOWED_PDF_MIME_TYPE;
  
  return hasValidExtension && hasValidMimeType;
}

/**
 * Validate PDF file size
 * 
 * Checks that the file size does not exceed 10MB
 * 
 * @param file - The file to validate
 * @returns True if size is valid, false otherwise
 * 
 * Requirements: 2.4, 9.5
 */
export function validatePdfFileSize(file: File): boolean {
  return file.size > 0 && file.size <= MAX_PDF_SIZE_BYTES;
}

/**
 * Validate PDF file
 * 
 * Performs all validation checks on the PDF file
 * 
 * @param file - The file to validate
 * @returns Validation result with error details if invalid
 * 
 * Requirements: 2.2, 2.3, 2.4, 9.4, 9.5
 */
export function validatePdfFile(file: File): {
  valid: boolean;
  error?: string;
  errorCode?: string;
} {
  // Check file type
  if (!validatePdfFileType(file)) {
    return {
      valid: false,
      error: 'Format non supporté. Seuls les fichiers PDF sont acceptés',
      errorCode: 'INVALID_FILE_TYPE',
    };
  }
  
  // Check file size
  if (!validatePdfFileSize(file)) {
    if (file.size === 0) {
      return {
        valid: false,
        error: 'Le fichier est vide',
        errorCode: 'EMPTY_FILE',
      };
    }
    
    return {
      valid: false,
      error: 'Fichier trop volumineux. Taille maximale: 10MB',
      errorCode: 'FILE_TOO_LARGE',
    };
  }
  
  return { valid: true };
}

// ============================================================================
// PATH GENERATION FUNCTIONS
// ============================================================================

/**
 * Sanitize filename to prevent security issues
 * 
 * Removes special characters and limits length
 * 
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and special characters
  let sanitized = filename.replace(/[/\\?%*:|"<>]/g, '_');
  
  // Limit length (keep extension)
  const maxLength = 200;
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, maxLength - ext.length) + ext;
  }
  
  return sanitized;
}

/**
 * Generate unique filename with UUID
 * 
 * Format: {uuid}_{original_filename}
 * 
 * @param originalFilename - Original filename
 * @returns Unique filename with UUID prefix
 * 
 * Requirements: 2.5, 9.2
 */
export function generateUniqueFilename(originalFilename: string): string {
  const uuid = crypto.randomUUID();
  const sanitized = sanitizeFilename(originalFilename);
  return `${uuid}_${sanitized}`;
}

/**
 * Generate storage path for receipt PDF
 * 
 * Path structure: {cooperative_id}/receipts/{receipt_number}/{uuid}_{original_filename}
 * 
 * @param cooperativeId - Cooperative ID
 * @param receiptNumber - Receipt number
 * @param filename - Filename (should already include UUID)
 * @returns Storage path
 * 
 * Requirements: 7.6, 9.3
 */
export function generateStoragePath(
  cooperativeId: string | null,
  receiptNumber: string,
  filename: string
): string {
  // Sanitize receipt number for use in path
  const sanitizedReceiptNumber = receiptNumber.replace(/[/\\]/g, '_');
  
  // If no cooperative, use "unassigned" folder
  const coopFolder = cooperativeId ?? 'unassigned';
  
  return `${coopFolder}/receipts/${sanitizedReceiptNumber}/${filename}`;
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * 
 * Formula: initialDelay * (2 ^ attempt)
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @returns Delay in milliseconds
 * 
 * Requirements: 2.6
 */
export function calculateBackoffDelay(attempt: number, initialDelay: number): number {
  return initialDelay * Math.pow(2, attempt);
}

/**
 * Execute function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @returns Result of the function
 * 
 * Requirements: 2.6
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  initialDelay: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, initialDelay);
      
      console.warn(
        `[receipt-upload-service] Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        error
      );
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('Upload failed after retries');
}

// ============================================================================
// UPLOAD SERVICE
// ============================================================================

/**
 * Upload a PDF file to Supabase Storage
 * 
 * This function:
 * 1. Validates the file (type and size)
 * 2. Generates a unique filename with UUID
 * 3. Generates the storage path
 * 4. Uploads to Supabase Storage with retry logic
 * 5. Returns the storage path and metadata
 * 
 * @param file - The PDF file to upload
 * @param cooperativeId - The cooperative ID
 * @param receiptNumber - The receipt number
 * @param options - Upload options (progress callback, retry config)
 * @returns Upload result with storage path and metadata
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 9.2, 9.3, 9.4, 9.5
 */
export async function uploadPdf(
  file: File,
  cooperativeId: string | null,
  receiptNumber: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    // Step 1: Validate file
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: validation.errorCode,
      };
    }
    
    // Step 2: Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.name);
    
    // Step 3: Generate storage path
    const storagePath = generateStoragePath(
      cooperativeId,
      receiptNumber,
      uniqueFilename
    );
    
    // Step 4: Upload to Supabase Storage with retry logic
    const supabase = await createServerSupabaseClient();
    
    const uploadFn = async () => {
      const { data, error } = await supabase.storage
        .from(COLLECTION_RECEIPTS_BUCKET)
        .upload(storagePath, file, {
          contentType: ALLOWED_PDF_MIME_TYPE,
          upsert: false, // Don't overwrite existing files
        });
      
      if (error) {
        throw error;
      }
      
      return data;
    };
    
    // Execute upload with retry logic
    const maxRetries = options.maxRetries ?? MAX_RETRY_ATTEMPTS;
    const retryDelay = options.retryDelay ?? INITIAL_RETRY_DELAY_MS;
    
    const data = await withRetry(uploadFn, maxRetries, retryDelay);
    
    // Step 5: Generate public URL (for reference, actual access uses signed URLs)
    const { data: urlData } = supabase.storage
      .from(COLLECTION_RECEIPTS_BUCKET)
      .getPublicUrl(storagePath);
    
    // Call progress callback with 100% completion
    if (options.onProgress) {
      options.onProgress({
        loaded: file.size,
        total: file.size,
        percentage: 100,
      });
    }
    
    return {
      success: true,
      pdfUrl: urlData.publicUrl,
      storagePath: data.path,
      fileSize: file.size,
      fileName: file.name,
    };
    
  } catch (error: any) {
    console.error('[receipt-upload-service] Upload error:', error);
    
    // Handle specific error cases
    if (error.message?.includes('already exists')) {
      return {
        success: false,
        error: 'Un fichier avec ce nom existe déjà',
        errorCode: 'FILE_ALREADY_EXISTS',
      };
    }

    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket') || error.statusCode === '404') {
      return {
        success: false,
        error: 'Le bucket de stockage n\'existe pas. Veuillez appliquer les migrations Supabase.',
        errorCode: 'BUCKET_NOT_FOUND',
      };
    }
    
    if (error.message?.includes('storage quota') || error.message?.includes('quota exceeded')) {
      return {
        success: false,
        error: 'Espace de stockage insuffisant',
        errorCode: 'STORAGE_FULL',
      };
    }
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return {
        success: false,
        error: 'Erreur réseau. Veuillez réessayer',
        errorCode: 'NETWORK_ERROR',
      };
    }
    
    return {
      success: false,
      error: `Échec de l'upload: ${error.message || 'Erreur inconnue'}`,
      errorCode: 'UPLOAD_FAILED',
    };
  }
}

// ============================================================================
// DOWNLOAD SERVICE
// ============================================================================

/**
 * Generate a signed URL for downloading a receipt PDF
 * 
 * The URL is valid for 60 seconds
 * 
 * @param storagePath - The storage path of the file
 * @returns Download URL result with signed URL
 */
export async function generateDownloadUrl(
  storagePath: string
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  errorCode?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Generate signed URL (valid for 60 seconds)
    const { data, error } = await supabase.storage
      .from(COLLECTION_RECEIPTS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRATION_SECONDS);
    
    if (error) {
      console.error('[receipt-upload-service] Download URL generation error:', error);
      
      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'Fichier non trouvé',
          errorCode: 'FILE_NOT_FOUND',
        };
      }
      
      return {
        success: false,
        error: `Impossible de générer l'URL de téléchargement: ${error.message}`,
        errorCode: 'DOWNLOAD_URL_FAILED',
      };
    }
    
    if (!data.signedUrl) {
      return {
        success: false,
        error: 'URL de téléchargement non générée',
        errorCode: 'DOWNLOAD_URL_EMPTY',
      };
    }
    
    return {
      success: true,
      url: data.signedUrl,
    };
  } catch (error: any) {
    console.error('[receipt-upload-service] Unexpected download URL error:', error);
    return {
      success: false,
      error: 'Erreur inattendue lors de la génération de l\'URL',
      errorCode: 'DOWNLOAD_ERROR',
    };
  }
}

// ============================================================================
// DELETE SERVICE
// ============================================================================

/**
 * Delete a receipt PDF file from Supabase Storage
 * 
 * @param storagePath - The storage path of the file to delete
 * @returns Delete result
 */
export async function deleteReceiptPdf(
  storagePath: string
): Promise<{
  success: boolean;
  error?: string;
  errorCode?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(COLLECTION_RECEIPTS_BUCKET)
      .remove([storagePath]);
    
    if (error) {
      console.error('[receipt-upload-service] Delete error:', error);
      
      // Note: Supabase Storage doesn't fail if file doesn't exist
      // So we treat this as a success (idempotent delete)
      if (error.message.includes('not found')) {
        console.warn('[receipt-upload-service] File not found, treating as success');
        return { success: true };
      }
      
      return {
        success: false,
        error: `Échec de la suppression: ${error.message}`,
        errorCode: 'DELETE_FAILED',
      };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[receipt-upload-service] Unexpected delete error:', error);
    return {
      success: false,
      error: 'Erreur inattendue lors de la suppression',
      errorCode: 'DELETE_ERROR',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  uploadPdf,
  generateDownloadUrl,
  deleteReceiptPdf,
  validatePdfFile,
  validatePdfFileType,
  validatePdfFileSize,
  generateUniqueFilename,
  generateStoragePath,
  sanitizeFilename,
  calculateBackoffDelay,
};
