/**
 * POST /api/satellite/ndvi/backfill-coop
 *
 * Bulk EVI/NDVI backfill with optional NDJSON progress stream.
 *
 * Auth: session (admin / coop manager) OR Bearer CRON_SECRET
 *
 * Body:
 * {
 *   "scope": "all" | "coop" | "no-coop",
 *   "cooperativeId": "uuid",
 *   "months": 12,
 *   "limit": 50,
 *   "parcelleIds": ["uuid", ...],
 *   "stream": true   // optional NDJSON progress
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runEviBackfill } from '@/lib/satellite/jobs/evi-backfill.job';

export const maxDuration = 300;

const BodySchema = z.object({
  scope: z.enum(['all', 'coop', 'no-coop']).optional().default('all'),
  cooperativeId: z.string().uuid().optional(),
  months: z.number().int().min(1).max(36).optional().default(12),
  limit: z.number().int().min(1).max(200).optional().default(50),
  parcelleIds: z.array(z.string().uuid()).optional(),
  stream: z.boolean().optional().default(false),
});

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || 'UNKNOWN_ERROR' },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCron =
      !!cronSecret &&
      !!authHeader &&
      authHeader === `Bearer ${cronSecret}`;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    let scope = body.scope;
    let cooperativeId = body.cooperativeId;

    if (isCron) {
      if (scope === 'coop' && !cooperativeId) {
        return errorResponse(
          'cooperativeId required when scope=coop',
          400,
          'MISSING_COOP'
        );
      }
    } else {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, cooperative_id')
        .eq('id', user.id)
        .maybeSingle();

      const p = profile as { role: string; cooperative_id: string | null } | null;
      if (!p) {
        return errorResponse('Profile not found', 403, 'FORBIDDEN');
      }

      const isAdmin = p.role === 'admin';
      const isManager =
        p.role === 'cooperative_manager' || p.role === 'manager';

      if (!isAdmin && !isManager) {
        return errorResponse(
          'Only admin or cooperative managers can run backfill',
          403,
          'FORBIDDEN'
        );
      }

      if (!isAdmin) {
        if (!p.cooperative_id) {
          return errorResponse(
            'No cooperative linked to your profile',
            400,
            'MISSING_COOP'
          );
        }
        scope = 'coop';
        cooperativeId = p.cooperative_id;
      } else if (scope === 'coop') {
        cooperativeId = cooperativeId || p.cooperative_id || undefined;
        if (!cooperativeId) {
          return errorResponse(
            'cooperativeId required when scope=coop',
            400,
            'MISSING_COOP'
          );
        }
      }
    }

    console.log(
      `[BackfillEvi] Starting scope=${scope}` +
        (cooperativeId ? ` coop=${cooperativeId}` : '') +
        ` months=${body.months} limit=${body.limit} stream=${body.stream}`
    );

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) => {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          };
          try {
            const result = await runEviBackfill({
              scope,
              cooperativeId,
              months: body.months,
              limit: body.limit,
              parcelleIds: body.parcelleIds,
              onProgress: (event) => {
                send({ ...event, type: 'progress' });
              },
            });
            send({ type: 'done', success: true, data: result });
          } catch (err) {
            send({
              type: 'error',
              success: false,
              error: (err as Error).message,
            });
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const result = await runEviBackfill({
      scope,
      cooperativeId,
      months: body.months,
      limit: body.limit,
      parcelleIds: body.parcelleIds,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        error.errors.map((e) => e.message).join(', '),
        400,
        'VALIDATION_ERROR'
      );
    }
    console.error('[BackfillEvi] Error:', error);
    return errorResponse(
      (error as Error).message || 'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
}
