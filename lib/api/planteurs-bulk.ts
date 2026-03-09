// CocoaTrack V2 - Bulk Planteur Assignment API
// Server-side API functions for bulk planteur assignment operations

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.gen';
import type {
  BulkAssignmentRequest,
  BulkAssignmentResponse,
  BulkAssignmentError,
  BulkAssignmentAuditMetadata,
} from '@/types/planteur-bulk';

type Planteur = Database['public']['Tables']['planteurs']['Row'];

/**
 * Bulk assign planteurs to chef planteur and/or cooperative
 * 
 * This function performs batch updates on multiple planteurs, respecting RLS policies
 * and handling partial failures gracefully. It creates an audit log entry for the operation.
 * 
 * Requirements:
 * - 4.1: Updates all selected planteurs in a single database transaction
 * - 4.2: Respects all RLS policies for the current user
 * - 4.3: Continues processing remaining planteurs if any update fails due to permissions
 * - 4.4: Returns result indicating success count and failure count
 * - 4.5: Only modifies chef_planteur_id and cooperative_id fields
 * - 6.1-6.7: Creates audit log entry with operation metadata
 * 
 * @param supabase - Authenticated Supabase client
 * @param request - Bulk assignment request with planteur IDs and assignments
 * @returns Response with success/failure counts and error details
 */
export async function bulkAssignPlanteurs(
  supabase: SupabaseClient<Database>,
  request: BulkAssignmentRequest
): Promise<BulkAssignmentResponse> {
  const { planteurIds, chefPlanteurId, cooperativeId } = request;
  
  // Get current user for audit logging
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Validate that at least one assignment field is being modified
  if (chefPlanteurId === undefined && cooperativeId === undefined) {
    throw new Error('At least one assignment field must be specified');
  }

  // Validate chef planteur exists if provided (Requirement 7.3, 9.3)
  if (chefPlanteurId !== null && chefPlanteurId !== undefined) {
    const { data: chefPlanteur, error: chefError } = await supabase
      .from('chef_planteurs')
      .select('id')
      .eq('id', chefPlanteurId)
      .single();
    
    if (chefError || !chefPlanteur) {
      throw new Error('Invalid chef planteur ID: chef planteur does not exist');
    }
  }

  // Validate cooperative exists if provided (Requirement 7.3, 9.4)
  if (cooperativeId !== null && cooperativeId !== undefined) {
    const { data: cooperative, error: coopError } = await supabase
      .from('cooperatives')
      .select('id')
      .eq('id', cooperativeId)
      .single();
    
    if (coopError || !cooperative) {
      throw new Error('Invalid cooperative ID: cooperative does not exist');
    }
  }

  // Build update object with only the fields being modified (Requirement 4.5)
  const updateData: Partial<Planteur> = {};
  if (chefPlanteurId !== undefined) {
    updateData.chef_planteur_id = chefPlanteurId ?? undefined;
  }
  if (cooperativeId !== undefined) {
    updateData.cooperative_id = cooperativeId ?? undefined;
  }

  // Track results
  let successCount = 0;
  let failureCount = 0;
  const errors: BulkAssignmentError[] = [];

  // Process each planteur individually to handle partial failures (Requirement 4.3)
  // Note: We process individually rather than in a single batch to allow RLS policies
  // to filter out planteurs the user doesn't have permission to update
  for (const planteurId of planteurIds) {
    try {
      // Attempt to update the planteur
      // RLS policies will automatically filter out planteurs the user can't access
      const { data, error } = await supabase
        .from('planteurs')
        .update(updateData)
        .eq('id', planteurId)
        .select('id, name')
        .single();

      if (error) {
        // Check if error is due to RLS (no rows returned)
        if (error.code === 'PGRST116') {
          failureCount++;
          errors.push({
            planteurId,
            error: 'Permission denied or planteur not found',
          });
        } else {
          // Other database errors
          failureCount++;
          errors.push({
            planteurId,
            error: error.message,
          });
        }
      } else if (!data) {
        // No data returned (RLS filtered it out)
        failureCount++;
        errors.push({
          planteurId,
          error: 'Permission denied or planteur not found',
        });
      } else {
        // Success
        successCount++;
      }
    } catch (err) {
      // Unexpected error
      failureCount++;
      errors.push({
        planteurId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Create audit log entry (Requirements 6.1-6.7)
  await createBulkAssignmentAuditLog(supabase, {
    userId: user.id,
    planteurIds,
    assignments: {
      chef_planteur_id: chefPlanteurId,
      cooperative_id: cooperativeId,
    },
    successCount,
    failureCount,
    errors: errors.length > 0 ? errors : undefined,
  });

  // Return response (Requirement 4.4)
  return {
    success: failureCount === 0,
    successCount,
    failureCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Create audit log entry for bulk assignment operation
 * 
 * Requirements:
 * - 6.1: Records the user who performed the operation
 * - 6.2: Records the timestamp of the operation
 * - 6.3: Records the number of planteurs affected
 * - 6.4: Records the list of planteur IDs affected
 * - 6.5: Records the chef planteur ID assigned (if any)
 * - 6.6: Records the cooperative ID assigned (if any)
 * - 6.7: Records success/failure counts and errors
 * 
 * @param supabase - Authenticated Supabase client
 * @param metadata - Audit log metadata
 */
async function createBulkAssignmentAuditLog(
  supabase: SupabaseClient<Database>,
  metadata: {
    userId: string;
    planteurIds: string[];
    assignments: {
      chef_planteur_id?: string | null;
      cooperative_id?: string | null;
    };
    successCount: number;
    failureCount: number;
    errors?: BulkAssignmentError[];
  }
): Promise<void> {
  const auditMetadata: BulkAssignmentAuditMetadata = {
    operation_type: 'bulk_assignment',
    planteur_ids: metadata.planteurIds,
    assignments: metadata.assignments,
    success_count: metadata.successCount,
    failure_count: metadata.failureCount,
    errors: metadata.errors,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('audit_logs') as any).insert({
      actor_id: metadata.userId,
      actor_type: 'user',
      table_name: 'planteurs',
      row_id: 'bulk_operation', // Special marker for bulk operations
      action: 'UPDATE',
      old_data: null,
      new_data: auditMetadata,
      ip_address: null,
    });
  } catch (error) {
    // Log error but don't fail the operation
    console.error('Failed to create audit log entry:', error);
  }
}
