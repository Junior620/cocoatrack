// CocoaTrack V2 - Parcelles Import Parse API Route
// POST /api/parcelles/import/[id]/parse - Parse an uploaded import file

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
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
import type {
  ParcelImportFile,
  ParsedFeature,
  ParseReport,
  ParseResult,
  ParseError,
  ParseWarning,
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
import { v4 as uuidv4 } from 'uuid';

// Storage bucket name for parcelle imports
const STORAGE_BUCKET = 'parcelle-imports';

/**
 * POST /api/parcelles/import/[id]/parse
 * 
 * Parse an uploaded import file.
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

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(typedImportFile.storage_url);

    if (downloadError || !fileData) {
      // Update status to failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('parcel_import_files') as any)
        .update({
          import_status: 'failed',
          failed_reason: `Failed to download file: ${downloadError?.message || 'Unknown error'}`,
        })
        .eq('id', importId);

      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to download file from storage',
        { reason: downloadError?.message || 'Unknown error' }
      ));
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

      switch (typedImportFile.file_type) {
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
          return validationErrorResponse('file_type', `Unsupported file type: ${typedImportFile.file_type}`);
      }
    } catch (err) {
      // Update status to failed
      const errorMessage = err instanceof Error ? err.message : 
        (err as { message?: string })?.message || 'Unknown parsing error';
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('parcel_import_files') as any)
        .update({
          import_status: 'failed',
          failed_reason: errorMessage,
          parse_report: {
            nb_features: 0,
            errors: [{
              code: ParcelleErrorCodes.VALIDATION_ERROR,
              message: errorMessage,
            }],
            warnings: [],
          },
        })
        .eq('id', importId);

      return handleErrorResponse(err, 'POST /api/parcelles/import/[id]/parse');
    }

    // Check feature limit
    if (parseResult.features.length > PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT) {
      const limitError: ParseError = {
        code: ParcelleErrorCodes.LIMIT_EXCEEDED,
        message: `Too many features: ${parseResult.features.length} exceeds limit of ${PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT}`,
        details: {
          limit: PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT,
          actual: parseResult.features.length,
          resource: 'features',
        },
      };
      parseResult.errors.push(limitError);

      // Update status to failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('parcel_import_files') as any)
        .update({
          import_status: 'failed',
          failed_reason: limitError.message,
          nb_features: parseResult.features.length,
          parse_report: {
            nb_features: parseResult.features.length,
            errors: parseResult.errors,
            warnings: parseResult.warnings,
          },
        })
        .eq('id', importId);

      return limitExceededResponse(
        PARCELLE_LIMITS.MAX_FEATURES_PER_IMPORT,
        parseResult.features.length,
        'features'
      );
    }

    // Check for projected coordinates warning (if no .prj file for shapefiles)
    const hasPrj = 'hasPrj' in parseResult ? parseResult.hasPrj : true;

    // Process each feature: validate, compute hash, check duplicates
    const parsedFeatures: ParsedFeature[] = [];
    const errors: ParseError[] = [...parseResult.errors];
    const warnings: ParseWarning[] = [...parseResult.warnings];

    // Get existing feature hashes for duplicate detection
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

    // Process features
    for (let i = 0; i < parseResult.features.length; i++) {
      const feature = parseResult.features[i];
      const tempId = uuidv4();
      const featureErrors: string[] = [];
      const featureWarnings: string[] = [];

      // Check for empty geometry
      if (isEmptyGeometry(feature.geometry)) {
        featureErrors.push('Empty geometry');
        errors.push({
          code: ParcelleErrorCodes.INVALID_GEOMETRY,
          message: `Feature ${i}: Empty geometry`,
          feature_index: i,
          details: { reason: 'empty geometry' },
        });
        continue;
      }

      // Validate coordinates are in WGS84 bounds
      const coordValidation = validateCoordinates(feature.geometry);
      let geomOriginalValid = true;
      let fixedGeometry = feature.geometry;

      if (!coordValidation.valid) {
        if (!hasPrj) {
          const projectedCheck = detectProjectedCoordinates(feature.geometry);
          if (projectedCheck.likely) {
            warnings.push({
              code: ParcelleErrorCodes.LIKELY_PROJECTED_COORDINATES,
              message: `Feature ${i}: Coordinates appear to be projected (not WGS84)`,
              feature_index: i,
              requires_confirmation: true,
              details: { sample_coord: projectedCheck.sampleCoord },
            });
            featureWarnings.push('Coordinates may be projected (not WGS84)');
          }
        }
      }

      // Validate geometry structure
      if (!isValidGeometry(feature.geometry)) {
        geomOriginalValid = false;
        featureWarnings.push('Geometry has self-intersections, attempting to fix');

        const fixed = tryFixGeometry(feature.geometry);
        if (fixed) {
          fixedGeometry = fixed;
          featureWarnings.push('Geometry was automatically fixed');
        } else {
          featureErrors.push('Invalid geometry that could not be fixed');
          errors.push({
            code: ParcelleErrorCodes.INVALID_GEOMETRY,
            message: `Feature ${i}: Invalid geometry that could not be fixed`,
            feature_index: i,
            details: { reason: 'self-intersecting polygon' },
          });
          continue;
        }
      }

      // Compute feature hash
      let featureHash: string;
      try {
        featureHash = await computeFeatureHash(fixedGeometry);
      } catch {
        featureErrors.push('Failed to compute feature hash');
        errors.push({
          code: ParcelleErrorCodes.VALIDATION_ERROR,
          message: `Feature ${i}: Failed to compute feature hash`,
          feature_index: i,
        });
        continue;
      }

      // Check for duplicates
      const existingMatch = existingHashMap.get(featureHash);
      const isDuplicate = !!existingMatch;
      if (isDuplicate) {
        featureWarnings.push(`Duplicate of existing parcelle ${existingMatch.id}`);
        warnings.push({
          code: ParcelleErrorCodes.DUPLICATE_GEOMETRY,
          message: `Feature ${i}: Duplicate geometry found`,
          feature_index: i,
          details: { existing_parcelle_id: existingMatch.id },
        });
      }

      // Calculate area and centroid
      const areaHa = calculateAreaHa(fixedGeometry);
      const centroid = calculateCentroid(fixedGeometry);

      // Extract label from properties
      const props = feature.properties || {};
      const label = (props.name || props.NAME || props.label || props.LABEL || 
                    props.nom || props.NOM || props.description || null) as string | null;

      // Create parsed feature
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

    // Sort features by feature_hash for idempotent ordering
    parsedFeatures.sort((a, b) => a.feature_hash.localeCompare(b.feature_hash));

    // Build parse report
    const parseReport: ParseReport = {
      nb_features: parsedFeatures.length,
      errors,
      warnings,
    };

    // Determine status based on errors
    const hasBlockingErrors = errors.some(
      (e) => e.code === ParcelleErrorCodes.LIMIT_EXCEEDED ||
             e.code === ParcelleErrorCodes.SHAPEFILE_MISSING_REQUIRED
    );
    const newStatus = hasBlockingErrors ? 'failed' : 'parsed';
    const failedReason = hasBlockingErrors ? errors[0]?.message : null;

    // Update import record with parse results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from('parcel_import_files') as any)
      .update({
        import_status: newStatus,
        failed_reason: failedReason,
        nb_features: parsedFeatures.length,
        parse_report: parseReport,
      })
      .eq('id', importId);

    if (updateError) {
      console.error('Failed to update import record:', updateError.message);
    }

    // Build response
    const result: ParseResult = {
      features: parsedFeatures,
      report: parseReport,
      available_fields: parseResult.availableFields,
    };

    const response = NextResponse.json(result, { status: 200 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'POST /api/parcelles/import/[id]/parse');
  }
}
