// CocoaTrack V2 - Planteur Duplicate Detection Service
// Detects potential duplicate planteurs during CSV import
// Requirements: 3.1, 3.2, 3.7

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.gen';
import type { DuplicateInfo } from '@/types/planteur-import';

/**
 * Normalizes a planteur name for duplicate detection
 * Applies: lowercase, trim whitespace, remove accents, collapse multiple spaces
 * 
 * This function replicates the logic of the database function normalize_planteur_name()
 * for client-side use when needed.
 * 
 * Requirements: 3.1
 * 
 * @param name - The planteur name to normalize
 * @returns Normalized name string
 */
export function normalizePlanteurName(name: string | null | undefined): string {
  // Handle NULL or empty input
  if (!name || name.trim() === '') {
    return '';
  }

  // Normalize: lowercase, trim, collapse multiple spaces
  // Note: We don't remove accents client-side as it requires a library
  // The database function handles accent removal via unaccent extension
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Detects if a planteur with the given name already exists in the cooperative
 * 
 * Uses the name_norm field for case-insensitive, accent-insensitive matching.
 * Only checks within the specified cooperative (cooperative isolation).
 * Only considers active planteurs.
 * 
 * Requirements: 3.2, 3.7
 * 
 * @param supabase - Supabase client instance
 * @param name - The planteur name to check
 * @param cooperativeId - The cooperative ID to scope the search
 * @returns DuplicateInfo if duplicate found, null otherwise
 */
export async function detectDuplicate(
  supabase: SupabaseClient<Database>,
  name: string,
  cooperativeId: string
): Promise<DuplicateInfo | null> {
  // Normalize the name using the database function for consistency
  // This ensures we use the same normalization logic as the database
  // Note: The function may not be in generated types yet, so we use type assertion
  const { data: normalizedData, error: normalizeError } = await supabase
    .rpc('normalize_planteur_name' as any, { name });

  if (normalizeError) {
    console.error('Error normalizing planteur name:', normalizeError);
    throw new Error(`Failed to normalize planteur name: ${normalizeError.message}`);
  }

  const normalizedName = normalizedData as string;

  // If normalized name is empty, no duplicate check needed
  if (!normalizedName) {
    return null;
  }

  // Query for existing planteur with same name_norm in the same cooperative
  // Only check active planteurs
  // Note: name_norm may not be in generated types yet, so we use type assertion
  const { data: existingPlanteur, error: queryError } = await supabase
    .from('planteurs')
    .select('id, name, code, name_norm' as any)
    .eq('cooperative_id', cooperativeId)
    .eq('is_active', true)
    .eq('name_norm' as any, normalizedName)
    .maybeSingle() as { 
      data: { id: string; name: string; code: string; name_norm: string } | null; 
      error: any 
    };

  if (queryError) {
    console.error('Error querying for duplicate planteur:', queryError);
    throw new Error(`Failed to check for duplicate planteur: ${queryError.message}`);
  }

  // No duplicate found
  if (!existingPlanteur) {
    return null;
  }

  // Duplicate found - return info
  const matchType = existingPlanteur.name === name ? 'exact' : 'normalized';

  return {
    existing_planteur_id: existingPlanteur.id,
    existing_planteur_name: existingPlanteur.name,
    existing_planteur_code: existingPlanteur.code,
    match_type: matchType,
  };
}

/**
 * Batch duplicate detection for multiple planteur names
 * More efficient than calling detectDuplicate multiple times
 * 
 * Requirements: 3.2, 3.7
 * 
 * @param supabase - Supabase client instance
 * @param names - Array of planteur names to check
 * @param cooperativeId - The cooperative ID to scope the search
 * @returns Map of name to DuplicateInfo (only includes duplicates)
 */
export async function detectDuplicatesBatch(
  supabase: SupabaseClient<Database>,
  names: string[],
  cooperativeId: string
): Promise<Map<string, DuplicateInfo>> {
  const results = new Map<string, DuplicateInfo>();

  // Filter out empty names
  const validNames = names.filter(name => name && name.trim() !== '');

  if (validNames.length === 0) {
    return results;
  }

  // Normalize all names using the database function
  const normalizedNames: string[] = [];
  for (const name of validNames) {
    // Note: The function may not be in generated types yet, so we use type assertion
    const { data: normalizedData, error: normalizeError } = await supabase
      .rpc('normalize_planteur_name' as any, { name });

    if (normalizeError) {
      console.error('Error normalizing planteur name:', normalizeError);
      continue; // Skip this name on error
    }

    normalizedNames.push(normalizedData as string);
  }

  // Query for all existing planteurs with matching name_norm in the cooperative
  // Also check orphan planteurs (cooperative_id IS NULL) created via CSV import without coop
  // Note: name_norm may not be in generated types yet, so we use type assertion
  let allExistingPlanteurs: Array<{ id: string; name: string; code: string; name_norm: string }> = [];

  // Search in cooperative
  const { data: coopPlanteurs, error: queryError } = await supabase
    .from('planteurs')
    .select('id, name, code, name_norm' as any)
    .eq('cooperative_id', cooperativeId)
    .eq('is_active', true)
    .in('name_norm' as any, normalizedNames) as { data: any[] | null; error: any };

  if (queryError) {
    console.error('Error querying for duplicate planteurs:', queryError);
    throw new Error(`Failed to check for duplicate planteurs: ${queryError.message}`);
  }

  // Also search orphan planteurs (no cooperative)
  const { data: orphanPlanteurs } = await supabase
    .from('planteurs')
    .select('id, name, code, name_norm' as any)
    .is('cooperative_id', null)
    .eq('is_active', true)
    .in('name_norm' as any, normalizedNames) as { data: any[] | null; error: any };

  // Merge: cooperative planteurs take priority over orphans
  const nameNormSeen = new Set<string>();
  for (const p of (orphanPlanteurs || [])) {
    if (!nameNormSeen.has(p.name_norm)) {
      allExistingPlanteurs.push(p);
      nameNormSeen.add(p.name_norm);
    }
  }
  for (const p of (coopPlanteurs || [])) {
    // Overwrite orphan if same name_norm
    const idx = allExistingPlanteurs.findIndex(e => e.name_norm === p.name_norm);
    if (idx >= 0) {
      allExistingPlanteurs[idx] = p;
    } else {
      allExistingPlanteurs.push(p);
    }
  }

  if (allExistingPlanteurs.length === 0) {
    return results;
  }

  // Build a map of name_norm to existing planteur
  const nameNormMap = new Map<string, any>();
  for (const planteur of allExistingPlanteurs) {
    // Use the first match if multiple exist (shouldn't happen due to unique constraint)
    if (!nameNormMap.has((planteur as any).name_norm)) {
      nameNormMap.set((planteur as any).name_norm, planteur);
    }
  }

  // Match each input name to its duplicate info
  for (let i = 0; i < validNames.length; i++) {
    const name = validNames[i];
    const normalizedName = normalizedNames[i];

    const existingPlanteur = nameNormMap.get(normalizedName);
    if (existingPlanteur) {
      const matchType = existingPlanteur.name === name ? 'exact' : 'normalized';

      results.set(name, {
        existing_planteur_id: existingPlanteur.id,
        existing_planteur_name: existingPlanteur.name,
        existing_planteur_code: existingPlanteur.code,
        match_type: matchType,
      });
    }
  }

  return results;
}
