/**
 * NDVI Batch Service
 *
 * Retrieves NDVI/EVI for multiple months in a single GEE session.
 * Writes always use the service-role client when available (avoids RLS issues).
 * Reuses an existing calculation_date for the calendar month when present.
 */

import type { MultiPolygon } from 'geojson';
import { getEE, evaluateEE } from '../utils/gee-sdk';
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
} from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePixelEVIAuto } from '../evi';
import { calculatePixelNDMI } from '../ndmi';
import { calculatePixelNDWI } from '../ndwi';
import { calculatePixelSAVI } from '../savi';
import { calculatePixelNDRE } from '../ndre';

// ============================================================================
// Constants
// ============================================================================

const SENTINEL2_COLLECTION = 'COPERNICUS/S2_SR_HARMONIZED';
const SENTINEL2_RESOLUTION = 10;
export const CLOUD_COVER_MAX = 80;
export const CLOUD_COVER_FALLBACK = 95;

export type ImageryQuality = 'good' | 'acceptable' | 'degraded';

// ============================================================================
// Types
// ============================================================================

export interface BatchNDVIResult {
  date: string;
  acquisitionDate?: string;
  meanNDVI: number;
  meanEVI?: number | null;
  meanNDMI?: number | null;
  meanNDWI?: number | null;
  meanSAVI?: number | null;
  meanNDRE?: number | null;
  healthStatus: string;
  cloudCover?: number | null;
  imageryQuality?: ImageryQuality | null;
  cloudFallbackUsed?: boolean;
  source: 'batch-gee';
}

export interface BatchNDVIResponse {
  calculated: BatchNDVIResult[];
  skipped: string[];
  failed: Array<{ date: string; reason: string }>;
  repairedSiblings?: number;
}

/** Exported for tests — must match ndvi.service + DB check constraint */
export function getBatchHealthStatus(ndvi: number): string {
  if (ndvi >= 0.65) return 'excellent';
  if (ndvi >= 0.55) return 'good';
  if (ndvi >= 0.45) return 'fair';
  if (ndvi >= 0.30) return 'poor';
  return 'critical';
}

export function classifyImageryQuality(
  cloudCover: number | null | undefined,
  usedFallback: boolean
): ImageryQuality {
  if (cloudCover == null || isNaN(cloudCover)) {
    return usedFallback ? 'acceptable' : 'good';
  }
  if (cloudCover < CLOUD_COVER_MAX) return 'good';
  if (cloudCover < CLOUD_COVER_FALLBACK) return 'acceptable';
  return 'degraded';
}

/** UTC year-month key from a Date (0-based month) */
export function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/** Local calendar month key (for Date(y, m, day) targets) */
export function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Exclusive GEE filterDate window for a calendar month (UTC) */
export function geeMonthWindow(d: Date): { startISO: string; endISO: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const endExclusive = new Date(Date.UTC(y, m + 1, 1));
  return {
    startISO: start.toISOString().split('T')[0],
    endISO: endExclusive.toISOString().split('T')[0],
  };
}

/** Month is complete when EVI + NDMI + NDWI + SAVI + NDRE are present */
export function isMonthCompleteWithEvi(
  rows: Array<{
    mean_evi: number | null;
    mean_ndmi?: number | null;
    mean_ndwi?: number | null;
    mean_savi?: number | null;
    mean_ndre?: number | null;
    acquisition_date?: string | null;
  }>
): boolean {
  return rows.some(
    (r) =>
      r.mean_evi != null &&
      r.mean_ndmi != null &&
      r.mean_ndwi != null &&
      r.mean_savi != null &&
      r.mean_ndre != null
  );
}

function toGEEGeometry(geometry: MultiPolygon): Record<string, unknown> {
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates,
  };
}

async function resolveWriteClient(
  preferred?: SupabaseClient
): Promise<SupabaseClient> {
  try {
    return createServiceRoleSupabaseClient();
  } catch {
    if (preferred) return preferred;
    return await createServerSupabaseClient();
  }
}

