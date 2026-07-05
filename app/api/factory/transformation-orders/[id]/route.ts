import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { getOrder, updateOrderStatus } from '@/lib/services/factory/order-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  try {
    const order = await getOrder(auth.supabase as never, id);
    if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  if (!auth.canWrite) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }
  const { id } = await params;

  try {
    const { status } = await request.json();
    const order = await updateOrderStatus(auth.supabase as never, id, status, auth.user.id);
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
