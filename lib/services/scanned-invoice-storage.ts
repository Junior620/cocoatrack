// CocoaTrack V2 - Scanned Invoice Storage Service
// Manages file uploads, downloads, and deletions in Supabase Storage

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  INVOICE_SCANS_BUCKET,
  SIGNED_URL_EXPIRATION_SECONDS,
  generateStoragePath,
  type ScannedInvoice,
} from '@/types/scanned-invoices';
import { sanitizeFilename } from './scanned-invoice-validation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of file upload operation
 */
export interface UploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Result of file download URL generation
 */
export interface DownloadUrlResult {
  success: boolean;
  url?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Result of file deletion operation
 */
export interface DeleteResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// UPLOAD SERVICE
// ============================================================================

/**
 * Upload a scanned invoice file to Supabase Storage
 * 
 * Path structure: {cooperative_id}/{invoice_id}/{uuid}_{original_filename}
 * 
 * @param file - The file to upload (File or Blob)
 * @param cooperativeId - The cooperative ID
 * @param invoiceId - The invoice ID
 * @param originalFilename - Original filename (will be sanitized)
 * @returns Upload result with storage path
 * 
 * @see Requirements 1.3, 7.1, 7.2
 */
export async function uploadScannedInvoiceFile(
  file: File | Blob,
  cooperativeId: string | null | undefined,
  invoiceId: string,
  originalFilename: string
): Promise<UploadResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Generate unique UUID for the file
    const uuid = crypto.randomUUID();
    
    // Sanitize filename to prevent security issues
    const sanitizedFilename = sanitizeFilename(originalFilename);
    
    // Generate storage path
    const storagePath = generateStoragePath(
      cooperativeId,
      invoiceId,
      uuid,
      sanitizedFilename
    );
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(INVOICE_SCANS_BUCKET)
      .upload(storagePath, file, {
        contentType: file instanceof File ? file.type : 'application/octet-stream',
        upsert: false, // Don't overwrite existing files
      });
    
    if (error) {
      console.error('[scanned-invoice-storage] Upload error:', error);
      
      // Handle specific error cases
      if (error.message.includes('already exists')) {
        return {
          success: false,
          error: 'Un fichier avec ce nom existe déjà',
          errorCode: 'FILE_ALREADY_EXISTS',
        };
      }
      
      if (error.message.includes('storage quota')) {
        return {
          success: false,
          error: 'Espace de stockage insuffisant',
          errorCode: 'STORAGE_FULL',
        };
      }
      
      return {
        success: false,
        error: `Échec de l'upload: ${error.message}`,
        errorCode: 'UPLOAD_FAILED',
      };
    }
    
    return {
      success: true,
      storagePath: data.path,
    };
  } catch (error) {
    console.error('[scanned-invoice-storage] Unexpected upload error:', error);
    return {
      success: false,
      error: 'Erreur inattendue lors de l\'upload',
      errorCode: 'UPLOAD_ERROR',
    };
  }
}

// ============================================================================
// DOWNLOAD SERVICE
// ============================================================================

/**
 * Generate a signed URL for downloading a scanned invoice file
 * 
 * The URL is valid for 60 seconds (SIGNED_URL_EXPIRATION_SECONDS)
 * 
 * @param storagePath - The storage path of the file
 * @returns Download URL result with signed URL
 * 
 * @see Requirements 4.1
 */
export async function generateDownloadUrl(
  storagePath: string
): Promise<DownloadUrlResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Generate signed URL (valid for 60 seconds)
    const { data, error } = await supabase.storage
      .from(INVOICE_SCANS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRATION_SECONDS);
    
    if (error) {
      console.error('[scanned-invoice-storage] Download URL generation error:', error);
      
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
  } catch (error) {
    console.error('[scanned-invoice-storage] Unexpected download URL error:', error);
    return {
      success: false,
      error: 'Erreur inattendue lors de la génération de l\'URL',
      errorCode: 'DOWNLOAD_ERROR',
    };
  }
}

/**
 * Get public URL for a file (if bucket is public)
 * Note: invoice-scans bucket is private, so this will return a URL
 * that requires authentication. Use generateDownloadUrl instead.
 * 
 * @param storagePath - The storage path of the file
 * @returns Public URL
 */
