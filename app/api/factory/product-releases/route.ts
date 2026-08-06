import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listProductReleases,
  decideProductRelease,
} from '@/lib/services/factory/release-service';
import type { ProductReleaseStatus } from '@/types/mes';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const data = await listProductReleases(auth.supabase as never, auth.user.id, { status });
    return NextResponse.json({ data });
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
    if (body.action !== 'decide') {
      return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
    }
    const release = await decideProductRelease(
      auth.supabase as never,
      auth.user.id,
      body.release_id,
      body.status as Exclude<ProductReleaseStatus, 'pending'>,
      body.decision_notes
    );
    return NextResponse.json(release);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
