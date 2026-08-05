/**
 * EVI backfill job — all parcelles, optional coop filter, or planteurs without coop.
 *
 * Uses service-role writes via batchCalculateNDVI. Supports progress callbacks
 * and a structured failure report.
 */

import type { MultiPolygon } from 'geojson';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { batchCalculateNDVI } from '../services/ndvi-batch.service';
import { redisCacheService } from '../services/redis-cache.service';

export type EviBackfillScope = 'all' | 'coop' | 'no-coop';

export interface EviBackfillJobOptions {
  scope?: EviBackfillScope;
  cooperativeId?: string;
  months?: number;
  limit?: number;
  parcelleIds?: string[];
  onlyMissingEvi?: boolean;
  /** Run SQL dedupe after each parcelle (default true) */
  dedupe?: boolean;
  onProgress?: (event: EviBackfillProgressEvent) => void | Promise<void>;
}

export interface EviBackfillProgressEvent {
  type: 'start' | 'parcelle' | 'done';
  current: number;
  total: number;
  parcelleId?: string;
  message?: string;
  parcelleResult?: EviBackfillParcelleResult;
}

export interface EviBackfillParcelleResult {
  parcelleId: string;
  calculated: number;
  skipped: number;
  failed: number;
  repairedSiblings?: number;
  errors?: Array<{ date: string; reason: string }>;
  error?: string;
}

export interface EviBackfillJobResult {
  scope: EviBackfillScope;
  cooperativeId: string | null;
  parcellesTargeted: number;
  parcellesProcessed: number;
  totalCalculated: number;
  totalSkipped: number;
  totalFailed: number;
  results: EviBackfillParcelleResult[];
  /** Aggregated failure report for operators */
  failureReport: {
    parcellesWithErrors: number;
    monthFailures: Array<{ parcelleId: string; date: string; reason: string }>;
    parcelleErrors: Array<{ parcelleId: string; error: string }>;
  };
}

/** Last day of each UTC month going back N months (aligned with batch GEE windows). */
export function buildMonthlyTargets(months: number, now = new Date()): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < months; i++) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    // Day 0 of next month = last day of target month
    dates.push(new Date(Date.UTC(y, m + 1, 0, 12, 0, 0)));
  }
  return dates;
}

