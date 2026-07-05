import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { searchUpstream } from '@/lib/services/factory/receipt-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const q = request.nextUrl.searchParams.get('q') || '';
  if (!q) return NextResponse.json({ waybills: [] });

  try {
    const result = await searchUpstream(auth.supabase as never, q);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