/**
 * Calculate NDVI/EVI for a list of months in a single GEE session.
 */
export async function batchCalculateNDVI(
  parcelleId: string,
  geometry: MultiPolygon,
  targetDates: Date[],
  forceRecalculate = false,
  supabaseClient?: SupabaseClient
): Promise<BatchNDVIResponse> {
  const supabase = await resolveWriteClient(supabaseClient);

  const skipped: string[] = [];
  const datesToProcess: Date[] = [];
  let repairedSiblings = 0;

  type ExistingRow = {
    id: string;
    calculation_date: string;
    mean_evi: number | null;
    min_evi: number | null;
    max_evi: number | null;
    std_dev_evi: number | null;
    mean_ndmi: number | null;
    min_ndmi: number | null;
    max_ndmi: number | null;
    std_dev_ndmi: number | null;
    mean_ndwi: number | null;
    min_ndwi: number | null;
    max_ndwi: number | null;
    std_dev_ndwi: number | null;
    mean_savi: number | null;
    min_savi: number | null;
    max_savi: number | null;
    std_dev_savi: number | null;
    mean_ndre: number | null;
    min_ndre: number | null;
    max_ndre: number | null;
    std_dev_ndre: number | null;
    acquisition_date: string | null;
  };

  const byMonth = new Map<string, ExistingRow[]>();

  if (targetDates.length > 0) {
    const oldest = targetDates[targetDates.length - 1];
    const newest = targetDates[0];
    const rangeStart = oldest < newest ? oldest : newest;
    const { data: existing } = await (supabase as any)
      .from('ndvi_results')
      .select(
        'id, calculation_date, acquisition_date, mean_evi, min_evi, max_evi, std_dev_evi, mean_ndmi, min_ndmi, max_ndmi, std_dev_ndmi, mean_ndwi, min_ndwi, max_ndwi, std_dev_ndwi, mean_savi, min_savi, max_savi, std_dev_savi, mean_ndre, min_ndre, max_ndre, std_dev_ndre'
      )
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', rangeStart.toISOString())
      .lte('calculation_date', new Date().toISOString());

    for (const row of (existing ?? []) as ExistingRow[]) {
      const key = utcMonthKey(new Date(row.calculation_date));
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(row);
    }

    for (const rows of byMonth.values()) {
      const donorEvi = rows.find((r) => r.mean_evi != null);
      const donorNdmi = rows.find((r) => r.mean_ndmi != null);
      const donorNdwi = rows.find((r) => r.mean_ndwi != null);
      const donorSavi = rows.find((r) => r.mean_savi != null);
      const donorNdre = rows.find((r) => r.mean_ndre != null);
      for (const row of rows) {
        const patch: Record<string, number> = {};
        if (row.mean_evi == null && donorEvi) {
          patch.mean_evi = donorEvi.mean_evi!;
          patch.min_evi = donorEvi.min_evi ?? donorEvi.mean_evi!;
          patch.max_evi = donorEvi.max_evi ?? donorEvi.mean_evi!;
          patch.std_dev_evi = donorEvi.std_dev_evi ?? 0;
        }
        if (row.mean_ndmi == null && donorNdmi) {
          patch.mean_ndmi = donorNdmi.mean_ndmi!;
          patch.min_ndmi = donorNdmi.min_ndmi ?? donorNdmi.mean_ndmi!;
          patch.max_ndmi = donorNdmi.max_ndmi ?? donorNdmi.mean_ndmi!;
          patch.std_dev_ndmi = donorNdmi.std_dev_ndmi ?? 0;
        }
        if (row.mean_ndwi == null && donorNdwi) {
          patch.mean_ndwi = donorNdwi.mean_ndwi!;
          patch.min_ndwi = donorNdwi.min_ndwi ?? donorNdwi.mean_ndwi!;
          patch.max_ndwi = donorNdwi.max_ndwi ?? donorNdwi.mean_ndwi!;
          patch.std_dev_ndwi = donorNdwi.std_dev_ndwi ?? 0;
        }
        if (row.mean_savi == null && donorSavi) {
          patch.mean_savi = donorSavi.mean_savi!;
          patch.min_savi = donorSavi.min_savi ?? donorSavi.mean_savi!;
          patch.max_savi = donorSavi.max_savi ?? donorSavi.mean_savi!;
          patch.std_dev_savi = donorSavi.std_dev_savi ?? 0;
        }
        if (row.mean_ndre == null && donorNdre) {
          patch.mean_ndre = donorNdre.mean_ndre!;
          patch.min_ndre = donorNdre.min_ndre ?? donorNdre.mean_ndre!;
          patch.max_ndre = donorNdre.max_ndre ?? donorNdre.mean_ndre!;
          patch.std_dev_ndre = donorNdre.std_dev_ndre ?? 0;
        }
        if (Object.keys(patch).length === 0) continue;
        const { error } = await (supabase as any)
          .from('ndvi_results')
          .update(patch)
          .eq('id', row.id);
        if (!error) {
          if (patch.mean_evi != null) row.mean_evi = patch.mean_evi;
          if (patch.mean_ndmi != null) row.mean_ndmi = patch.mean_ndmi;
          if (patch.mean_ndwi != null) row.mean_ndwi = patch.mean_ndwi;
          if (patch.mean_savi != null) row.mean_savi = patch.mean_savi;
          if (patch.mean_ndre != null) row.mean_ndre = patch.mean_ndre;
          repairedSiblings++;
        }
      }
    }
    if (repairedSiblings > 0) {
      console.log(
        `[BatchNDVI] Repaired EVI/NDMI/NDWI/SAVI on ${repairedSiblings} sibling row(s) for parcelle ${parcelleId}`
      );
    }
  }

  if (!forceRecalculate && targetDates.length > 0) {
    const existingComplete = new Set<string>();
    for (const [key, rows] of byMonth) {
      if (isMonthCompleteWithEvi(rows)) existingComplete.add(key);
    }

    for (const d of targetDates) {
      const key = localMonthKey(d);
      if (existingComplete.has(key)) {
        skipped.push(d.toISOString().split('T')[0]);
      } else {
        datesToProcess.push(d);
      }
    }
  } else {
    datesToProcess.push(...targetDates);
  }

  if (datesToProcess.length === 0) {
    return { calculated: [], skipped, failed: [], repairedSiblings };
  }

  const ee = await getEE();
  const geeGeometry = ee.Geometry(toGEEGeometry(geometry));

  const CHUNK_SIZE = 12;
  const calculated: BatchNDVIResult[] = [];
  const failed: Array<{ date: string; reason: string }> = [];

  for (let i = 0; i < datesToProcess.length; i += CHUNK_SIZE) {
    const chunk = datesToProcess.slice(i, i + CHUNK_SIZE);

    console.log(
      `[BatchNDVI] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(datesToProcess.length / CHUNK_SIZE)} ` +
        `(${chunk.length} months: ${chunk[0].toISOString().split('T')[0]} → ${chunk[chunk.length - 1].toISOString().split('T')[0]})`
    );

    const chunkResults = await processChunk(ee, geeGeometry, chunk);

    for (const { date, result } of chunkResults) {
      const dateLabel = date.toISOString().split('T')[0];

      if ('error' in result) {
        console.warn(`[BatchNDVI] ⚠️ ${dateLabel}: ${result.error}`);
        failed.push({ date: dateLabel, reason: result.error });
        continue;
      }

      const { red, nir, blue, green, nirNarrow, swir, redEdge, acquisitionDate, cloudCover, usedFallback } =
        result;
      const sum = red + nir;
      const ndvi = sum < 1e-10 ? 0 : (nir - red) / sum;
      const evi = calculatePixelEVIAuto(nir, red, blue);
      const ndmi =
        swir != null && !isNaN(swir)
          ? calculatePixelNDMI(nirNarrow ?? nir, swir)
          : null;
      const ndwi =
        green != null && !isNaN(green)
          ? calculatePixelNDWI(green, nir)
          : null;
      const savi = calculatePixelSAVI(nir, red);
      const ndre =
        redEdge != null && !isNaN(redEdge) && nirNarrow != null && !isNaN(nirNarrow)
          ? calculatePixelNDRE(nirNarrow, redEdge)
          : null;
      const healthStatus = getBatchHealthStatus(ndvi);
      const imageryQuality = classifyImageryQuality(cloudCover, usedFallback);

      console.log(
        `[BatchNDVI] ✅ ${dateLabel}: NDVI=${ndvi.toFixed(4)}, EVI=${evi.toFixed(4)}, ` +
          `NDMI=${ndmi != null ? ndmi.toFixed(4) : 'n/a'}, ` +
          `NDWI=${ndwi != null ? ndwi.toFixed(4) : 'n/a'}, ` +
          `SAVI=${savi.toFixed(4)}, ` +
          `NDRE=${ndre != null ? ndre.toFixed(4) : 'n/a'}, ` +
          `status=${healthStatus}, capture=${acquisitionDate}, cloud=${cloudCover ?? 'n/a'}% (${imageryQuality})`
      );

      const monthStart = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), 1)
      );
      const monthEnd = new Date(
        Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
      );
      const monthKey = localMonthKey(date);

      const monthRows =
        byMonth.get(monthKey) ??
        byMonth.get(utcMonthKey(date)) ??
        [];

      // Prefer existing calculation_date (EVI+NDMI+acq > EVI > acq > any)
      const preferred = [...monthRows].sort((a, b) => {
        const score = (r: ExistingRow) =>
          (r.mean_evi != null ? 4 : 0) +
          (r.mean_ndmi != null ? 2 : 0) +
          (r.mean_ndwi != null ? 2 : 0) +
          (r.mean_savi != null ? 1 : 0) +
          (r.acquisition_date ? 1 : 0) +
          new Date(r.calculation_date).getTime() / 1e15;
        return score(b) - score(a);
      })[0];

      const calculationDateIso =
        preferred?.calculation_date ?? date.toISOString();

      const patch = {
        mean_ndvi: ndvi,
        min_ndvi: ndvi,
        max_ndvi: ndvi,
        std_dev_ndvi: 0,
        mean_evi: evi,
        min_evi: evi,
        max_evi: evi,
        std_dev_evi: 0,
        mean_ndmi: ndmi,
        min_ndmi: ndmi,
        max_ndmi: ndmi,
        std_dev_ndmi: ndmi != null ? 0 : null,
        mean_ndwi: ndwi,
        min_ndwi: ndwi,
        max_ndwi: ndwi,
        std_dev_ndwi: ndwi != null ? 0 : null,
        mean_savi: savi,
        min_savi: savi,
        max_savi: savi,
        std_dev_savi: 0,
        mean_ndre: ndre,
        min_ndre: ndre,
        max_ndre: ndre,
        std_dev_ndre: ndre != null ? 0 : null,
        health_status: healthStatus,
        acquisition_date: new Date(
          `${acquisitionDate}T12:00:00.000Z`
        ).toISOString(),
        cloud_cover: cloudCover,
        imagery_quality: imageryQuality,
      };

      // Propagate EVI/NDMI/NDWI/cloud onto every row in the month, then upsert preferred date
      const { error: updateError } = await (supabase as any)
        .from('ndvi_results')
        .update({
          mean_evi: evi,
          min_evi: evi,
          max_evi: evi,
          std_dev_evi: 0,
          mean_ndmi: ndmi,
          min_ndmi: ndmi,
          max_ndmi: ndmi,
          std_dev_ndmi: ndmi != null ? 0 : null,
          mean_ndwi: ndwi,
          min_ndwi: ndwi,
          max_ndwi: ndwi,
          std_dev_ndwi: ndwi != null ? 0 : null,
          mean_savi: savi,
          min_savi: savi,
          max_savi: savi,
          std_dev_savi: 0,
          mean_ndre: ndre,
          min_ndre: ndre,
          max_ndre: ndre,
          std_dev_ndre: ndre != null ? 0 : null,
          cloud_cover: cloudCover,
          imagery_quality: imageryQuality,
        })
        .eq('parcelle_id', parcelleId)
        .gte('calculation_date', monthStart.toISOString())
        .lte('calculation_date', monthEnd.toISOString());

      if (updateError) {
        console.warn(
          `[BatchNDVI] Month EVI/NDMI/NDWI/SAVI update warning for ${dateLabel}:`,
          updateError.message
        );
      }

      const { error: dbError } = await (supabase as any)
        .from('ndvi_results')
        .upsert(
          {
            parcelle_id: parcelleId,
            calculation_date: calculationDateIso,
            ...patch,
            ndvi_raster_url: null,
            imagery_id: null,
          },
          { onConflict: 'parcelle_id,calculation_date' }
        );

      if (dbError) {
        console.error(`[BatchNDVI] DB error for ${dateLabel}:`, dbError);
        failed.push({ date: dateLabel, reason: dbError.message });
        continue;
      }

      // Drop sibling duplicates in the same UTC month (keep preferred calculation_date)
      const { error: delError } = await (supabase as any)
        .from('ndvi_results')
        .delete()
        .eq('parcelle_id', parcelleId)
        .gte('calculation_date', monthStart.toISOString())
        .lte('calculation_date', monthEnd.toISOString())
        .neq('calculation_date', calculationDateIso);

      if (delError) {
        console.warn(
          `[BatchNDVI] Dedup delete warning for ${dateLabel}:`,
          delError.message
        );
      }

      calculated.push({
        date: dateLabel,
        acquisitionDate,
        meanNDVI: ndvi,
        meanEVI: evi,
        meanNDMI: ndmi,
        meanNDWI: ndwi,
        meanSAVI: savi,
        meanNDRE: ndre,
        healthStatus,
        cloudCover,
        imageryQuality,
        cloudFallbackUsed: usedFallback,
        source: 'batch-gee',
      });
    }
  }

  if (calculated.length > 0) {
    try {
      const { redisCacheService } = await import('./redis-cache.service');
      await redisCacheService.invalidateParcelleCache(parcelleId);
    } catch {
      // Redis not configured
    }
  }

  console.log(
    `[BatchNDVI] Complete: ${calculated.length} calculated, ${skipped.length} skipped, ${failed.length} failed`
  );

  return { calculated, skipped, failed, repairedSiblings };
}

