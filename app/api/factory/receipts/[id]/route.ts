import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { getReceipt } from '@/lib/services/factory/receipt-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  try {
    const receipt = await getReceipt(auth.supabase as never, id);
    if (!receipt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    return NextResponse.json(receipt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
