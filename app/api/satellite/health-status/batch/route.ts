/**
 * GET /api/satellite/health-status/batch
 *
 * Batch version of GET /api/satellite/health-status/:parcelleId
 * Goal: avoid N+1 calls from "Planteur 360" traceability view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import type { HealthStatus } from '@/lib/satellite/types';
import type { NDVITrend } from '@/lib/satellite/types';

const ParcelleIdsSchema = z
  .object({
    parcelleIds: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((x) => x.trim()))
      .refine((arr) => arr.length > 0, 'parcelleIds cannot be empty')
      .transform((arr) => arr.filter(Boolean))
      .refine((arr) => arr.length <= 50, 'Too many parcelleIds'),
    includeTrend: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true')
      .default('false'),
  })
  .transform((data) => ({
    parcelleIds: data.parcelleIds as unknown as string[],
    includeTrend: data.includeTrend as unknown as boolean,
  }));

type BatchHealthStatusItem = {
  parcelleId: string;
  healthStatus: HealthStatus;
  meanNDVI: number;
  lastCalculationDate: Date;
  trend: null | NDVITrend;
  recommendation: string;
  cached: boolean;
  ndviRasterUrl: string | null;
  ndviRasterBounds: [number, number, number, number] | null;
};

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || 'UNKNOWN_ERROR' },
    { status }
  );
}

async function getUserRoleAndCoop(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, cooperative_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) return { role: 'unknown', cooperative_id: null as string | null };
  const p = profile as { role: string; cooperative_id: string | null };
  return { role: p.role, cooperative_id: p.cooperative_id };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = ParcelleIdsSchema.safeParse({
      parcelleIds: searchParams.get('parcelleIds') || '',
      includeTrend: searchParams.get('includeTrend') ?? 'false',
    });

    if (!parseResult.success) {
      const msg = parseResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${msg}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleIds, includeTrend } = parseResult.data as unknown as {
      parcelleIds: string[];
      includeTrend: boolean;
    };

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { role, cooperative_id } = await getUserRoleAndCoop(supabase, user.id);

    // Filter accessible parcelles in SQL (RLS should also apply, but we keep explicit filters
    // to match existing access logic).
    // Note: parcelles is joined to planteurs for cooperative_id filtering.
    let accessibleIds = parcelleIds;

    if (role === 'planteur') {
      const { data } = await supabase
        .from('parcelles')
        .select('id')
        .eq('planteur_id', user.id)
        .in('id', parcelleIds);
      accessibleIds = (data || []).map((r: { id: string }) => r.id);
    } else if (role === 'cooperative_manager') {
      const { data } = await supabase
        .from('parcelles')
        .select('id, planteurs(cooperative_id)')
        .in('id', parcelleIds);

      accessibleIds = (data || [])
        .filter((r: any) => (r.planteurs?.cooperative_id ?? null) === cooperative_id)
        .map((r: any) => r.id);
    }

    if (accessibleIds.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    // Latest NDVI per parcelle
    const maxRows = Math.max(1, parcelleIds.length * 3);
    const { data: latestRows, error: latestError } = await supabase
      .from('ndvi_results')
      .select(
        'parcelle_id, mean_ndvi, health_status, calculation_date, ndvi_raster_url, ndvi_raster_bounds'
      )
      .in('parcelle_id', accessibleIds)
      .order('calculation_date', { ascending: false })
      .limit(maxRows);

    if (latestError) {
      return errorResponse(
        `Failed to retrieve NDVI: ${latestError.message}`,
        500,
        'NDVI_NOT_FOUND'
      );
    }

    // distinct by parcelle_id keeping the first row (already ordered desc)
    const byId = new Map<string, (typeof latestRows)[number]>();
    for (const row of latestRows || []) {
      const r = row as unknown as {
        parcelle_id: string;
        mean_ndvi: number;
        health_status: string;
        calculation_date: string;
        ndvi_raster_url: string | null;
        ndvi_raster_bounds: [number, number, number, number] | null;
      };
      if (!byId.has(r.parcelle_id)) byId.set(r.parcelle_id, row);
    }

    const baseItems = Array.from(byId.entries()).map(([parcelleId, row]) => {
      const r = row as unknown as {
        parcelle_id: string;
        mean_ndvi: number;
        health_status: string;
        calculation_date: string;
        ndvi_raster_url: string | null;
        ndvi_raster_bounds: [number, number, number, number] | null;
      };

      const recommendation = ndviService.getRecommendation(
        r.health_status as HealthStatus
      );

      const item: BatchHealthStatusItem = {
        parcelleId,
        healthStatus: r.health_status as HealthStatus,
        meanNDVI: Number(r.mean_ndvi),
        lastCalculationDate: new Date(r.calculation_date),
        trend: null,
        recommendation,
        cached: true,
        ndviRasterUrl: r.ndvi_raster_url,
        ndviRasterBounds: r.ndvi_raster_bounds,
      };

      return item;
    });

    // Optional: trend for up to 10 parcels to avoid heavy load
    if (includeTrend) {
      const limited = baseItems.slice(0, 10);
      for (const it of limited) {
        try {
          const trend = await ndviService.getNDVITrend(it.parcelleId);
          // Keep NDVITrend shape (property name: `trend`) to match our types.
          it.trend = trend ? trend : null;
        } catch {
          it.trend = null;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: baseItems,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (err) {
    console.error('Unexpected error in GET /api/satellite/health-status/batch:', err);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

