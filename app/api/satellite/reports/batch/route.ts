/**
 * POST /api/satellite/reports/batch
 * 
 * Generate certification reports for multiple parcelles and package as ZIP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exportService } from '@/lib/satellite/services/export.service';
import type { CertificationReportData } from '@/lib/satellite/services/export.service';
import type { ReportOptions } from '@/lib/satellite/types';
import { z } from 'zod';

/**
 * Request body schema for batch report generation
 */
const BatchReportRequestSchema = z.object({
  parcelleIds: z.array(z.string().uuid()).min(1).max(100), // Limit to 100 parcelles per batch
  options: z.object({
    includeBeforeAfter: z.boolean().default(true),
    includeNDVITrend: z.boolean().default(true),
    includeYieldPrediction: z.boolean().default(false),
    baselineDate: z.string().datetime().transform(str => new Date(str)),
    language: z.enum(['fr', 'en']).default('fr'),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = BatchReportRequestSchema.parse(body);
    const { parcelleIds, options } = validatedData;

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Fetch parcelle data with related information
    const { data: parcelles, error: parcellesError } = await supabase
      .from('parcelles')
      .select(
        `
        id,
        code,
        label,
        village,
        geometry,
        surface_hectares,
        planteur:planteurs!inner(name)
      `
      )
      .in('id', parcelleIds);

    if (parcellesError) {
      console.error('Error fetching parcelles:', parcellesError);
      return NextResponse.json(
        { error: 'Failed to fetch parcelle data' },
        { status: 500 }
      );
    }

    if (!parcelles || parcelles.length === 0) {
      return NextResponse.json(
        { error: 'No parcelles found with provided IDs' },
        { status: 404 }
      );
    }

    // Prepare certification report data for each parcelle
    const reportDataArray: CertificationReportData[] = [];

    for (const parcelle of parcelles) {
      // Type assertion for parcelle
      const parcelleRow = parcelle as any;
      
      // Fetch NDVI trend data
      const { data: ndviResults } = await supabase
        .from('ndvi_results')
        .select('*')
        .eq('parcelle_id', parcelleRow.id)
        .order('calculation_date', { ascending: true })
        .limit(12); // Last 12 data points

      // Fetch deforestation events
      const { data: deforestationEvents } = await supabase
        .from('deforestation_events')
        .select('*')
        .eq('parcelle_id', parcelleRow.id)
        .order('detection_date', { ascending: false });

      // Fetch baseline imagery (around Dec 31, 2020)
      const { data: baselineImagery } = await supabase
        .from('satellite_imagery')
        .select('*')
        .eq('parcelle_id', parcelleRow.id)
        .gte('acquisition_date', '2020-11-01')
        .lte('acquisition_date', '2021-02-28')
        .order('cloud_cover_percent', { ascending: true })
        .limit(1)
        .single();

      // Fetch most recent imagery
      const { data: currentImagery } = await supabase
        .from('satellite_imagery')
        .select('*')
        .eq('parcelle_id', parcelleRow.id)
        .order('acquisition_date', { ascending: false })
        .limit(1)
        .single();

      // Fetch yield prediction if requested
      let yieldPrediction = undefined;
      if (options.includeYieldPrediction) {
        const { data: yieldData } = await supabase
          .from('yield_predictions')
          .select('*')
          .eq('parcelle_id', parcelleRow.id)
          .order('prediction_date', { ascending: false })
          .limit(1)
          .single();

        yieldPrediction = yieldData || undefined;
      }

      // Determine compliance status
      const hasPendingAlerts = deforestationEvents?.some(
        (event: any) => event.status === 'pending'
      );
      const hasNonCompliantAlerts = deforestationEvents?.some(
        (event: any) => event.status === 'pending' || event.status === 'disputed'
      );

      let complianceStatus: 'compliant' | 'non-compliant' | 'requires-review';
      if (!deforestationEvents || deforestationEvents.length === 0) {
        complianceStatus = 'compliant';
      } else if (hasNonCompliantAlerts) {
        complianceStatus = hasPendingAlerts ? 'requires-review' : 'non-compliant';
      } else {
        complianceStatus = 'compliant';
      }

      // Convert NDVI results to temporal data points
      const ndviTrend = ndviResults?.map((result: any) => ({
        date: new Date(result.calculation_date),
        ndvi: result.mean_ndvi,
        cloudCover: 0, // Not available in ndvi_results
        healthStatus: result.health_status as any,
        hasSignificantChange: false, // Would need to calculate
      }));

      // Build report data
      const reportData: CertificationReportData = {
        parcelle: {
          id: parcelleRow.id,
          code: parcelleRow.code,
          label: parcelleRow.label,
          village: parcelleRow.village,
          region: parcelleRow.region,
          geometry: parcelleRow.geometry,
          surface_hectares: parcelleRow.surface_hectares,
          planteur_name: parcelleRow.planteur
            ? `${parcelleRow.planteur.prenom} ${parcelleRow.planteur.nom}`
            : null,
        },
        complianceStatus,
        deforestation: (deforestationEvents || undefined) as unknown as CertificationReportData['deforestation'],
        ndviTrend: (ndviTrend || undefined) as unknown as CertificationReportData['ndviTrend'],
        baselineImagery: (baselineImagery || undefined) as unknown as CertificationReportData['baselineImagery'],
        currentImagery: (currentImagery || undefined) as unknown as CertificationReportData['currentImagery'],
        yieldPrediction: yieldPrediction as unknown as CertificationReportData['yieldPrediction'],
        generatedBy: user.email || user.id,
      };

      reportDataArray.push(reportData);
    }

    // Generate batch reports with progress tracking
    // Note: In a production environment, this should be done as a background job
    // with proper progress tracking via WebSocket or polling
    const zipUrl = await exportService.generateBatchCertificationReports(
      reportDataArray,
      options,
      undefined, // Use default template
      (current, total) => {
        // Progress callback - in production, emit to WebSocket or store in database
        console.log(`Generating report ${current} of ${total}`);
      }
    );

    // Log the batch report generation in audit log
    await (supabase.from('satellite_audit_logs') as any).insert({
      user_id: user.id,
      event_type: 'batch_report_generated',
      event_data: {
        parcelle_count: reportDataArray.length,
        parcelle_ids: parcelleIds,
        options,
      },
    });

    return NextResponse.json({
      success: true,
      zipUrl,
      reportCount: reportDataArray.length,
      message: `Successfully generated ${reportDataArray.length} certification reports`,
    });
  } catch (error) {
    console.error('Error generating batch reports:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Failed to generate batch reports',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
