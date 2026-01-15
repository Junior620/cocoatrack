// CocoaTrack V2 - Parcelles Import Apply API Route
// POST /api/parcelles/import/[id]/apply - Apply parsed features to create parcelles
// Supports V2 import modes: auto_create, orphan, assign

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { applyImportV2Schema, applyImportSchema } from '@/lib/validations/parcelle';
import type {
  ParcelImportFile,
  ParsedFeature,
  ApplyImportResult,
  ParcelleSource,
  ImportFileType,
  ImportMode,
} from '@/types/parcelles';
import { PARCELLE_LIMITS } from '@/types/parcelles';
import {
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  limitExceededResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';
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
} from '@/lib/services/geometry-service';
import type { ParseError, ParseWarning } from '@/types/parcelles';
import { v4 as uuidv4 } from 'uuid';
import { normalizePlanteurName } from '@/lib/api/parcelles-import';

// Storage bucket name for parcelle imports
const STORAGE_BUCKET = 'parcelle-imports';

/**
 * POST /api/parcelles/import/[id]/apply
 * 
 * Apply an import - create parcelles from parsed features.
 * 
 * Supports two input formats:
 * - V1 (legacy): { planteur_id, mapping, defaults } - assigns all parcelles to one planteur
 * - V2: { mode, planteur_id?, planteur_name_field?, default_chef_planteur_id?, mapping, defaults }
 *   - mode: 'auto_create' | 'orphan' | 'assign'
 *   - auto_create: Creates planteurs from DBF attributes, requires planteur_name_field, default_chef_planteur_id is optional
 *   - orphan: Creates parcelles without planteur assignment
 *   - assign: Assigns all parcelles to planteur_id (same as V1)
 * 
 * @see Requirements 3.1, 3.2, 3.3
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
    const { id: importId } = await params;

    // Validate import ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(importId)) {
      return validationErrorResponse('id', 'Must be a valid UUID');
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse('body', 'Request body must be valid JSON');
    }

    // Detect input format (V1 vs V2) and validate accordingly
    // V2 has 'mode' field, V1 does not
    const isV2Input = body && typeof body === 'object' && 'mode' in body;
    
    let validatedInput: {
      mode: ImportMode;
      planteur_id?: string;
      planteur_name_field?: string;
      default_chef_planteur_id?: string;
      mapping: { label_field?: string; code_field?: string; village_field?: string };
      defaults: { conformity_status?: string; certifications?: string[] };
    };

    if (isV2Input) {
      // V2 input with mode
      const parseResult = applyImportV2Schema.safeParse(body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        return validationErrorResponse(firstError.path.join('.'), firstError.message);
      }
      validatedInput = parseResult.data;
    } else {
      // V1 legacy input - convert to V2 format with 'assign' mode
      const parseResult = applyImportSchema.safeParse(body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        return validationErrorResponse(firstError.path.join('.'), firstError.message);
      }
      validatedInput = {
        mode: 'assign',
        planteur_id: parseResult.data.planteur_id,
        mapping: parseResult.data.mapping,
        defaults: parseResult.data.defaults,
      };
    }

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Get the import record (RLS will enforce cooperative isolation)
    const { data: importFile, error: fetchError } = await supabase
      .from('parcel_import_files')
      .select('*')
      .eq('id', importId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return notFoundResponse('import_file', importId);
      }
      console.error('Error fetching import file:', fetchError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch import file',
        { reason: fetchError.message }
      ));
    }

    const typedImportFile = importFile as ParcelImportFile;

    // Check if already applied - REFUSE with VALIDATION_ERROR "Already applied"
    if (typedImportFile.import_status === 'applied') {
      return validationErrorResponse(
        'import_status',
        'Already applied. This import has already been applied and cannot be re-applied'
      );
    }

    // Check if status is 'parsed' (ready to apply)
    if (typedImportFile.import_status !== 'parsed') {
      return validationErrorResponse(
        'import_status',
        `Import must be in 'parsed' status to apply. Current status: '${typedImportFile.import_status}'`
      );
    }

    const { mode, mapping, defaults } = validatedInput;
    const importCoopId = typedImportFile.cooperative_id || null;

    // Mode-specific validation
    if (mode === 'assign') {
      // Verify planteur belongs to the same cooperative as the import file
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: planteur, error: planteurError } = await (supabase.from('planteurs') as any)
        .select('id, cooperative_id')
        .eq('id', validatedInput.planteur_id)
        .single();

      if (planteurError || !planteur) {
        return validationErrorResponse(
          'planteur_id',
          'The specified planteur does not exist or is not accessible'
        );
      }

      const typedPlanteur = planteur as { id: string; cooperative_id: string };
      if (typedPlanteur.cooperative_id !== importCoopId) {
        return validationErrorResponse(
          'planteur_id',
          'Planteur must belong to the same cooperative as the import file'
        );
      }
    }

    if (mode === 'auto_create' && validatedInput.default_chef_planteur_id) {
      // Verify chef_planteur exists and belongs to the same cooperative
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: chefPlanteur, error: chefError } = await (supabase.from('chef_planteurs') as any)
        .select('id, cooperative_id')
        .eq('id', validatedInput.default_chef_planteur_id)
        .single();

      if (chefError || !chefPlanteur) {
        return validationErrorResponse(
          'default_chef_planteur_id',
          'The specified chef planteur does not exist or is not accessible'
        );
      }

      const typedChef = chefPlanteur as { id: string; cooperative_id: string };
      if (typedChef.cooperative_id !== importCoopId) {
        return validationErrorResponse(
          'default_chef_planteur_id',
          'Chef planteur must belong to the same cooperative as the import file'
        );
      }
    }

    // Re-parse to get the features (parse is idempotent)
    const parsedFeatures = await parseImportFile(supabase, typedImportFile);

    // Check feature limit
    if (parsedFeatures.length > PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT) {
      return limitExceededResponse(
        PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT,
        parsedFeatures.length,
        'features'
      );
    }

    // Determine source based on file type
    const sourceMap: Record<ImportFileType, ParcelleSource> = {
      shapefile_zip: 'shapefile',
      kml: 'kml',
      kmz: 'kml',
      geojson: 'geojson',
    };
    const source = sourceMap[typedImportFile.file_type];

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

      for (const feature of parsedFeatures) {
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
      
      if (planteurNameMap.size > 0 && importCoopId) {
        const nameNorms = Array.from(planteurNameMap.keys());
        
        // Query existing planteurs with matching name_norm in the same cooperative
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingPlanteurs } = await (supabase.from('planteurs') as any)
          .select('id, name, name_norm')
          .eq('cooperative_id', importCoopId)
          .eq('is_active', true)
          .in('name_norm', nameNorms);

        if (existingPlanteurs) {
          for (const p of existingPlanteurs as Array<{ id: string; name: string; name_norm: string }>) {
            existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
          }
        }
      }

      // Step 3: Create new planteurs for names that don't exist
      const newPlanteursMap = new Map<string, string>(); // name_norm → planteur_id

      for (const [nameNorm, { name }] of Array.from(planteurNameMap.entries())) {
        if (existingPlanteursMap.has(nameNorm)) {
          // Reuse existing planteur
          newPlanteursMap.set(nameNorm, existingPlanteursMap.get(nameNorm)!.id);
        } else {
          // Create new planteur
          const planteurCode = `PLT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newPlanteur, error: createError } = await (supabase.from('planteurs') as any)
            .insert({
              name,
              code: planteurCode,
              cooperative_id: importCoopId,
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: existing } = await (supabase.from('planteurs') as any)
                .select('id')
                .eq('cooperative_id', importCoopId)
                .eq('name_norm', nameNorm)
                .eq('is_active', true)
                .single();
              
              if (existing) {
                newPlanteursMap.set(nameNorm, (existing as { id: string }).id);
                continue;
              }
            }
            console.error(`Failed to create planteur "${name}":`, createError.message);
            // Skip all features for this planteur
            nbSkipped += planteurNameMap.get(nameNorm)!.features.length;
            continue;
          }

          if (newPlanteur) {
            newPlanteursMap.set(nameNorm, (newPlanteur as { id: string }).id);
          }
        }
      }

      // Step 4: Create parcelles for each planteur
      for (const [nameNorm, { features: planteurFeatures }] of Array.from(planteurNameMap.entries())) {
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
          const result = await createParcelle(
            supabase,
            feature,
            planteurId,
            codeCounter,
            mapping,
            defaults,
            source,
            importId,
            user.id
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
        const result = await createParcelle(
          supabase,
          feature,
          null, // orphan - no planteur
          0, // no code counter for orphans
          mapping,
          defaults,
          source,
          importId,
          user.id
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
      for (const feature of parsedFeatures) {
        if (!feature.validation.ok) {
          nbSkipped++;
          continue;
        }

        if (feature.is_duplicate) {
          nbSkipped++;
          continue;
        }

        const result = await createParcelle(
          supabase,
          feature,
          null, // orphan - no planteur
          0, // no code counter for orphans
          mapping,
          defaults,
          source,
          importId,
          user.id
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

      for (const feature of parsedFeatures) {
        if (!feature.validation.ok) {
          nbSkipped++;
          continue;
        }

        if (feature.is_duplicate) {
          nbSkipped++;
          continue;
        }

        const result = await createParcelle(
          supabase,
          feature,
          planteurId,
          codeCounter,
          mapping,
          defaults,
          source,
          importId,
          user.id
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from('parcel_import_files') as any)
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

    // Build response
    const result: ApplyImportResult = {
      nb_applied: createdIds.length,
      nb_skipped: nbSkipped,
      created_ids: createdIds,
    };

    const response = NextResponse.json(result, { status: 200 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/import/[id]/apply');
  }
}

/**
 * Parse import file and return parsed features
 */
