import type { SupabaseClient } from '@supabase/supabase-js';
import type { TraceabilityResult } from '@/types/factory';
import { resolveFactorySiteId } from './factory-context';
import {
  getCocoaLotByNumber,
  getLotPassport,
  buildGenealogyDownstream,
} from './lot-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

async function enrichWithParcelles(
  supabase: UntypedDb,
  receipt: Record<string, unknown> | null,
  cocoaLotId?: string | null
): Promise<TraceabilityResult['parcelles']> {
  const parcelles: NonNullable<TraceabilityResult['parcelles']> = [];

  if (cocoaLotId) {
    const { data: sources } = await supabase
      .from('lot_sources')
      .select('weight_kg, parcelle:parcelles(id, code, label, planteur_id)')
      .eq('lot_id', cocoaLotId)
      .not('parcelle_id', 'is', null);
    for (const s of sources ?? []) {
      const p = s.parcelle as unknown as {
        id: string;
        code: string;
        label: string | null;
        planteur_id: string | null;
      } | null;
      if (p) {
        parcelles.push({
          id: p.id,
          code: p.code,
          label: p.label,
          weight_kg: Number(s.weight_kg),
          planteur_id: p.planteur_id,
        });
      }
    }
  }

  const deliveryId = receipt?.delivery_id as string | undefined;
  if (deliveryId && parcelles.length === 0) {
    const { data: shares } = await supabase
      .from('delivery_parcelle_shares')
      .select('weight_kg, parcelle:parcelles(id, code, label, planteur_id)')
      .eq('delivery_id', deliveryId);
    for (const s of shares ?? []) {
      const p = s.parcelle as unknown as {
        id: string;
        code: string;
        label: string | null;
        planteur_id: string | null;
      } | null;
      if (p) {
        parcelles.push({
          id: p.id,
          code: p.code,
          label: p.label,
          weight_kg: Number(s.weight_kg),
          planteur_id: p.planteur_id,
        });
      }
    }
  }

  return parcelles;
}

export async function traceByLot(
  supabase: UntypedDb,
  userId: string,
  lotReference: string
): Promise<TraceabilityResult> {
  await resolveFactorySiteId(supabase, userId);

  // Prefer cocoa_lots unified model
  const cocoaLot = await getCocoaLotByNumber(supabase, userId, lotReference).catch(() => null);
  if (cocoaLot) {
    const passport = await getLotPassport(supabase, cocoaLot.id);
    const genealogy = await buildGenealogyDownstream(supabase, cocoaLot.id);
    const receipt = passport?.receipt as Record<string, unknown> | null;
    const parcelles = await enrichWithParcelles(supabase, receipt, cocoaLot.id);

    let quality_control = passport?.quality ?? null;
    let orders: unknown[] = [];
    let outputs: unknown[] = [];
    let stock_items: unknown[] = [];

    if (cocoaLot.source_stock_item_id) {
      const { data: si } = await supabase
        .from('stock_items')
        .select('*, product_type:product_types(*)')
        .eq('id', cocoaLot.source_stock_item_id);
      stock_items = si ?? [];
    }

    const { data: stockByLot } = await supabase
      .from('stock_items')
      .select('*, product_type:product_types(*), transformation_order_id')
      .eq('cocoa_lot_id', cocoaLot.id);
    if (stockByLot?.length) stock_items = stockByLot;

    const orderIds = [
      ...new Set(
        (stock_items as Array<{ transformation_order_id?: string }>)
          .map((i) => i.transformation_order_id)
          .filter(Boolean) as string[]
      ),
    ];
    if (orderIds.length) {
      const { data: o } = await supabase
        .from('transformation_orders')
        .select('*, inputs:transformation_inputs(*), outputs:transformation_outputs(*), losses:transformation_losses(*)')
        .in('id', orderIds);
      orders = o ?? [];
      const { data: out } = await supabase
        .from('transformation_outputs')
        .select('*, product_type:product_types(*)')
        .in('transformation_order_id', orderIds);
      outputs = out ?? [];
    }

    const cooperatives = receipt?.cooperative_id
      ? (
          await supabase
            .from('cooperatives')
            .select('id, name')
            .eq('id', receipt.cooperative_id as string)
        ).data ?? []
      : [];

    return {
      direction: 'downstream',
      receipt: receipt as TraceabilityResult['receipt'],
      quality_control: quality_control as TraceabilityResult['quality_control'],
      stock_items: stock_items as TraceabilityResult['stock_items'],
      orders: orders as TraceabilityResult['orders'],
      outputs: outputs as TraceabilityResult['outputs'],
      cooperatives: cooperatives as TraceabilityResult['cooperatives'],
      parcelles,
      cocoa_lot: {
        id: cocoaLot.id,
        lot_number: cocoaLot.lot_number,
        status: cocoaLot.status,
        oncc_grade: cocoaLot.oncc_grade,
        eudr_ready: cocoaLot.eudr_ready,
      },
      parents: (passport?.parents ?? []).map((r) => ({
        lot_number: (r.parent_lot as { lot_number?: string } | undefined)?.lot_number ?? r.parent_lot_id,
        weight_kg: r.weight_kg,
      })),
      children: (genealogy?.children ?? []).map((c) => ({
        lot_number: c.lot_number,
        weight_kg: c.weight_kg,
      })),
      packaging: (passport?.packaging ?? []).map((p) => ({
        unit_number: p.unit_number,
        net_weight_kg: p.net_weight_kg,
        qr_code: p.qr_code,
      })),
      dispatches: (passport?.dispatches ?? []).map((d) => ({
        dispatch_number: d.dispatch_number,
        status: d.status,
      })),
    };
  }

  const { data: stockItems } = await supabase
    .from('stock_items')
    .select(
      '*, product_type:product_types(*), source_receipt:factory_receipts(*, cooperative:cooperatives(id, name, code), waybill:delivery_waybills(id, code, lot_number))'
    )
    .ilike('lot_reference', `%${lotReference}%`);

  const items = stockItems ?? [];
  const receiptIds = [...new Set(items.map((i) => i.source_receipt_id).filter(Boolean))];

  let receipt = null;
  let quality_control = null;
  if (receiptIds.length > 0) {
    const { data: r } = await supabase
      .from('factory_receipts')
      .select(
        '*, cooperative:cooperatives(id, name), waybill:delivery_waybills(id, code, lot_number), quality_controls(*)'
      )
      .eq('id', receiptIds[0] as string)
      .maybeSingle();
    receipt = r;
    const qcs = (r as { quality_controls?: unknown[] })?.quality_controls ?? [];
    quality_control = qcs[0] ?? null;
  }

  const orderIds = [...new Set(items.map((i) => i.transformation_order_id).filter(Boolean))];
  let orders: unknown[] = [];
  let outputs: unknown[] = [];

  if (orderIds.length > 0) {
    const { data: o } = await supabase
      .from('transformation_orders')
      .select('*, inputs:transformation_inputs(*), outputs:transformation_outputs(*), losses:transformation_losses(*)')
      .in('id', orderIds);
    orders = o ?? [];

    const { data: out } = await supabase
      .from('transformation_outputs')
      .select('*, product_type:product_types(*)')
      .in('transformation_order_id', orderIds);
    outputs = out ?? [];
  }

  if (items.length === 0 && !receipt) {
    const { data: rByLot } = await supabase
      .from('factory_receipts')
      .select('*, cooperative:cooperatives(id, name), quality_controls(*)')
      .ilike('upstream_lot_number', `%${lotReference}%`)
      .limit(1)
      .maybeSingle();
    receipt = rByLot;
    if (rByLot) {
      const qcs = (rByLot as { quality_controls?: unknown[] }).quality_controls ?? [];
      quality_control = qcs[0] ?? null;
    }
  }

  const cooperatives = receipt
    ? [(receipt as { cooperative?: { id: string; name: string } }).cooperative].filter(Boolean)
    : [];

  const parcelles = await enrichWithParcelles(
    supabase,
    receipt as Record<string, unknown> | null,
    (receipt as { cocoa_lot_id?: string } | null)?.cocoa_lot_id
  );

  return {
    direction: 'downstream',
    receipt: receipt as TraceabilityResult['receipt'],
    quality_control: quality_control as TraceabilityResult['quality_control'],
    stock_items: items as unknown as TraceabilityResult['stock_items'],
    orders: orders as unknown as TraceabilityResult['orders'],
    outputs: outputs as unknown as TraceabilityResult['outputs'],
    cooperatives: cooperatives as TraceabilityResult['cooperatives'],
    parcelles,
  };
}

