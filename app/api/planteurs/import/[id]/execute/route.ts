// CocoaTrack V2 - Planteurs Import Execute API Route
// POST /api/planteurs/import/[id]/execute - Execute import with user decisions

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import type { 
  PlanteurImportFile,
  ExecuteImportInput,
  ImportSummary,
  ImportError,
  RowAction,
  ParsedRow,
  PlanteurCSVData,
} from '@/types/planteur-import';
import type { Database } from '@/types/database.gen';

type PlanteurInsert = Database['public']['Tables']['planteurs']['Insert'];
type PlanteurUpdate = Database['public']['Tables']['planteurs']['Update'];

/**
 * Error codes for execute operations
 */
const ERROR_CODES = {
  IMPORT_NOT_FOUND: 'IMPORT_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Error messages in French
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.IMPORT_NOT_FOUND]: 'Import introuvable',
  [ERROR_CODES.UNAUTHORIZED]: 'Non autorisé',
  [ERROR_CODES.INVALID_STATUS]: 'L\'import ne peut pas être exécuté dans son état actuel',
  [ERROR_CODES.INVALID_INPUT]: 'Données d\'entrée invalides',
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
 * Generate a unique code for a planteur
 */
async function generatePlanteurCode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  cooperativeId: string | null
): Promise<string> {
  // Get count of planteurs (filter by cooperative if provided)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('planteurs') as any).select('*', { count: 'exact', head: true });
  
  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  
  const { count } = await query;

  const nextNumber = (count || 0) + 1;
  return `PL${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Create audit log entry for bulk operations
 */
async function createAuditLog(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  action: string,
  importId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('audit_logs') as any).insert({
      actor_id: userId,
      actor_type: 'user',
      table_name: 'planteur_import_files',
      row_id: importId,
      action,
      new_data: details,
      old_data: null,
      ip_address: null,
    });
  } catch (error) {
    console.error('[planteurs/import/execute] Error creating audit log:', error);
    // Don't fail the request if audit logging fails
  }
}

/**
 * Process a single row action (create or update)
 */
async function processRowAction(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  row: ParsedRow,
  action: RowAction,
  cooperativeId: string | null,
  userId: string
): Promise<{ success: boolean; error?: ImportError }> {
  try {
    const data = row.data;

    if (action.action === 'create') {
      // Generate unique code
      const code = await generatePlanteurCode(supabase, cooperativeId);

      // Prepare insert data (cooperative_id can be null - will be assigned manually later)
      const insertData = {
        name: data.nom,
        code,
        phone: data.téléphone || null,
        cni: data.CNI || null,
        cooperative_id: cooperativeId || null, // Can be null
        chef_planteur_id: null, // NULL - no chef_planteur assigned yet
        superficie_hectares: data.superficie || null,
        is_active: true,
        created_by: userId,
      } as unknown as PlanteurInsert;

      // Insert new planteur
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase
        .from('planteurs') as any)
        .insert(insertData);

      if (insertError) {
        return {
          success: false,
          error: {
            row_number: row.row_number,
            error_message: `Erreur lors de la création: ${insertError.message}`,
            error_code: 'CREATE_FAILED',
          },
        };
      }

      return { success: true };
    } else if (action.action === 'update') {
      // Validate planteur_id is provided
      if (!action.planteur_id) {
        return {
          success: false,
          error: {
            row_number: row.row_number,
            error_message: 'ID du planteur manquant pour la mise à jour',
            error_code: 'MISSING_PLANTEUR_ID',
          },
        };
      }

      // Prepare update data (only non-empty values)
      const updateData: PlanteurUpdate = {
        name: data.nom,
      };

      // Add optional fields if provided
      if (data.prénoms) {
        // Note: prénoms field doesn't exist in current schema, skip it
        // If needed, this would require schema migration
      }
      if (data.CNI) {
        updateData.cni = data.CNI;
      }
      if (data.téléphone) {
        updateData.phone = data.téléphone;
      }
      if (data.superficie !== undefined && data.superficie !== null) {
        updateData.superficie_hectares = data.superficie;
      }

      // Update existing planteur (preserve cooperative_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase
        .from('planteurs') as any)
        .update(updateData)
        .eq('id', action.planteur_id);

      if (updateError) {
        return {
          success: false,
          error: {
            row_number: row.row_number,
            error_message: `Erreur lors de la mise à jour: ${updateError.message}`,
            error_code: 'UPDATE_FAILED',
          },
        };
      }

      return { success: true };
    }

    // Should never reach here
    return {
      success: false,
      error: {
        row_number: row.row_number,
        error_message: 'Action invalide',
        error_code: 'INVALID_ACTION',
      },
    };
  } catch (error) {
    console.error('[planteurs/import/execute] Error processing row:', error);
    return {
      success: false,
      error: {
        row_number: row.row_number,
        error_message: error instanceof Error ? error.message : 'Erreur inconnue',
        error_code: 'PROCESSING_ERROR',
      },
    };
  }
}

/**
 * POST /api/planteurs/import/[id]/execute
 * 
 * Execute import with user decisions on duplicates.
 * 
 * Requirements: 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 8.6
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

    // Note: User's cooperative_id is not needed for access control
    // Users can import planteurs without belonging to a cooperative themselves

    // Parse request body
    let input: ExecuteImportInput;
    try {
      input = await request.json();
    } catch {
      return createErrorResponse('INVALID_INPUT', 'Corps de la requête invalide');
    }

    // Validate input
    if (!input.row_actions || !Array.isArray(input.row_actions)) {
      return createErrorResponse('INVALID_INPUT', 'row_actions doit être un tableau');
    }

    // Debug: Log received row actions
    console.log('[planteurs/import/execute] Received row_actions:', input.row_actions.length);
    console.log('[planteurs/import/execute] Actions breakdown:', {
      create: input.row_actions.filter(a => a.action === 'create').length,
      update: input.row_actions.filter(a => a.action === 'update').length,
      ignore: input.row_actions.filter(a => a.action === 'ignore').length,
    });

    // Retrieve import file and parse_result from database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: importFile, error: fetchError } = await (supabase
      .from('planteur_import_files') as any)
      .select('*')
      .eq('id', importId)
      .maybeSingle();

    if (fetchError) {
      console.error('[planteurs/import/execute] Error fetching import file:', fetchError);
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
    
    // Use import's cooperative_id if available (may be null - planteurs can be assigned to cooperative later)
    const cooperativeId = importFile.cooperative_id;

    // Verify import status is 'parsed' (can only execute after parsing)
    if (importFile.import_status !== 'parsed') {
      return createErrorResponse(
        'INVALID_STATUS',
        undefined,
        { current_status: importFile.import_status }
      );
    }

    // Get parse_result
    const parseResult = importFile.parse_result;
    if (!parseResult || !parseResult.rows) {
      return createErrorResponse('INVALID_INPUT', 'Aucun résultat d\'analyse trouvé');
    }

    // Update import status to 'executing'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
      .from('planteur_import_files') as any)
      .update({
        import_status: 'executing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    // Build a map of row actions for quick lookup
    const actionsMap = new Map<number, RowAction>();
    for (const action of input.row_actions) {
      actionsMap.set(action.row_number, action);
    }

    // Initialize summary counters
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: ImportError[] = [];

    // Process each row based on user action
    for (const row of parseResult.rows) {
      // Skip rows with validation errors (should not be processed)
      if (row.validation_errors && row.validation_errors.length > 0) {
        skippedCount++;
        continue;
      }

      // Get user action for this row
      const action = actionsMap.get(row.row_number);

      // If no action specified or action is 'ignore', skip the row
      if (!action || action.action === 'ignore') {
        skippedCount++;
        continue;
      }

      // Process the row (create or update)
      const result = await processRowAction(
        supabase,
        row,
        action,
        cooperativeId,
        user.id
      );

      if (result.success) {
        if (action.action === 'create') {
          createdCount++;
        } else if (action.action === 'update') {
          updatedCount++;
        }
      } else {
        failedCount++;
        if (result.error) {
          errors.push(result.error);
        }
      }
    }

    // Build ImportSummary
    const summary: ImportSummary = {
      total_processed: createdCount + updatedCount + skippedCount + failedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      errors,
    };

    // Determine final status
    const finalStatus = failedCount > 0 ? 'failed' : 'completed';

    // Update import record with import_summary and final status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
      .from('planteur_import_files') as any)
      .update({
        import_summary: summary,
        import_status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    // Create audit log entries for bulk operations
    if (createdCount > 0) {
      await createAuditLog(supabase, user.id, 'INSERT', importId, {
        operation: 'planteur_bulk_created',
        count: createdCount,
        import_id: importId,
        cooperative_id: cooperativeId,
      });
    }

    if (updatedCount > 0) {
      await createAuditLog(supabase, user.id, 'UPDATE', importId, {
        operation: 'planteur_bulk_updated',
        count: updatedCount,
        import_id: importId,
        cooperative_id: cooperativeId,
      });
    }

    if (failedCount > 0) {
      await createAuditLog(supabase, user.id, 'INSERT', importId, {
        operation: 'planteur_import_failed',
        failed_count: failedCount,
        errors: errors.slice(0, 10), // Limit to first 10 errors
        import_id: importId,
        cooperative_id: cooperativeId,
      });
    }

    // Return ImportSummary
    const response = NextResponse.json(summary, { status: 200 });

    // Add security headers
    addSecurityHeaders(response);

    return response;
  } catch (error) {
    console.error('[planteurs/import/execute] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse('INTERNAL_ERROR', undefined, { reason: errorMessage }, 500);
  }
}
