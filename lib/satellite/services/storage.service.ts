/**
 * Satellite Storage Service
 * 
 * Manages storage of satellite imagery artifacts (NDVI rasters, legends, etc.)
 * in Supabase Storage. Handles upload, download, and URL generation for
 * raster images.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Supabase Storage bucket name for satellite imagery
 */
const STORAGE_BUCKET = 'satellite-imagery';

/**
 * Storage paths for different artifact types
 */
const STORAGE_PATHS = {
  NDVI_RASTERS: 'ndvi-rasters',
  LEGENDS: 'legends',
  TEMPORAL: 'temporal',
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Upload result
 */
export interface UploadResult {
  /**
   * Public URL of the uploaded file
   */
  publicUrl: string;

  /**
   * Storage path of the uploaded file
   */
  path: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;
}

/**
 * Upload options
 */
export interface UploadOptions {
  /**
   * Content type (MIME type)
   * Default: 'image/png'
   */
  contentType?: string;

  /**
   * Cache control header
   * Default: 'public, max-age=31536000' (1 year)
   */
  cacheControl?: string;

  /**
   * Whether to overwrite existing file
   * Default: true
   */
  upsert?: boolean;
}

// ============================================================================
// StorageService Class
// ============================================================================

/**
 * Service for managing satellite imagery storage
 */
export class StorageService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    // Initialize Supabase client with service role key for storage operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
    }

    if (!serviceRoleKey) {
      console.warn(
        'SUPABASE_SERVICE_KEY not found, using anon key (may have limited permissions)'
      );
    }

    this.supabase = createClient(
      supabaseUrl,
      serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  /**
   * Upload NDVI raster image to storage
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Calculation date
   * @param buffer - Image buffer
   * @param options - Upload options
   * @returns Upload result with public URL
   * 
   * @example
   * ```typescript
   * const service = new StorageService();
   * const result = await service.uploadNDVIRaster(
   *   'parcelle-123',
   *   new Date(),
   *   imageBuffer
   * );
   * console.log('Raster URL:', result.publicUrl);
   * ```
   */
  async uploadNDVIRaster(
    parcelleId: string,
    date: Date,
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      contentType = 'image/png',
      cacheControl = 'public, max-age=31536000', // 1 year
      upsert = true,
    } = options;

    // Generate file path: ndvi-rasters/{parcelleId}/{YYYY-MM-DD}.png
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${dateStr}.png`;
    const filePath = `${STORAGE_PATHS.NDVI_RASTERS}/${parcelleId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        cacheControl,
        upsert,
      });

    if (error) {
      throw new Error(`Failed to upload NDVI raster: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return {
      publicUrl: urlData.publicUrl,
      path: filePath,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Upload legend image to storage
   * 
   * @param buffer - Image buffer
   * @param options - Upload options
   * @returns Upload result with public URL
   */
  async uploadLegend(
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      contentType = 'image/png',
      cacheControl = 'public, max-age=31536000', // 1 year
      upsert = true,
    } = options;

    // Generate file path: legends/ndvi-legend.png
    const filePath = `${STORAGE_PATHS.LEGENDS}/ndvi-legend.png`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        cacheControl,
        upsert,
      });

    if (error) {
      throw new Error(`Failed to upload legend: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return {
      publicUrl: urlData.publicUrl,
      path: filePath,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Delete NDVI raster from storage
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Calculation date
   */
  async deleteNDVIRaster(parcelleId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    const fileName = `${dateStr}.png`;
    const filePath = `${STORAGE_PATHS.NDVI_RASTERS}/${parcelleId}/${fileName}`;

    const { error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete NDVI raster: ${error.message}`);
    }
  }

  /**
   * Delete all NDVI rasters for a parcelle
   * 
   * @param parcelleId - Parcelle ID
   */
  async deleteAllNDVIRasters(parcelleId: string): Promise<void> {
    const folderPath = `${STORAGE_PATHS.NDVI_RASTERS}/${parcelleId}`;

    // List all files in the folder
    const { data: files, error: listError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .list(folderPath);

    if (listError) {
      throw new Error(`Failed to list NDVI rasters: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return; // No files to delete
    }

    // Delete all files
    const filePaths = files.map((file) => `${folderPath}/${file.name}`);
    const { error: deleteError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      throw new Error(`Failed to delete NDVI rasters: ${deleteError.message}`);
    }
  }

  /**
   * Get public URL for an NDVI raster
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Calculation date
   * @returns Public URL
   */
  getNDVIRasterUrl(parcelleId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    const fileName = `${dateStr}.png`;
    const filePath = `${STORAGE_PATHS.NDVI_RASTERS}/${parcelleId}/${fileName}`;

    const { data } = this.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Check if storage bucket exists and is accessible
   * 
   * @returns True if bucket is accessible, false otherwise
   */
  async checkBucketAccess(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .list('', { limit: 1 });

      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure storage bucket exists
   * 
   * Creates the bucket if it doesn't exist.
   * Note: This requires admin privileges.
   */
  async ensureBucket(): Promise<void> {
    // Check if bucket exists
    const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets?.some((b) => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      // Create bucket
      const { error: createError } = await this.supabase.storage.createBucket(
        STORAGE_BUCKET,
        {
          public: true, // Make bucket public for easy access
          fileSizeLimit: 10485760, // 10MB limit
          allowedMimeTypes: ['image/png', 'image/jpeg'],
        }
      );

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log(`Created storage bucket: ${STORAGE_BUCKET}`);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of StorageService
 */
export const storageService = new StorageService();
