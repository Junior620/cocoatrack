/**
 * GET /api/satellite/deforestation/batch
 *
 * Batch version of GET /api/satellite/deforestation?parcelleId=... (latest status)
 * Used by "Planteur 360" to avoid N+1 calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const ParcelleIdsSchema = z
  .object({
    parcelleIds: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean))
      .refine((arr) => arr.length > 0, 'parcelleIds cannot be empty')
      .refine((arr) => arr.length <= 50, 'Too many parcelleIds'),
  })
  .transform((data) => ({ parcelleIds: data.parcelleIds as unknown as string[] }));

type DeforestationEventRow = {
  id: string;
  parcelle_id: string;
  baseline_date: string;
  detection_date: string;
  baseline_ndvi: number;
  current_ndvi: number;
  ndvi_change: number;
  affected_area_hectares: number;
  affected_area_percent: number;
  status: 'pending' | 'acknowledged' | 'disputed' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgment_notes: string | null;
  disputed_by: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
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
    });

    if (!parseResult.success) {
      const msg = parseResult.error.errors.map((e) => e.message).join(', ');
      return errorResponse(`Invalid request: ${msg}`, 400, 'VALIDATION_ERROR');
    }

    const { parcelleIds } = parseResult.data as unknown as { parcelleIds: string[] };

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { role, cooperative_id } = await getUserRoleAndCoop(supabase, user.id);

    // Filter accessible parcelles (RLS should also apply, but we keep explicit rules to match existing endpoints).
    let accessibleIds = parcelleIds;

    if (role === 'planteur') {
      const { data } = await supabase
        .from('parcelles')
        .select('id')
        .eq('planteur_id', user.id)
        .in('id', parcelleIds);
      accessibleIds = (data || []).map((r) => r.id);
    } else if (role === 'cooperative_manager') {
      const { data } = await supabase
        .from('parcelles')
        .select('id, planteurs(cooperative_id)')
        .in('id', parcelleIds);

      accessibleIds = (data || [])
        .filter((r: any) => (r.planteurs?.cooperative_id ?? null) === cooperative_id)
        .map((r: any) => r.id);
    } else if (role !== 'admin' && role !== 'certification_auditor' && role !== 'agronomist') {
      accessibleIds = [];
    }

    if (accessibleIds.length === 0) {
      return NextResponse.json({ success: true, data: { latestByParcelleId: {}, recentEvents: [] } });
    }

    // Latest event per parcelle
    // distinct-on isn't directly expressible in supabase-js, so we use rpc-less raw query via `.select` + `order` + `in`:
    // For correctness, we rely on the SQL `distinct on` by using `from(...).select(...).in(...)` + `order` is not enough.
    // We'll use a Postgres function-like approach by selecting latest per parcelle in JS.
    const { data: events, error } = await supabase
      .from('deforestation_events')
      .select(
        'id, parcelle_id, baseline_date, detection_date, baseline_ndvi, current_ndvi, ndvi_change, affected_area_hectares, affected_area_percent, status, acknowledged_by, acknowledged_at, acknowledgment_notes, disputed_by, disputed_at, dispute_reason'
      )
      .in('parcelle_id', accessibleIds)
      .order('detection_date', { ascending: false })
      .limit(accessibleIds.length * 3);

    if (error) {
      return errorResponse(`Failed to retrieve deforestation events: ${error.message}`, 500, 'DEFORESTATION_NOT_FOUND');
    }

    const byId = new Map<string, DeforestationEventRow>();
    const allEvents: DeforestationEventRow[] = (events || []) as unknown as DeforestationEventRow[];

    for (const ev of allEvents) {
      if (!byId.has(ev.parcelle_id)) {
        byId.set(ev.parcelle_id, ev);
      }
    }

    // Recent events (global)
    const recentEvents = allEvents
      .sort((a, b) => new Date(b.detection_date).getTime() - new Date(a.detection_date).getTime())
      .slice(0, 15);

    const latestByParcelleId: Record<string, DeforestationEventRow> = {};
    for (const [parcelleId, ev] of byId.entries()) {
      latestByParcelleId[parcelleId] = ev;
    }

    const data = {
      latestByParcelleId,
      recentEvents,
      // simple compliance summary
      compliance: {
        totalParcelles: accessibleIds.length,
        compliantParcelles: accessibleIds.filter(
          (id) => latestByParcelleId[id] && !['pending', 'disputed'].includes(latestByParcelleId[id].status)
        ).length,
      },
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error in GET /api/satellite/deforestation/batch:', err);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

