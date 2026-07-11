/**
 * POST /api/satellite/ndvi/backfill
 *
 * Calculates NDVI for the past N months from Google Earth Engine and stores
 * all results in the database. This populates the temporal analysis chart
 * with real historical satellite data.
 *
 * Sentinel-2 archives are available from June 2015 onwards, allowing you to
 * retrieve up to ~130 months of historical data (as of May 2026).
 *
 * Two modes:
 * - batch (default): single GEE session, parallel month processing, ~10x faster
 * - sequential: one GEE request per month, slower but more resilient
 *
 * Request Body:
 * {
 *   "parcelleId": "uuid",
 *   "months": 12,              // Optional, default 12, max ~130 (back to June 2015)
 *   "forceRecalculate": false, // Optional, recalculate months already in DB
 *   "mode": "batch"            // Optional: "batch" (default) | "sequential"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "calculated": 10,
 *     "skipped": 2,
 *     "failed": 0,
 *     "results": [...],
 *     "mode": "batch"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import { batchCalculateNDVI } from '@/lib/satellite/services/ndvi-batch.service';
import { z } from 'zod';
import type { MultiPolygon } from 'geojson';

// ============================================================================
// Request Validation
// ============================================================================

// Sentinel-2 data available since June 2015
const SENTINEL2_START_DATE = new Date('2015-06-01');
const MAX_MONTHS_AVAILABLE = Math.floor(
  (Date.now() - SENTINEL2_START_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
);

const BackfillRequestSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelle ID format'),
  months: z.number().int().min(1).max(MAX_MONTHS_AVAILABLE).optional().default(12),
  forceRecalculate: z.boolean().optional().default(false),
  mode: z.enum(['batch', 'sequential']).optional().default('batch'),
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request
    const body = await request.json();
    const validation = BackfillRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { parcelleId, months, forceRecalculate, mode } = validation.data;

    // Step 2: Authenticate
    // Accepts either:
    //   a) A valid Supabase session cookie (browser / normal users)
    //   b) Authorization: Bearer <CRON_SECRET> (CLI / cron jobs)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // Use service role client for cron (bypasses RLS), regular client for users
    const supabase = isCronAuth
      ? createServiceRoleSupabaseClient()
      : await createServerSupabaseClient();

    if (!isCronAuth) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // Step 3: Get parcelle geometry
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id, geometry')
      .eq('id', parcelleId)
      .single();

    if (parcelleError || !parcelle) {
      return NextResponse.json(
        { success: false, error: 'Parcelle not found' },
        { status: 404 }
      );
    }

    const geometry = parcelle.geometry as unknown as MultiPolygon;
    if (!geometry || geometry.type !== 'MultiPolygon') {
      return NextResponse.json(
        { success: false, error: 'Parcelle has no valid geometry' },
        { status: 422 }
      );
    }

    // Step 4: Build list of target dates (last day of each month, going back N months)
    const targetDates: Date[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      // Last day of each month, gives the most complete monthly window
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      targetDates.push(d);
    }

    console.log(
      `[Backfill] Starting NDVI backfill for parcelle ${parcelleId}, ` +
      `${months} months, mode=${mode}, ` +
      `range: ${targetDates[targetDates.length - 1].toISOString().split('T')[0]} → ${targetDates[0].toISOString().split('T')[0]}`
    );

    // ── BATCH MODE ──────────────────────────────────────────────────────────
    if (mode === 'batch') {
      const batchResult = await batchCalculateNDVI(
        parcelleId,
        geometry,
        targetDates,
        forceRecalculate,
        supabase  // pass the correct client (service role for cron, session for users)
      );

      return NextResponse.json({
        success: true,
        data: {
          parcelleId,
          monthsRequested: months,
          calculated: batchResult.calculated.length,
          skipped: batchResult.skipped.length,
          failed: batchResult.failed.length,
          results: batchResult.calculated,
          errors: batchResult.failed.length > 0 ? batchResult.failed : undefined,
          mode: 'batch',
        },
      });
    }

    // ── SEQUENTIAL MODE (fallback) ──────────────────────────────────────────
    const existingDates = new Set<string>();

    if (!forceRecalculate) {
      const { data: existing } = await supabase
        .from('ndvi_results')
        .select('calculation_date')
        .eq('parcelle_id', parcelleId)
        .gte('calculation_date', targetDates[targetDates.length - 1].toISOString())
        .lte('calculation_date', now.toISOString());

      if (existing) {
        for (const row of existing) {
          const d = new Date(row.calculation_date);
          existingDates.add(`${d.getFullYear()}-${d.getMonth()}`);
        }
      }
    }

    const results = [];
    let calculated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ date: string; reason: string }> = [];

    for (const date of targetDates) {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const dateLabel = date.toISOString().split('T')[0];

      if (existingDates.has(monthKey)) {
        console.log(`[Backfill] Skipping ${dateLabel}, already in database`);
        skipped++;
        continue;
      }

      try {
        console.log(`[Backfill] Calculating NDVI for ${dateLabel}...`);

        const result = await ndviService.calculateNDVI(
          parcelleId,
          geometry,
          date,
          { forceRecalculate, storeResult: true, generateRaster: false }
        );

        results.push({
          date: dateLabel,
          meanNDVI: result.meanNDVI,
          healthStatus: result.healthStatus,
          status: 'calculated',
        });

        calculated++;
        console.log(`[Backfill] ✅ ${dateLabel}: NDVI=${result.meanNDVI.toFixed(4)}, status=${result.healthStatus}`);

      } catch (error) {
        const reason = (error as Error).message;
        console.warn(`[Backfill] ⚠️ ${dateLabel}: Failed, ${reason}`);
        errors.push({ date: dateLabel, reason });
        failed++;
      }
    }

    console.log(`[Backfill] Complete: ${calculated} calculated, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({
      success: true,
      data: {
        parcelleId,
        monthsRequested: months,
        calculated,
        skipped,
        failed,
        results,
        errors: errors.length > 0 ? errors : undefined,
        mode: 'sequential',
      },
    });

  } catch (error) {
    console.error('[Backfill] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
