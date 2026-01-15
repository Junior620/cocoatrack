// CocoaTrack V2 - Photo Upload Utilities
// Client-side photo compression and upload functions

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.gen';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TARGET_SIZE = 1 * 1024 * 1024; // 1MB after compression
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const BUCKET_NAME = 'delivery-photos';

// ============================================================================
// TYPES
// ============================================================================

export interface PhotoUploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a photo file before upload
 */
export function validatePhoto(file: File): PhotoValidationResult {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Le fichier doit être au format JPEG ou PNG',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Le fichier ne doit pas dépasser ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

// ============================================================================
// COMPRESSION
// ============================================================================

/**
 * Compress an image file to target size
 * Uses canvas to resize and compress
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions (max 1920px on longest side)
      const maxDimension = 1920;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to achieve target size
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // If still too large and quality can be reduced, try again
            if (blob.size > TARGET_SIZE && quality > 0.3) {
              tryCompress(quality - 0.1);
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };

      // Start with 0.8 quality
      tryCompress(0.8);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

// ============================================================================
// UPLOAD
// ============================================================================

/**
 * Upload a photo for a delivery
 * Compresses the image before upload
 */
export async function uploadDeliveryPhoto(
  file: File,
  deliveryId: string,
  cooperativeId: string
): Promise<PhotoUploadResult> {
  const supabase = createClient();

  // Validate
  const validation = validatePhoto(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Compress image
    const compressedBlob = await compressImage(file);

    // Generate unique filename
    const ext = 'jpg'; // Always save as JPEG after compression
    const filename = `${crypto.randomUUID()}.${ext}`;
    const path = `${cooperativeId}/${deliveryId}/${filename}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, compressedBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Create database record
    const insertData: Database['public']['Tables']['delivery_photos']['Insert'] = {
      delivery_id: deliveryId,
      storage_path: path,
      file_name: file.name,
      file_size: compressedBlob.size,
      created_by: user.id,
    };

    const { error: dbError } = await (supabase
      .from('delivery_photos') as unknown as {
        insert: (data: Database['public']['Tables']['delivery_photos']['Insert']) => Promise<{ error: Error | null }>
      })
      .insert(insertData);

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([path]);
      return { success: false, error: dbError.message };
    }

    return { success: true, path };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

/**
 * Delete a delivery photo
 */
export async function deleteDeliveryPhoto(photoId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // Get photo record
    const { data: photo, error: fetchError } = await supabase
      .from('delivery_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return { success: false, error: 'Photo not found' };
    }

    // Delete from storage
    const storagePath = (photo as { storage_path: string }).storage_path;
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
      // Continue to delete DB record anyway
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from('delivery_photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}
