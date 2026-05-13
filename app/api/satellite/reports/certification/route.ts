/**
 * POST /api/satellite/reports/certification
 * 
 * Generate EUDR certification report for a parcelle.
 * 
 * This endpoint:
 * 1. Validates request body (parcelleId, options)
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Gathers required data (parcelle, NDVI, deforestation, imagery)
 * 5. Generates PDF report using ExportService
 * 6. Uploads report to Supabase Storage
 * 7. Logs report generation in audit log
 * 8. Returns report URL with expiration
 * 
 * Requirements: Task 5.4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exportService, type CertificationReportData } from '@/lib/satellite/services/export.service';
import { z } from 'zod';
import type {
  ReportOptions,
  DeforestationEvent,
  TemporalDataPoint,
  ImageryData,
  YieldPrediction,
  NDVIResult,
} from '@/lib/satellite/types';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for POST /api/satellite/reports/certification request body
 */
const CertificationReportRequestSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  options: z.object({
    includeBeforeAfter: z.boolean().default(true),
    includeNDVITrend: z.boolean().default(true),
    includeYieldPrediction: z.boolean().default(false),
    baselineDate: z.string().datetime().transform((val) => new Date(val)),
    language: z.enum(['fr', 'en']).default('fr'),
  }),
});

type CertificationReportRequest = z.infer<typeof CertificationReportRequestSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create error response with consistent format
 */
function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || 'UNKNOWN_ERROR',
    },
    { status }
  );
}

/**
 * Check if user has access to the parcelle
 * 
 * Access rules:
 * - Admin: Access to all parcelles
 * - Cooperative Manager: Access to parcelles in their cooperative
 * - Agronomist: Access to parcelles they are assigned to
 * - Planteur: Access to their own parcelles
 * - Certification Auditor: Access to all parcelles (for EUDR compliance verification)
 */
async function checkParcelleAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  parcelleId: string
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    // Type assertion for profile
    const userProfile = profile as {
      role: string;
      cooperative_id: string | null;
    };

    // Admin and Certification Auditor have access to all parcelles
    if (userProfile.role === 'admin' || userProfile.role === 'certification_auditor') {
      return { hasAccess: true };
    }

    // Get parcelle with planteur and cooperative info
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, planteur:planteurs(cooperative_id)')
      .eq('id', parcelleId)
      .maybeSingle();

    if (parcelleError || !parcelle) {
      return { hasAccess: false, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = parcelle as {
      id: string;
      planteur_id: string;
      planteur: { cooperative_id: string };
    };

    // Check cooperative access
    if (userProfile.cooperative_id && parcelleData.planteur.cooperative_id !== userProfile.cooperative_id) {
      return { hasAccess: false, error: 'Access denied: parcelle belongs to different cooperative' };
    }

    // Cooperative Manager: Check if parcelle is in their cooperative
    if (userProfile.role === 'cooperative_manager') {
      return { hasAccess: true };
    }

    // Planteur: Check if they own the parcelle
    if (userProfile.role === 'planteur') {
      if (parcelleData.planteur_id === userId) {
        return { hasAccess: true };
      }
      return { hasAccess: false, error: 'You do not own this parcelle' };
    }

    // Agronomist: Check if they are assigned to the parcelle
    // (This would require an assignment table - for now, allow access to all)
    if (userProfile.role === 'agronomist') {
      return { hasAccess: true };
    }

    return { hasAccess: false, error: 'Insufficient permissions' };
  } catch (error) {
    console.error('Error checking parcelle access:', error);
    return { hasAccess: false, error: 'Failed to verify access' };
  }
}

/**
 * Fetch parcelle data with related information
 */
async function fetchParcelleData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
) {
  const { data, error } = await supabase
    .from('parcelles')
    .select(`
      id,
      code,
      label,
      village,
      geometry,
      surface_hectares,
      planteur:planteur_id (
        name
      )
    `)
    .eq('id', parcelleId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Failed to fetch parcelle data');
  }

  // Type assertion and transformation
  const parcelle = data as any;
  const planteurName = parcelle.planteur?.name || null;

  return {
    id: parcelle.id,
    code: parcelle.code,
    label: parcelle.label,
    village: parcelle.village,
    region: null, // Region not available in parcelles table
    geometry: parcelle.geometry,
    surface_hectares: parcelle.surface_hectares,
    planteur_name: planteurName,
  };
}

