import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listTanks,
  getTank,
  createTank,
  updateTankStatus,
  fillTank,
  emptyTank,
  transferTank,
  listTankMovements,
} from '@/lib/services/factory/tank-service';
import type { TankStatus } from '@/types/mes';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const id = sp.get('id');
  const movements = sp.get('movements');

  try {
    if (id && movements === '1') {
      const data = await listTankMovements(auth.supabase as never, id);
      return NextResponse.json({ data });
    }
    if (id) {
      const tank = await getTank(auth.supabase as never, id);
      if (!tank) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
      return NextResponse.json(tank);
    }
    const data = await listTanks(auth.supabase as never, auth.user.id);
    return NextResponse.json({ data });
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
      const tank = await createTank(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(tank, { status: 201 });
    }
    if (action === 'status') {
      const tank = await updateTankStatus(
        auth.supabase as never,
        body.tank_id,
        body.status as TankStatus,
        body
      );
      return NextResponse.json(tank);
    }
    if (action === 'fill') {
      const tank = await fillTank(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(tank);
    }
    if (action === 'empty') {
      const tank = await emptyTank(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(tank);
    }
    if (action === 'transfer') {
      const result = await transferTank(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    const status = msg.includes('Capacité') || msg.includes('indisponible') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
