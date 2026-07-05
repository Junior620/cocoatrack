import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { validateOrder } from '@/lib/services/factory/order-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  if (!auth.canWrite) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;

  try {
    const order = await validateOrder(auth.supabase as never, auth.user.id, id);
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