export async function traceByOutputLot(
  supabase: UntypedDb,
  userId: string,
  outputLot: string
): Promise<TraceabilityResult> {
  await resolveFactorySiteId(supabase, userId);

  const { data: output } = await supabase
    .from('transformation_outputs')
    .select(
      '*, transformation_order:transformation_orders(*, inputs:transformation_inputs(*, stock_item:stock_items(*)))'
    )
    .ilike('output_lot_number', `%${outputLot}%`)
    .limit(1)
    .maybeSingle();

  if (!output) {
    return { direction: 'upstream', receipt: null, stock_items: [], orders: [], outputs: [] };
  }

  const order = (output as { transformation_order?: Record<string, unknown> }).transformation_order;
  const inputs =
    (order?.inputs as Array<{
      stock_item?: { source_receipt_id?: string; lot_reference?: string; cocoa_lot_id?: string };
    }>) ?? [];
  const sourceReceiptId = inputs[0]?.stock_item?.source_receipt_id;
  const cocoaLotId = inputs[0]?.stock_item?.cocoa_lot_id;

  let receipt = null;
  let quality_control = null;
  if (sourceReceiptId) {
    const { data: r } = await supabase
      .from('factory_receipts')
      .select('*, cooperative:cooperatives(id, name), waybill:delivery_waybills(id, code), quality_controls(*)')
      .eq('id', sourceReceiptId)
      .maybeSingle();
    receipt = r;
    const qcs = (r as { quality_controls?: unknown[] })?.quality_controls ?? [];
    quality_control = qcs[0] ?? null;
  }

  const parcelles = await enrichWithParcelles(
    supabase,
    receipt as Record<string, unknown> | null,
    cocoaLotId
  );

  return {
    direction: 'upstream',
    receipt: receipt as TraceabilityResult['receipt'],
    quality_control: quality_control as TraceabilityResult['quality_control'],
    stock_items: [],
    orders: order ? [order as never] : [],
    outputs: [output as never],
    parcelles,
  };
}
