// CocoaTrack V2 - Parcelles Import Upload API Route
// POST /api/parcelles/import/upload - Upload a file for parcelle import

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import type { ParcelImportFile, ImportFileType } from '@/types/parcelles';
import { PARCELLE_LIMITS } from '@/types/parcelles';
import {
  unauthorizedResponse,
  validationErrorResponse,
  limitExceededResponse,
  duplicateFileResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';

// Storage bucket name for parcelle imports
const STORAGE_BUCKET = 'parcelle-imports';

/**
 * Determine file type from filename extension
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
 * Compute SHA256 hash of file content using Web Crypto API
 */
async function computeFileSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /api/parcelles/import/upload
 * 
 * Upload a file for parcelle import.
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Get user's profile to retrieve cooperative_id (optional)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
      .select('cooperative_id')
      .eq('id', user.id)
      .maybeSingle();

    // Profile error is only a real error if it's not a "no rows" situation
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch user profile',
        { reason: profileError.message }
      ));
    }

    // cooperative_id is optional - user can import parcelles without belonging to a cooperative
    // If profile doesn't exist or has no cooperative, cooperativeId will be null
    const cooperativeId = (profile as { cooperative_id: string | null } | null)?.cooperative_id || null;

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return validationErrorResponse('body', 'Request must be multipart/form-data');
    }

    // Get file from form data
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return validationErrorResponse('file', 'A file must be provided in the "file" field');
    }

    // Get optional planteur_id from form data
    const planteurIdValue = formData.get('planteur_id');
    const planteurId = planteurIdValue && typeof planteurIdValue === 'string' ? planteurIdValue : undefined;

    // Validate planteur_id format if provided
    if (planteurId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(planteurId)) {
        return validationErrorResponse('planteur_id', 'Must be a valid UUID');
      }
    }

    // Validate file type
    const fileType = getFileType(file.name);
    if (!fileType) {
      return validationErrorResponse(
        'file',
        `File extension not supported: ${file.name.split('.').pop()}. Accepted formats: .zip (Shapefile), .kml, .kmz, .geojson`
      );
    }

    // Validate file size (50MB max)
    if (file.size > PARCELLE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return limitExceededResponse(PARCELLE_LIMITS.MAX_FILE_SIZE_BYTES, file.size, 'file_size');
    }

    // Read file content and compute SHA256 hash
    const fileBuffer = await file.arrayBuffer();
    const fileSha256 = await computeFileSha256(fileBuffer);

    // Check for duplicate file (same SHA256 for same user/cooperative)
    // Use cooperative_id if available, otherwise check by created_by (user)
    let existingImport = null;
    let checkError = null;
    
    if (cooperativeId) {
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
      console.error('Error checking for duplicate file:', checkError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to check for duplicate file',
        { reason: checkError.message }
      ));
    }

    if (existingImport) {
      return duplicateFileResponse((existingImport as { id: string }).id);
    }

    // Generate unique storage path (use cooperative_id or user.id as folder)
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderPath = cooperativeId || `user_${user.id}`;
    const storagePath = `${folderPath}/${timestamp}_${sanitizedFilename}`;

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to upload file',
        { reason: uploadError.message }
      ));
    }

    // Create import record in database
    const insertData = {
      cooperative_id: cooperativeId, // Can be null for users without cooperative
      filename: file.name,
      storage_url: storagePath,
      file_type: fileType,
      file_sha256: fileSha256,
      import_status: 'uploaded' as const,
      parse_report: {},
      nb_features: 0,
      nb_applied: 0,
      nb_skipped_duplicates: 0,
      created_by: user.id,
      planteur_id: planteurId || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: importRecord, error: insertError } = await (supabase
      .from('parcel_import_files') as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      // Cleanup: delete uploaded file if record creation fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      
      // Check for unique constraint violation (duplicate SHA256)
      if (insertError.message.includes('uniq_import_file_sha256')) {
        return duplicateFileResponse('unknown');
      }
      
      // Check for planteur/cooperative mismatch
      if (insertError.message.includes('planteur_id does not belong to cooperative_id')) {
        return validationErrorResponse('planteur_id', 'Planteur must belong to your cooperative');
      }
      
      console.error('Error creating import record:', insertError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to create import record',
        { reason: insertError.message }
      ));
    }

    // Build response with 201 Created status
    const response = NextResponse.json(importRecord as ParcelImportFile, { status: 201 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/import/upload');
  }
}
