import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listStorageZones,
  listStorageLocations,
  createStorageZone,
  createStorageLocation,
  createPackagingUnits,
  listPackagingByLot,
  moveLotToLocation,
} from '@/lib/services/factory/wms-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const resource = request.nextUrl.searchParams.get('resource') ?? 'locations';
  const lotId = request.nextUrl.searchParams.get('lot_id');

  try {
    if (resource === 'zones') {
      return NextResponse.json({ data: await listStorageZones(auth.supabase as never, auth.user.id) });
    }
    if (resource === 'packaging' && lotId) {
      return NextResponse.json({ data: await listPackagingByLot(auth.supabase as never, lotId) });
    }
    return NextResponse.json({
      data: await listStorageLocations(auth.supabase as never, auth.user.id),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'create_zone') {
      const zone = await createStorageZone(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(zone, { status: 201 });
    }
    if (action === 'create_location') {
      const loc = await createStorageLocation(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(loc, { status: 201 });
    }
    if (action === 'package') {
      const units = await createPackagingUnits(auth.supabase as never, auth.user.id, body);
      return NextResponse.json({ data: units }, { status: 201 });
    }
    if (action === 'move') {
      await moveLotToLocation(auth.supabase as never, auth.user.id, body.lot_id, body.location_id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    const status = e instanceof Error && e.message.includes('non opérable') ? 409 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status });
  }
}
