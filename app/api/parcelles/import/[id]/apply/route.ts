// CocoaTrack V2 - Parcelles Import Apply API Route
// POST /api/parcelles/import/[id]/apply - Apply parsed features to create parcelles
// Supports V2 import modes: auto_create, orphan, assign

// Timeout étendu pour les gros imports (25 000+ polygones)
// Vercel Pro/Enterprise: jusqu'à 300s, Hobby: 60s max
export const maxDuration = 300;

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
import { parseKML, parseKMZ, parseGeoJSON, parseGPX } from '@/lib/services/geo-parser';
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

    const typedImportFile = importFile as unknown as ParcelImportFile;

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
      gpx: 'gpx',
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
      // Cherche dans la coopérative ET parmi les planteurs orphelins (cooperative_id IS NULL)
      const existingPlanteursMap = new Map<string, { id: string; name: string }>();
      
      if (planteurNameMap.size > 0) {
        const nameNorms = Array.from(planteurNameMap.keys());
        
        // Requête 1 : planteurs de la coopérative
        let coopPlanteurs: Array<{ id: string; name: string; name_norm: string }> = [];
        if (importCoopId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.from('planteurs') as any)
            .select('id, name, name_norm')
            .eq('cooperative_id', importCoopId)
            .eq('is_active', true)
            .in('name_norm', nameNorms);
          coopPlanteurs = data || [];
        }

        // Requête 2 : planteurs orphelins (sans coopérative), issus d'imports CSV sans coop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orphanPlanteurs } = await (supabase.from('planteurs') as any)
          .select('id, name, name_norm')
          .is('cooperative_id', null)
          .eq('is_active', true)
          .in('name_norm', nameNorms);

        // Priorité : planteur de la coopérative > planteur orphelin
        for (const p of (orphanPlanteurs || []) as Array<{ id: string; name: string; name_norm: string }>) {
          existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
        }
        // Les planteurs de la coopérative écrasent les orphelins si même name_norm
        for (const p of coopPlanteurs) {
          existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
        }
      }

      // Step 3: Create new planteurs for names that don't exist, en batch
      const newPlanteursMap = new Map<string, string>(); // name_norm → planteur_id

      // Séparer les planteurs existants des nouveaux
      const planteursToCreate: Array<{ nameNorm: string; name: string }> = [];
      for (const [nameNorm, { name }] of Array.from(planteurNameMap.entries())) {
        if (existingPlanteursMap.has(nameNorm)) {
          newPlanteursMap.set(nameNorm, existingPlanteursMap.get(nameNorm)!.id);
        } else {
          planteursToCreate.push({ nameNorm, name });
        }
      }

      // Créer tous les nouveaux planteurs en une seule requête batch
      if (planteursToCreate.length > 0) {
        const baseTimestamp = Date.now();
        const insertData = planteursToCreate.map(({ name }, idx) => ({
          name,
          // Code unique : timestamp de base + index pour éviter les doublons dans le batch
          code: `PLT-${baseTimestamp}-${idx.toString().padStart(5, '0')}`,
          cooperative_id: importCoopId,
          chef_planteur_id: defaultChefPlanteurId,
          auto_created: true,
          created_via_import_id: importId,
          is_active: true,
          created_by: user.id,
        }));

        // Insérer par batches de 500 pour éviter les limites de payload
        const PLANTEUR_BATCH = 500;
        for (let i = 0; i < insertData.length; i += PLANTEUR_BATCH) {
          const batch = insertData.slice(i, i + PLANTEUR_BATCH);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: created, error: batchError } = await (supabase.from('planteurs') as any)
            .insert(batch)
            .select('id, name_norm');

          if (batchError) {
            console.error(`[BATCH] Error creating planteurs batch ${i}:`, batchError.message);
            // En cas d'erreur, essayer de récupérer les existants
            const batchNorms = planteursToCreate.slice(i, i + PLANTEUR_BATCH).map(p => p.nameNorm);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existing } = await (supabase.from('planteurs') as any)
              .select('id, name_norm')
              .in('name_norm', batchNorms)
              .eq('is_active', true);
            for (const p of (existing || []) as Array<{ id: string; name_norm: string }>) {
              newPlanteursMap.set(p.name_norm, p.id);
            }
          } else {
            for (const p of (created || []) as Array<{ id: string; name_norm: string }>) {
              newPlanteursMap.set(p.name_norm, p.id);
            }
          }
        }
      }

      // Step 4: Build bulk payload with batching optimization
      // Collect all planteur IDs that have features
      const planteurIds = Array.from(planteurNameMap.entries())
        .map(([nameNorm]) => newPlanteursMap.get(nameNorm))
        .filter((id): id is string => !!id);

      // Fetch existing parcelle counts for ALL planteurs in one query
      const existingCountsMap = new Map<string, number>();
      if (planteurIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: countData } = await (supabase as any)
          .rpc('get_parcelle_counts_by_planteur', { p_planteur_ids: planteurIds });

        if (countData) {
          for (const row of countData as Array<{ planteur_id: string; count: number }>) {
            existingCountsMap.set(row.planteur_id, row.count);
          }
        }
      }

      // Build all payloads with pre-calculated codes
      const allPayloads: Array<Record<string, unknown>> = [];
      const planteurPayloadMap = new Map<string, number>(); // Track how many parcelles per planteur for logging

      for (const [nameNorm, { features: planteurFeatures }] of Array.from(planteurNameMap.entries())) {
        const planteurId = newPlanteursMap.get(nameNorm);
        if (!planteurId) {
          nbSkipped += planteurFeatures.length;
          continue;
        }

        const existingCount = existingCountsMap.get(planteurId) || 0;
        const baseCounter = existingCount + 1;

        const payloads = planteurFeatures.map((feature, idx) =>
          buildParcellePayload(feature, planteurId, baseCounter + idx, mapping, defaults, source)
        );

        allPayloads.push(...payloads);
        planteurPayloadMap.set(planteurId, payloads.length);
      }

      // Process in batches of 500 parcelles
      // Pour 25 000 polygones : 50 batches au lieu de 250 avec batch=100
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(allPayloads.length / BATCH_SIZE);
      
      console.log(`[BULK] Processing ${allPayloads.length} parcelles across ${planteurIds.length} planteurs in ${totalBatches} batches`);

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const start = batchIdx * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allPayloads.length);
        const batchPayload = allPayloads.slice(start, end);

        console.log(`[BULK] Batch ${batchIdx + 1}/${totalBatches}: Processing ${batchPayload.length} parcelles`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bulkResults, error: bulkError } = await (supabase as any).rpc('bulk_create_parcelles', {
          p_parcelles: batchPayload,
          p_import_file_id: importId,
          p_created_by: user.id,
        });

        if (bulkError) {
          console.error(`[BULK ERROR] Batch ${batchIdx + 1} error:`, bulkError);
          nbSkipped += batchPayload.length;
          continue;
        }

        console.log(`[BULK] Batch ${batchIdx + 1} received ${(bulkResults as Array<unknown> || []).length} results`);

        for (const row of (bulkResults as Array<{ id: string | null; success: boolean; error_message?: string }>) || []) {
          if (row.success && row.id) {
            createdIds.push(row.id);
          } else {
            console.log(`[BULK] Skipped parcelle: success=${row.success}, error=${row.error_message || 'none'}`);
            nbSkipped++;
          }
        }
      }

      // Step 5: Bulk-create orphan parcelles (empty planteur name)
      if (orphanFeatures.length > 0) {
        const payload = orphanFeatures.map(feature =>
          buildParcellePayload(feature, null, 0, mapping, defaults, source)
        );

        console.log(`[BULK] Calling bulk_create_parcelles for ${orphanFeatures.length} orphan parcelles`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bulkResults, error: bulkError } = await (supabase as any).rpc('bulk_create_parcelles', {
          p_parcelles: payload,
          p_import_file_id: importId,
          p_created_by: user.id,
        });

        if (bulkError) {
          console.error('[BULK ERROR] bulk_create_parcelles error for orphan features:', bulkError);
          nbSkipped += orphanFeatures.length;
        } else {
          console.log(`[BULK] Received ${(bulkResults as Array<unknown> || []).length} results for orphan parcelles`);
          
          for (const row of (bulkResults as Array<{ id: string | null; success: boolean; error_message?: string }>) || []) {
            if (row.success && row.id) {
              createdIds.push(row.id);
            } else {
              console.log(`[BULK] Skipped orphan parcelle: success=${row.success}, error=${row.error_message || 'none'}`);
              nbSkipped++;
            }
          }
        }
      }
    }

    // =========================================================================
    // MODE: orphan - Create all parcelles without planteur assignment
    // =========================================================================
    else if (mode === 'orphan') {
      const validFeatures = parsedFeatures.filter(f => f.validation.ok && !f.is_duplicate);
      nbSkipped += parsedFeatures.length - validFeatures.length;

      const payload = validFeatures.map(feature =>
        buildParcellePayload(feature, null, 0, mapping, defaults, source)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bulkResults, error: bulkError } = await (supabase as any).rpc('bulk_create_parcelles', {
        p_parcelles: payload,
        p_import_file_id: importId,
        p_created_by: user.id,
      });

      if (bulkError) {
        console.error('bulk_create_parcelles error (orphan mode):', bulkError.message);
        nbSkipped += validFeatures.length;
      } else {
        for (const row of (bulkResults as Array<{ id: string | null; success: boolean }>) || []) {
          if (row.success && row.id) createdIds.push(row.id);
          else nbSkipped++;
        }
      }
    }

    // =========================================================================
    // MODE: assign - Assign all parcelles to a single existing planteur
    // =========================================================================
    else if (mode === 'assign') {
      const planteurId = validatedInput.planteur_id!;

      const { count: existingCount } = await supabase
        .from('parcelles')
        .select('*', { count: 'exact', head: true })
        .eq('planteur_id', planteurId);

      const baseCounter = (existingCount || 0) + 1;

      const validFeatures = parsedFeatures.filter(f => f.validation.ok && !f.is_duplicate);
      nbSkipped += parsedFeatures.length - validFeatures.length;

      const payload = validFeatures.map((feature, idx) =>
        buildParcellePayload(feature, planteurId, baseCounter + idx, mapping, defaults, source)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bulkResults, error: bulkError } = await (supabase as any).rpc('bulk_create_parcelles', {
        p_parcelles: payload,
        p_import_file_id: importId,
        p_created_by: user.id,
      });

      if (bulkError) {
        console.error('bulk_create_parcelles error (assign mode):', bulkError.message);
        nbSkipped += validFeatures.length;
      } else {
        for (const row of (bulkResults as Array<{ id: string | null; success: boolean }>) || []) {
          if (row.success && row.id) createdIds.push(row.id);
          else nbSkipped++;
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
      case 'gpx':
        const gpxText = await fileData.text();
        parseResult = parseGPX(gpxText);
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

  // Pre-compute all feature hashes to only query relevant existing parcelles
  const allHashes: string[] = [];
  for (const feature of parseResult.features) {
    if (!feature.geometry) continue;
    try {
      const h = await computeFeatureHash(feature.geometry as import('geojson').MultiPolygon);
      allHashes.push(h);
    } catch { /* skip */ }
  }

  // Query only parcelles with matching hashes (scoped to cooperative for performance)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingParcellesQuery = (supabase.from('parcelles') as any)
    .select('id, feature_hash, planteur_id')
    .eq('is_active', true)
    .not('feature_hash', 'is', null);

  if (allHashes.length > 0) {
    existingParcellesQuery = existingParcellesQuery.in('feature_hash', allHashes);
  }

  const { data: existingParcelles } = await existingParcellesQuery;

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
 * Remove Z dimension from GeoJSON geometry (convert 3D to 2D)
 */
function remove3DCoordinates(geometry: import('geojson').MultiPolygon): import('geojson').MultiPolygon {
  const convert = (coords: number[]): number[] => {
    // If coordinate has Z dimension [x, y, z], return [x, y]
    return coords.length > 2 ? [coords[0], coords[1]] : coords;
  };

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map(polygon =>
      polygon.map(ring =>
        ring.map(convert)
      )
    ),
  };
}

/**
 * Build a single parcelle payload object for bulk_create_parcelles RPC.
 */
function buildParcellePayload(
  feature: ParsedFeature,
  planteurId: string | null,
  codeCounter: number,
  mapping: { label_field?: string; code_field?: string; village_field?: string; region_field?: string },
  defaults: { conformity_status?: string; certifications?: string[]; region?: string },
  source: ParcelleSource,
): Record<string, unknown> {
  const attrs = feature.dbf_attributes || {};

  let label = feature.label;
  if (mapping.label_field && attrs[mapping.label_field] !== undefined) {
    label = String(attrs[mapping.label_field]);
  }

  let code: string | null = null;
  if (planteurId) {
    if (mapping.code_field && attrs[mapping.code_field] !== undefined) {
      code = String(attrs[mapping.code_field]);
    } else if (codeCounter > 0) {
      code = `PARC-${String(codeCounter).padStart(4, '0')}`;
    }
  }

  let village: string | null = null;
  if (mapping.village_field && attrs[mapping.village_field] !== undefined) {
    village = String(attrs[mapping.village_field]);
  }

  // Region : depuis le mapping DBF ou depuis les defaults
  let region: string | null = defaults.region || null;
  if (mapping.region_field && attrs[mapping.region_field] !== undefined) {
    region = String(attrs[mapping.region_field]);
  }

  // Remove Z dimension if present (convert 3D to 2D)
  const geometry2D = remove3DCoordinates(feature.geom_geojson);

  return {
    planteur_id: planteurId,
    code,
    label,
    village,
    region,
    geometry_geojson: JSON.stringify(geometry2D),
    certifications: defaults.certifications || [],
    conformity_status: defaults.conformity_status || 'informations_manquantes',
    risk_flags: {},
    source,
    feature_hash: feature.feature_hash,
  };
}
