// CocoaTrack V2 - Planteurs Import Parse API Route
// POST /api/planteurs/import/[id]/parse - Parse and validate uploaded CSV file

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { parseCSV } from '@/lib/utils/csv-parser';
import { validatePlanteurRow } from '@/lib/validations/planteur-import';
import { detectDuplicatesBatch } from '@/lib/services/planteur-duplicate-detector';
import type { 
  PlanteurImportFile, 
  ParseResult, 
  ParsedRow,
  PlanteurCSVData,
  ParseError 
} from '@/types/planteur-import';

// Storage bucket name for planteur imports
const STORAGE_BUCKET = 'planteur-imports';

// Required CSV columns
const REQUIRED_COLUMNS = ['nom'];

// Expected CSV columns (for validation)
const EXPECTED_COLUMNS = ['nom', 'prénoms', 'CNI', 'téléphone', 'superficie'];

/**
 * Error codes for parse operations
 */
const ERROR_CODES = {
  IMPORT_NOT_FOUND: 'IMPORT_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_STATUS: 'INVALID_STATUS',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  EMPTY_FILE: 'EMPTY_FILE',
  MISSING_HEADER: 'MISSING_HEADER',
  MISSING_REQUIRED_COLUMNS: 'MISSING_REQUIRED_COLUMNS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Error messages in French
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.IMPORT_NOT_FOUND]: 'Import introuvable',
  [ERROR_CODES.UNAUTHORIZED]: 'Non autorisé',
  [ERROR_CODES.INVALID_STATUS]: 'L\'import ne peut pas être analysé dans son état actuel',
  [ERROR_CODES.FILE_NOT_FOUND]: 'Fichier introuvable dans le stockage',
  [ERROR_CODES.FILE_READ_ERROR]: 'Impossible de lire le fichier. Assurez-vous qu\'il s\'agit d\'un fichier CSV valide',
  [ERROR_CODES.EMPTY_FILE]: 'Le fichier CSV est vide',
  [ERROR_CODES.MISSING_HEADER]: 'Le fichier CSV doit contenir une ligne d\'en-tête avec les noms de champs',
  [ERROR_CODES.MISSING_REQUIRED_COLUMNS]: 'Colonnes requises manquantes',
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
 * POST /api/planteurs/import/[id]/parse
 * 
 * Parse and validate an uploaded CSV file.
 * 
 * Requirements: 1.3, 1.4, 1.5, 2.1-2.7, 3.1, 3.2, 8.2, 8.3, 9.4
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Await params (Next.js 15 requirement)
    const { id: importId } = await params;

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return createErrorResponse('UNAUTHORIZED', undefined, undefined, 401);
    }

    // Retrieve import file from database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: importFile, error: fetchError } = await (supabase
      .from('planteur_import_files') as any)
      .select('*')
      .eq('id', importId)
      .maybeSingle();

    if (fetchError) {
      console.error('[planteurs/import/parse] Error fetching import file:', fetchError);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch import file', { reason: fetchError.message }, 500);
    }

    if (!importFile) {
      return createErrorResponse('IMPORT_NOT_FOUND', undefined, undefined, 404);
    }

    // Verify user has access to this import
    // User can access their own imports regardless of cooperative
    if (importFile.created_by !== user.id) {
      return createErrorResponse('UNAUTHORIZED', 'Vous n\'avez pas accès à cet import', undefined, 403);
    }
    
    // Use import's cooperative_id if available (may be null - will be assigned later)
    const effectiveCooperativeId = importFile.cooperative_id;

    // Verify import status is 'uploaded' (can only parse once)
    if (importFile.import_status !== 'uploaded') {
      return createErrorResponse(
        'INVALID_STATUS',
        undefined,
        { current_status: importFile.import_status }
      );
    }

    // Download CSV from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(importFile.file_path);

    if (downloadError || !fileData) {
      console.error('[planteurs/import/parse] Error downloading file:', downloadError);
      return createErrorResponse('FILE_NOT_FOUND', undefined, { path: importFile.file_path }, 404);
    }

    // Convert Blob to File for parser
    const file = new File([fileData], importFile.filename, { type: 'text/csv' });

    // Parse CSV using csv-parser utility
    const parseResult = await parseCSV<Record<string, string>>(file, {
      expectedHeaders: REQUIRED_COLUMNS,
      skipEmptyRows: true,
      trimValues: true,
    });

    // Check for parse-level errors
    const parseErrors: ParseError[] = [...parseResult.errors];

    if (parseErrors.length > 0) {
      // Return early if there are critical parse errors
      const firstError = parseErrors[0];
      
      if (firstError.code === 'EMPTY_FILE') {
        return createErrorResponse('EMPTY_FILE');
      }
      
      if (firstError.code === 'MISSING_HEADER') {
        return createErrorResponse('MISSING_HEADER');
      }
      
      if (firstError.code === 'MISSING_REQUIRED_COLUMNS') {
        return createErrorResponse(
          'MISSING_REQUIRED_COLUMNS',
          firstError.message,
          { missing_columns: REQUIRED_COLUMNS.filter(col => !parseResult.headers.includes(col)) }
        );
      }
      
      // Other parse errors
      return createErrorResponse(
        'FILE_READ_ERROR',
        firstError.message,
        { code: firstError.code }
      );
    }

    // Validate each row using validation function
    const parsedRows: ParsedRow[] = [];
    let validRowCount = 0;
    let invalidRowCount = 0;

    for (let i = 0; i < parseResult.data.length; i++) {
      const rowData = parseResult.data[i];
      const rowNumber = i + 1;

      // Validate row
      const validationResult = validatePlanteurRow(rowData);

      // Create parsed row object
      const parsedRow: ParsedRow = {
        row_number: rowNumber,
        data: validationResult.data || ({} as PlanteurCSVData),
        validation_errors: validationResult.errors,
        duplicate_info: null, // Will be populated in next step
        user_action: validationResult.isValid ? 'pending' : 'pending',
      };

      parsedRows.push(parsedRow);

      if (validationResult.isValid) {
        validRowCount++;
      } else {
        invalidRowCount++;
      }
    }

    // Detect duplicates for each valid row using duplicate detector
    // Only check valid rows (no point checking invalid ones)
    // Only check duplicates if we have a cooperative to check against
    const validRows = parsedRows.filter(row => row.validation_errors.length === 0);
    const namesToCheck = validRows.map(row => row.data.nom);

    let duplicateCount = 0;

    if (namesToCheck.length > 0 && effectiveCooperativeId) {
      try {
        const duplicatesMap = await detectDuplicatesBatch(
          supabase as any,
          namesToCheck,
          effectiveCooperativeId
        );

        // Update parsed rows with duplicate info
        for (const row of validRows) {
          const duplicateInfo = duplicatesMap.get(row.data.nom);
          if (duplicateInfo) {
            row.duplicate_info = duplicateInfo;
            duplicateCount++;
          }
        }
      } catch (error) {
        console.error('[planteurs/import/parse] Error detecting duplicates:', error);
        // Continue without duplicate detection - not critical
      }
    }

    // Build ParseResult with all rows, validation errors, duplicate info
    const result: ParseResult = {
      rows: parsedRows,
      total_rows: parseResult.data.length,
      valid_rows: validRowCount,
      invalid_rows: invalidRowCount,
      duplicate_rows: duplicateCount,
      errors: parseErrors,
    };

    // Update import record with parse_result and status 'parsed'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from('planteur_import_files') as any)
      .update({
        parse_result: result,
        import_status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    if (updateError) {
      console.error('[planteurs/import/parse] Error updating import record:', updateError);
      // Don't fail the request - we still return the parse result
    }

    // Create audit log entry for parse
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('audit_logs') as any).insert({
        actor_id: user.id,
        actor_type: 'user',
        table_name: 'planteur_import_files',
        row_id: importId,
        action: 'UPDATE',
        new_data: {
          operation: 'planteur_import_parsed',
          total_rows: result.total_rows,
          valid_rows: result.valid_rows,
          invalid_rows: result.invalid_rows,
          duplicate_rows: result.duplicate_rows,
          import_id: importId,
          cooperative_id: effectiveCooperativeId,
        },
        old_data: null,
        ip_address: null,
      });
    } catch (error) {
      console.error('[planteurs/import/parse] Error creating audit log:', error);
      // Don't fail the request if audit logging fails
    }

    // Return ParseResult
    const response = NextResponse.json(result, { status: 200 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    console.error('[planteurs/import/parse] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse('INTERNAL_ERROR', undefined, { reason: errorMessage }, 500);
  }
}
