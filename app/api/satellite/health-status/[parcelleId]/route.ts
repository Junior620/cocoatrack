/**
 * GET /api/satellite/health-status/:parcelleId
 * 
 * Retrieve current health status for a parcelle.
 * 
 * This endpoint:
 * 1. Validates parcelleId parameter
 * 2. Authenticates the user
 * 3. Authorizes access to the parcelle
 * 4. Retrieves the most recent NDVI result from cache/database
 * 5. Calculates NDVI trend over the past 3 months
 * 6. Returns health status with NDVI value, trend, and recommendation
 * 7. Implements 24-hour caching via Cache-Control headers
 * 
 * Requirements: Task 2.2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
  type HealthStatus,
  type NDVITrend,
} from '@/lib/satellite/types';
import {
  detectEVIEarlyAlert,
  calculateNdviEviGap,
  interpretNdviEviGap,
  type EVIAlert,
} from '@/lib/satellite/evi-alerts';
import {
  detectNDMIEarlyAlert,
  NDMI_THRESHOLDS_CACAO,
  type NDMIAlert,
} from '@/lib/satellite/ndmi-alerts';
import {
  detectNDWIEarlyAlert,
  type NDWIAlert,
} from '@/lib/satellite/ndwi-alerts';
import {
  detectSAVIEarlyAlert,
  type SAVIAlert,
} from '@/lib/satellite/savi-alerts';
import {
  detectNDREEarlyAlert,
  interpretNDRELevel,
  type NDREAlert,
} from '@/lib/satellite/ndre-alerts';
import {
  combineVegetationAlerts,
  type CombinedVegetationAlert,
} from '@/lib/satellite/combined-alerts';
import {
  computeVisitPriority,
  type VisitPriorityResult,
} from '@/lib/satellite/visit-priority';
import { getCocoaSeasonContext } from '@/lib/satellite/seasonality';
import { interpretNDMILevel } from '@/lib/satellite/ndmi-levels';
import { interpretNDWILevel } from '@/lib/satellite/ndwi-levels';
import {
  shouldShowSavi,
  interpretSAVILevel,
} from '@/lib/satellite/savi-context';
import { getRainfallContextForPoint, type RainfallContext } from '@/lib/satellite/rainfall';
import {
  compareNdmiToVillage,
  type VillageNdmiComparison,
} from '@/lib/satellite/village-ndmi';
import {
  compareEviToVillage,
  compareSaviToVillage,
  type VillageIndexComparison,
} from '@/lib/satellite/village-index';
import { calibrateNdmiThresholdsFromFeedback } from '@/lib/satellite/ndmi-calibration';
import { applyRegionalNdmiThresholds } from '@/lib/satellite/regional-thresholds';
import {
  buildIndexLegendSentence,
  isIndexUnreliable,
} from '@/lib/satellite/index-legend';

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for parcelleId parameter
 */
const ParcelleIdSchema = z.string().uuid('Invalid parcelle ID format');

// ============================================================================
// Response Types
// ============================================================================

/**
 * Health status response data
 */
