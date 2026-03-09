// CocoaTrack V2 - Planteurs Import Upload API Route
// POST /api/planteurs/import/upload - Upload a CSV file for planteur import

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import type { PlanteurImportFile } from '@/types/planteur-import';

// Storage bucket name for planteur imports
const STORAGE_BUCKET = 'planteur-imports';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Error codes for planteur import operations
 */
const ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Error messages in French
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.FILE_TOO_LARGE]: 'Le fichier est trop volumineux. Taille maximale : 10 MB',
  [ERROR_CODES.INVALID_FILE_TYPE]: 'Format de fichier invalide. Seuls les fichiers CSV sont acceptés',
  [ERROR_CODES.FILE_READ_ERROR]: 'Impossible de lire le fichier. Assurez-vous qu\'il s\'agit d\'un fichier CSV valide',
  [ERROR_CODES.UNAUTHORIZED]: 'Non autorisé',
  [ERROR_CODES.INTERNAL_ERROR]: 'Une erreur interne s\'est produite',
} as const;

/**
 * Create a standardized error response
 */
function createErrorResponse(
  code: keyof typeof ERROR_CODES,
  message?: string,
  details?: Record<string, unknown>,
  status = 400
): Response {
  return Response.json(
    {
      error_code: code,
      message: message || ERROR_MESSAGES[code],
      details: details || {},
    },
    { status }
  );
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
 * POST /api/planteurs/import/upload
 * 
 * Upload a CSV file for planteur import.
 * 
 * Requirements: 1.1, 8.1, 8.2
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
      return createErrorResponse('UNAUTHORIZED', undefined, undefined, 401);
    }

    // Get user's profile to retrieve cooperative_id (OPTIONAL - can be added manually later)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
      .select('cooperative_id')
      .eq('id', user.id)
      .maybeSingle();

    // Profile error is only a real error if it's not a "no rows" situation
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[planteurs/import/upload] Error fetching profile:', profileError);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user profile', { reason: profileError.message }, 500);
    }

    // For planteur imports, cooperative_id is OPTIONAL - can be null and added manually later
    const cooperativeId = (profile as { cooperative_id: string | null } | null)?.cooperative_id || null;

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return createErrorResponse('FILE_READ_ERROR', 'Request must be multipart/form-data');
    }

    // Get file from form data
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return createErrorResponse('FILE_READ_ERROR', 'A file must be provided in the "file" field');
    }

    // Validate file type (.csv only)
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension !== 'csv') {
      return createErrorResponse(
        'INVALID_FILE_TYPE',
        undefined,
        { extension: fileExtension }
      );
    }

    // Validate file size (10MB max)
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        'FILE_TOO_LARGE',
        undefined,
        { limit: MAX_FILE_SIZE, actual: file.size }
      );
    }

    // Read file content and compute SHA256 hash
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
    } catch (error) {
      console.error('[planteurs/import/upload] Error reading file:', error);
      return createErrorResponse('FILE_READ_ERROR');
    }

    const fileSha256 = await computeFileSha256(fileBuffer);

    // Generate unique storage path: {cooperative_id or 'unassigned'}/{timestamp}_{filename}
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFolder = cooperativeId || 'unassigned';
    const storagePath = `${storageFolder}/${timestamp}_${sanitizedFilename}`;

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('[planteurs/import/upload] Error uploading file to storage:', uploadError);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to upload file', { reason: uploadError.message }, 500);
    }

    // Create import record in database
    const insertData = {
      cooperative_id: cooperativeId,
      filename: file.name,
      file_size: file.size,
      file_path: storagePath,
      import_status: 'uploaded' as const,
      parse_result: null,
      import_summary: null,
      created_by: user.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: importRecord, error: insertError } = await (supabase
      .from('planteur_import_files') as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      // Cleanup: delete uploaded file if record creation fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      
      console.error('[planteurs/import/upload] Error creating import record:', insertError);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to create import record', { reason: insertError.message }, 500);
    }

    // Create audit log entry for upload
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('audit_logs') as any).insert({
        actor_id: user.id,
        actor_type: 'user',
        table_name: 'planteur_import_files',
        row_id: importRecord.id,
        action: 'INSERT',
        new_data: {
          operation: 'planteur_import_uploaded',
          filename: file.name,
          file_size: file.size,
          import_id: importRecord.id,
          cooperative_id: cooperativeId,
        },
        old_data: null,
        ip_address: null,
      });
    } catch (error) {
      console.error('[planteurs/import/upload] Error creating audit log:', error);
      // Don't fail the request if audit logging fails
    }

    // Build response with 201 Created status
    const response = NextResponse.json(importRecord as PlanteurImportFile, { status: 201 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    console.error('[planteurs/import/upload] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse('INTERNAL_ERROR', undefined, { reason: errorMessage }, 500);
  }
}
