// CocoaTrack V2 - Parcelles Import Preview Auto-Create API Route
// POST /api/parcelles/import/[id]/preview-auto-create - Preview auto-create mode results
// Shows which planteurs will be created vs reused before applying the import

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { z } from 'zod';
import type {
  ParcelImportFile,
  ParsedFeature,
  AutoCreatePreview,
  ParseError,
  ParseWarning,
} from '@/types/parcelles';
import {
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
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
import { v4 as uuidv4 } from 'uuid';
import { normalizePlanteurName } from '@/lib/api/parcelles-import';

// Storage bucket name for parcelle imports
const STORAGE_BUCKET = 'parcelle-imports';

// Request body schema
const previewAutoCreateSchema = z.object({
  planteur_name_field: z.string().min(1, 'Planteur name field is required'),
});

/**
 * POST /api/parcelles/import/[id]/preview-auto-create
 * 
 * Preview auto-create mode results before applying the import.
 * Shows which planteurs will be created vs reused based on name_norm matching.
 * 
 * Request body:
 * - planteur_name_field: DBF field containing planteur names
 * 
 * Response:
 * - new_planteurs: Array of planteurs that will be created
 * - existing_planteurs: Array of existing planteurs that will be reused
 * - orphan_count: Number of parcelles without planteur name (will be orphan)
 * 
 * @see Requirements 3.5
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

    const parseResult = previewAutoCreateSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const { planteur_name_field: planteurNameField } = parseResult.data;

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

    // Check if status is 'parsed' (ready for preview)
    if (typedImportFile.import_status !== 'parsed') {
      return validationErrorResponse(
        'import_status',
        `Import must be in 'parsed' status to preview. Current status: '${typedImportFile.import_status}'`
      );
    }

    // Parse the import file to get features
    const parsedFeatures = await parseImportFile(supabase, typedImportFile);

    // Get available fields from the first feature
    const availableFields = parsedFeatures.length > 0 
      ? Object.keys(parsedFeatures[0].dbf_attributes || {})
      : [];

    // Check if the specified field exists in available fields
    if (!availableFields.includes(planteurNameField)) {
      return validationErrorResponse(
        'planteur_name_field',
        `The field '${planteurNameField}' does not exist in the imported file. Available fields: ${availableFields.join(', ')}`
      );
    }

    // Extract unique planteur names from features
    // Map: name_norm → { name (original), count }
    const planteurNameMap = new Map<string, { name: string; count: number }>();
    let orphanCount = 0;

    for (const feature of parsedFeatures) {
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
    const importCoopId = typedImportFile.cooperative_id || null;
    const existingPlanteursMap = new Map<string, { id: string; name: string }>();

    if (planteurNameMap.size > 0 && importCoopId) {
      const nameNorms = Array.from(planteurNameMap.keys());

      // Query existing planteurs with matching name_norm in the same cooperative
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPlanteurs, error: queryError } = await (supabase.from('planteurs') as any)
        .select('id, name, name_norm')
        .eq('cooperative_id', importCoopId)
        .eq('is_active', true)
        .in('name_norm', nameNorms);

      if (queryError) {
        console.error('Failed to query existing planteurs:', queryError.message);
        // Continue without matching - all will be treated as new
      } else if (existingPlanteurs) {
        for (const p of existingPlanteurs as Array<{ id: string; name: string; name_norm: string }>) {
          existingPlanteursMap.set(p.name_norm, { id: p.id, name: p.name });
        }
      }
    }

    // Build the preview result
    const newPlanteurs: AutoCreatePreview['new_planteurs'] = [];
    const existingPlanteurs: AutoCreatePreview['existing_planteurs'] = [];

    for (const [nameNorm, { name, count }] of Array.from(planteurNameMap.entries())) {
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

    const result: AutoCreatePreview = {
      new_planteurs: newPlanteurs,
      existing_planteurs: existingPlanteurs,
      orphan_count: orphanCount,
    };

    const response = NextResponse.json(result, { status: 200 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/import/[id]/preview-auto-create');
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
