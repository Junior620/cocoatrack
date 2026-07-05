import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { traceByLot, traceByOutputLot } from '@/lib/services/factory/traceability-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const lot = request.nextUrl.searchParams.get('lot');
  const output = request.nextUrl.searchParams.get('output');

  try {
    if (output) {
      const result = await traceByOutputLot(auth.supabase as never, auth.user.id, output);
      return NextResponse.json(result);
    }
    if (lot) {
      const result = await traceByLot(auth.supabase as never, auth.user.id, lot);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Paramètre lot ou output requis' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
