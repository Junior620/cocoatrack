/**
 * API Route: Export Parcelle Data as KML
 * 
 * POST /api/satellite/export/kml
 * 
 * Exports parcelle data with satellite analysis as KML file for Google Earth visualization.
 * Supports single and batch exports with optional NDVI, deforestation, and temporal data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exportService } from '@/lib/satellite/services/export.service';
import type { 
  KMLExportOptions, 
  NDVIResult, 
  DeforestationEvent,
  TemporalDataPoint 
} from '@/lib/satellite/types';
import type { ParcelleKMLData, KMLExportData } from '@/lib/satellite/services/export.service';
import type { MultiPolygon } from 'geojson';

/**
 * Storage bucket for KML exports
 * KML files are stored temporarily with 7-day retention
 */
const KML_STORAGE_BUCKET = 'satellite-imagery';
const KML_FOLDER = 'kml-exports';

/**
 * KML file expiration time (7 days in seconds)
 */
const KML_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

/**
 * Request body schema
 */
interface KMLExportRequest {
  parcelleIds: string[];
  options: KMLExportOptions;
}

/**
 * POST handler for KML export
 * 
 * Request body:
 * {
 *   parcelleIds: string[],
 *   options: {
 *     includeTemporal: boolean,
 *     includeNDVI: boolean,
 *     includeDeforestation: boolean,
 *     startDate?: string,
 *     endDate?: string,
 *     format: 'kml' | 'kmz'
 *   }
 * }
 * 
 * Returns:
 * {
 *   fileUrl: string,
 *   expiresAt: string,
 *   filename: string,
 *   estimatedSize: number,
 *   parcelleCount: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: KMLExportRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { parcelleIds, options } = body;

    // Validate required fields
    if (!parcelleIds || !Array.isArray(parcelleIds) || parcelleIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid parcelleIds array' },
        { status: 400 }
      );
    }

    if (!options || typeof options !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid options object' },
        { status: 400 }
      );
    }

    // Validate parcelleIds (max 100 for performance)
    if (parcelleIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 parcelles allowed per export' },
        { status: 400 }
      );
    }

    // Validate UUID format for all parcelleIds
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = parcelleIds.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid UUID format for parcelleIds: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate options
    if (typeof options.includeNDVI !== 'boolean' ||
        typeof options.includeDeforestation !== 'boolean' ||
        typeof options.includeTemporal !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid options: includeNDVI, includeDeforestation, and includeTemporal must be boolean' },
        { status: 400 }
      );
    }

    if (options.format !== 'kml' && options.format !== 'kmz') {
      return NextResponse.json(
        { error: 'Invalid format: must be "kml" or "kmz"' },
        { status: 400 }
      );
    }

    // Parse date filters if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (options.startDate) {
      startDate = new Date(options.startDate);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 }
        );
      }
    }

    if (options.endDate) {
      endDate = new Date(options.endDate);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 }
        );
      }
    }

    // Fetch parcelles with access control (RLS will filter based on user permissions)
    const { data: parcelles, error: parcellesError } = await supabase
      .from('parcelles')
      .select(`
        id,
        code,
        label,
        village,
        geometry,
        surface_hectares,
        planteur:planteurs(name)
      `)
      .in('id', parcelleIds);

    if (parcellesError) {
      console.error('Error fetching parcelles:', parcellesError);
      return NextResponse.json(
        { error: 'Failed to fetch parcelles' },
        { status: 500 }
      );
    }

    if (!parcelles || parcelles.length === 0) {
      return NextResponse.json(
        { error: 'No parcelles found or access denied' },
        { status: 404 }
      );
    }

    // Build KML export data for each parcelle
    const exportData: KMLExportData[] = [];

    for (const parcelle of parcelles) {
      // Type assertion for parcelle
      const parcelleRow = parcelle as any;
      
      // Transform parcelle data
      const parcelleData: ParcelleKMLData = {
        id: parcelleRow.id,
        code: parcelleRow.code,
        label: parcelleRow.label,
        village: parcelleRow.village,
        region: null, // Region not available in parcelles table
        geometry: parcelleRow.geometry as MultiPolygon,
        surface_hectares: parcelleRow.surface_hectares,
        planteur_name: parcelleRow.planteur?.name || null,
      };

      const kmlData: KMLExportData = {
        parcelle: parcelleData,
      };

      // Fetch NDVI data if requested
      if (options.includeNDVI) {
        const { data: ndviData } = await supabase
          .from('ndvi_results')
          .select('*')
          .eq('parcelle_id', parcelleRow.id)
          .order('calculation_date', { ascending: false })
          .limit(1)
          .single();

        if (ndviData) {
          const ndviRow = ndviData as any;
          kmlData.ndvi = {
            id: ndviRow.id,
            parcelleId: ndviRow.parcelle_id,
            imageryId: ndviRow.imagery_id,
            calculationDate: new Date(ndviRow.calculation_date),
            meanNDVI: ndviRow.mean_ndvi,
            minNDVI: ndviRow.min_ndvi,
            maxNDVI: ndviRow.max_ndvi,
            stdDevNDVI: ndviRow.std_dev_ndvi,
            healthStatus: ndviRow.health_status as 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
            ndviRasterUrl: ndviRow.ndvi_raster_url,
            createdAt: new Date(ndviRow.created_at),
          };
        }
      }

      // Fetch deforestation alerts if requested
      if (options.includeDeforestation) {
        const { data: deforestationData } = await supabase
          .from('deforestation_events')
          .select('*')
          .eq('parcelle_id', parcelleRow.id)
          .order('detection_date', { ascending: false });

        if (deforestationData && deforestationData.length > 0) {
          kmlData.deforestation = deforestationData.map((alert: any): DeforestationEvent => ({
            id: alert.id,
            parcelleId: alert.parcelle_id,
            baselineDate: new Date(alert.baseline_date),
            detectionDate: new Date(alert.detection_date),
            baselineNDVI: alert.baseline_ndvi,
            currentNDVI: alert.current_ndvi,
            ndviChange: alert.ndvi_change,
            affectedAreaHectares: alert.affected_area_hectares,
            affectedAreaPercent: alert.affected_area_percent,
            status: alert.status as 'pending' | 'acknowledged' | 'disputed' | 'resolved',
            acknowledgedBy: alert.acknowledged_by,
            acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : null,
            acknowledgmentNotes: alert.acknowledgment_notes,
            disputedBy: alert.disputed_by,
            disputedAt: alert.disputed_at ? new Date(alert.disputed_at) : null,
            disputeReason: alert.dispute_reason,
            createdAt: new Date(alert.created_at),
            updatedAt: new Date(alert.updated_at),
          }));
        }
      }

      // Fetch temporal data if requested
      if (options.includeTemporal) {
        let temporalQuery = supabase
          .from('ndvi_results')
          .select('*')
          .eq('parcelle_id', parcelleRow.id)
          .order('calculation_date', { ascending: true });

        if (startDate) {
          temporalQuery = temporalQuery.gte('calculation_date', startDate.toISOString());
        }

        if (endDate) {
          temporalQuery = temporalQuery.lte('calculation_date', endDate.toISOString());
        }

        const { data: temporalData } = await temporalQuery;

        if (temporalData && temporalData.length > 0) {
          // Transform to TemporalDataPoint format
          kmlData.temporal = temporalData.map((result: any, index): TemporalDataPoint => {
            // Calculate if there's a significant change from previous
            let hasSignificantChange = false;
            if (index > 0) {
              const previousNDVI = (temporalData[index - 1] as any).mean_ndvi;
              const change = Math.abs(result.mean_ndvi - previousNDVI);
              hasSignificantChange = change > 0.15;
            }

            return {
              date: new Date(result.calculation_date),
              ndvi: result.mean_ndvi,
              cloudCover: 0, // Not stored in ndvi_results, would need to join with satellite_imagery
              healthStatus: result.health_status as 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
              hasSignificantChange,
            };
          });
        }
      }

      exportData.push(kmlData);
    }

    // Check if compression is recommended
    const shouldCompress = exportService.shouldCompressToKMZ(exportData, options);
    if (shouldCompress && options.format === 'kml') {
      // Warn user but proceed with KML (they can request KMZ explicitly)
      console.warn(`KML export size estimated to exceed 10MB. Consider using KMZ format.`);
    }

    // Generate KML content
    const kmlContent = await exportService.exportKML(exportData, options);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const parcelleCount = exportData.length;
    const filename = parcelleCount === 1
      ? `cocoatrack-${exportData[0].parcelle.code || exportData[0].parcelle.id.substring(0, 8)}-${timestamp}.kml`
      : `cocoatrack-${parcelleCount}-parcelles-${timestamp}.kml`;

    // Return KML file directly as response
    // Use TextEncoder to get the correct byte length for UTF-8 content
    const encoder = new TextEncoder();
    const kmlBytes = encoder.encode(kmlContent);
    
    return new NextResponse(kmlBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': kmlBytes.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error in KML export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
