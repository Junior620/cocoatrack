import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  getOperationRun,
  startOperationRun,
  completeOperationRun,
} from '@/lib/services/factory/operation-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  try {
    const run = await getOperationRun(auth.supabase as never, id);
    if (!run) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    return NextResponse.json(run);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  if (!auth.canWrite) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'start') {
      const run = await startOperationRun(auth.supabase as never, auth.user.id, body.run_id);
      return NextResponse.json(run);
    }
    if (action === 'complete') {
      const run = await completeOperationRun(
        auth.supabase as never,
        auth.user.id,
        body.run_id,
        body
      );
      return NextResponse.json(run);
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    const status = msg.includes('tolérance') || msg.includes('interdit') || msg.includes('requise') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
