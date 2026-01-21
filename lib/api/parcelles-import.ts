// CocoaTrack V2 - Parcelles Import API
// Client-side API functions for parcelle import operations
// Handles file upload, parsing, and applying imports
// @ts-nocheck - Types need to be regenerated from Supabase after migration

import { createClient } from '@/lib/supabase/client';
import type {
  ParcelImportFile,
  ImportFileType,
  ParsedFeature,
  ParseReport,
  ParseResult,
  ParseError,
  ParseWarning,
  ApplyImportInput,
  ApplyImportResult,
  ParcelleSource,
  ImportMode,
  ApplyImportInputV2,
  AutoCreatePreview,
} from '@/types/parcelles';
import { PARCELLE_ERROR_CODES, PARCELLE_LIMITS } from '@/types/parcelles';
import { parseShapefile } from '@/lib/services/shapefile-parser';
import { parseKML, parseKMZ, parseGeoJSON } from '@/lib/services/geo-parser';
import {
  computeFeatureHash,
  calculateAreaHa,
  calculateCentroid,
  validateCoordinates,
  detectProjectedCoordinates,
  isValidGeometry,
  isEmptyGeometry,
  tryFixGeometry,
  stripZDimension,
} from '@/lib/services/geometry-service';
import { applyImportSchema, applyImportV2Schema } from '@/lib/validations/parcelle';
import { v4 as uuidv4 } from 'uuid';

// Storage bucket name for parcelle imports
const STORAGE_BUCKET = 'parcelle-imports';

// Helper to get typed client
const getTypedClient = () => createClient();

/**
 * Normalize a planteur name for matching
 * Equivalent to the PostgreSQL normalize_planteur_name() function
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes accents (diacritics)
 * 
 * @param name - The name to normalize
 * @returns Normalized name
 */
export function normalizePlanteurName(name: string | null | undefined): string {
  if (!name) return '';
  
  // Normalize to NFD (decomposed form), remove diacritics, then convert to lowercase and trim
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
}

/**
 * Detect conformity status based on DBF attributes
 * 
 * Rules for automatic detection:
 * - 'conforme': Has planteur name AND (village OR coordinates) AND area > 0
 * - 'en_cours': Has planteur name but missing some optional fields
 * - 'informations_manquantes': Missing planteur name or critical data
 * 
 * @param attributes - DBF attributes from the feature
 * @param planteurNameField - Field name containing planteur name (optional)
 * @param areaHa - Calculated area in hectares
 * @returns Detected conformity status
 */
export function detectConformityStatus(
  attributes: Record<string, unknown>,
  planteurNameField?: string,
  areaHa?: number
): 'conforme' | 'en_cours' | 'informations_manquantes' {
  // Check for planteur name
  let hasPlanteurName = false;
  if (planteurNameField) {
    const planteurValue = attributes[planteurNameField];
    hasPlanteurName = planteurValue !== undefined && planteurValue !== null && String(planteurValue).trim() !== '';
  } else {
    // Try common field names for planteur
    const commonPlanteurFields = ['Nom_prod', 'NOM_PROD', 'nom_prod', 'planteur', 'PLANTEUR', 'Planteur', 'nom', 'NOM', 'name', 'NAME'];
    for (const field of commonPlanteurFields) {
      const value = attributes[field];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        hasPlanteurName = true;
        break;
      }
    }
  }

  // Check for village/location
  const commonVillageFields = ['village', 'VILLAGE', 'Village', 'localite', 'LOCALITE', 'Localite', 'lieu', 'LIEU'];
  let hasVillage = false;
  for (const field of commonVillageFields) {
    const value = attributes[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      hasVillage = true;
      break;
    }
  }

  // Check for valid area
  const hasValidArea = areaHa !== undefined && areaHa > 0;

  // Check for additional data (certifications, dates, etc.)
  const commonDataFields = ['date', 'DATE', 'certification', 'CERTIFICATION', 'code', 'CODE', 'superficie', 'SUPERFICIE', 'surface', 'SURFACE'];
  let additionalDataCount = 0;
  for (const field of commonDataFields) {
    const value = attributes[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      additionalDataCount++;
    }
  }

  // Determine status based on available data
  if (hasPlanteurName && (hasVillage || hasValidArea) && additionalDataCount >= 1) {
    return 'conforme';
  } else if (hasPlanteurName || hasValidArea) {
    return 'en_cours';
  } else {
    return 'informations_manquantes';
  }
}

/**
 * Map a DBF field value to a conformity status
 * Handles various formats and translations
 * 
 * @param value - The field value from DBF
 * @returns Mapped conformity status or null if not mappable
 */
export function mapFieldToConformityStatus(
  value: unknown
): 'conforme' | 'non_conforme' | 'en_cours' | 'informations_manquantes' | null {
  if (value === undefined || value === null) return null;
  
  const strValue = String(value).toLowerCase().trim();
  
  // Direct matches
  if (strValue === 'conforme' || strValue === 'ok' || strValue === 'valid' || strValue === 'valide' || strValue === 'oui' || strValue === 'yes' || strValue === '1' || strValue === 'true') {
    return 'conforme';
  }
  if (strValue === 'non_conforme' || strValue === 'non conforme' || strValue === 'invalid' || strValue === 'invalide' || strValue === 'non' || strValue === 'no' || strValue === '0' || strValue === 'false') {
    return 'non_conforme';
  }
  if (strValue === 'en_cours' || strValue === 'en cours' || strValue === 'pending' || strValue === 'en attente' || strValue === 'verification') {
    return 'en_cours';
  }
  if (strValue === 'informations_manquantes' || strValue === 'informations manquantes' || strValue === 'missing' || strValue === 'manquant' || strValue === 'incomplet' || strValue === 'incomplete') {
    return 'informations_manquantes';
  }
  
  return null;
}

/**
 * Upload progress callback type
 * @param progress - Progress percentage (0-100)
 * @param phase - Current phase of the upload ('uploading' | 'processing')
 */
export type UploadProgressCallback = (progress: number, phase: 'uploading' | 'processing') => void;

/**
 * Determine file type from filename extension
 * 
 * @param filename - Original filename
 * @returns ImportFileType or null if unsupported
 */
function getFileType(filename: string): ImportFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'zip':
      return 'shapefile_zip';
    case 'kml':
      return 'kml';
    case 'kmz':
      return 'kmz';
    case 'geojson':
    case 'json':
      return 'geojson';
    default:
      return null;
  }
}