export async function runEviBackfill(
  options: EviBackfillJobOptions = {}
): Promise<EviBackfillJobResult> {
  const months = options.months ?? 12;
  const limit = options.limit ?? 50;
  const onlyMissingEvi = options.onlyMissingEvi !== false;
  const dedupe = options.dedupe !== false;
  const scope: EviBackfillScope =
    options.scope ?? (options.cooperativeId ? 'coop' : 'all');

  if (scope === 'coop' && !options.cooperativeId) {
    throw new Error('cooperativeId is required when scope=coop');
  }

  const supabase = createServiceRoleSupabaseClient();
  const targetDates = buildMonthlyTargets(months);

  let parcelleQuery = supabase
    .from('parcelles')
    .select(
      `
      id,
      geometry,
      planteur:planteurs!inner(
        cooperative_id
      )
    `
    )
    .not('geometry', 'is', null)
    .eq('is_active', true)
    .limit(limit);

  if (scope === 'coop') {
    parcelleQuery = parcelleQuery.eq(
      'planteur.cooperative_id',
      options.cooperativeId!
    );
  } else if (scope === 'no-coop') {
    parcelleQuery = parcelleQuery.is('planteur.cooperative_id', null);
  }

  if (options.parcelleIds?.length) {
    parcelleQuery = parcelleQuery.in('id', options.parcelleIds);
  }

  const { data: parcelles, error } = await parcelleQuery;
  if (error) {
    throw new Error(`Failed to list parcelles: ${error.message}`);
  }

  const list = parcelles ?? [];
  const results: EviBackfillParcelleResult[] = [];
  let totalCalculated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const monthFailures: EviBackfillJobResult['failureReport']['monthFailures'] =
    [];
  const parcelleErrors: EviBackfillJobResult['failureReport']['parcelleErrors'] =
    [];

  await options.onProgress?.({
    type: 'start',
    current: 0,
    total: list.length,
    message: `Backfill EVI scope=${scope}, ${list.length} parcelles, ${months} mois`,
  });

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const parcelleId = (row as { id: string }).id;
    const geometry = (row as { geometry: MultiPolygon }).geometry;

    await options.onProgress?.({
      type: 'parcelle',
      current: i + 1,
      total: list.length,
      parcelleId,
      message: `Parcelle ${i + 1}/${list.length}`,
    });

    const oldest = targetDates[targetDates.length - 1];
    const { count } = await supabase
      .from('ndvi_results')
      .select('id', { count: 'exact', head: true })
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', oldest.toISOString())
      .or('mean_evi.is.null,mean_ndmi.is.null,mean_ndwi.is.null,mean_savi.is.null,mean_ndre.is.null');

    const { count: anyNdvi } = await supabase
      .from('ndvi_results')
      .select('id', { count: 'exact', head: true })
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', oldest.toISOString());

    const needsWork = (count ?? 0) > 0 || (anyNdvi ?? 0) === 0;
    if (onlyMissingEvi && !needsWork && !options.parcelleIds?.length) {
      const skippedResult: EviBackfillParcelleResult = {
        parcelleId,
        calculated: 0,
        skipped: targetDates.length,
        failed: 0,
      };
      results.push(skippedResult);
      totalSkipped += targetDates.length;
      await options.onProgress?.({
        type: 'parcelle',
        current: i + 1,
        total: list.length,
        parcelleId,
        parcelleResult: skippedResult,
        message: 'déjà complet (EVI présent)',
      });
      continue;
    }

    try {
      const batch = await batchCalculateNDVI(
        parcelleId,
        geometry,
        targetDates,
        false,
        supabase as any
      );

      if (dedupe) {
        try {
          await (supabase as any).rpc('dedupe_ndvi_results_by_month', {
            p_parcelle_id: parcelleId,
          });
        } catch (dedupeErr) {
          console.warn(
            `[EviBackfill] dedupe skipped for ${parcelleId}:`,
            (dedupeErr as Error).message
          );
        }
      }

      await redisCacheService.invalidateParcelleCache(parcelleId);

      const parcelleResult: EviBackfillParcelleResult = {
        parcelleId,
        calculated: batch.calculated.length,
        skipped: batch.skipped.length,
        failed: batch.failed.length,
        repairedSiblings: batch.repairedSiblings,
        errors: batch.failed.length > 0 ? batch.failed : undefined,
      };
      results.push(parcelleResult);
      totalCalculated += batch.calculated.length;
      totalSkipped += batch.skipped.length;
      totalFailed += batch.failed.length;

      for (const f of batch.failed) {
        monthFailures.push({
          parcelleId,
          date: f.date,
          reason: f.reason,
        });
      }

      await options.onProgress?.({
        type: 'parcelle',
        current: i + 1,
        total: list.length,
        parcelleId,
        parcelleResult,
        message: `${batch.calculated.length} calculés, ${batch.failed.length} échecs`,
      });
    } catch (err) {
      const message = (err as Error).message;
      const parcelleResult: EviBackfillParcelleResult = {
        parcelleId,
        calculated: 0,
        skipped: 0,
        failed: targetDates.length,
        error: message,
      };
      results.push(parcelleResult);
      totalFailed += targetDates.length;
      parcelleErrors.push({ parcelleId, error: message });
      await options.onProgress?.({
        type: 'parcelle',
        current: i + 1,
        total: list.length,
        parcelleId,
        parcelleResult,
        message: `erreur: ${message}`,
      });
    }
  }

  const result: EviBackfillJobResult = {
    scope,
    cooperativeId: options.cooperativeId ?? null,
    parcellesTargeted: list.length,
    parcellesProcessed: results.length,
    totalCalculated,
    totalSkipped,
    totalFailed,
    results,
    failureReport: {
      parcellesWithErrors:
        results.filter((r) => r.failed > 0 || !!r.error).length,
      monthFailures,
      parcelleErrors,
    },
  };

  await options.onProgress?.({
    type: 'done',
    current: list.length,
    total: list.length,
    message: `Terminé: ${totalCalculated} calculés, ${totalFailed} échecs`,
  });

  return result;
}

/** @deprecated use runEviBackfill({ scope: 'coop', cooperativeId }) */
export async function runCooperativeEviBackfill(options: {
  cooperativeId: string;
  months?: number;
  limit?: number;
  parcelleIds?: string[];
}): Promise<EviBackfillJobResult> {
  return runEviBackfill({
    scope: 'coop',
    cooperativeId: options.cooperativeId,
    months: options.months,
    limit: options.limit,
    parcelleIds: options.parcelleIds,
  });
}