// ============================================================================
// Chunk processor
// ============================================================================

interface MonthResult {
  date: Date;
  result:
    | {
        red: number;
        nir: number;
        blue: number | null;
        nirNarrow: number | null;
        swir: number | null;
        green: number | null;
        redEdge: number | null;
        acquisitionDate: string;
        cloudCover: number | null;
        usedFallback: boolean;
      }
    | { error: string };
}

async function processChunk(
  ee: Awaited<ReturnType<typeof getEE>>,
  geeGeometry: ReturnType<typeof ee.Geometry>,
  dates: Date[]
): Promise<MonthResult[]> {
  const monthWindows = dates.map((d) => ({
    date: d,
    ...geeMonthWindow(d),
  }));

  const promises = monthWindows.map(async ({ date, startISO, endISO }) => {
    const dateLabel = date.toISOString().split('T')[0];
    try {
      const tryCloud = async (maxCloud: number, usedFallback: boolean) => {
        const collection = ee
          .ImageCollection(SENTINEL2_COLLECTION)
          .filterDate(startISO, endISO)
          .filterBounds(geeGeometry)
          .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloud))
          .sort('CLOUDY_PIXEL_PERCENTAGE', true);

        const size = await evaluateEE<number>(collection.size());
        if (size === 0) return null;

        const image = collection.first();
        const meta = await evaluateEE<{ time?: number; cloud?: number }>(
          ee.Dictionary({
            time: image.get('system:time_start'),
            cloud: image.get('CLOUDY_PIXEL_PERCENTAGE'),
          })
        );
        const acquisitionDate = meta?.time
          ? new Date(meta.time).toISOString().split('T')[0]
          : dateLabel;
        const cloudCover =
          typeof meta?.cloud === 'number' ? meta.cloud : null;

        // NDVI/EVI/NDWI at 10 m (B2/B3/B4/B8)
        const spectral10 = image.select(['B2', 'B3', 'B4', 'B8']);
        let red: number | null = null;
        let nir: number | null = null;
        let blue: number | null = null;
        let green: number | null = null;

        try {
          const sampled = spectral10.sampleRectangle({
            region: geeGeometry,
            defaultValue: 0,
          });
          const sampledResult =
            await evaluateEE<Record<string, number[][]>>(sampled);
          const redArr: number[][] = sampledResult?.['B4'] ?? [];
          const nirArr: number[][] = sampledResult?.['B8'] ?? [];
          const blueArr: number[][] = sampledResult?.['B2'] ?? [];
          const greenArr: number[][] = sampledResult?.['B3'] ?? [];

          if (redArr.length > 0 && nirArr.length > 0) {
            const flat = (arr: number[][]) => arr.flat();
            const mean = (vals: number[]) =>
              vals.reduce((a, b) => a + b, 0) / vals.length;
            red = mean(flat(redArr));
            nir = mean(flat(nirArr));
            if (blueArr.length > 0) blue = mean(flat(blueArr));
            if (greenArr.length > 0) green = mean(flat(greenArr));
          }
        } catch {
          // fall through
        }

        if (red === null || nir === null) {
          const stats = spectral10.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: geeGeometry,
            scale: SENTINEL2_RESOLUTION,
            maxPixels: 1e9,
          });
          const reduceResult =
            await evaluateEE<Record<string, number>>(stats);
          red = reduceResult?.['B4'] ?? null;
          nir = reduceResult?.['B8'] ?? null;
          blue = reduceResult?.['B2'] ?? null;
          green = reduceResult?.['B3'] ?? null;
        }

        if (red === null || nir === null) return null;

        // NDMI (B8A+B11) + NDRE (B8A+B5) at 20 m
        let nirNarrow: number | null = null;
        let swir: number | null = null;
        let redEdge: number | null = null;
        const spectral20 = image.select(['B8A', 'B11', 'B5']);
        try {
          const stats20 = spectral20.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: geeGeometry,
            scale: 20,
            maxPixels: 1e9,
          });
          const r20 = await evaluateEE<Record<string, number>>(stats20);
          nirNarrow = r20?.['B8A'] ?? null;
          swir = r20?.['B11'] ?? null;
          redEdge = r20?.['B5'] ?? null;
        } catch {
          // NDMI/NDRE optional if 20 m bands unavailable
        }

        return {
          red,
          nir,
          blue,
          green,
          nirNarrow,
          swir,
          redEdge,
          acquisitionDate,
          cloudCover,
          usedFallback,
        };
      };

      const primary = await tryCloud(CLOUD_COVER_MAX, false);
      const resolved =
        primary ?? (await tryCloud(CLOUD_COVER_FALLBACK, true));

      if (!resolved) {
        return {
          date,
          result: {
            error: `No imagery available for ${startISO} → ${endISO} (cloud cover < ${CLOUD_COVER_FALLBACK}%)`,
          },
        };
      }

      return { date, result: resolved };
    } catch (err) {
      return { date, result: { error: (err as Error).message } };
    }
  });

  return Promise.all(promises);
}