async function parseImportFile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  importFile: ParcelImportFile
): Promise<ParsedFeature[]> {
  // Download the file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(importFile.storage_url);

  if (downloadError || !fileData) {
    throw createParcelleError(
      ParcelleErrorCodes.INTERNAL_ERROR,
      'Failed to download file from storage',
      { reason: downloadError?.message || 'Unknown error' }
    );
  }

  // Parse the file based on type
  let parseResult: {
    features: Array<import('geojson').Feature<import('geojson').MultiPolygon>>;
    errors: ParseError[];
    warnings: ParseWarning[];
    availableFields: string[];
    hasPrj?: boolean;
  };

  try {
    const buffer = await fileData.arrayBuffer();

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
        throw createParcelleError(
          ParcelleErrorCodes.VALIDATION_ERROR,
          `Unsupported file type: ${importFile.file_type}`,
          { file_type: importFile.file_type }
        );
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'error_code' in err) {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown parsing error';
    throw createParcelleError(
      ParcelleErrorCodes.VALIDATION_ERROR,
      'Failed to parse file',
      { reason: errorMessage }
    );
  }

  const hasPrj = 'hasPrj' in parseResult ? parseResult.hasPrj : true;

  // Process each feature
  const parsedFeatures: ParsedFeature[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingParcelles } = await (supabase.from('parcelles') as any)
    .select('id, feature_hash, planteur_id')
    .eq('is_active', true)
    .not('feature_hash', 'is', null);

  const existingHashMap = new Map<string, { id: string; planteur_id: string }>();
  if (existingParcelles) {
    for (const p of existingParcelles as Array<{ id: string; feature_hash: string | null; planteur_id: string }>) {
      if (p.feature_hash) {
        existingHashMap.set(p.feature_hash, { id: p.id, planteur_id: p.planteur_id });
      }
    }
  }

  for (let i = 0; i < parseResult.features.length; i++) {
    const feature = parseResult.features[i];
    const tempId = uuidv4();
    const featureErrors: string[] = [];
    const featureWarnings: string[] = [];

    if (isEmptyGeometry(feature.geometry)) {
      featureErrors.push('Empty geometry');
      continue;
    }

    const coordValidation = validateCoordinates(feature.geometry);
    let geomOriginalValid = true;
    let fixedGeometry = feature.geometry;

    if (!coordValidation.valid) {
      if (!hasPrj) {
        const projectedCheck = detectProjectedCoordinates(feature.geometry);
        if (projectedCheck.likely) {
          featureWarnings.push('Coordinates may be projected (not WGS84)');
        }
      }
    }

    if (!isValidGeometry(feature.geometry)) {
      geomOriginalValid = false;
      featureWarnings.push('Geometry has self-intersections, attempting to fix');

      const fixed = tryFixGeometry(feature.geometry);
      if (fixed) {
        fixedGeometry = fixed;
        featureWarnings.push('Geometry was automatically fixed');
      } else {
        featureErrors.push('Invalid geometry that could not be fixed');
        continue;
      }
    }

    let featureHash: string;
    try {
      featureHash = await computeFeatureHash(fixedGeometry);
    } catch {
      featureErrors.push('Failed to compute feature hash');
      continue;
    }

    const existingMatch = existingHashMap.get(featureHash);
    const isDuplicate = !!existingMatch;
    if (isDuplicate) {
      featureWarnings.push(`Duplicate of existing parcelle ${existingMatch.id}`);
    }

    const areaHa = calculateAreaHa(fixedGeometry);
    const centroid = calculateCentroid(fixedGeometry);

    const props = feature.properties || {};
    const label = (props.name || props.NAME || props.label || props.LABEL || 
                  props.nom || props.NOM || props.description || null) as string | null;

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

    if (!geomOriginalValid) {
      parsedFeature.geom_fixed = fixedGeometry;
    }

    parsedFeatures.push(parsedFeature);
  }

  parsedFeatures.sort((a, b) => a.feature_hash.localeCompare(b.feature_hash));

  return parsedFeatures;
}

