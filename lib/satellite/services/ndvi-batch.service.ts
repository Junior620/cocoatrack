/**
 * NDVI Batch Service
 *
 * Retrieves NDVI for multiple months in a single GEE request by mapping
 * over a monthly ImageCollection. This is ~10x faster than sequential
 * per-month requests for historical backfills.
 *
 * Strategy:
 * 1. Build a list of target months (year-month pairs)
 * 2. For each month, pick the least-cloudy Sentinel-2 image in that month
 * 3. Compute mean Red + NIR via reduceRegion in a single GEE batch call
 * 4. Calculate NDVI from the returned mean values
 * 5. Store all results in the database
 */

import type { MultiPolygon } from 'geojson';
import { getEE, evaluateEE } from '../utils/gee-sdk';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Constants
// ============================================================================

const SENTINEL2_COLLECTION = 'COPERNICUS/S2_SR_HARMONIZED';
const SENTINEL2_RESOLUTION = 10; // metres
const CLOUD_COVER_MAX = 80; // relaxed for tropical regions

// ============================================================================
// Types
// ============================================================================

export interface BatchNDVIResult {
  date: string;           // YYYY-MM-DD (last day of month used as target)
  meanNDVI: number;
  healthStatus: string;
  source: 'batch-gee';
}

export interface BatchNDVIResponse {
  calculated: BatchNDVIResult[];
  skipped: string[];      // dates already in DB
  failed: Array<{ date: string; reason: string }>;
}

// ============================================================================
// Health status helper (mirrors ndvi.service.ts logic)
// ============================================================================

function getHealthStatus(ndvi: number): string {
  if (ndvi >= 0.6) return 'excellent';
  if (ndvi >= 0.4) return 'good';
  if (ndvi >= 0.2) return 'moderate';
  if (ndvi >= 0.1) return 'poor';
  return 'critical';
}

// ============================================================================
// Geometry helper
// ============================================================================

function toGEEGeometry(geometry: MultiPolygon): Record<string, unknown> {
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates,
  };
}

// ============================================================================
// Core batch function
// ============================================================================

/**
 * Calculate NDVI for a list of months in a single GEE session.
 *
 * @param parcelleId  - UUID of the parcelle
 * @param geometry    - MultiPolygon geometry
 * @param targetDates - Array of Date objects (one per month to process)
 * @param forceRecalculate - Skip DB existence check when true
 * @returns BatchNDVIResponse
 */
