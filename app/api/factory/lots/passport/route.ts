import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  getCocoaLotByNumber,
  getLotPassport,
  changeLotStatus,
  buildGenealogyDownstream,
} from '@/lib/services/factory/lot-service';
import type { CocoaLotStatus } from '@/types/usinage';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const lot = request.nextUrl.searchParams.get('lot');
  const id = request.nextUrl.searchParams.get('id');
  const genealogy = request.nextUrl.searchParams.get('genealogy');

  try {
    let lotId = id;
    if (!lotId && lot) {
      const found = await getCocoaLotByNumber(auth.supabase as never, auth.user.id, lot);
      lotId = found?.id ?? null;
    }
    if (!lotId) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 });
    }

    if (genealogy === '1') {
      const tree = await buildGenealogyDownstream(auth.supabase as never, lotId);
      return NextResponse.json(tree);
    }

    const passport = await getLotPassport(auth.supabase as never, lotId);
    if (!passport) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 });
    return NextResponse.json(passport);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { lot_id, status, reason } = body as {
      lot_id: string;
      status: CocoaLotStatus;
      reason?: string;
    };
    if (!lot_id || !status) {
      return NextResponse.json({ error: 'lot_id et status requis' }, { status: 400 });
    }
    const lot = await changeLotStatus(auth.supabase as never, auth.user.id, lot_id, status, reason);
    return NextResponse.json(lot);
  } catch (e) {
    const status = e instanceof Error && e.message.includes('non opérable') ? 409 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status });
  }
}