export async function getPublicUrl(storagePath: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  const { data } = supabase.storage
    .from(INVOICE_SCANS_BUCKET)
    .getPublicUrl(storagePath);
  
  return data.publicUrl;
}

// ============================================================================
// DELETE SERVICE
// ============================================================================

/**
 * Delete a scanned invoice file from Supabase Storage
 * 
 * @param storagePath - The storage path of the file to delete
 * @returns Delete result
 * 
 * @see Requirements 6.3
 */
export async function deleteScannedInvoiceFile(
  storagePath: string
): Promise<DeleteResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(INVOICE_SCANS_BUCKET)
      .remove([storagePath]);
    
    if (error) {
      console.error('[scanned-invoice-storage] Delete error:', error);
      
      // Note: Supabase Storage doesn't fail if file doesn't exist
      // So we treat this as a success (idempotent delete)
      if (error.message.includes('not found')) {
        console.warn('[scanned-invoice-storage] File not found, treating as success');
        return { success: true };
      }
      
      return {
        success: false,
        error: `Échec de la suppression: ${error.message}`,
        errorCode: 'DELETE_FAILED',
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('[scanned-invoice-storage] Unexpected delete error:', error);
    return {
      success: false,
      error: 'Erreur inattendue lors de la suppression',
      errorCode: 'DELETE_ERROR',
    };
  }
}

/**
 * Delete multiple scanned invoice files from Supabase Storage
 * 
 * @param storagePaths - Array of storage paths to delete
 * @returns Delete result with count of successful deletions
 * 
 * @see Requirements 6.2
 */
export async function deleteMultipleScannedInvoiceFiles(
  storagePaths: string[]
): Promise<{
  success: boolean;
  deletedCount: number;
  failedPaths: string[];
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Delete all files in one batch
    const { data, error } = await supabase.storage
      .from(INVOICE_SCANS_BUCKET)
      .remove(storagePaths);
    
    if (error) {
      console.error('[scanned-invoice-storage] Bulk delete error:', error);
      return {
        success: false,
        deletedCount: 0,
        failedPaths: storagePaths,
        error: `Échec de la suppression multiple: ${error.message}`,
      };
    }
    
    // Supabase returns array of deleted files
    const deletedCount = data?.length || 0;
    const failedPaths = storagePaths.filter(
      path => !data?.some(deleted => deleted.name === path)
    );
    
    return {
      success: failedPaths.length === 0,
      deletedCount,
      failedPaths,
    };
  } catch (error) {
    console.error('[scanned-invoice-storage] Unexpected bulk delete error:', error);
    return {
      success: false,
      deletedCount: 0,
      failedPaths: storagePaths,
      error: 'Erreur inattendue lors de la suppression multiple',
    };
  }
}

// ============================================================================
// CLEANUP SERVICE
// ============================================================================

/**
 * Cleanup orphaned files in storage (files without database records)
 * This should be run periodically as a maintenance task
 * 
 * @param scannedInvoices - Array of scanned invoices from database
 * @returns Cleanup result with count of deleted orphaned files
 */
export async function cleanupOrphanedFiles(
  scannedInvoices: ScannedInvoice[]
): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get all files in storage
    const { data: files, error: listError } = await supabase.storage
      .from(INVOICE_SCANS_BUCKET)
      .list();
    
    if (listError) {
      console.error('[scanned-invoice-storage] List files error:', listError);
      return {
        success: false,
        deletedCount: 0,
        error: `Échec de la liste des fichiers: ${listError.message}`,
      };
    }
    
    // Find orphaned files (files in storage but not in database)
    const dbPaths = new Set(scannedInvoices.map(scan => scan.storage_path));
    const orphanedPaths = files
      ?.filter(file => !dbPaths.has(file.name))
      .map(file => file.name) || [];
    
    if (orphanedPaths.length === 0) {
      return {
        success: true,
        deletedCount: 0,
      };
    }
    
    // Delete orphaned files
    const deleteResult = await deleteMultipleScannedInvoiceFiles(orphanedPaths);
    
    return {
      success: deleteResult.success,
      deletedCount: deleteResult.deletedCount,
      error: deleteResult.error,
    };
  } catch (error) {
    console.error('[scanned-invoice-storage] Unexpected cleanup error:', error);
    return {
      success: false,
      deletedCount: 0,
      error: 'Erreur inattendue lors du nettoyage',
    };
  }
}