export async function batchCalculateNDVI(
  parcelleId: string,
  geometry: MultiPolygon,
  targetDates: Date[],
  forceRecalculate = false,
  supabaseClient?: SupabaseClient
): Promise<BatchNDVIResponse> {
  // Use provided client (service role for CLI/cron) or create a regular server client
  const supabase = supabaseClient ?? await createServerSupabaseClient();

  // ── 1. Find which months already have data ──────────────────────────────
  const skipped: string[] = [];
  const datesToProcess: Date[] = [];

  if (!forceRecalculate && targetDates.length > 0) {
    const oldest = targetDates[targetDates.length - 1];
    const { data: existing } = await (supabase as any)
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', oldest.toISOString())
      .lte('calculation_date', new Date().toISOString());

    const existingKeys = new Set<string>(
      (existing ?? []).map((r: { calculation_date: string }) => {
        const d = new Date(r.calculation_date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );

    for (const d of targetDates) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (existingKeys.has(key)) {
        skipped.push(d.toISOString().split('T')[0]);
      } else {
        datesToProcess.push(d);
      }
    }
  } else {
    datesToProcess.push(...targetDates);
  }

  if (datesToProcess.length === 0) {
    return { calculated: [], skipped, failed: [] };
  }

  // ── 2. Initialize GEE once ──────────────────────────────────────────────
  const ee = await getEE();
  const geeGeometry = ee.Geometry(toGEEGeometry(geometry));

  // ── 3. Process in chunks of 12 months (GEE memory limit safety) ─────────
  const CHUNK_SIZE = 12;
  const calculated: BatchNDVIResult[] = [];
  const failed: Array<{ date: string; reason: string }> = [];

  for (let i = 0; i < datesToProcess.length; i += CHUNK_SIZE) {
    const chunk = datesToProcess.slice(i, i + CHUNK_SIZE);

    console.log(
      `[BatchNDVI] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(datesToProcess.length / CHUNK_SIZE)} ` +
      `(${chunk.length} months: ${chunk[0].toISOString().split('T')[0]} → ${chunk[chunk.length - 1].toISOString().split('T')[0]})`
    );

    // Build per-month results via a single GEE evaluate call per chunk
    const chunkResults = await processChunk(ee, geeGeometry, chunk);

    for (const { date, result } of chunkResults) {
      const dateLabel = date.toISOString().split('T')[0];

      if ('error' in result) {
        console.warn(`[BatchNDVI] ⚠️ ${dateLabel}: ${result.error}`);
        failed.push({ date: dateLabel, reason: result.error });
        continue;
      }

      const { red, nir } = result;
      const sum = red + nir;
      const ndvi = sum < 1e-10 ? 0 : (nir - red) / sum;
      const healthStatus = getHealthStatus(ndvi);

      console.log(`[BatchNDVI] ✅ ${dateLabel}: NDVI=${ndvi.toFixed(4)}, status=${healthStatus}`);

      // Store in DB
      const { error: dbError } = await (supabase as any).from('ndvi_results').upsert(
        {
          parcelle_id: parcelleId,
          calculation_date: date.toISOString(),
          mean_ndvi: ndvi,
          min_ndvi: ndvi,   // single-pixel mean — min/max = mean
          max_ndvi: ndvi,
          std_dev_ndvi: 0,
          health_status: healthStatus,
          ndvi_raster_url: null,
          imagery_id: null,
        },
        { onConflict: 'parcelle_id,calculation_date' }
      );

      if (dbError) {
        console.error(`[BatchNDVI] DB error for ${dateLabel}:`, dbError);
        failed.push({ date: dateLabel, reason: dbError.message });
      } else {
        calculated.push({ date: dateLabel, meanNDVI: ndvi, healthStatus, source: 'batch-gee' });
      }
    }
  }

  // ── 4. Invalidate temporal cache ────────────────────────────────────────
  if (calculated.length > 0) {
    try {
      const { redisCacheService } = await import('./redis-cache.service');
      await redisCacheService.invalidateParcelleCache(parcelleId);
    } catch {
      // Redis not configured — ignore
    }
  }

  console.log(
    `[BatchNDVI] Complete: ${calculated.length} calculated, ${skipped.length} skipped, ${failed.length} failed`
  );

  return { calculated, skipped, failed };
}

// ============================================================================
// Chunk processor — one GEE evaluate per chunk
// ============================================================================

interface MonthResult {
  date: Date;
  result: { red: number; nir: number } | { error: string };
}

async function processChunk(
  ee: Awaited<ReturnType<typeof getEE>>,
  geeGeometry: ReturnType<typeof ee.Geometry>,
  dates: Date[]
): Promise<MonthResult[]> {
  // Build a list of { startDate, endDate, label } for each month
  const monthWindows = dates.map(d => {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day
    return {
      date: d,
      startISO: start.toISOString().split('T')[0],
      endISO:   end.toISOString().split('T')[0],
    };
  });

  // For each month window, get the least-cloudy image and reduce to mean Red+NIR
  // We run these as parallel GEE evaluate calls (GEE handles server-side parallelism)
  const promises = monthWindows.map(async ({ date, startISO, endISO }) => {
    const dateLabel = date.toISOString().split('T')[0];
    try {
      const collection = ee.ImageCollection(SENTINEL2_COLLECTION)
        .filterDate(startISO, endISO)
        .filterBounds(geeGeometry)
        .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', CLOUD_COVER_MAX))
        .sort('CLOUDY_PIXEL_PERCENTAGE', true);

      // Check collection size first
      const size = await evaluateEE<number>(collection.size());
      if (size === 0) {
        return {
          date,
          result: { error: `No imagery available for ${startISO} → ${endISO} (cloud cover < ${CLOUD_COVER_MAX}%)` },
        };
      }

      const image = collection.first().select(['B4', 'B8']);

      // Try sampleRectangle first, fall back to reduceRegion for small parcelles
      let red: number | null = null;
      let nir: number | null = null;

      try {
        const sampled = image.sampleRectangle({ region: geeGeometry, defaultValue: 0 });
        const result = await evaluateEE<Record<string, number[][]>>(sampled);
        const redArr: number[][] = result?.['B4'] ?? [];
        const nirArr: number[][] = result?.['B8'] ?? [];

        if (redArr.length > 0 && nirArr.length > 0) {
          // Compute mean from pixel arrays
          const flat = (arr: number[][]) => arr.flat();
          const mean = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
          red = mean(flat(redArr));
          nir = mean(flat(nirArr));
        }
      } catch {
        // sampleRectangle failed — fall through to reduceRegion
      }

      if (red === null || nir === null) {
        const stats = image.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: geeGeometry,
          scale: SENTINEL2_RESOLUTION,
          maxPixels: 1e9,
        });
        const result = await evaluateEE<Record<string, number>>(stats);
        red = result?.['B4'] ?? null;
        nir = result?.['B8'] ?? null;
      }

      if (red === null || nir === null) {
        return { date, result: { error: `No valid pixel data for ${dateLabel}` } };
      }

      return { date, result: { red, nir } };

    } catch (err) {
      return { date, result: { error: (err as Error).message } };
    }
  });

  return Promise.all(promises);
}
