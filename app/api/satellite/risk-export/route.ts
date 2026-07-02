/**
 * API Route: Export Parcelles by Risk Category
 * 
 * GET /api/satellite/risk-export?category=high_risk&format=csv&region=...
 * 
 * Exports filtered list of parcelles based on risk assessment with full details:
 * - High risk parcelles (critical/poor health, declining, deforestation)
 * - Good parcelles (excellent/good health, stable/improving)
 * - Custom filters (region, surface, planteur, cooperative)
 * 
 * Formats:
 * - CSV: Detailed spreadsheet export
 * - JSON: Structured data for programmatic access
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  riskAssessmentService,
  RISK_CATEGORIES,
  type RiskCategory,
  type RiskFilterOptions,
} from '@/lib/satellite/services/risk-assessment.service';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import type { MultiPolygon } from 'geojson';
import { z } from 'zod';

/**
 * Maximum concurrent NDVI calculations to prevent overwhelming the system
 * Increased for large batch operations (handles up to 50 simultaneous API calls to GEE)
 */
const MAX_NDVI_CONCURRENCY = 50;

/**
 * Default maximum parcelles to process in one export (safety limit)
 * Set to unlimited for production use (can be overridden by query param)
 */
const DEFAULT_MAX_PARCELLES = 50000;

/**
 * Query parameters schema
 */
const RiskExportQuerySchema = z.object({
  // Risk categories to include (comma-separated)
  category: z
    .string()
    .optional()
    .transform((val) => val?.split(',').filter(Boolean)),
  
  // Export format
  format: z.enum(['csv', 'json']).default('csv'),
  
  // Calculate NDVI before export (default: true)
  calculateNDVI: z
    .string()
    .optional()
    .transform((val) => val !== 'false') // Default to true, only false if explicitly set
    .default('true'),
  
  // Max parcelles to process (safety limit)
  maxParcelles: z.coerce.number().optional().default(DEFAULT_MAX_PARCELLES),
  
  // Optional filters
  region: z.string().optional(),
  minSurface: z.coerce.number().optional(),
  maxSurface: z.coerce.number().optional(),
  hasDeforestation: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  planteurId: z.string().uuid().optional(),
  cooperativeId: z.string().uuid().optional(),
});

/**
 * GET /api/satellite/risk-export
 * 
 * Export parcelles filtered by risk assessment
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      category: searchParams.get('category') || undefined,
      format: searchParams.get('format') || 'csv',
      calculateNDVI: searchParams.get('calculateNDVI') || 'true',
      maxParcelles: searchParams.get('maxParcelles') || String(DEFAULT_MAX_PARCELLES),
      region: searchParams.get('region') || undefined,
      minSurface: searchParams.get('minSurface') || undefined,
      maxSurface: searchParams.get('maxSurface') || undefined,
      hasDeforestation: searchParams.get('hasDeforestation') || undefined,
      planteurId: searchParams.get('planteurId') || undefined,
      cooperativeId: searchParams.get('cooperativeId') || undefined,
    };

    const parsed = RiskExportQuerySchema.parse(queryParams);

    console.log(`[Risk Export] Starting export with calculateNDVI=${parsed.calculateNDVI}, maxParcelles=${parsed.maxParcelles}`);

    // Build filter options
    const filters: RiskFilterOptions = {
      riskCategories: parsed.category as RiskCategory[] | undefined,
      regions: parsed.region ? [parsed.region] : undefined,
      minSurfaceHectares: parsed.minSurface,
      maxSurfaceHectares: parsed.maxSurface,
      hasDeforestation: parsed.hasDeforestation,
      planteurId: parsed.planteurId,
      cooperativeId: parsed.cooperativeId,
    };

    // Step 1: Get list of parcelles to process (with basic filters applied)
    const parcellesToProcess = await getParcellesForExport(supabase, filters, parsed.maxParcelles);

    console.log(`[Risk Export] Found ${parcellesToProcess.length} parcelles to process`);

    // Step 2: Calculate NDVI for all parcelles if requested
    if (parsed.calculateNDVI && parcellesToProcess.length > 0) {
      console.log(`[Risk Export] Starting NDVI calculation for ${parcellesToProcess.length} parcelles`);
      await calculateNDVIBatch(supabase, parcellesToProcess);
      console.log(`[Risk Export] NDVI calculation complete`);
    }

    // Step 3: Get filtered parcelles with risk assessment
    const parcelles = await riskAssessmentService.getParcellesByRisk(
      filters,
      supabase,
      parsed.maxParcelles // Pass the limit to avoid Supabase default 1000 limit
    );

    console.log(`[Risk Export] Risk assessment complete, ${parcelles.length} parcelles match criteria`);

    // Return based on format
    if (parsed.format === 'json') {
      return NextResponse.json({
        count: parcelles.length,
        filters: filters,
        data: parcelles,
        exportDate: new Date().toISOString(),
        ndviCalculated: parsed.calculateNDVI,
      });
    }

    // CSV export
    const csv = generateCSV(parcelles);
    const filename = generateFilename(filters);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Risk export error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export risk data' },
      { status: 500 }
    );
  }
}

/**
 * Get list of parcelles for export with basic filters applied
 */
