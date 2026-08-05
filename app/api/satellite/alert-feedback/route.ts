/**
 * POST /api/satellite/alert-feedback
 * GET  /api/satellite/alert-feedback?parcelleId=...
 *
 * Field-agent calibration feedback on early EVI/NDMI alerts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const PostSchema = z.object({
  parcelleId: z.string().uuid(),
  alertKind: z.enum(['ndmi', 'evi', 'combined']),
  alertLevel: z.enum(['watch', 'alert']),
  alertCode: z.string().optional().nullable(),
  verdict: z.enum(['true_positive', 'false_positive', 'uncertain']),
  note: z.string().max(1000).optional().nullable(),
  context: z.record(z.unknown()).optional(),
});

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || 'UNKNOWN_ERROR' },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    const parcelleId = new URL(request.url).searchParams.get('parcelleId');
    if (!parcelleId || !z.string().uuid().safeParse(parcelleId).success) {
      return errorResponse('parcelleId UUID required', 400, 'VALIDATION_ERROR');
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { data, error } = await (supabase as any)
      .from('satellite_alert_feedback')
      .select(
        'id, parcelle_id, alert_kind, alert_level, alert_code, verdict, note, created_at'
      )
      .eq('parcelle_id', parcelleId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[alert-feedback GET]', error);
      return errorResponse('Failed to load feedback', 500, 'DB_ERROR');
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[alert-feedback GET]', err);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.errors.map((e) => e.message).join(', '),
        400,
        'VALIDATION_ERROR'
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const {
      parcelleId,
      alertKind,
      alertLevel,
      alertCode,
      verdict,
      note,
      context,
    } = parsed.data;

    const { data, error } = await (supabase as any)
      .from('satellite_alert_feedback')
      .insert({
        parcelle_id: parcelleId,
        user_id: user.id,
        alert_kind: alertKind,
        alert_level: alertLevel,
        alert_code: alertCode ?? null,
        verdict,
        note: note ?? null,
        context: context ?? {},
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[alert-feedback POST]', error);
      return errorResponse(
        error.message.includes('satellite_alert_feedback')
          ? 'Table feedback absente — exécutez la migration 20260805160000'
          : 'Failed to save feedback',
        500,
        'DB_ERROR'
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('[alert-feedback POST]', err);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