/**
 * Helper function to create a single parcelle
 * 
 * @param supabase - Supabase client
 * @param feature - Parsed feature to create parcelle from
 * @param planteurId - Planteur ID (null for orphan parcelles)
 * @param codeCounter - Counter for generating parcelle codes (0 for orphans)
 * @param mapping - Field mapping configuration
 * @param defaults - Default values for parcelle
 * @param source - Data source (shapefile, kml, geojson)
 * @param importFileId - Import file ID
 * @param userId - User ID who is creating the parcelle
 * @returns Object with success flag and optional parcelle ID
 */
async function createParcelle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  feature: ParsedFeature,
  planteurId: string | null,
  codeCounter: number,
  mapping: { label_field?: string; code_field?: string; village_field?: string },
  defaults: { conformity_status?: string; certifications?: string[] },
  source: ParcelleSource,
  importFileId: string,
  userId: string
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

  // Prepare parcelle data for RPC call
  const parcelleData = {
    p_planteur_id: planteurId,
    p_code: code,
    p_label: label,
    p_village: village,
    p_geometry_geojson: JSON.stringify(feature.geom_geojson),
    p_certifications: defaults.certifications || [],
    p_conformity_status: defaults.conformity_status || 'informations_manquantes',
    p_risk_flags: {},
    p_source: source,
    p_import_file_id: importFileId,
    p_feature_hash: feature.feature_hash,
    p_created_by: userId,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertError } = await supabase.rpc('create_parcelle', parcelleData as any);

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

    const createdResult = created as unknown;
    if (createdResult && Array.isArray(createdResult) && createdResult.length > 0 && (createdResult[0] as { id?: string }).id) {
      return { success: true, id: (createdResult[0] as { id: string }).id };
    } else if (createdResult && typeof createdResult === 'object' && 'id' in createdResult) {
      return { success: true, id: (createdResult as { id: string }).id };
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
}
