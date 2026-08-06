import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  upsertDeliveryParcelleShares,
  listDeliveryParcelleShares,
} from '@/lib/services/factory/lot-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const deliveryId = request.nextUrl.searchParams.get('delivery_id');
  if (!deliveryId) {
    return NextResponse.json({ error: 'delivery_id requis' }, { status: 400 });
  }

  try {
    const shares = await listDeliveryParcelleShares(auth.supabase as never, deliveryId);
    return NextResponse.json({ data: shares });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { delivery_id, shares } = body as {
      delivery_id: string;
      shares: Array<{ parcelle_id: string; weight_kg: number; notes?: string }>;
    };
    if (!delivery_id || !Array.isArray(shares)) {
      return NextResponse.json({ error: 'delivery_id et shares requis' }, { status: 400 });
    }
    const data = await upsertDeliveryParcelleShares(
      auth.supabase as never,
      auth.user.id,
      delivery_id,
      shares
    );
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