interface HealthStatusResponse {
  parcelleId: string;
  healthStatus: HealthStatus;
  meanNDVI: number;
  meanEVI: number | null;
  meanNDMI: number | null;
  meanNDWI: number | null;
  meanSAVI: number | null;
  meanNDRE: number | null;
  /** True when plantation age/density or sparse proxy says SAVI is useful */
  saviRelevant: boolean;
  anneePlantation: number | null;
  densiteArbresHa: number | null;
  /** NDVI − EVI gap (canopy density / saturation signal) */
  ndviEviGap: number | null;
  ndviEviGapLabel: string | null;
  ndviEviGapHint: string | null;
  /** Early EVI stress alert (complementary to NDVI health badge) */
  eviAlert: EVIAlert;
  /** Early hydric stress alert from NDMI */
  ndmiAlert: NDMIAlert;
  /** Early surface-wetness alert from NDWI */
  ndwiAlert: NDWIAlert;
  /** Weak recovery on young/sparse stands */
  saviAlert: SAVIAlert;
  /** Chlorophyll / red-edge */
  ndreAlert: NDREAlert;
  /** Combined EVI ∩ NDMI signal for field priority */
  combinedAlert: CombinedVegetationAlert;
  /** Unified visit queue rank */
  visitPriority: VisitPriorityResult;
  /** Human NDMI moisture band */
  ndmiBand: ReturnType<typeof interpretNDMILevel>;
  /** Human NDWI surface-wetness band */
  ndwiBand: ReturnType<typeof interpretNDWILevel>;
  /** Human SAVI band (only meaningful when saviRelevant) */
  saviBand: ReturnType<typeof interpretSAVILevel> | null;
  ndreBand: ReturnType<typeof interpretNDRELevel>;
  /** One-sentence métier legend */
  indexLegend: string;
  indicesUnreliable: boolean;
  season: ReturnType<typeof getCocoaSeasonContext>;
  /** NDMI vs village median (same calendar month) */
  villageNdmi: VillageNdmiComparison | null;
  villageEvi: VillageIndexComparison | null;
  villageSavi: VillageIndexComparison | null;
  /** Latest imagery quality if available on the row */
  imageryQuality: 'good' | 'acceptable' | 'degraded' | null;
  cloudCover: number | null;
  rainfall: RainfallContext;
  lastCalculationDate: Date;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changeRate: number; // NDVI units per month
    dataPoints: number;
  } | null;
  recommendation: string;
  cached: boolean;
  ndviRasterUrl: string | null;
  ndviRasterBounds: [number, number, number, number] | null;
}

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
      .single();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    // Type assertion for profile
    const userProfile = profile as { role: string; cooperative_id: string | null };

    // Admin has access to all parcelles
    if (userProfile.role === 'admin') {
      return { hasAccess: true };
    }

    // Get parcelle with planteur and cooperative info
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, planteur_id, planteurs(cooperative_id)')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      return { hasAccess: false, error: 'Parcelle not found' };
    }

    // Type assertion for parcelle
    const parcelleData = {
      id: parcelle.id,
      planteur_id: parcelle.planteur_id,
      cooperative_id: (parcelle.planteurs as { cooperative_id: string | null } | null)?.cooperative_id ?? null,
    };

    // Cooperative Manager: Check if parcelle is in their cooperative
    if (userProfile.role === 'cooperative_manager') {
      if (parcelleData.cooperative_id === userProfile.cooperative_id) {
        return { hasAccess: true };
      }
      return { hasAccess: false, error: 'Parcelle not in your cooperative' };
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
 * Get the most recent NDVI result for a parcelle
 */
async function getMostRecentNDVI(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<{
  meanNDVI: number;
  meanEVI: number | null;
  meanNDMI: number | null;
  meanNDWI: number | null;
  meanSAVI: number | null;
  meanNDRE: number | null;
  healthStatus: HealthStatus;
  calculationDate: Date;
  ndviRasterUrl: string | null;
  ndviRasterBounds: [number, number, number, number] | null;
  cloudCover: number | null;
  imageryQuality: 'good' | 'acceptable' | 'degraded' | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('ndvi_results')
      .select(
        'mean_ndvi, mean_evi, mean_ndmi, mean_ndwi, mean_savi, mean_ndre, health_status, calculation_date, ndvi_raster_url, ndvi_raster_bounds, cloud_cover, imagery_quality'
      )
      .eq('parcelle_id', parcelleId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getMostRecentNDVI] Supabase error:', error);
      return null;
    }

    if (!data) {
      console.log('[getMostRecentNDVI] No data found for parcelle:', parcelleId);
      return null;
    }

    const ndviData = data as unknown as {
      mean_ndvi: number;
      mean_evi: number | null;
      mean_ndmi: number | null;
      mean_ndwi: number | null;
      mean_savi: number | null;
      mean_ndre: number | null;
      health_status: string;
      calculation_date: string;
      ndvi_raster_url: string | null;
      ndvi_raster_bounds: [number, number, number, number] | null;
      cloud_cover: number | null;
      imagery_quality: 'good' | 'acceptable' | 'degraded' | null;
    };

    return {
      meanNDVI: Number(ndviData.mean_ndvi),
      meanEVI: ndviData.mean_evi != null ? Number(ndviData.mean_evi) : null,
      meanNDMI: ndviData.mean_ndmi != null ? Number(ndviData.mean_ndmi) : null,
      meanNDWI: ndviData.mean_ndwi != null ? Number(ndviData.mean_ndwi) : null,
      meanSAVI: ndviData.mean_savi != null ? Number(ndviData.mean_savi) : null,
      meanNDRE: ndviData.mean_ndre != null ? Number(ndviData.mean_ndre) : null,
      healthStatus: ndviData.health_status as HealthStatus,
      calculationDate: new Date(ndviData.calculation_date),
      ndviRasterUrl: ndviData.ndvi_raster_url,
      ndviRasterBounds: ndviData.ndvi_raster_bounds,
      cloudCover: ndviData.cloud_cover != null ? Number(ndviData.cloud_cover) : null,
      imageryQuality: ndviData.imagery_quality ?? null,
    };
  } catch (error) {
    console.error('Error retrieving most recent NDVI:', error);
    return null;
  }
}