/**
 * Compute SHA256 hash of file content
 * Uses Web Crypto API for browser compatibility
 * 
 * @param file - File to hash
 * @returns SHA256 hash as hex string
 */
async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parcelles Import API - Client-side functions for import operations
 */
export const parcellesImportApi = {
  /**
   * Upload a file for parcelle import
   * 
   * Stores the file in Supabase storage and creates an import record.
   * The cooperative_id is automatically retrieved from the authenticated user's profile.
   * 
   * Workflow: **Upload** → Parse → Preview → Apply
   * 
   * Supported file types:
   * - .zip (Shapefile archive containing .shp, .shx, .dbf, optionally .prj)
   * - .kml (Keyhole Markup Language)
   * - .kmz (Compressed KML)
   * - .geojson / .json (GeoJSON)
   * 
   * Limits:
   * - Maximum file size: 50MB
   * - Duplicate files (same SHA256) per cooperative are rejected
   * 
   * @param file - File to upload
   * @param planteurId - Optional planteur ID (if importing from planteur form)
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Created ParcelImportFile record
   * @throws Error if file type unsupported, size exceeded, duplicate, or upload fails
   */
  async upload(file: File, planteurId?: string, onProgress?: UploadProgressCallback): Promise<ParcelImportFile> {
    const supabase = getTypedClient();

    // Check for RAR files specifically to provide a helpful error message
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension === 'rar') {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Les fichiers .rar ne sont pas supportés. Veuillez extraire le contenu et re-compresser en .zip',
        details: {
          field: 'file',
          message: 'RAR format is not supported. Please extract and re-compress as ZIP.',
        },
      };
    }

    // Validate file type
    const fileType = getFileType(file.name);
    if (!fileType) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Format de fichier non supporté. Formats acceptés : .zip (Shapefile), .kml, .kmz, .geojson',
        details: {
          field: 'file',
          message: `File extension not supported: ${fileExtension}`,
        },
      };
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      throw {
        error_code: PARCELLE_ERROR_CODES.LIMIT_EXCEEDED,
        message: `File size exceeds maximum allowed (50MB)`,
        details: {
          limit: MAX_FILE_SIZE,
          actual: file.size,
          resource: 'file_size',
        },
      };
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw {
        error_code: PARCELLE_ERROR_CODES.UNAUTHORIZED,
        message: 'User not authenticated',
        details: {},
      };
    }

    // Get user's profile to retrieve cooperative_id (optional)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cooperative_id')
      .eq('id', user.id)
      .maybeSingle();

    // Profile error is only a real error if it's not a "no rows" situation
    if (profileError && profileError.code !== 'PGRST116') {
      throw {
        error_code: PARCELLE_ERROR_CODES.UNAUTHORIZED,
        message: 'Failed to fetch user profile',
        details: { reason: profileError.message },
      };
    }

    // cooperative_id is optional - user can import parcelles without belonging to a cooperative
    const cooperativeId = profile?.cooperative_id || null;

    // Compute file SHA256 hash for deduplication
    const fileSha256 = await computeFileSha256(file);

    // Check for duplicate file (same SHA256 for same user/cooperative)
    let existingImport = null;
    let checkError = null;
    
    if (cooperativeId) {
      // For users with cooperative, check by cooperative_id
      const result = await supabase
        .from('parcel_import_files')
        .select('id')
        .eq('cooperative_id', cooperativeId)
        .eq('file_sha256', fileSha256)
        .maybeSingle();
      existingImport = result.data;
      checkError = result.error;
    } else {
      // For users without cooperative, check by created_by
      const result = await supabase
        .from('parcel_import_files')
        .select('id')
        .is('cooperative_id', null)
        .eq('created_by', user.id)
        .eq('file_sha256', fileSha256)
        .maybeSingle();
      existingImport = result.data;
      checkError = result.error;
    }

    if (checkError) {
      throw new Error(`Failed to check for duplicate file: ${checkError.message}`);
    }

    if (existingImport) {
      throw {
        error_code: PARCELLE_ERROR_CODES.DUPLICATE_FILE,
        message: 'This file has already been uploaded',
        details: {
          existing_import_id: existingImport.id,
        },
      };
    }

    // Generate unique storage path: {cooperative_id or user_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderPath = cooperativeId || `user_${user.id}`;
    const storagePath = `${folderPath}/${timestamp}_${sanitizedFilename}`;

    // Upload file to Supabase storage with progress tracking
    // If onProgress callback is provided, use XMLHttpRequest for progress tracking
    // Otherwise, use the standard Supabase upload method
    if (onProgress) {
      // Get the Supabase URL and session for direct upload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw {
          error_code: PARCELLE_ERROR_CODES.UNAUTHORIZED,
          message: 'No valid session for upload',
          details: {},
        };
      }

      // Get Supabase URL from the client
      // The storage URL follows the pattern: {supabase_url}/storage/v1/object/{bucket}/{path}
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;

      // Upload with XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete, 'uploading');
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            // Try to parse error response
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const response = JSON.parse(xhr.responseText);
              errorMessage = response.message || response.error || errorMessage;
            } catch {
              // Use default error message
            }
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        // Normalize MIME type for ZIP files (some browsers use application/x-zip-compressed)
        const contentType = file.type === 'application/x-zip-compressed' 
          ? 'application/zip' 
          : (file.type || 'application/octet-stream');
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(file);
      });
    } else {
      // Standard upload without progress tracking
      // Normalize MIME type for ZIP files (some browsers use application/x-zip-compressed)
      const contentType = file.type === 'application/x-zip-compressed' 
        ? 'application/zip' 
        : (file.type || 'application/octet-stream');
      
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
    }

    // Signal processing phase if progress callback is provided
    onProgress?.(100, 'processing');

    // Create import record in database
    const insertData: Record<string, unknown> = {
      cooperative_id: cooperativeId,
      filename: file.name,
      storage_url: storagePath,
      file_type: fileType,
      file_sha256: fileSha256,
      import_status: 'uploaded',
      parse_report: {},
      nb_features: 0,
      nb_applied: 0,
      nb_skipped_duplicates: 0,
      created_by: user.id,
    };

    // Add planteur_id if provided
    if (planteurId) {
      insertData.planteur_id = planteurId;
    }

    const { data: importRecord, error: insertError } = await supabase
      .from('parcel_import_files')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      // Cleanup: delete uploaded file if record creation fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      
      // Check for unique constraint violation (duplicate SHA256)
      if (insertError.message.includes('uniq_import_file_sha256')) {
        throw {
          error_code: PARCELLE_ERROR_CODES.DUPLICATE_FILE,
          message: 'This file has already been uploaded (concurrent upload detected)',
          details: {},
        };
      }
      
      throw new Error(`Failed to create import record: ${insertError.message}`);
    }

    return importRecord as ParcelImportFile;
  },

  /**
   * Get an import file record by ID
   * 
   * @param importId - UUID of the import file
   * @returns ParcelImportFile or null if not found
   */
  async get(importId: string): Promise<ParcelImportFile | null> {
    const supabase = getTypedClient();

    const { data, error } = await supabase
      .from('parcel_import_files')
      .select('*')
      .eq('id', importId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch import file: ${error.message}`);
    }

    return data as ParcelImportFile;
  },

  /**
   * List import files for the current user's cooperative
   * 
   * @param filters - Optional filters (status, planteur_id)
   * @returns Array of ParcelImportFile records
   */
  async list(filters: {
    status?: string;
    planteur_id?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ data: ParcelImportFile[]; total: number }> {
    const supabase = getTypedClient();
    const { status, planteur_id, page = 1, pageSize = 20 } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('parcel_import_files')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('import_status', status);
    }
    if (planteur_id) {
      query = query.eq('planteur_id', planteur_id);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list import files: ${error.message}`);
    }

    return {
      data: (data || []) as ParcelImportFile[],
      total: count || 0,
    };
  },

  /**
   * Get the download URL for an import file
   * 
   * @param importId - UUID of the import file
   * @returns Signed URL for downloading the file
   */
  async getDownloadUrl(importId: string): Promise<string> {
    const supabase = getTypedClient();

    // Get the import record to find storage path
    const importFile = await this.get(importId);
    if (!importFile) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Import file not found',
        details: { id: importId },
      };
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(importFile.storage_url, 3600);

    if (error || !data) {
      throw new Error(`Failed to generate download URL: ${error?.message || 'Unknown error'}`);
    }

    return data.signedUrl;
  },

  /**
   * Parse an uploaded import file
   * 
   * Extracts features from the uploaded file, validates geometries,
   * computes feature hashes, and checks for duplicates.
   * 
   * Workflow: Upload → **Parse** → Preview → Apply
   * 
   * This operation is idempotent - re-parsing the same file will replace
   * the previous parse_report and preview data.
   * 
   * Features are sorted by feature_hash for deterministic ordering.
   * 
   * @param importId - UUID of the import file to parse
   * @returns ParseResult with features, report, and available fields
   * @throws Error if import not found, file download fails, or parsing fails
   */
  async parse(importId: string): Promise<ParseResult> {
    const supabase = getTypedClient();

    console.log('[parcellesImportApi.parse] Starting parse for import:', importId);

    // Get the import record
    const importFile = await this.get(importId);
    if (!importFile) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Import file not found',
        details: { id: importId },
      };
    }

    console.log('[parcellesImportApi.parse] Import file found, downloading from:', importFile.storage_url);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(importFile.storage_url);

    console.log('[parcellesImportApi.parse] Download result:', { hasData: !!fileData, error: downloadError?.message });

    if (downloadError || !fileData) {
      // Update status to failed
      await supabase
        .from('parcel_import_files')
        .update({
          import_status: 'failed',
          failed_reason: `Failed to download file: ${downloadError?.message || 'Unknown error'}`,
        })
        .eq('id', importId);

      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    console.log('[parcellesImportApi.parse] File downloaded, size:', fileData.size, 'bytes');

    // Parse the file based on type
    let parseResult: {
      features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: import('geojson').MultiPolygon }>;
      errors: ParseError[];
      warnings: ParseWarning[];
      availableFields: string[];
      hasPrj?: boolean;
    };

    try {
      console.log('[parcellesImportApi.parse] Converting to ArrayBuffer...');
      const buffer = await fileData.arrayBuffer();
      console.log('[parcellesImportApi.parse] ArrayBuffer size:', buffer.byteLength);

      console.log('[parcellesImportApi.parse] Parsing file type:', importFile.file_type);
      switch (importFile.file_type) {
        case 'shapefile_zip':
          parseResult = await parseShapefile(buffer);
          break;
        case 'kml':
          const kmlText = await fileData.text();
          parseResult = parseKML(kmlText);
          break;
        case 'kmz':
          parseResult = await parseKMZ(buffer);
          break;
        case 'geojson':
          const geojsonText = await fileData.text();
          parseResult = parseGeoJSON(geojsonText);
          break;
        default:
          throw {
            error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
            message: `Unsupported file type: ${importFile.file_type}`,
            details: { file_type: importFile.file_type },
          };
      }
      console.log('[parcellesImportApi.parse] Parse complete, features:', parseResult.features.length);
    } catch (err) {
      console.error('[parcellesImportApi.parse] Parse error:', err);
      // Update status to failed
      const errorMessage = err instanceof Error ? err.message : 
        (err as { message?: string })?.message || 'Unknown parsing error';
      
      await supabase
        .from('parcel_import_files')
        .update({
          import_status: 'failed',
          failed_reason: errorMessage,
          parse_report: {
            nb_features: 0,
            errors: [{
              code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
              message: errorMessage,
            }],
            warnings: [],
          },
        })
        .eq('id', importId);

      throw err;
    }

    // Check feature limit
    if (parseResult.features.length > PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT) {
      const limitError: ParseError = {
        code: PARCELLE_ERROR_CODES.LIMIT_EXCEEDED,
        message: `Too many features: ${parseResult.features.length} exceeds limit of ${PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT}`,
        details: {
          limit: PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT,
          actual: parseResult.features.length,
          resource: 'features',
        },
      };
      parseResult.errors.push(limitError);

      // Update status to failed
      await supabase
        .from('parcel_import_files')
        .update({
          import_status: 'failed',
          failed_reason: limitError.message,
          nb_features: parseResult.features.length,
          parse_report: {
            nb_features: parseResult.features.length,
            errors: parseResult.errors,
            warnings: parseResult.warnings,
          },
        })
        .eq('id', importId);

      throw {
        error_code: PARCELLE_ERROR_CODES.LIMIT_EXCEEDED,
        message: limitError.message,
        details: limitError.details,
      };
    }

    // Check for projected coordinates warning (if no .prj file for shapefiles)
    const hasPrj = 'hasPrj' in parseResult ? parseResult.hasPrj : true;

    // If no features were parsed, return early with empty result
    if (parseResult.features.length === 0) {
      console.log('[parcellesImportApi.parse] No features found, returning early');
      
      const emptyReport: ParseReport = {
        nb_features: 0,
        errors: parseResult.errors.length > 0 ? parseResult.errors : [{
          code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: 'No valid polygon features found in the file',
        }],
        warnings: parseResult.warnings,
      };

      // Update import record
      await supabase
        .from('parcel_import_files')
        .update({
          import_status: 'failed',
          failed_reason: 'No valid polygon features found in the file',
          nb_features: 0,
          parse_report: emptyReport,
        })
        .eq('id', importId);

      return {
        features: [],
        report: emptyReport,
        available_fields: parseResult.availableFields,
      };
    }

    // Process each feature: validate, compute hash, check duplicates
    console.log('[parcellesImportApi.parse] Processing', parseResult.features.length, 'features...');
    const parsedFeatures: ParsedFeature[] = [];
    const errors: ParseError[] = [...parseResult.errors];
    const warnings: ParseWarning[] = [...parseResult.warnings];

    // Get existing feature hashes for duplicate detection
    // We need to check against all active parcelles in the cooperative
    console.log('[parcellesImportApi.parse] Fetching existing parcelles for duplicate check...');
    const { data: existingParcelles } = await supabase
      .from('parcelles')
      .select('id, feature_hash, planteur_id')
      .eq('is_active', true)
      .not('feature_hash', 'is', null);
    console.log('[parcellesImportApi.parse] Found', existingParcelles?.length || 0, 'existing parcelles');

    const existingHashMap = new Map<string, { id: string; planteur_id: string }>();
    if (existingParcelles) {
      for (const p of existingParcelles) {
        if (p.feature_hash) {
          existingHashMap.set(p.feature_hash, { id: p.id, planteur_id: p.planteur_id });
        }
      }
    }

    // Process features
    for (let i = 0; i < parseResult.features.length; i++) {
      const feature = parseResult.features[i];
      const tempId = uuidv4();
      const featureErrors: string[] = [];
      const featureWarnings: string[] = [];

      // Check for empty geometry
      if (isEmptyGeometry(feature.geometry)) {
        featureErrors.push('Empty geometry');
        errors.push({
          code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
          message: `Feature ${i}: Empty geometry`,
          feature_index: i,
          details: { reason: 'empty geometry' },
        });
        continue; // Skip this feature
      }

      // Validate coordinates are in WGS84 bounds
      const coordValidation = validateCoordinates(feature.geometry);
      let geomOriginalValid = true;
      let fixedGeometry = feature.geometry;

      if (!coordValidation.valid) {
        // Check if likely projected coordinates
        if (!hasPrj) {
          const projectedCheck = detectProjectedCoordinates(feature.geometry);
          if (projectedCheck.likely) {
            warnings.push({
              code: PARCELLE_ERROR_CODES.LIKELY_PROJECTED_COORDINATES,
              message: `Feature ${i}: Coordinates appear to be projected (not WGS84)`,
              feature_index: i,
              requires_confirmation: true,
              details: { sample_coord: projectedCheck.sampleCoord },
            });
            featureWarnings.push('Coordinates may be projected (not WGS84)');
          }
        }
      }

      // Validate geometry structure
      if (!isValidGeometry(feature.geometry)) {
        geomOriginalValid = false;
        featureWarnings.push('Geometry has self-intersections, attempting to fix');

        // Try to fix the geometry
        const fixed = tryFixGeometry(feature.geometry);
        if (fixed) {
          fixedGeometry = fixed;
          featureWarnings.push('Geometry was automatically fixed');
        } else {
          featureErrors.push('Invalid geometry that could not be fixed');
          errors.push({
            code: PARCELLE_ERROR_CODES.INVALID_GEOMETRY,
            message: `Feature ${i}: Invalid geometry that could not be fixed`,
            feature_index: i,
            details: { reason: 'self-intersecting polygon' },
          });
          continue; // Skip this feature
        }
      }

      // Compute feature hash
      let featureHash: string;
      try {
        featureHash = await computeFeatureHash(fixedGeometry);
      } catch (err) {
        featureErrors.push('Failed to compute feature hash');
        errors.push({
          code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: `Feature ${i}: Failed to compute feature hash`,
          feature_index: i,
        });
        continue; // Skip this feature
      }

      // Check for duplicates
      const existingMatch = existingHashMap.get(featureHash);
      const isDuplicate = !!existingMatch;
      if (isDuplicate) {
        featureWarnings.push(`Duplicate of existing parcelle ${existingMatch.id}`);
        warnings.push({
          code: PARCELLE_ERROR_CODES.DUPLICATE_GEOMETRY,
          message: `Feature ${i}: Duplicate geometry found`,
          feature_index: i,
          details: { existing_parcelle_id: existingMatch.id },
        });
      }

      // Calculate area and centroid
      const areaHa = calculateAreaHa(fixedGeometry);
      const centroid = calculateCentroid(fixedGeometry);

      // Extract label from properties (try common field names)
      const props = feature.properties || {};
      const label = (props.name || props.NAME || props.label || props.LABEL || 
                    props.nom || props.NOM || props.description || null) as string | null;

      // Create parsed feature
      const parsedFeature: ParsedFeature = {
        temp_id: tempId,
        label,
        dbf_attributes: props,
        geom_geojson: fixedGeometry,
        geom_original_valid: geomOriginalValid,
        area_ha: areaHa,
        centroid,
        validation: {
          ok: featureErrors.length === 0,
          errors: featureErrors,
          warnings: featureWarnings,
        },
        feature_hash: featureHash,
        is_duplicate: isDuplicate,
        existing_parcelle_id: existingMatch?.id,
      };

      // Add fixed geometry if it was modified
      if (!geomOriginalValid) {
        parsedFeature.geom_fixed = fixedGeometry;
      }

      parsedFeatures.push(parsedFeature);
    }

    // Sort features by feature_hash for idempotent ordering
    parsedFeatures.sort((a, b) => a.feature_hash.localeCompare(b.feature_hash));

    // Build parse report
    const parseReport: ParseReport = {
      nb_features: parsedFeatures.length,
      errors,
      warnings,
    };

    // Determine status based on errors
    const hasBlockingErrors = errors.some(
      (e) => e.code === PARCELLE_ERROR_CODES.LIMIT_EXCEEDED ||
             e.code === PARCELLE_ERROR_CODES.SHAPEFILE_MISSING_REQUIRED
    );
    const newStatus = hasBlockingErrors ? 'failed' : 'parsed';
    const failedReason = hasBlockingErrors ? errors[0]?.message : null;

    // Update import record with parse results
    const { error: updateError } = await supabase
      .from('parcel_import_files')
      .update({
        import_status: newStatus,
        failed_reason: failedReason,
        nb_features: parsedFeatures.length,
        parse_report: parseReport,
      })
      .eq('id', importId);

    if (updateError) {
      throw new Error(`Failed to update import record: ${updateError.message}`);
    }

    return {
      features: parsedFeatures,
      report: parseReport,
      available_fields: parseResult.availableFields,
    };
  },

  /**
   * Apply an import - create parcelles from parsed features (Legacy V1)
   * 
   * Creates parcelles from the parsed features in an import file.
   * All parcelles will belong to the specified planteur.
   * 
   * Workflow: Upload → Parse → Preview → **Apply**
   * 
   * @deprecated Use applyV2() with mode parameter for flexible import modes
   * 
   * @param importId - UUID of the import file to apply
   * @param input - ApplyImportInput with planteur_id, mapping, and defaults
   * @returns ApplyImportResult with nb_applied, nb_skipped, and created_ids
   */
  async apply(importId: string, input: ApplyImportInput): Promise<ApplyImportResult> {
    // Delegate to applyV2 with 'assign' mode for backward compatibility
    return this.applyV2(importId, {
      mode: 'assign',
      planteur_id: input.planteur_id,
      mapping: input.mapping,
      defaults: input.defaults,
    });
  },

  /**
   * Apply an import with flexible modes (V2)
   * 
   * Creates parcelles from the parsed features in an import file.
   * Supports three import modes:
   * - auto_create: Create planteurs automatically from DBF attributes
   * - orphan: Create parcelles without planteur assignment (orphan parcelles)
   * - assign: Assign all parcelles to a single existing planteur
   * 
   * Workflow: Upload → Parse → Preview → **Apply**
   * 
   * Validation:
   * - Import must have status='parsed' (not 'uploaded', 'failed', or 'applied')
   * - Import cannot be re-applied (status='applied' returns VALIDATION_ERROR)
   * - For 'assign' mode: Planteur must belong to the same cooperative as the import file
   * - For 'auto_create' mode: planteur_name_field is required, default_chef_planteur_id is optional
   * - For 'orphan' mode: import_file_id is automatically set (required for RLS)
   * 
   * Duplicate handling:
   * - Features with is_duplicate=true are skipped by default
   * - Constraint violations (unique index) are caught and counted as skipped
   * 
   * @param importId - UUID of the import file to apply
   * @param input - ApplyImportInputV2 with mode, mapping, defaults, and mode-specific fields
   * @returns ApplyImportResult with nb_applied, nb_skipped, and created_ids
   * @throws Error if import not found, already applied, or validation fails
   * 
   * @see Requirements 2.3, 2.4, 2.5, 2.6, 3.2, 3.3
   */
  async applyV2(importId: string, input: ApplyImportInputV2): Promise<ApplyImportResult> {
    const supabase = getTypedClient();

    // Validate input with Zod schema
    const validatedInput = applyImportV2Schema.parse(input);

    // Get the import record
    const importFile = await this.get(importId);
    if (!importFile) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Import file not found',
        details: { id: importId },
      };
    }

    // Check if already applied - return success with existing data instead of error
    if (importFile.import_status === 'applied') {
      // Get the created parcelle IDs
      const { data: existingParcelles } = await supabase
        .from('parcelles')
        .select('id')
        .eq('import_file_id', importId)
        .eq('is_active', true);

      const createdIds = (existingParcelles || []).map(p => p.id);
      
      // Return success with existing data - this allows the UI to redirect properly
      return {
        nb_applied: importFile.nb_applied || createdIds.length,
        nb_skipped: importFile.nb_skipped_duplicates || 0,
        created_ids: createdIds,
      };
    }

    // Check if parcelles were already created for this import (partial apply recovery)
    // This handles the case where the import succeeded but the status update failed
    const { count: existingParcellesCount } = await supabase
      .from('parcelles')
      .select('*', { count: 'exact', head: true })
      .eq('import_file_id', importId)
      .eq('is_active', true);

    if (existingParcellesCount && existingParcellesCount > 0) {
      // Parcelles were already created - update status and return success
      console.log(`[applyV2] Found ${existingParcellesCount} existing parcelles for import ${importId}, recovering...`);
      
      // Get the created parcelle IDs
      const { data: existingParcelles } = await supabase
        .from('parcelles')
        .select('id')
        .eq('import_file_id', importId)
        .eq('is_active', true);

      const createdIds = (existingParcelles || []).map(p => p.id);

      // Update import status to 'applied'
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('parcel_import_files')
        .update({
          import_status: 'applied',
          nb_applied: createdIds.length,
          nb_skipped_duplicates: 0,
          applied_by: user?.id,
          applied_at: new Date().toISOString(),
        })
        .eq('id', importId);

      return {
        nb_applied: createdIds.length,
        nb_skipped: 0,
        created_ids: createdIds,
      };
    }

    // Check if status is 'parsed' (ready to apply)
    if (importFile.import_status !== 'parsed') {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: `Import cannot be applied in status '${importFile.import_status}'`,
        details: {
          field: 'import_status',
          message: `Import must be in 'parsed' status to apply. Current status: '${importFile.import_status}'`,
        },
      };
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw {
        error_code: PARCELLE_ERROR_CODES.UNAUTHORIZED,
        message: 'User not authenticated',
        details: {},
      };
    }

    // Get user's profile to retrieve cooperative_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('cooperative_id')
      .eq('id', user.id)
      .maybeSingle();

    const userCooperativeId = profile?.cooperative_id || null;
    const importCoopId = importFile.cooperative_id || null;

    // Mode-specific validation
    const { mode, mapping, defaults } = validatedInput;
    
    // For 'assign' mode, verify planteur belongs to the same cooperative
    if (mode === 'assign') {
      const { data: planteur, error: planteurError } = await supabase
        .from('planteurs')
        .select('id, cooperative_id')
        .eq('id', validatedInput.planteur_id!)
        .single();

      if (planteurError || !planteur) {
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: 'Planteur not found',
          details: {
            field: 'planteur_id',
            message: 'The specified planteur does not exist or is not accessible',
          },
        };
      }

      const planteurCoopId = planteur.cooperative_id || null;
      if (planteurCoopId !== importCoopId) {
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: 'Planteur does not belong to the same cooperative as the import file',
          details: {
            field: 'planteur_id',
            message: 'Planteur must belong to the same cooperative as the import file',
          },
        };
      }
    }

    // For 'auto_create' mode, verify chef_planteur exists (if provided)
    if (mode === 'auto_create' && validatedInput.default_chef_planteur_id) {
      const { data: chefPlanteur, error: chefError } = await supabase
        .from('chef_planteurs')
        .select('id, cooperative_id')
        .eq('id', validatedInput.default_chef_planteur_id)
        .single();

      if (chefError || !chefPlanteur) {
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: 'Chef planteur not found',
          details: {
            field: 'default_chef_planteur_id',
            message: 'The specified chef planteur does not exist or is not accessible',
          },
        };
      }

      // Verify chef_planteur belongs to the same cooperative
      const chefCoopId = chefPlanteur.cooperative_id || null;
      if (chefCoopId !== importCoopId) {
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: 'Chef planteur does not belong to the same cooperative as the import file',
          details: {
            field: 'default_chef_planteur_id',
            message: 'Chef planteur must belong to the same cooperative as the import file',
          },
        };
      }
    }

    // For 'orphan' mode, verify import_file_id is set (required for RLS)
    // This is guaranteed since we're using the importId parameter
    if (mode === 'orphan' && !importId) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Orphan parcelles require import_file_id for RLS',
        details: {
          field: 'import_file_id',
          message: 'Cannot create orphan parcelles without an import file reference',
        },
      };
    }

    // Re-parse to get the features (parse is idempotent)
    const parseResult = await this.parse(importId);
    const features = parseResult.features;

    // Check feature limit
    if (features.length > PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT) {
      throw {
        error_code: PARCELLE_ERROR_CODES.LIMIT_EXCEEDED,
        message: `Too many features: ${features.length} exceeds limit of ${PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT}`,
        details: {
          limit: PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT,
          actual: features.length,
          resource: 'features',
        },
      };
    }

    // Determine source based on file type
    const sourceMap: Record<ImportFileType, ParcelleSource> = {
      shapefile_zip: 'shapefile',
      kml: 'kml',
      kmz: 'kml',
      geojson: 'geojson',
    };
    const source = sourceMap[importFile.file_type];

    // Track results
    const createdIds: string[] = [];
    let nbSkipped = 0;

    // =========================================================================
    // MODE: auto_create - Create planteurs automatically from DBF attributes
    // =========================================================================
    if (mode === 'auto_create') {
      const planteurNameField = validatedInput.planteur_name_field!;
      const defaultChefPlanteurId = validatedInput.default_chef_planteur_id; // Can be undefined

      // Step 1: Extract unique planteur names from features
      const planteurNameMap = new Map<string, { name: string; features: ParsedFeature[] }>();
      const orphanFeatures: ParsedFeature[] = [];

      for (const feature of features) {
        if (!feature.validation.ok || feature.is_duplicate) {
          nbSkipped++;
          continue;
        }

        const attrs = feature.dbf_attributes || {};
        const rawName = attrs[planteurNameField];
        
        if (!rawName || String(rawName).trim() === '') {
          // Empty name → orphan parcelle
          orphanFeatures.push(feature);
          continue;
        }

        const name = String(rawName).trim();
        const nameNorm = normalizePlanteurName(name);

        if (!planteurNameMap.has(nameNorm)) {
          planteurNameMap.set(nameNorm, { name, features: [] });
        }
        planteurNameMap.get(nameNorm)!.features.push(feature);
      }

      // Step 2: Match with existing planteurs by name_norm
      const existingPlanteursMap = new Map<string, { id: string; name: string }>();
      
      // Use import's cooperative_id, or fall back to user's cooperative_id
      const effectiveCoopId = importCoopId || userCooperativeId;
      
      if (planteurNameMap.size > 0) {
        const nameNorms = Array.from(planteurNameMap.keys());
        
        // Batch the query to avoid URL length limits (PostgREST has ~8KB URL limit)
        // With ~20 names per batch, we stay well under the limit
        const BATCH_SIZE = 20;
        const batches: string[][] = [];
        
        for (let i = 0; i < nameNorms.length; i += BATCH_SIZE) {
          batches.push(nameNorms.slice(i, i + BATCH_SIZE));
        }
        
        // Query existing planteurs in batches
        for (const batch of batches) {
          let query = supabase
            .from('planteurs')
            .select('id, name, name_norm')
            .eq('is_active', true)
            .in('name_norm', batch);
          
          // Filter by cooperative_id if available, otherwise get planteurs without cooperative
          if (effectiveCoopId) {
            query = query.eq('cooperative_id', effectiveCoopId);
          } else {
            query = query.is('cooperative_id', null);
          }

          const { data: existingPlanteurs } = await query;

          if (existingPlanteurs) {
            for (const p of existingPlanteurs) {
              existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
            }
          }
        }
      }

      // Step 3: Create new planteurs for names that don't exist
      const newPlanteursMap = new Map<string, string>(); // name_norm → planteur_id

      for (const [nameNorm, { name }] of planteurNameMap) {
        if (existingPlanteursMap.has(nameNorm)) {
          // Reuse existing planteur
          newPlanteursMap.set(nameNorm, existingPlanteursMap.get(nameNorm)!.id);
        } else {
          // Create new planteur
          const planteurCode = `PLT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          const { data: newPlanteur, error: createError } = await supabase
            .from('planteurs')
            .insert({
              name,
              code: planteurCode,
              cooperative_id: effectiveCoopId, // Use effective cooperative_id (can be null)
              chef_planteur_id: defaultChefPlanteurId,
              auto_created: true,
              created_via_import_id: importId,
              is_active: true,
              created_by: user.id,
            })
            .select('id')
            .single();

          if (createError) {
            // Check for duplicate name_norm (race condition)
            if (createError.code === '23505' || createError.message?.includes('planteurs_unique_name_norm_per_coop')) {
              // Try to fetch the existing planteur
              let duplicateQuery = supabase
                .from('planteurs')
                .select('id')
                .eq('name_norm', nameNorm)
                .eq('is_active', true);
              
              if (effectiveCoopId) {
                duplicateQuery = duplicateQuery.eq('cooperative_id', effectiveCoopId);
              } else {
                duplicateQuery = duplicateQuery.is('cooperative_id', null);
              }
              
              const { data: existing } = await duplicateQuery.single();
              
              if (existing) {
                newPlanteursMap.set(nameNorm, existing.id);
                continue;
              }
            }
            console.error(`Failed to create planteur "${name}":`, createError.message);
            // Skip all features for this planteur
            nbSkipped += planteurNameMap.get(nameNorm)!.features.length;
            continue;
          }

          if (newPlanteur) {
            newPlanteursMap.set(nameNorm, newPlanteur.id);
          }
        }
      }

      // Step 4: Create parcelles for each planteur
      for (const [nameNorm, { features: planteurFeatures }] of planteurNameMap) {
        const planteurId = newPlanteursMap.get(nameNorm);
        if (!planteurId) {
          nbSkipped += planteurFeatures.length;
          continue;
        }

        // Get existing parcelle count for code generation
        const { count: existingCount } = await supabase
          .from('parcelles')
          .select('*', { count: 'exact', head: true })
          .eq('planteur_id', planteurId);

        let codeCounter = (existingCount || 0) + 1;

        for (const feature of planteurFeatures) {
          const result = await this._createParcelle(
            supabase,
            feature,
            planteurId,
            codeCounter,
            mapping,
            defaults,
            source,
            importId,
            user.id,
            planteurNameField // Pass for auto-detection
          );

          if (result.success) {
            createdIds.push(result.id!);
            codeCounter++;
          } else {
            nbSkipped++;
          }
        }
      }

      // Step 5: Create orphan parcelles (features with empty planteur name)
      for (const feature of orphanFeatures) {
        const result = await this._createParcelle(
          supabase,
          feature,
          null, // orphan - no planteur
          0, // no code counter for orphans
          mapping,
          defaults,
          source,
          importId,
          user.id,
          planteurNameField // Pass for auto-detection
        );

        if (result.success) {
          createdIds.push(result.id!);
        } else {
          nbSkipped++;
        }
      }
    }

    // =========================================================================
    // MODE: orphan - Create all parcelles without planteur assignment
    // =========================================================================
    else if (mode === 'orphan') {
      for (const feature of features) {
        if (!feature.validation.ok) {
          nbSkipped++;
          continue;
        }

        if (feature.is_duplicate) {
          nbSkipped++;
          continue;
        }

        const result = await this._createParcelle(
          supabase,
          feature,
          null, // orphan - no planteur
          0, // no code counter for orphans
          mapping,
          defaults,
          source,
          importId,
          user.id,
          undefined // No planteur name field for orphan mode
        );

        if (result.success) {
          createdIds.push(result.id!);
        } else {
          nbSkipped++;
        }
      }
    }

    // =========================================================================
    // MODE: assign - Assign all parcelles to a single existing planteur
    // =========================================================================
    else if (mode === 'assign') {
      const planteurId = validatedInput.planteur_id!;

      // Get existing parcelle count for code generation
      const { count: existingCount } = await supabase
        .from('parcelles')
        .select('*', { count: 'exact', head: true })
        .eq('planteur_id', planteurId);

      let codeCounter = (existingCount || 0) + 1;

      for (const feature of features) {
        if (!feature.validation.ok) {
          nbSkipped++;
          continue;
        }

        if (feature.is_duplicate) {
          nbSkipped++;
          continue;
        }

        const result = await this._createParcelle(
          supabase,
          feature,
          planteurId,
          codeCounter,
          mapping,
          defaults,
          source,
          importId,
          user.id,
          undefined // No planteur name field for assign mode
        );

        if (result.success) {
          createdIds.push(result.id!);
          codeCounter++;
        } else {
          nbSkipped++;
        }
      }
    }

    // Update import file record with results
    const { error: updateError } = await supabase
      .from('parcel_import_files')
      .update({
        import_status: 'applied',
        nb_applied: createdIds.length,
        nb_skipped_duplicates: nbSkipped,
        applied_by: user.id,
        applied_at: new Date().toISOString(),
      })
      .eq('id', importId);

    if (updateError) {
      console.error('Failed to update import file status:', updateError.message);
    }

    return {
      nb_applied: createdIds.length,
      nb_skipped: nbSkipped,
      created_ids: createdIds,
    };
  },

  /**
   * Preview auto-create mode results
   * 
   * Analyzes the parsed features to show which planteurs will be created vs reused.
   * This allows users to review the import before applying.
   * 
   * Workflow: Upload → Parse → **Preview Auto-Create** → Apply
   * 
   * @param importId - UUID of the import file to preview
   * @param planteurNameField - DBF field containing planteur names
   * @returns AutoCreatePreview with new_planteurs, existing_planteurs, and orphan_count
   * @throws Error if import not found or not in 'parsed' status
   * 
   * @see Requirements 3.5
   */
  async previewAutoCreate(importId: string, planteurNameField: string): Promise<AutoCreatePreview> {
    const supabase = getTypedClient();

    // Validate planteur_name_field is provided
    if (!planteurNameField || planteurNameField.trim() === '') {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Planteur name field is required',
        details: {
          field: 'planteur_name_field',
          message: 'Please specify which DBF field contains the planteur names',
        },
      };
    }

    // Get the import record
    const importFile = await this.get(importId);
    if (!importFile) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Import file not found',
        details: { id: importId },
      };
    }

    // Check if status is 'parsed' (ready for preview)
    if (importFile.import_status !== 'parsed') {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: `Import cannot be previewed in status '${importFile.import_status}'`,
        details: {
          field: 'import_status',
          message: `Import must be in 'parsed' status to preview. Current status: '${importFile.import_status}'`,
        },
      };
    }

    // Re-parse to get the features (parse is idempotent)
    const parseResult = await this.parse(importId);
    const features = parseResult.features;

    // Check if the specified field exists in available fields
    if (!parseResult.available_fields.includes(planteurNameField)) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: `Field '${planteurNameField}' not found in the file`,
        details: {
          field: 'planteur_name_field',
          message: `The field '${planteurNameField}' does not exist in the imported file. Available fields: ${parseResult.available_fields.join(', ')}`,
        },
      };
    }

    // Extract unique planteur names from features
    // Map: name_norm → { name (original), count }
    const planteurNameMap = new Map<string, { name: string; count: number }>();
    let orphanCount = 0;

    for (const feature of features) {
      // Skip features with validation errors or duplicates
      if (!feature.validation.ok || feature.is_duplicate) {
        continue;
      }

      const attrs = feature.dbf_attributes || {};
      const rawName = attrs[planteurNameField];

      if (!rawName || String(rawName).trim() === '') {
        // Empty name → will be orphan parcelle
        orphanCount++;
        continue;
      }

      const name = String(rawName).trim();
      const nameNorm = normalizePlanteurName(name);

      if (planteurNameMap.has(nameNorm)) {
        // Increment count for existing name
        const existing = planteurNameMap.get(nameNorm)!;
        existing.count++;
      } else {
        // Add new name
        planteurNameMap.set(nameNorm, { name, count: 1 });
      }
    }

    // Match with existing planteurs by name_norm
    const importCoopId = importFile.cooperative_id || null;
    const existingPlanteursMap = new Map<string, { id: string; name: string }>();

    if (planteurNameMap.size > 0 && importCoopId) {
      const nameNorms = Array.from(planteurNameMap.keys());

      // Query existing planteurs with matching name_norm in the same cooperative
      const { data: existingPlanteurs, error: queryError } = await supabase
        .from('planteurs')
        .select('id, name, name_norm')
        .eq('cooperative_id', importCoopId)
        .eq('is_active', true)
        .in('name_norm', nameNorms);

      if (queryError) {
        console.error('Failed to query existing planteurs:', queryError.message);
        // Continue without matching - all will be treated as new
      } else if (existingPlanteurs) {
        for (const p of existingPlanteurs) {
          existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
        }
      }
    }

    // Build the preview result
    const newPlanteurs: AutoCreatePreview['new_planteurs'] = [];
    const existingPlanteurs: AutoCreatePreview['existing_planteurs'] = [];

    for (const [nameNorm, { name, count }] of planteurNameMap) {
      const existing = existingPlanteursMap.get(nameNorm);

      if (existing) {
        // Will reuse existing planteur
        existingPlanteurs.push({
          id: existing.id,
          name: existing.name,
          parcelle_count: count,
        });
      } else {
        // Will create new planteur
        newPlanteurs.push({
          name,
          name_norm: nameNorm,
          parcelle_count: count,
        });
      }
    }

    // Sort results for consistent ordering
    newPlanteurs.sort((a, b) => a.name.localeCompare(b.name));
    existingPlanteurs.sort((a, b) => a.name.localeCompare(b.name));

    return {
      new_planteurs: newPlanteurs,
      existing_planteurs: existingPlanteurs,
      orphan_count: orphanCount,
    };
  },

  /**
   * Helper function to create a single parcelle
   * @internal
   */
  async _createParcelle(
    supabase: ReturnType<typeof createClient>,
    feature: ParsedFeature,
    planteurId: string | null,
    codeCounter: number,
    mapping: { label_field?: string; code_field?: string; village_field?: string; conformity_status_field?: string },
    defaults: { conformity_status?: string; certifications?: string[]; auto_detect_conformity?: boolean },
    source: ParcelleSource,
    importFileId: string,
    userId: string,
    planteurNameField?: string
  ): Promise<{ success: boolean; id?: string }> {
    const attrs = feature.dbf_attributes || {};

    // Get label from mapped field or use feature label
    let label = feature.label;
    if (mapping.label_field && attrs[mapping.label_field] !== undefined) {
      label = String(attrs[mapping.label_field]);
    }

    // Get code from mapped field or generate (only for assigned parcelles)
    let code: string | null = null;
    if (planteurId) {
      if (mapping.code_field && attrs[mapping.code_field] !== undefined) {
        code = String(attrs[mapping.code_field]);
      } else {
        code = `PARC-${String(codeCounter).padStart(4, '0')}`;
      }
    }

    // Get village from mapped field
    let village: string | null = null;
    if (mapping.village_field && attrs[mapping.village_field] !== undefined) {
      village = String(attrs[mapping.village_field]);
    }

    // Determine conformity status
    let conformityStatus: string = defaults.conformity_status || 'informations_manquantes';
    
    // Priority 1: Use mapped field if available
    if (mapping.conformity_status_field && attrs[mapping.conformity_status_field] !== undefined) {
      const mappedStatus = mapFieldToConformityStatus(attrs[mapping.conformity_status_field]);
      if (mappedStatus) {
        conformityStatus = mappedStatus;
      }
    }
    // Priority 2: Auto-detect if enabled
    else if (defaults.auto_detect_conformity) {
      conformityStatus = detectConformityStatus(attrs, planteurNameField, feature.area_ha);
    }

    // Prepare parcelle data
    // Strip Z dimension from geometry (shapefiles can have 3D coords but PostGIS column is 2D)
    const geometry2D = stripZDimension(feature.geom_geojson);
    
    const parcelleData = {
      planteur_id: planteurId,
      code,
      label,
      village,
      geometry_geojson: JSON.stringify(geometry2D),
      certifications: defaults.certifications || [],
      conformity_status: conformityStatus,
      risk_flags: {},
      source,
      import_file_id: importFileId,
      feature_hash: feature.feature_hash,
      created_by: userId,
    };

    try {
      // Insert parcelle using RPC function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: insertError } = await supabase.rpc('create_parcelle', {
        p_planteur_id: parcelleData.planteur_id,
        p_code: parcelleData.code,
        p_label: parcelleData.label,
        p_village: parcelleData.village,
        p_geometry_geojson: parcelleData.geometry_geojson,
        p_certifications: parcelleData.certifications,
        p_conformity_status: parcelleData.conformity_status,
        p_risk_flags: parcelleData.risk_flags,
        p_source: parcelleData.source,
        p_import_file_id: parcelleData.import_file_id,
        p_feature_hash: parcelleData.feature_hash,
        p_created_by: parcelleData.created_by,
      } as any);

      if (insertError) {
        const isUniqueViolation =
          insertError.code === '23505' ||
          insertError.message?.includes('uniq_active_parcelle_hash') ||
          insertError.message?.includes('parcelles_code_unique') ||
          insertError.message?.includes('duplicate key') ||
          insertError.message?.includes('unique constraint') ||
          insertError.message?.includes('violates unique constraint');

        if (isUniqueViolation) {
          return { success: false };
        }

        console.error(`Failed to create parcelle for feature ${feature.temp_id}:`, insertError.message);
        return { success: false };
      }

      if (created && typeof created === 'object' && 'id' in created) {
        return { success: true, id: (created as { id: string }).id };
      }

      return { success: false };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = (err as { code?: string })?.code;

      const isUniqueViolation =
        errorCode === '23505' ||
        errorMessage.includes('uniq_active_parcelle_hash') ||
        errorMessage.includes('parcelles_code_unique') ||
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('unique constraint') ||
        errorMessage.includes('violates unique constraint');

      if (isUniqueViolation) {
        return { success: false };
      }

      console.error(`Error creating parcelle for feature ${feature.temp_id}:`, err);
      return { success: false };
    }
  },
};
