import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
  proposeMaterials,
  reserveMaterials,
  startProductionOrder,
  updateProductionOrderStatus,
  closeProductionOrder,
} from '@/lib/services/factory/production-order-service';
import type { ProductionOrderStatus } from '@/types/mes';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const id = sp.get('id');
  try {
    if (id) {
      const order = await getProductionOrder(auth.supabase as never, id);
      if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
      return NextResponse.json(order);
    }
    const result = await listProductionOrders(auth.supabase as never, auth.user.id, {
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
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      const order = await createProductionOrder(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(order, { status: 201 });
    }
    if (action === 'propose_materials') {
      const result = await proposeMaterials(
        auth.supabase as never,
        auth.user.id,
        body.order_id,
        body.quantity_kg
      );
      return NextResponse.json(result);
    }
    if (action === 'reserve_materials') {
      const order = await reserveMaterials(
        auth.supabase as never,
        auth.user.id,
        body.order_id,
        body.materials
      );
      return NextResponse.json(order);
    }
    if (action === 'start') {
      const order = await startProductionOrder(auth.supabase as never, auth.user.id, body.order_id);
      return NextResponse.json(order);
    }
    if (action === 'close') {
      const order = await closeProductionOrder(
        auth.supabase as never,
        auth.user.id,
        body.order_id,
        body.variance_justification
      );
      return NextResponse.json(order);
    }
    if (action === 'status') {
      const order = await updateProductionOrderStatus(
        auth.supabase as never,
        body.order_id,
        body.status as ProductionOrderStatus,
        auth.user.id
      );
      return NextResponse.json(order);
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    const status =
      msg.includes('interdit') || msg.includes('insuffisant') || msg.includes('requise') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
