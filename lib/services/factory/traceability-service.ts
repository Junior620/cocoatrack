import type { SupabaseClient } from '@supabase/supabase-js';
import type { TraceabilityResult } from '@/types/factory';
import { resolveFactorySiteId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function traceByLot(
  supabase: UntypedDb,
  userId: string,
  lotReference: string
): Promise<TraceabilityResult> {
  await resolveFactorySiteId(supabase, userId);

  const { data: stockItems } = await supabase
    .from('stock_items')
    .select('*, product_type:product_types(*), source_receipt:factory_receipts(*, cooperative:cooperatives(id, name, code), waybill:delivery_waybills(id, code, lot_number))')
    .ilike('lot_reference', `%${lotReference}%`);

  const items = stockItems ?? [];
  const receiptIds = [...new Set(items.map((i) => i.source_receipt_id).filter(Boolean))];

  let receipt = null;
  let quality_control = null;
  if (receiptIds.length > 0) {
    const { data: r } = await supabase
      .from('factory_receipts')
      .select('*, cooperative:cooperatives(id, name), waybill:delivery_waybills(id, code, lot_number), quality_controls(*)')
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

  return {
    direction: 'downstream',
    receipt: receipt as TraceabilityResult['receipt'],
    quality_control: quality_control as TraceabilityResult['quality_control'],
    stock_items: items as unknown as TraceabilityResult['stock_items'],
    orders: orders as unknown as TraceabilityResult['orders'],
    outputs: outputs as unknown as TraceabilityResult['outputs'],
    cooperatives: cooperatives as TraceabilityResult['cooperatives'],
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
    .select('*, transformation_order:transformation_orders(*, inputs:transformation_inputs(*, stock_item:stock_items(*)))')
    .ilike('output_lot_number', `%${outputLot}%`)
    .limit(1)
    .maybeSingle();

  if (!output) {
    return { direction: 'upstream', receipt: null, stock_items: [], orders: [], outputs: [] };
  }

  const order = (output as { transformation_order?: Record<string, unknown> }).transformation_order;
  const inputs = (order?.inputs as Array<{ stock_item?: { source_receipt_id?: string; lot_reference?: string } }>) ?? [];
  const sourceReceiptId = inputs[0]?.stock_item?.source_receipt_id;

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

  return {
    direction: 'upstream',
    receipt: receipt as TraceabilityResult['receipt'],
    quality_control: quality_control as TraceabilityResult['quality_control'],
    orders: order ? [order as unknown as NonNullable<TraceabilityResult['orders']>[0]] : [],
    outputs: [output as unknown as NonNullable<TraceabilityResult['outputs']>[0]],
    cooperatives: receipt
      ? [(receipt as { cooperative?: { id: string; name: string } }).cooperative].filter(Boolean) as TraceabilityResult['cooperatives']
      : [],
  };
}
