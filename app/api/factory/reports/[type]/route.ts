import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { listOrders } from '@/lib/services/factory/order-service';
import { listStockItems } from '@/lib/services/factory/dashboard-service';
import { listReceipts } from '@/lib/services/factory/receipt-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  const { type } = await params;
  const format = request.nextUrl.searchParams.get('format');

  try {
    let rows: Record<string, unknown>[] = [];

    if (type === 'production') {
      const { data } = await listOrders(auth.supabase as never, auth.user.id, { pageSize: 500 });
      rows = (data as Record<string, unknown>[]) ?? [];
    } else if (type === 'yields') {
      const { data } = await listOrders(auth.supabase as never, auth.user.id, { pageSize: 500 });
      rows = ((data as Record<string, unknown>[]) ?? []).filter((o) =>
        ['completed', 'validated'].includes(o.status as string)
      );
    } else if (type === 'stocks') {
      rows = (await listStockItems(auth.supabase as never, auth.user.id)) as Record<string, unknown>[];
    } else if (type === 'traceability') {
      const { data } = await listReceipts(auth.supabase as never, auth.user.id, { pageSize: 200 });
      rows = (data as Record<string, unknown>[]) ?? [];
    } else {
      return NextResponse.json({ error: 'Type inconnu' }, { status: 404 });
    }

    if (format === 'csv') {
      if (rows.length === 0) {
        return new NextResponse('', { headers: { 'Content-Type': 'text/csv' } });
      }
      const keys = Object.keys(rows[0]);
      const csv = [
        keys.join(';'),
        ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(';')),
      ].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=factory-${type}.csv`,
        },
      });
    }

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
