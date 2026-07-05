import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { listReceipts, createReceipt } from '@/lib/services/factory/receipt-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  try {
    const result = await listReceipts(auth.supabase as never, auth.user.id, {
      status: sp.get('status') || undefined,
      search: sp.get('search') || undefined,
      page: parseInt(sp.get('page') || '1'),
      pageSize: parseInt(sp.get('pageSize') || '20'),
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
    const receipt = await createReceipt(auth.supabase as never, auth.user.id, body);
    return NextResponse.json(receipt, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