async function getParcellesForExport(
  supabase: any,
  filters: RiskFilterOptions,
  maxParcelles: number
): Promise<Array<{ id: string; geometry: MultiPolygon }>> {
  let query = supabase
    .from('parcelles')
    .select('id, geometry');

  // Apply basic filters
  if (filters.regions && filters.regions.length > 0) {
    query = query.in('region', filters.regions);
  }
  if (filters.minSurfaceHectares) {
    query = query.gte('surface_hectares', filters.minSurfaceHectares);
  }
  if (filters.maxSurfaceHectares) {
    query = query.lte('surface_hectares', filters.maxSurfaceHectares);
  }
  if (filters.planteurId) {
    query = query.eq('planteur_id', filters.planteurId);
  }

  // Apply limit
  query = query.limit(maxParcelles);

  const { data: parcelles, error } = await query;

  if (error || !parcelles) {
    throw new Error(`Failed to fetch parcelles: ${error?.message}`);
  }

  return parcelles.filter((p: any) => p.geometry && p.geometry.type === 'MultiPolygon');
}

/**
 * Calculate NDVI for a batch of parcelles with concurrency control
 */
async function calculateNDVIBatch(
  supabase: any,
  parcelles: Array<{ id: string; geometry: MultiPolygon }>
): Promise<void> {
  const date = new Date();
  const startTime = Date.now();
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  // Process parcelles with concurrency limit
  const executing: Promise<void>[] = [];
  let completed = 0;

  console.log(`[Risk Export NDVI] Starting batch calculation for ${parcelles.length} parcelles with concurrency ${MAX_NDVI_CONCURRENCY}`);

  for (const parcelle of parcelles) {
    const promise = calculateNDVIForParcelle(supabase, parcelle.id, parcelle.geometry, date)
      .then((result) => {
        results.push(result);
        completed++;
        
        // Log progress every 100 parcelles for large batches
        if (completed % 100 === 0 || completed === parcelles.length) {
          const percentage = Math.round(completed / parcelles.length * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = completed / elapsed;
          const remaining = parcelles.length - completed;
          const etaSeconds = remaining / rate;
          const etaMinutes = Math.round(etaSeconds / 60);
          console.log(`[Risk Export NDVI] Progress: ${completed}/${parcelles.length} (${percentage}%) - Rate: ${rate.toFixed(1)}/s - ETA: ${etaMinutes} min`);
        }
      })
      .finally(() => {
        executing.splice(executing.indexOf(promise), 1);
      });

    executing.push(promise);

    // Wait if we've hit the concurrency limit
    if (executing.length >= MAX_NDVI_CONCURRENCY) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining promises
  await Promise.all(executing);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`[Risk Export NDVI] Batch complete: ${successful} successful, ${failed} failed in ${totalTime} min`);
}

/**
 * Calculate NDVI for a single parcelle (with caching)
 */
async function calculateNDVIForParcelle(
  supabase: any,
  parcelleId: string,
  geometry: MultiPolygon,
  date: Date
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    // Check cache first
    const cached = await ndviService.getCachedNDVI(parcelleId, date, supabase);
    if (cached) {
      // Already calculated, skip
      return { id: parcelleId, success: true };
    }

    // Calculate NDVI
    const result = await ndviService.calculateNDVI(
      parcelleId,
      geometry,
      date,
      {
        forceRecalculate: false,
        storeResult: true, // Auto-save to database
        generateRaster: false, // Skip raster generation for batch operations
      }
    );

    return { id: parcelleId, success: true };
  } catch (error) {
    console.error(`[Risk Export NDVI] Failed for parcelle ${parcelleId}:`, error);
    return {
      id: parcelleId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate CSV content from parcelle risk data
 */
function generateCSV(parcelles: any[]): string {
  if (parcelles.length === 0) {
    return 'Aucune parcelle trouvée avec les critères spécifiés.\n';
  }

  // CSV headers (French labels)
  const headers = [
    'Code Parcelle',
    'Libellé',
    'Village',
    'Région',
    'Surface (ha)',
    'Code Planteur',
    'Nom Planteur',
    'Catégorie de Risque',
    'Statut Santé Actuel',
    'NDVI Actuel',
    'Tendance',
    'Taux de Changement',
    'Alertes Déforestation',
    'Changements Significatifs',
    'Dernière Analyse',
    'Points Temporels',
    'NDVI Moyen',
    'NDVI Min',
    'NDVI Max',
    'Facteurs de Risque',
    'Recommandations',
  ];

  // Build CSV rows
  const rows = parcelles.map((p) => {
    return [
      escapeCsvValue(p.code),
      escapeCsvValue(p.label),
      escapeCsvValue(p.village),
      escapeCsvValue(p.region),
      formatNumber(p.surface_hectares, 2),
      escapeCsvValue(p.planteur_code),
      escapeCsvValue(p.planteur_name),
      getRiskCategoryLabel(p.risk_category),
      getHealthStatusLabel(p.current_health_status),
      formatNumber(p.current_ndvi, 3),
      getTrendLabel(p.trend),
      formatNumber(p.trend_change_rate, 4),
      p.deforestation_alert_count || 0,
      p.significant_change_count || 0,
      p.last_calculation_date
        ? new Date(p.last_calculation_date).toLocaleDateString('fr-FR')
        : 'N/A',
      p.temporal_data_points || 0,
      formatNumber(p.average_ndvi, 3),
      formatNumber(p.min_ndvi, 3),
      formatNumber(p.max_ndvi, 3),
      escapeCsvValue(p.risk_factors),
      escapeCsvValue(p.recommendations),
    ].join(',');
  });

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format number with fixed decimals
 */
function formatNumber(value: any, decimals: number): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return Number(value).toFixed(decimals);
}

/**
 * Get French label for risk category
 */
function getRiskCategoryLabel(category: string | null): string {
  const labels: Record<string, string> = {
    high_risk: 'À Risque Élevé',
    medium_risk: 'À Surveiller',
    low_risk: 'Santé Correcte',
    excellent: 'Excellente Santé',
    unknown: 'Non Évalué',
  };
  return labels[category || 'unknown'] || category || 'N/A';
}

/**
 * Get French label for health status
 */
function getHealthStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Faible',
    critical: 'Critique',
  };
  return labels[status || ''] || status || 'N/A';
}

/**
 * Get French label for trend
 */
function getTrendLabel(trend: string | null): string {
  const labels: Record<string, string> = {
    improving: 'En amélioration',
    stable: 'Stable',
    declining: 'En déclin',
  };
  return labels[trend || ''] || trend || 'N/A';
}

/**
 * Generate filename based on filters
 */
function generateFilename(filters: RiskFilterOptions): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Determine category label for filename
  let categoryLabel = 'toutes';
  if (filters.riskCategories && filters.riskCategories.length > 0) {
    if (filters.riskCategories.includes(RISK_CATEGORIES.HIGH_RISK)) {
      categoryLabel = 'risque-eleve';
    } else if (filters.riskCategories.includes(RISK_CATEGORIES.EXCELLENT)) {
      categoryLabel = 'excellente-sante';
    } else {
      categoryLabel = filters.riskCategories[0].replace('_', '-');
    }
  }

  return `parcelles-${categoryLabel}-${timestamp}.csv`;
}
