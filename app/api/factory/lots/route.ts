import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { listCocoaLots } from '@/lib/services/factory/lot-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const statusParam = request.nextUrl.searchParams.get('status');
  const search = request.nextUrl.searchParams.get('search') || undefined;
  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const data = await listCocoaLots(auth.supabase as never, auth.user.id, {
      status: statuses,
      search,
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