/**
 * Peer NDMI values for the same village in the same calendar month (UTC).
 */
async function getVillageNdmiPeers(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string,
  calculationDate: Date
): Promise<{ village: string | null; peerValues: number[] }> {
  const { data: parcelle } = await supabase
    .from('parcelles')
    .select('id, village, planteur_id, planteurs(cooperative_id)')
    .eq('id', parcelleId)
    .maybeSingle();

  if (!parcelle) return { village: null, peerValues: [] };

  const village = (parcelle as { village: string | null }).village;
  if (!village) return { village: null, peerValues: [] };

  const coopId =
    (
      parcelle as {
        planteurs: { cooperative_id: string | null } | null;
      }
    ).planteurs?.cooperative_id ?? null;

  let peersQuery = supabase
    .from('parcelles')
    .select('id, village, planteur_id, planteurs!inner(cooperative_id)')
    .eq('village', village)
    .eq('is_active', true)
    .neq('id', parcelleId)
    .limit(80);

  if (coopId) {
    peersQuery = peersQuery.eq('planteurs.cooperative_id', coopId);
  }

  const { data: peers } = await peersQuery;
  const peerIds = ((peers || []) as Array<{ id: string }>).map((p) => p.id);
  const allIds = [parcelleId, ...peerIds];

  const y = calculationDate.getUTCFullYear();
  const m = calculationDate.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(y, m + 1, 1)).toISOString();

  const { data: rows } = await supabase
    .from('ndvi_results')
    .select('parcelle_id, mean_ndmi, calculation_date')
    .in('parcelle_id', allIds)
    .gte('calculation_date', monthStart)
    .lt('calculation_date', monthEnd)
    .not('mean_ndmi', 'is', null);

  const byParcelleDate = new Map<string, { d: string; v: number }>();
  for (const row of (rows || []) as Array<{
    parcelle_id: string;
    mean_ndmi: number;
    calculation_date: string;
  }>) {
    const prev = byParcelleDate.get(row.parcelle_id);
    if (!prev || row.calculation_date > prev.d) {
      byParcelleDate.set(row.parcelle_id, {
        d: row.calculation_date,
        v: Number(row.mean_ndmi),
      });
    }
  }

  return {
    village,
    peerValues: Array.from(byParcelleDate.values()).map((x) => x.v),
  };
}

/**
 * Recent NDVI/EVI/NDMI/NDWI series for early-warning (last ~4 months)
 */

/**
 * Peer index values for the same village in the same calendar month (UTC).
 */
