// CocoaTrack V2 - Parcelles Assignment API
// Client-side API functions for assigning orphan parcelles to planteurs
// @ts-nocheck - Types need to be regenerated from Supabase after migration

import { createClient } from '@/lib/supabase/client';
import { PARCELLE_ERROR_CODES } from '@/types/parcelles';
import { normalizePlanteurName } from './parcelles-import';

// Helper to get typed client
const getTypedClient = () => createClient();

/**
 * Result of assigning parcelles to a planteur
 */
export interface AssignParcellesResult {
  /** Number of parcelles successfully assigned */
  updated_count: number;
  /** IDs of parcelles that were assigned */
  assigned_ids: string[];
  /** Audit log entry ID */
  audit_log_id: string | null;
}

/**
 * Result of assigning parcelles to a new planteur
 */
export interface AssignNewPlanteurResult {
  /** ID of the newly created planteur */
  planteur_id: string;
  /** Number of parcelles successfully assigned */
  updated_count: number;
  /** IDs of parcelles that were assigned */
  assigned_ids: string[];
  /** Audit log entry ID */
  audit_log_id: string | null;
}

/**
 * Generate a unique code for a parcelle
 * Format: PARC-XXXX where XXXX is a zero-padded number
 * 
 * @param supabase - Supabase client
 * @param planteurId - UUID of the planteur
 * @returns Generated parcelle code
 */
