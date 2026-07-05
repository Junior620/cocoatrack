import { NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { listProductionLines } from '@/lib/services/factory/dashboard-service';

export async function GET() {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  try {
    const data = await listProductionLines(auth.supabase as never, auth.user.id);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