async function getVillageIndexPeers(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string,
  calculationDate: Date,
  column: 'mean_ndmi' | 'mean_evi' | 'mean_savi'
): Promise<{ village: string | null; peerValues: number[] }> {
  const { data: parcelle } = await supabase
    .from('parcelles')
    .select('id, village, planteur_id, planteurs(cooperative_id)')
    .eq('id', parcelleId)
    .maybeSingle();

  if (!parcelle) return { village: null, peerValues: [] };

  const village = (parcelle as { village: string | null }).village;
  if (!village) return { village: null, peerValues: [] };

  const coopId =
    (
      parcelle as {
        planteurs: { cooperative_id: string | null } | null;
      }
    ).planteurs?.cooperative_id ?? null;

  let peersQuery = supabase
    .from('parcelles')
    .select('id, village, planteur_id, planteurs!inner(cooperative_id)')
    .eq('village', village)
    .eq('is_active', true)
    .neq('id', parcelleId)
    .limit(80);

  if (coopId) {
    peersQuery = peersQuery.eq('planteurs.cooperative_id', coopId);
  }

  const { data: peers } = await peersQuery;
  const peerIds = ((peers || []) as Array<{ id: string }>).map((p) => p.id);
  const allIds = [parcelleId, ...peerIds];

  const y = calculationDate.getUTCFullYear();
  const m = calculationDate.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(y, m + 1, 1)).toISOString();

  const { data: rows } = await supabase
    .from('ndvi_results')
    .select(`parcelle_id, ${column}, calculation_date`)
    .in('parcelle_id', allIds)
    .gte('calculation_date', monthStart)
    .lt('calculation_date', monthEnd)
    .not(column, 'is', null);

  const byParcelleDate = new Map<string, { d: string; v: number }>();
  for (const row of (rows || []) as Array<Record<string, unknown>>) {
    const pid = String(row.parcelle_id);
    const val = Number(row[column]);
    const d = String(row.calculation_date);
    const prev = byParcelleDate.get(pid);
    if (!prev || d > prev.d) {
      byParcelleDate.set(pid, { d, v: val });
    }
  }

  return {
    village,
    peerValues: Array.from(byParcelleDate.values()).map((x) => x.v),
  };
}

async function getRecentIndexSeries(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  parcelleId: string
): Promise<
  Array<{
    date: Date;
    ndvi: number;
    evi: number | null;
    ndmi: number | null;
    ndwi: number | null;
    savi: number | null;
    ndre: number | null;
  }>
> {
  const since = new Date();
  since.setMonth(since.getMonth() - 4);

  const { data, error } = await supabase
    .from('ndvi_results')
    .select(
      'calculation_date, mean_ndvi, mean_evi, mean_ndmi, mean_ndwi, mean_savi, mean_ndre'
    )
    .eq('parcelle_id', parcelleId)
    .gte('calculation_date', since.toISOString())
    .order('calculation_date', { ascending: true });

  if (error || !data) return [];

  return (data as Array<{
    calculation_date: string;
    mean_ndvi: number;
    mean_evi: number | null;
    mean_ndmi: number | null;
    mean_ndwi: number | null;
    mean_savi: number | null;
    mean_ndre: number | null;
  }>).map((row) => ({
    date: new Date(row.calculation_date),
    ndvi: Number(row.mean_ndvi),
    evi: row.mean_evi != null ? Number(row.mean_evi) : null,
    ndmi: row.mean_ndmi != null ? Number(row.mean_ndmi) : null,
    ndwi: row.mean_ndwi != null ? Number(row.mean_ndwi) : null,
    savi: row.mean_savi != null ? Number(row.mean_savi) : null,
    ndre: row.mean_ndre != null ? Number(row.mean_ndre) : null,
  }));
}

/**
 * Get NDVI trend for a parcelle (past 3 months)
 */
