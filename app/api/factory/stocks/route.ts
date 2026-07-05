import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { listStockItems } from '@/lib/services/factory/dashboard-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  try {
    const items = await listStockItems(auth.supabase as never, auth.user.id, {
      rawOnly: sp.get('raw') === '1',
      finishedOnly: sp.get('finished') === '1',
    });
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