async function generateParcelleCode(
  supabase: ReturnType<typeof getTypedClient>,
  planteurId: string
): Promise<string> {
  const { count, error } = await supabase
    .from('parcelles')
    .select('*', { count: 'exact', head: true })
    .eq('planteur_id', planteurId);

  if (error) {
    throw new Error(`Failed to generate parcelle code: ${error.message}`);
  }

  const nextNumber = (count || 0) + 1;
  return `PARC-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Parcelles Assignment API - Client-side functions for assigning orphan parcelles
 */
export const parcellesAssignApi = {
  /**
   * Assign orphan parcelles to an existing planteur
   * 
   * This function:
   * 1. Verifies all parcelles are orphan (planteur_id IS NULL) unless user is admin
   * 2. Generates codes for parcelles that don't have one
   * 3. Updates parcelles with the new planteur_id
   * 4. Creates an audit log entry
   * 
   * @param parcelleIds - Array of parcelle UUIDs to assign
   * @param planteurId - UUID of the planteur to assign parcelles to
   * @returns AssignParcellesResult with updated_count and audit_log_id
   * 
   * @throws Error if any parcelle is not orphan (unless admin)
   * @throws Error if planteur not found
   * @throws Error if parcelles not found
   * 
   * @see Requirements 5.4, 5.5
   */
  async assignParcelles(
    parcelleIds: string[],
    planteurId: string
  ): Promise<AssignParcellesResult> {
    const supabase = getTypedClient();

    // Validate input
    if (!parcelleIds || parcelleIds.length === 0) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'At least one parcelle must be selected',
        details: { field: 'parcelle_ids', message: 'Array is empty' },
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

    // Get user's role to check if admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

    // Verify planteur exists and get cooperative_id
    const { data: planteur, error: planteurError } = await supabase
      .from('planteurs')
      .select('id, name, code, cooperative_id')
      .eq('id', planteurId)
      .eq('is_active', true)
      .single();

    if (planteurError || !planteur) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Planteur not found',
        details: { planteur_id: planteurId },
      };
    }

    // Fetch all parcelles to verify they exist and are orphan
    const { data: parcelles, error: parcellesError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, code, label')
      .in('id', parcelleIds)
      .eq('is_active', true);

    if (parcellesError) {
      throw new Error(`Failed to fetch parcelles: ${parcellesError.message}`);
    }

    if (!parcelles || parcelles.length === 0) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'No parcelles found with the provided IDs',
        details: { parcelle_ids: parcelleIds },
      };
    }

    // Check if all requested parcelles were found
    if (parcelles.length !== parcelleIds.length) {
      const foundIds = new Set(parcelles.map(p => p.id));
      const missingIds = parcelleIds.filter(id => !foundIds.has(id));
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: `Some parcelles were not found: ${missingIds.join(', ')}`,
        details: { missing_ids: missingIds },
      };
    }

    // Verify all parcelles are orphan (unless admin)
    if (!isAdmin) {
      const nonOrphanParcelles = parcelles.filter(p => p.planteur_id !== null);
      if (nonOrphanParcelles.length > 0) {
        const nonOrphanCodes = nonOrphanParcelles.map(p => p.code || p.id);
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: `Cannot assign non-orphan parcelles: ${nonOrphanCodes.join(', ')}`,
          details: {
            field: 'parcelle_ids',
            message: 'Some parcelles are already assigned to a planteur',
            non_orphan_ids: nonOrphanParcelles.map(p => p.id),
          },
        };
      }
    }

    // Generate codes for parcelles that don't have one
    const assignedIds: string[] = [];
    let updatedCount = 0;

    for (const parcelle of parcelles) {
      // Generate code if null
      let code = parcelle.code;
      if (!code) {
        code = await generateParcelleCode(supabase, planteurId);
      }

      // Update the parcelle
      const { error: updateError } = await supabase
        .from('parcelles')
        .update({
          planteur_id: planteurId,
          code: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parcelle.id);

      if (updateError) {
        console.error(`Failed to update parcelle ${parcelle.id}:`, updateError);
        continue;
      }

      assignedIds.push(parcelle.id);
      updatedCount++;
    }

    // Create audit log entry
    let auditLogId: string | null = null;
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          actor_id: user.id,
          actor_type: 'user',
          table_name: 'parcelles',
          row_id: assignedIds.join(','), // Store all affected IDs
          action: 'UPDATE',
          old_data: {
            operation: 'assign_parcelles',
            parcelle_ids: parcelleIds,
            previous_planteur_id: null, // All were orphan
          },
          new_data: {
            operation: 'assign_parcelles',
            parcelle_ids: assignedIds,
            planteur_id: planteurId,
            planteur_name: planteur.name,
            updated_count: updatedCount,
          },
        })
        .select('id')
        .single();

      if (!auditError && auditData) {
        auditLogId = auditData.id;
      }
    } catch (auditErr) {
      // Log but don't fail the operation if audit logging fails
      console.error('Failed to create audit log entry:', auditErr);
    }

    return {
      updated_count: updatedCount,
      assigned_ids: assignedIds,
      audit_log_id: auditLogId,
    };
  },

  /**
   * Assign orphan parcelles to a new planteur (create planteur and assign in one operation)
   * 
   * This function:
   * 1. Verifies all parcelles are orphan (planteur_id IS NULL) unless user is admin
   * 2. Creates a new planteur with name_norm calculated
   * 3. Verifies name_norm uniqueness in the cooperative
   * 4. Generates codes for parcelles that don't have one
   * 5. Updates parcelles with the new planteur_id
   * 6. Creates an audit log entry
   * 
   * @param parcelleIds - Array of parcelle UUIDs to assign
   * @param planteurData - Data for the new planteur (name, code?, chef_planteur_id)
   * @returns AssignNewPlanteurResult with planteur_id, updated_count, and audit_log_id
   * 
   * @throws Error if any parcelle is not orphan (unless admin)
   * @throws Error if planteur name already exists in the cooperative (by name_norm)
   * @throws Error if chef_planteur not found
   * @throws Error if parcelles not found
   * 
   * @see Requirements 5.3, 5.4, 5.5
   */
  async assignWithNewPlanteur(
    parcelleIds: string[],
    planteurData: {
      name: string;
      code?: string;
      chef_planteur_id: string;
    }
  ): Promise<AssignNewPlanteurResult> {
    const supabase = getTypedClient();

    // Validate input
    if (!parcelleIds || parcelleIds.length === 0) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'At least one parcelle must be selected',
        details: { field: 'parcelle_ids', message: 'Array is empty' },
      };
    }

    if (!planteurData.name || planteurData.name.trim() === '') {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Planteur name is required',
        details: { field: 'name', message: 'Name must not be empty' },
      };
    }

    if (!planteurData.chef_planteur_id) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: 'Chef planteur ID is required',
        details: { field: 'chef_planteur_id', message: 'Chef planteur ID must be provided' },
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

    // Get user's role and cooperative_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const userCooperativeId = profile?.cooperative_id;

    // Verify chef_planteur exists and get cooperative_id
    const { data: chefPlanteur, error: chefError } = await supabase
      .from('chef_planteurs')
      .select('id, cooperative_id')
      .eq('id', planteurData.chef_planteur_id)
      .eq('is_active', true)
      .single();

    if (chefError || !chefPlanteur) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'Chef planteur not found',
        details: { chef_planteur_id: planteurData.chef_planteur_id },
      };
    }

    const cooperativeId = chefPlanteur.cooperative_id;

    // Verify user has access to this cooperative
    if (userCooperativeId && userCooperativeId !== cooperativeId) {
      throw {
        error_code: PARCELLE_ERROR_CODES.UNAUTHORIZED,
        message: 'Chef planteur does not belong to your cooperative',
        details: { chef_planteur_id: planteurData.chef_planteur_id },
      };
    }

    // Calculate name_norm for uniqueness check
    const nameNorm = normalizePlanteurName(planteurData.name);

    // Check if a planteur with the same name_norm already exists in the cooperative
    const { data: existingPlanteur, error: existingError } = await supabase
      .from('planteurs')
      .select('id, name')
      .eq('cooperative_id', cooperativeId)
      .eq('name_norm', nameNorm)
      .eq('is_active', true)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw new Error(`Failed to check for existing planteur: ${existingError.message}`);
    }

    if (existingPlanteur) {
      throw {
        error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
        message: `A planteur with this name already exists: "${existingPlanteur.name}"`,
        details: {
          field: 'name',
          message: `A planteur with the normalized name "${nameNorm}" already exists in this cooperative`,
          existing_planteur_id: existingPlanteur.id,
          existing_planteur_name: existingPlanteur.name,
        },
      };
    }

    // Fetch all parcelles to verify they exist and are orphan
    const { data: parcelles, error: parcellesError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, code, label')
      .in('id', parcelleIds)
      .eq('is_active', true);

    if (parcellesError) {
      throw new Error(`Failed to fetch parcelles: ${parcellesError.message}`);
    }

    if (!parcelles || parcelles.length === 0) {
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: 'No parcelles found with the provided IDs',
        details: { parcelle_ids: parcelleIds },
      };
    }

    // Check if all requested parcelles were found
    if (parcelles.length !== parcelleIds.length) {
      const foundIds = new Set(parcelles.map(p => p.id));
      const missingIds = parcelleIds.filter(id => !foundIds.has(id));
      throw {
        error_code: PARCELLE_ERROR_CODES.NOT_FOUND,
        message: `Some parcelles were not found: ${missingIds.join(', ')}`,
        details: { missing_ids: missingIds },
      };
    }

    // Verify all parcelles are orphan (unless admin)
    if (!isAdmin) {
      const nonOrphanParcelles = parcelles.filter(p => p.planteur_id !== null);
      if (nonOrphanParcelles.length > 0) {
        const nonOrphanCodes = nonOrphanParcelles.map(p => p.code || p.id);
        throw {
          error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
          message: `Cannot assign non-orphan parcelles: ${nonOrphanCodes.join(', ')}`,
          details: {
            field: 'parcelle_ids',
            message: 'Some parcelles are already assigned to a planteur',
            non_orphan_ids: nonOrphanParcelles.map(p => p.id),
          },
        };
      }
    }

    // Generate planteur code if not provided
    const planteurCode = planteurData.code || 
      `PLT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create the new planteur
    const { data: newPlanteur, error: createPlanteurError } = await supabase
      .from('planteurs')
      .insert({
        name: planteurData.name.trim(),
        code: planteurCode,
        cooperative_id: cooperativeId,
        chef_planteur_id: planteurData.chef_planteur_id,
        auto_created: false, // Not auto-created, user explicitly created
        is_active: true,
        created_by: user.id,
      })
      .select('id, name, code')
      .single();

    if (createPlanteurError) {
      // Check for unique constraint violations
      if (createPlanteurError.code === '23505') {
        if (createPlanteurError.message?.includes('planteurs_unique_name_norm_per_coop')) {
          throw {
            error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
            message: 'A planteur with this name already exists in the cooperative',
            details: {
              field: 'name',
              message: 'Duplicate planteur name (normalized)',
            },
          };
        }
        if (createPlanteurError.message?.includes('planteurs_code_key') || 
            createPlanteurError.message?.includes('code')) {
          throw {
            error_code: PARCELLE_ERROR_CODES.VALIDATION_ERROR,
            message: 'A planteur with this code already exists',
            details: {
              field: 'code',
              message: 'Duplicate planteur code',
            },
          };
        }
      }
      throw new Error(`Failed to create planteur: ${createPlanteurError.message}`);
    }

    if (!newPlanteur) {
      throw new Error('Failed to create planteur: No data returned');
    }

    const planteurId = newPlanteur.id;

    // Assign parcelles to the new planteur
    const assignedIds: string[] = [];
    let updatedCount = 0;

    for (const parcelle of parcelles) {
      // Generate code if null
      let code = parcelle.code;
      if (!code) {
        code = await generateParcelleCode(supabase, planteurId);
      }

      // Update the parcelle
      const { error: updateError } = await supabase
        .from('parcelles')
        .update({
          planteur_id: planteurId,
          code: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parcelle.id);

      if (updateError) {
        console.error(`Failed to update parcelle ${parcelle.id}:`, updateError);
        continue;
      }

      assignedIds.push(parcelle.id);
      updatedCount++;
    }

    // Create audit log entry
    let auditLogId: string | null = null;
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          actor_id: user.id,
          actor_type: 'user',
          table_name: 'parcelles',
          row_id: assignedIds.join(','), // Store all affected IDs
          action: 'UPDATE',
          old_data: {
            operation: 'assign_with_new_planteur',
            parcelle_ids: parcelleIds,
            previous_planteur_id: null, // All were orphan
          },
          new_data: {
            operation: 'assign_with_new_planteur',
            parcelle_ids: assignedIds,
            planteur_id: planteurId,
            planteur_name: newPlanteur.name,
            planteur_code: newPlanteur.code,
            planteur_created: true,
            updated_count: updatedCount,
          },
        })
        .select('id')
        .single();

      if (!auditError && auditData) {
        auditLogId = auditData.id;
      }
    } catch (auditErr) {
      // Log but don't fail the operation if audit logging fails
      console.error('Failed to create audit log entry:', auditErr);
    }

    return {
      planteur_id: planteurId,
      updated_count: updatedCount,
      assigned_ids: assignedIds,
      audit_log_id: auditLogId,
    };
  },
};