async function getNDVITrendSafe(
  parcelleId: string
): Promise<NDVITrend | null> {
  try {
    const trend = await ndviService.getNDVITrend(parcelleId);
    return trend;
  } catch (error) {
    // If insufficient data for trend analysis, return null
    if (error instanceof InsufficientDataError) {
      return null;
    }
    // Log other errors but don't fail the request
    console.error('Error calculating NDVI trend:', error);
    return null;
  }
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/satellite/health-status/:parcelleId
 * 
 * Retrieve current health status for a parcelle
 * 
 * Path Parameters:
 * - parcelleId: UUID of the parcelle
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "parcelleId": "uuid",
 *     "healthStatus": "good",
 *     "meanNDVI": 0.65,
 *     "lastCalculationDate": "2024-01-15T00:00:00Z",
 *     "trend": {
 *       "direction": "improving",
 *       "changeRate": 0.02,
 *       "dataPoints": 5
 *     },
 *     "recommendation": "Vegetation is healthy. Monitor regularly...",
 *     "cached": true
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parcelleId: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { parcelleId: parcelleIdParam } = await params;
    
    // Step 1: Validate parcelleId parameter
    const validationResult = ParcelleIdSchema.safeParse(parcelleIdParam);

    if (!validationResult.success) {
      return errorResponse(
        'Invalid parcelle ID format',
        400,
        'VALIDATION_ERROR'
      );
    }

    const parcelleId = validationResult.data;

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

    // Step 4: Retrieve the most recent NDVI result
    const recentNDVI = await getMostRecentNDVI(supabase, parcelleId);

    if (!recentNDVI) {
      return errorResponse(
        'No NDVI data available for this parcelle. Please calculate NDVI first.',
        404,
        'NDVI_NOT_FOUND'
      );
    }

    // Step 5: Calculate NDVI trend over the past 3 months
    const trend = await getNDVITrendSafe(parcelleId);

    // Step 5b: Plantation meta + calibrated alerts + village peers
    const { data: parcelleMeta } = await (supabase as any)
      .from('parcelles')
      .select(
        'annee_plantation, densite_arbres_ha, elevation_meters, centroid, village'
      )
      .eq('id', parcelleId)
      .maybeSingle();

    const anneePlantation =
      (parcelleMeta as { annee_plantation?: number | null } | null)
        ?.annee_plantation ?? null;
    const densiteArbresHa =
      (parcelleMeta as { densite_arbres_ha?: number | null } | null)
        ?.densite_arbres_ha != null
        ? Number(
            (parcelleMeta as { densite_arbres_ha: number }).densite_arbres_ha
          )
        : null;
    const region = null as string | null;
    const elevationMeters =
      (parcelleMeta as { elevation_meters?: number | null } | null)
        ?.elevation_meters != null
        ? Number(
            (parcelleMeta as { elevation_meters: number }).elevation_meters
          )
        : null;

    let feedbackAgg = { confirmed: 0, falsePositive: 0, unsure: 0 };
    try {
      const { data: fbRows } = await (supabase as any)
        .from('satellite_alert_feedback')
        .select('verdict')
        .eq('alert_kind', 'ndmi')
        .gte(
          'created_at',
          new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString()
        )
        .limit(200);
      for (const row of (fbRows || []) as Array<{ verdict: string }>) {
        if (row.verdict === 'true_positive') feedbackAgg.confirmed += 1;
        else if (row.verdict === 'false_positive')
          feedbackAgg.falsePositive += 1;
        else feedbackAgg.unsure += 1;
      }
    } catch {
      /* ignore */
    }

    const calibrated = applyRegionalNdmiThresholds(
      calibrateNdmiThresholdsFromFeedback(NDMI_THRESHOLDS_CACAO, feedbackAgg),
      { region, elevationMeters }
    );

    const series = await getRecentIndexSeries(supabase, parcelleId);
    const eviAlert = detectEVIEarlyAlert(series);
    const ndmiAlert = detectNDMIEarlyAlert(series, { thresholds: calibrated });
    const ndwiAlert = detectNDWIEarlyAlert(series);
    const saviRelevant = shouldShowSavi({
      meanNdvi: recentNDVI.meanNDVI,
      meanEvi: recentNDVI.meanEVI,
      anneePlantation,
      densiteArbresHa,
    });
    const saviAlert = detectSAVIEarlyAlert(
      series.map((p) => ({ date: p.date, savi: p.savi })),
      {
        meanNdvi: recentNDVI.meanNDVI,
        meanEvi: recentNDVI.meanEVI,
        anneePlantation,
        densiteArbresHa,
      }
    );
    const ndreAlert = detectNDREEarlyAlert(
      series.map((p) => ({ date: p.date, ndvi: p.ndvi, ndre: p.ndre }))
    );
    const combinedAlert = combineVegetationAlerts(eviAlert, ndmiAlert);
    const visitPriority = computeVisitPriority({
      combined: combinedAlert,
      ndwiAlert,
      saviAlert,
      ndreAlert,
      imageryQuality: recentNDVI.imageryQuality,
    });
    const ndviEviGap = calculateNdviEviGap(
      recentNDVI.meanNDVI,
      recentNDVI.meanEVI
    );
    const gapInterpretation = interpretNdviEviGap(ndviEviGap);

    let villageNdmi: VillageNdmiComparison | null = null;
    let villageEvi: VillageIndexComparison | null = null;
    let villageSavi: VillageIndexComparison | null = null;
    if (recentNDVI.meanNDMI != null) {
      const { village, peerValues } = await getVillageIndexPeers(
        supabase,
        parcelleId,
        recentNDVI.calculationDate,
        'mean_ndmi'
      );
      villageNdmi = compareNdmiToVillage(
        recentNDVI.meanNDMI,
        village,
        peerValues
      );
    }
    if (recentNDVI.meanEVI != null) {
      const { village, peerValues } = await getVillageIndexPeers(
        supabase,
        parcelleId,
        recentNDVI.calculationDate,
        'mean_evi'
      );
      villageEvi = compareEviToVillage(
        recentNDVI.meanEVI,
        village,
        peerValues
      );
    }
    if (saviRelevant && recentNDVI.meanSAVI != null) {
      const { village, peerValues } = await getVillageIndexPeers(
        supabase,
        parcelleId,
        recentNDVI.calculationDate,
        'mean_savi'
      );
      villageSavi = compareSaviToVillage(
        recentNDVI.meanSAVI,
        village,
        peerValues
      );
    }

    // Rainfall context (CHIRPS 30d, fallback season)
    let lon: number | null = null;
    let lat: number | null = null;
    try {
      const c = (parcelleMeta as { centroid?: unknown } | null)?.centroid as
        | { type?: string; coordinates?: [number, number] }
        | string
        | null;
      if (c && typeof c === 'object' && Array.isArray(c.coordinates)) {
        lon = Number(c.coordinates[0]);
        lat = Number(c.coordinates[1]);
      } else if (typeof c === 'string' && c.includes('(')) {
        // WKT POINT(lon lat)
        const m = /POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i.exec(c);
        if (m) {
          lon = Number(m[1]);
          lat = Number(m[2]);
        }
      }
    } catch {
      /* ignore */
    }
    const rainfall = await getRainfallContextForPoint(
      lon,
      lat,
      30,
      recentNDVI.calculationDate
    );

    const indexLegend = buildIndexLegendSentence({
      meanNdvi: recentNDVI.meanNDVI,
      meanEvi: recentNDVI.meanEVI,
      meanNdmi: recentNDVI.meanNDMI,
      meanNdwi: recentNDVI.meanNDWI,
      meanSavi: recentNDVI.meanSAVI,
      saviRelevant,
      imageryQuality: recentNDVI.imageryQuality,
    });

    // Step 6: Get recommendation based on health status
    const recommendation = ndviService.getRecommendation(recentNDVI.healthStatus);

    // Step 7: Build response
    const response: HealthStatusResponse = {
      parcelleId,
      healthStatus: recentNDVI.healthStatus,
      meanNDVI: recentNDVI.meanNDVI,
      meanEVI: recentNDVI.meanEVI,
      meanNDMI: recentNDVI.meanNDMI,
      meanNDWI: recentNDVI.meanNDWI,
      meanSAVI: recentNDVI.meanSAVI,
      meanNDRE: recentNDVI.meanNDRE,
      saviRelevant,
      anneePlantation,
      densiteArbresHa,
      ndviEviGap,
      ndviEviGapLabel: gapInterpretation.labelFr,
      ndviEviGapHint: gapInterpretation.hintFr,
      eviAlert,
      ndmiAlert,
      ndwiAlert,
      saviAlert,
      ndreAlert,
      combinedAlert,
      visitPriority,
      ndmiBand: interpretNDMILevel(recentNDVI.meanNDMI),
      ndwiBand: interpretNDWILevel(recentNDVI.meanNDWI),
      saviBand: saviRelevant
        ? interpretSAVILevel(recentNDVI.meanSAVI)
        : null,
      ndreBand: interpretNDRELevel(recentNDVI.meanNDRE),
      indexLegend,
      indicesUnreliable: isIndexUnreliable(recentNDVI.imageryQuality),
      season: getCocoaSeasonContext(),
      villageNdmi,
      villageEvi,
      villageSavi,
      imageryQuality: recentNDVI.imageryQuality,
      cloudCover: recentNDVI.cloudCover,
      rainfall,
      lastCalculationDate: recentNDVI.calculationDate,
      trend: trend
        ? {
            direction: trend.trend,
            changeRate: trend.changeRate,
            dataPoints: trend.dataPoints,
          }
        : null,
      recommendation,
      cached: true, // Data is retrieved from database cache
      ndviRasterUrl: recentNDVI.ndviRasterUrl,
      ndviRasterBounds: recentNDVI.ndviRasterBounds,
    };

    // Step 8: Return response with 24-hour cache headers
    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/satellite/health-status:', error);
    return errorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
