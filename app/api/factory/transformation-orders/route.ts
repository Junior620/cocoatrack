import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listOrders,
  createOrder,
  getOrder,
  updateOrderStatus,
  saveProductionEntry,
  validateOrder,
} from '@/lib/services/factory/order-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  try {
    const result = await listOrders(auth.supabase as never, auth.user.id, {
      status: sp.get('status') || undefined,
      page: parseInt(sp.get('page') || '1'),
    });
    return NextResponse.json(result);
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
    const order = await createOrder(auth.supabase as never, auth.user.id, body);
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
