import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  createQualityControlAndStock,
} from '@/lib/services/factory/receipt-service';
import { listPendingQuality } from '@/lib/services/factory/dashboard-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  if (request.nextUrl.searchParams.get('pending') === '1') {
    try {
      const data = await listPendingQuality(auth.supabase as never, auth.user.id);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
    }
  }

  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  if (!auth.canWrite) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const qc = await createQualityControlAndStock(auth.supabase as never, auth.user.id, body);
    return NextResponse.json(qc, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