/**
 * Fetch deforestation events for parcelle
 */
async function fetchDeforestationEvents(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<DeforestationEvent[]> {
  const { data, error } = await supabase
    .from('deforestation_events')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .order('detection_date', { ascending: false });

  if (error) {
    console.error('Error fetching deforestation events:', error);
    return [];
  }

  // Transform database rows to DeforestationEvent objects
  return (data || []).map((row: any) => ({
    id: row.id,
    parcelleId: row.parcelle_id,
    baselineDate: new Date(row.baseline_date),
    detectionDate: new Date(row.detection_date),
    baselineNDVI: row.baseline_ndvi,
    currentNDVI: row.current_ndvi,
    ndviChange: row.ndvi_change,
    affectedAreaHectares: row.affected_area_hectares,
    affectedAreaPercent: row.affected_area_percent,
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
    acknowledgmentNotes: row.acknowledgment_notes,
    disputedBy: row.disputed_by,
    disputedAt: row.disputed_at ? new Date(row.disputed_at) : null,
    disputeReason: row.dispute_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Fetch NDVI trend data for parcelle
 */
async function fetchNDVITrend(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string,
  startDate: Date,
  endDate: Date
): Promise<TemporalDataPoint[]> {
  const { data, error } = await supabase
    .from('ndvi_results')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .gte('calculation_date', startDate.toISOString())
    .lte('calculation_date', endDate.toISOString())
    .order('calculation_date', { ascending: true });

  if (error) {
    console.error('Error fetching NDVI trend:', error);
    return [];
  }

  // Transform to TemporalDataPoint format
  // Note: Database columns use snake_case, need to access them correctly
  const ndviResults = (data || []) as any[];
  
  return ndviResults.map((result, index) => {
    // Access database columns with snake_case
    const meanNDVI = result.mean_ndvi;
    const calculationDate = result.calculation_date;
    const healthStatus = result.health_status;
    
    // Calculate if there's a significant change from previous
    let hasSignificantChange = false;
    if (index > 0) {
      const previousNDVI = ndviResults[index - 1].mean_ndvi;
      const change = Math.abs(meanNDVI - previousNDVI);
      hasSignificantChange = change > 0.15;
    }

    return {
      date: new Date(calculationDate),
      ndvi: meanNDVI,
      cloudCover: 0, // Not stored in ndvi_results, would need to join with satellite_imagery
      healthStatus: healthStatus,
      hasSignificantChange,
    };
  });
}

/**
 * Fetch baseline imagery for EUDR compliance
 */
async function fetchBaselineImagery(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string,
  baselineDate: Date
): Promise<ImageryData | null> {
  // Find imagery closest to baseline date (within 60 days)
  const startWindow = new Date(baselineDate);
  startWindow.setDate(startWindow.getDate() - 60);
  const endWindow = new Date(baselineDate);
  endWindow.setDate(endWindow.getDate() + 60);

  const { data, error } = await supabase
    .from('satellite_imagery')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .gte('acquisition_date', startWindow.toISOString())
    .lte('acquisition_date', endWindow.toISOString())
    .order('acquisition_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Type assertion for data
  const imageryRow = data as any;

  // Transform to ImageryData
  return {
    id: imageryRow.id,
    parcelleId: imageryRow.parcelle_id,
    acquisitionDate: new Date(imageryRow.acquisition_date),
    cloudCoverPercent: imageryRow.cloud_cover_percent,
    satelliteSource: imageryRow.satellite_source as 'sentinel-2',
    tileUrl: imageryRow.tile_url,
    bounds: imageryRow.bounds,
    resolutionMeters: imageryRow.resolution_meters,
    createdAt: new Date(imageryRow.created_at),
  };
}

/**
 * Fetch current imagery (most recent)
 */
async function fetchCurrentImagery(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<ImageryData | null> {
  const { data, error } = await supabase
    .from('satellite_imagery')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .order('acquisition_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Type assertion for data
  const imageryRow = data as any;

  // Transform to ImageryData
  return {
    id: imageryRow.id,
    parcelleId: imageryRow.parcelle_id,
    acquisitionDate: new Date(imageryRow.acquisition_date),
    cloudCoverPercent: imageryRow.cloud_cover_percent,
    satelliteSource: imageryRow.satellite_source as 'sentinel-2',
    tileUrl: imageryRow.tile_url,
    bounds: imageryRow.bounds,
    resolutionMeters: imageryRow.resolution_meters,
    createdAt: new Date(imageryRow.created_at),
  };
}

/**
 * Fetch yield prediction for parcelle
 */
async function fetchYieldPrediction(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<YieldPrediction | null> {
  const { data, error } = await supabase
    .from('yield_predictions')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .order('prediction_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Type assertion for data
  const yieldRow = data as any;

  // Transform to YieldPrediction
  return {
    id: yieldRow.id,
    parcelleId: yieldRow.parcelle_id,
    predictionDate: new Date(yieldRow.prediction_date),
    harvestSeason: yieldRow.harvest_season,
    predictedYieldKgPerHa: yieldRow.predicted_yield_kg_per_ha,
    confidenceLevel: yieldRow.confidence_level as 'high' | 'medium' | 'low',
    confidenceIntervalLower: yieldRow.confidence_interval_lower,
    confidenceIntervalUpper: yieldRow.confidence_interval_upper,
    modelVersion: yieldRow.model_version,
    inputFeatures: yieldRow.input_features as any,
    actualYieldKgPerHa: yieldRow.actual_yield_kg_per_ha,
    createdAt: new Date(yieldRow.created_at),
  };
}

/**
 * Determine compliance status based on deforestation events
 */
function determineComplianceStatus(
  deforestation: DeforestationEvent[]
): 'compliant' | 'non-compliant' | 'requires-review' {
  if (deforestation.length === 0) {
    return 'compliant';
  }

  const pendingAlerts = deforestation.filter((d) => d.status === 'pending');
  const disputedAlerts = deforestation.filter((d) => d.status === 'disputed');

  if (pendingAlerts.length > 0 || disputedAlerts.length > 0) {
    return 'requires-review';
  }

  const acknowledgedAlerts = deforestation.filter((d) => d.status === 'acknowledged');
  if (acknowledgedAlerts.length > 0) {
    return 'non-compliant';
  }

  return 'compliant';
}

/**
 * Upload PDF to Supabase Storage
 */
async function uploadPDFToStorage(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  pdfBlob: Blob,
  fileName: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('certification-reports')
    .upload(fileName, pdfBlob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading PDF to storage:', error);
    throw new Error('Failed to upload report to storage');
  }

  // Get public URL with expiration (7 days)
  const { data: urlData } = await supabase.storage
    .from('certification-reports')
    .createSignedUrl(data.path, 7 * 24 * 60 * 60); // 7 days in seconds

  if (!urlData) {
    throw new Error('Failed to generate signed URL for report');
  }

  return urlData.signedUrl;
}

/**
 * Log report generation in audit log
 */
async function logReportGeneration(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  parcelleId: string,
  reportUrl: string,
  options: ReportOptions,
  request: NextRequest
) {
  // Extract IP address and user agent from request
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const { error } = await (supabase
    .from('satellite_audit_logs') as any)
    .insert({
      user_id: userId,
      parcelle_id: parcelleId,
      event_type: 'report_generated',
      event_description: `Generated EUDR certification report for parcelle ${parcelleId}`,
      event_metadata: {
        report_url: reportUrl,
        options: {
          includeBeforeAfter: options.includeBeforeAfter,
          includeNDVITrend: options.includeNDVITrend,
          includeYieldPrediction: options.includeYieldPrediction,
          language: options.language,
        },
        baseline_date: options.baselineDate.toISOString(),
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

  if (error) {
    console.error('Error logging report generation:', error);
    // Don't throw - audit log failure shouldn't prevent report generation
  }
}

// ============================================================================
// POST Handler
// ============================================================================

/**
 * POST /api/satellite/reports/certification
 * 
 * Generate EUDR certification report for a parcelle
 * 
 * Request Body:
 * {
 *   "parcelleId": "uuid",
 *   "options": {
 *     "includeBeforeAfter": boolean,
 *     "includeNDVITrend": boolean,
 *     "includeYieldPrediction": boolean,
 *     "baselineDate": "ISO 8601 datetime",
 *     "language": "fr" | "en"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "reportUrl": "string",
 *     "expiresAt": "ISO 8601 datetime",
 *     "fileName": "string",
 *     "complianceStatus": "compliant" | "non-compliant" | "requires-review"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    
    const validationResult = CertificationReportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errorResponse(`Invalid request: ${errors}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleId, options } = validationResult.data;

    // Step 2: Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Step 3: Authorize access to parcelle
    const accessCheck = await checkParcelleAccess(supabase, user.id, parcelleId);
    if (!accessCheck.hasAccess) {
      return errorResponse(
        accessCheck.error || 'Access denied',
        403,
        'FORBIDDEN'
      );
    }

    // Step 4: Gather required data
    console.log('Fetching parcelle data...');
    const parcelle = await fetchParcelleData(supabase, parcelleId);

    console.log('Fetching deforestation events...');
    const deforestation = await fetchDeforestationEvents(supabase, parcelleId);

    // Determine compliance status
    const complianceStatus = determineComplianceStatus(deforestation);

    // Fetch NDVI trend if requested (last 12 months)
    let ndviTrend: TemporalDataPoint[] | undefined;
    if (options.includeNDVITrend) {
      console.log('Fetching NDVI trend...');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      ndviTrend = await fetchNDVITrend(supabase, parcelleId, startDate, endDate);
    }

    // Fetch baseline and current imagery if requested
    let baselineImagery: ImageryData | undefined;
    let currentImagery: ImageryData | undefined;
    if (options.includeBeforeAfter) {
      console.log('Fetching baseline and current imagery...');
      baselineImagery = (await fetchBaselineImagery(supabase, parcelleId, options.baselineDate)) || undefined;
      currentImagery = (await fetchCurrentImagery(supabase, parcelleId)) || undefined;
    }

    // Fetch yield prediction if requested
    let yieldPrediction: YieldPrediction | undefined;
    if (options.includeYieldPrediction) {
      console.log('Fetching yield prediction...');
      yieldPrediction = (await fetchYieldPrediction(supabase, parcelleId)) || undefined;
    }

    // Get user profile for generatedBy field
    const { data: profile } = await supabase
      .from('profiles')
      .select('nom, prenom, email')
      .eq('id', user.id)
      .maybeSingle();

    const profileData = profile as any;
    const generatedBy = profileData
      ? `${profileData.prenom || ''} ${profileData.nom || ''}`.trim() || profileData.email || user.id
      : user.id;

    // Step 5: Prepare report data
    const reportData: CertificationReportData = {
      parcelle,
      complianceStatus,
      deforestation: deforestation.length > 0 ? deforestation : undefined,
      ndviTrend,
      baselineImagery,
      currentImagery,
      yieldPrediction,
      generatedBy,
    };

    // Step 6: Generate PDF report
    console.log('Generating PDF report...');
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable'); // Load autotable plugin
    
    // Use the exportService to generate the report
    // Note: The exportService.generateCertificationReport method handles PDF generation
    // and returns a storage URL, but we need to handle the upload ourselves
    // So we'll generate the PDF directly here
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Set document metadata
    doc.setProperties({
      title: `EUDR Certification Report - ${parcelle.code || parcelle.id}`,
      subject: 'EUDR Compliance Certification',
      author: 'CocoaTrack',
      keywords: 'EUDR, deforestation, NDVI, certification',
      creator: 'CocoaTrack Satellite Analysis System',
    });

    // Helper function to check if we need a new page
    const checkPageBreak = (currentY: number, requiredSpace: number): number => {
      if (currentY + requiredSpace > 280) {
        doc.addPage();
        return 20;
      }
      return currentY;
    };

    // Add content to PDF
    let yPos = 20;
    
    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('EUDR Certification Report', 105, yPos, { align: 'center' });
    yPos += 15;

    // Parcelle info section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Parcelle Information', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (parcelle.code) {
      doc.text(`Code: ${parcelle.code}`, 20, yPos);
      yPos += 6;
    }
    doc.text(`Surface: ${parcelle.surface_hectares.toFixed(2)} ha`, 20, yPos);
    yPos += 6;
    if (parcelle.village) {
      doc.text(`Village: ${parcelle.village}`, 20, yPos);
      yPos += 6;
    }
    if (parcelle.region) {
      doc.text(`Region: ${parcelle.region}`, 20, yPos);
      yPos += 6;
    }
    if (parcelle.planteur_name) {
      doc.text(`Planteur: ${parcelle.planteur_name}`, 20, yPos);
      yPos += 6;
    }
    yPos += 10;

    // Compliance status section
    yPos = checkPageBreak(yPos, 30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compliance Status', 20, yPos);
    yPos += 10;

    doc.setFontSize(12);
    const statusText = complianceStatus === 'compliant' ? 'COMPLIANT' :
                       complianceStatus === 'non-compliant' ? 'NON-COMPLIANT' :
                       'REQUIRES REVIEW';
    const statusColor: [number, number, number] = complianceStatus === 'compliant' ? [34, 197, 94] :
                        complianceStatus === 'non-compliant' ? [239, 68, 68] :
                        [251, 191, 36];
    doc.setTextColor(...statusColor);
    doc.text(statusText, 20, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Deforestation alerts: ${deforestation.length}`, 20, yPos);
    yPos += 15;

    // Deforestation details if any
    if (deforestation.length > 0) {
      yPos = checkPageBreak(yPos, 40);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Deforestation Alerts Details', 20, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      deforestation.slice(0, 5).forEach((alert, index) => {
        yPos = checkPageBreak(yPos, 20);
        doc.text(`Alert ${index + 1}:`, 20, yPos);
        yPos += 5;
        doc.text(`  Detection Date: ${alert.detectionDate.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US')}`, 20, yPos);
        yPos += 5;
        doc.text(`  NDVI Change: ${alert.ndviChange.toFixed(3)} (${alert.affectedAreaPercent.toFixed(1)}% of parcelle)`, 20, yPos);
        yPos += 5;
        doc.text(`  Status: ${alert.status}`, 20, yPos);
        yPos += 8;
      });

      if (deforestation.length > 5) {
        doc.text(`... and ${deforestation.length - 5} more alerts`, 20, yPos);
        yPos += 10;
      }
    }

    // NDVI Trend section (if requested and available)
    if (options.includeNDVITrend && ndviTrend && ndviTrend.length > 0) {
      yPos = checkPageBreak(yPos, 80);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('NDVI Trend Analysis', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Data points: ${ndviTrend.length}`, 20, yPos);
      yPos += 6;
      
      const avgNDVI = ndviTrend.reduce((sum, point) => sum + point.ndvi, 0) / ndviTrend.length;
      doc.text(`Average NDVI: ${avgNDVI.toFixed(3)}`, 20, yPos);
      yPos += 6;
      
      const minNDVI = Math.min(...ndviTrend.map(p => p.ndvi));
      const maxNDVI = Math.max(...ndviTrend.map(p => p.ndvi));
      doc.text(`Range: ${minNDVI.toFixed(3)} - ${maxNDVI.toFixed(3)}`, 20, yPos);
      yPos += 10;

      // Simple text-based trend chart
      doc.setFontSize(9);
      doc.text('Recent NDVI Values:', 20, yPos);
      yPos += 6;
      
      ndviTrend.slice(-10).forEach((point) => {
        const dateStr = point.date.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US', { 
          month: 'short', 
          year: 'numeric' 
        });
        const healthEmoji = point.healthStatus === 'excellent' ? '●' : 
                           point.healthStatus === 'good' ? '●' :
                           point.healthStatus === 'fair' ? '●' :
                           point.healthStatus === 'poor' ? '●' : '●';
        doc.text(`  ${dateStr}: ${point.ndvi.toFixed(3)} ${healthEmoji} ${point.healthStatus}`, 20, yPos);
        yPos += 5;
      });
      yPos += 10;
    }

    // Before/After Imagery section (if requested and available)
    if (options.includeBeforeAfter && (baselineImagery || currentImagery)) {
      yPos = checkPageBreak(yPos, 50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Satellite Imagery Comparison', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (baselineImagery) {
        doc.text(`Baseline Image (${options.baselineDate.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US')}):`, 20, yPos);
        yPos += 6;
        doc.text(`  Acquisition: ${baselineImagery.acquisitionDate.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US')}`, 20, yPos);
        yPos += 6;
        doc.text(`  Cloud Cover: ${baselineImagery.cloudCoverPercent.toFixed(1)}%`, 20, yPos);
        yPos += 6;
        doc.text(`  Source: ${baselineImagery.satelliteSource}`, 20, yPos);
        yPos += 10;
      } else {
        doc.text(`Baseline Image: Not available for reference date`, 20, yPos);
        yPos += 10;
      }

      if (currentImagery) {
        doc.text(`Current Image (Most Recent):`, 20, yPos);
        yPos += 6;
        doc.text(`  Acquisition: ${currentImagery.acquisitionDate.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US')}`, 20, yPos);
        yPos += 6;
        doc.text(`  Cloud Cover: ${currentImagery.cloudCoverPercent.toFixed(1)}%`, 20, yPos);
        yPos += 6;
        doc.text(`  Source: ${currentImagery.satelliteSource}`, 20, yPos);
        yPos += 10;
      } else {
        doc.text(`Current Image: Not available`, 20, yPos);
        yPos += 10;
      }

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Note: Actual satellite images are available in the web application.', 20, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 10;
    }

    // Yield Prediction section (if requested and available)
    if (options.includeYieldPrediction && yieldPrediction) {
      yPos = checkPageBreak(yPos, 50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Yield Prediction', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Harvest Season: ${yieldPrediction.harvestSeason}`, 20, yPos);
      yPos += 6;
      doc.text(`Predicted Yield: ${yieldPrediction.predictedYieldKgPerHa.toFixed(0)} kg/ha`, 20, yPos);
      yPos += 6;
      doc.text(`Confidence: ${yieldPrediction.confidenceLevel} (${yieldPrediction.confidenceIntervalLower.toFixed(0)} - ${yieldPrediction.confidenceIntervalUpper.toFixed(0)} kg/ha)`, 20, yPos);
      yPos += 6;
      doc.text(`Model Version: ${yieldPrediction.modelVersion}`, 20, yPos);
      yPos += 6;
      doc.text(`Prediction Date: ${yieldPrediction.predictionDate.toLocaleDateString(options.language === 'fr' ? 'fr-FR' : 'en-US')}`, 20, yPos);
      yPos += 10;

      if (yieldPrediction.actualYieldKgPerHa) {
        doc.text(`Actual Yield: ${yieldPrediction.actualYieldKgPerHa.toFixed(0)} kg/ha`, 20, yPos);
        const accuracy = ((1 - Math.abs(yieldPrediction.actualYieldKgPerHa - yieldPrediction.predictedYieldKgPerHa) / yieldPrediction.actualYieldKgPerHa) * 100);
        doc.text(`Prediction Accuracy: ${accuracy.toFixed(1)}%`, 20, yPos + 6);
        yPos += 12;
      }
    }

    // Footer with metadata
    yPos = checkPageBreak(yPos, 20);
    yPos = Math.max(yPos, 270); // Position near bottom of page
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString(options.language === 'fr' ? 'fr-FR' : 'en-US')}`, 20, yPos);
    doc.text(`By: ${generatedBy}`, 20, yPos + 5);
    doc.setTextColor(0, 0, 0);

    // Generate PDF blob
    const pdfBlob = doc.output('blob');

    // Step 7: Upload to Supabase Storage
    console.log('Uploading PDF to storage...');
    const fileName = `certification-report-${parcelleId}-${Date.now()}.pdf`;
    const reportUrl = await uploadPDFToStorage(supabase, pdfBlob, fileName);

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Step 8: Log report generation in audit log
    console.log('Logging report generation...');
    await logReportGeneration(supabase, user.id, parcelleId, reportUrl, options, request);

    // Step 9: Return report URL with expiration
    return NextResponse.json(
      {
        success: true,
        data: {
          reportUrl,
          expiresAt: expiresAt.toISOString(),
          fileName,
          complianceStatus,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/satellite/reports/certification:', error);
    
    // Check if it's a known error type
    if (error instanceof Error) {
      return errorResponse(
        error.message,
        500,
        'REPORT_GENERATION_ERROR'
      );
    }
    
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
