import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateTransformationOrderInput,
  ProductionEntryInput,
  TransformationOrderStatus,
} from '@/types/factory';
import { calculateYield } from './yield-calculator';
import { resolveFactorySiteId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

const ORDER_SELECT = `
  *,
  production_line:production_lines(*),
  inputs:transformation_inputs(*, stock_item:stock_items(*, product_type:product_types(*))),
  outputs:transformation_outputs(*, product_type:product_types(*)),
  losses:transformation_losses(*)
`;

export async function listOrders(
  supabase: UntypedDb,
  userId: string,
  filters: { status?: string; page?: number; pageSize?: number } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('transformation_orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .eq('factory_site_id', siteId)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getOrder(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('transformation_orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createOrder(
  supabase: UntypedDb,
  userId: string,
  input: CreateTransformationOrderInput
) {
  const siteId = await resolveFactorySiteId(supabase, userId, input.factory_site_id);

  const { data: order, error } = await supabase
    .from('transformation_orders')
    .insert({
      factory_site_id: siteId,
      order_number: '',
      transformation_type: input.transformation_type,
      production_line_id: input.production_line_id ?? null,
      planned_date: input.planned_date ?? null,
      input_quantity_kg: input.input_quantity_kg ?? null,
      theoretical_yield_rate: input.theoretical_yield_rate ?? null,
      operator_id: input.operator_id ?? userId,
      notes: input.notes ?? null,
      status: 'draft',
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  if (input.stock_item_ids?.length) {
    for (const stockItemId of input.stock_item_ids) {
      const { data: stock } = await supabase
        .from('stock_items')
        .select('id, lot_reference, quantity_kg, status')
        .eq('id', stockItemId)
        .single();

      if (!stock) throw new Error(`Stock ${stockItemId} introuvable`);
      if (!['available', 'quarantine'].includes(stock.status as string)) {
        throw new Error(`Lot ${stock.lot_reference} non disponible pour transformation`);
      }

      await supabase.from('transformation_inputs').insert({
        transformation_order_id: order.id,
        stock_item_id: stockItemId,
        source_lot_reference: stock.lot_reference,
        quantity_used_kg: 0,
      });
    }
  }

  return getOrder(supabase, order.id as string);
}

export async function updateOrderStatus(
  supabase: UntypedDb,
  orderId: string,
  status: TransformationOrderStatus,
  userId?: string
) {
  const updates: Record<string, unknown> = { status };
  if (status === 'in_progress') updates.started_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (status === 'validated' && userId) {
    updates.validated_by = userId;
    updates.validated_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('transformation_orders')
    .update(updates)
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  return getOrder(supabase, orderId);
}

export async function saveProductionEntry(
  supabase: UntypedDb,
  userId: string,
  orderId: string,
  entry: ProductionEntryInput
) {
  const order = await getOrder(supabase, orderId);
  if (!order) throw new Error('Ordre introuvable');

  await supabase.from('transformation_inputs').delete().eq('transformation_order_id', orderId);
  await supabase.from('transformation_outputs').delete().eq('transformation_order_id', orderId);
  await supabase.from('transformation_losses').delete().eq('transformation_order_id', orderId);

  for (const inp of entry.inputs) {
    const { data: stock } = await supabase
      .from('stock_items')
      .select('lot_reference')
      .eq('id', inp.stock_item_id)
      .single();

    await supabase.from('transformation_inputs').insert({
      transformation_order_id: orderId,
      stock_item_id: inp.stock_item_id,
      source_lot_reference: stock?.lot_reference ?? null,
      quantity_used_kg: inp.quantity_used_kg,
    });
  }

  for (const out of entry.outputs) {
    await supabase.from('transformation_outputs').insert({
      transformation_order_id: orderId,
      product_type_id: out.product_type_id,
      product_name: out.product_name,
      output_lot_number: out.output_lot_number,
      quantity_produced_kg: out.quantity_produced_kg,
      warehouse_id: out.warehouse_id ?? null,
    });
  }

  for (const loss of entry.losses) {
    await supabase.from('transformation_losses').insert({
      transformation_order_id: orderId,
      loss_type: loss.loss_type,
      quantity_kg: loss.quantity_kg,
      reason: loss.reason ?? null,
    });
  }

  const yieldCalc = calculateYield({
    inputs: entry.inputs.map((i) => ({ quantity_kg: i.quantity_used_kg })),
    outputs: entry.outputs.map((o) => ({
      product_name: o.product_name,
      quantity_kg: o.quantity_produced_kg,
    })),
    losses: entry.losses.map((l) => ({ quantity_kg: l.quantity_kg })),
    expectedYieldPct: (order as { theoretical_yield_rate?: number }).theoretical_yield_rate ?? null,
  });

  await supabase
    .from('transformation_orders')
    .update({
      input_quantity_kg: yieldCalc.totalInputKg,
      actual_yield_rate: yieldCalc.globalYieldPct,
      loss_rate: yieldCalc.lossRatePct,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  return { order: await getOrder(supabase, orderId), yield: yieldCalc };
}

export async function validateOrder(supabase: UntypedDb, userId: string, orderId: string) {
  const order = await getOrder(supabase, orderId);
  if (!order) throw new Error('Ordre introuvable');
  if ((order as { status: string }).status !== 'completed') {
    throw new Error('Seul un ordre terminé peut être validé');
  }

  const siteId = (order as { factory_site_id: string }).factory_site_id;
  const inputs = ((order as { inputs?: Array<{ stock_item_id: string; quantity_used_kg: number }> }).inputs) ?? [];
  const outputs = ((order as { outputs?: Array<Record<string, unknown>> }).outputs) ?? [];
  const losses = ((order as { losses?: Array<{ quantity_kg: number; loss_type: string }> }).losses) ?? [];

  for (const inp of inputs) {
    const { data: stock } = await supabase
      .from('stock_items')
      .select('quantity_kg, lot_reference')
      .eq('id', inp.stock_item_id)
      .single();

    if (!stock) throw new Error('Stock introuvable');
    const newQty = Number(stock.quantity_kg) - Number(inp.quantity_used_kg);
    if (newQty < 0) throw new Error(`Stock insuffisant pour ${stock.lot_reference}`);

    await supabase
      .from('stock_items')
      .update({ quantity_kg: newQty, status: newQty === 0 ? 'depleted' : 'available' })
      .eq('id', inp.stock_item_id);

    await supabase.from('stock_movements').insert({
      factory_site_id: siteId,
      stock_item_id: inp.stock_item_id,
      movement_type: 'transformation',
      quantity_kg: inp.quantity_used_kg,
      reference_type: 'transformation_order',
      reference_id: orderId,
      created_by: userId,
    });
  }

  const sourceLotRef = inputs[0]?.stock_item_id
    ? (
        await supabase
          .from('stock_items')
          .select('source_lot_reference, lot_reference')
          .eq('id', inputs[0].stock_item_id)
          .single()
      ).data
    : null;
  const upstreamLot =
    (sourceLotRef as { source_lot_reference?: string; lot_reference?: string } | null)
      ?.source_lot_reference ||
    (sourceLotRef as { lot_reference?: string } | null)?.lot_reference ||
    null;

  for (const out of outputs) {
    const { data: stockItem } = await supabase
      .from('stock_items')
      .insert({
        factory_site_id: siteId,
        product_type_id: out.product_type_id as string,
        lot_reference: out.output_lot_number as string,
        quantity_kg: out.quantity_produced_kg as number,
        warehouse_id: (out.warehouse_id as string) ?? null,
        source_lot_reference: upstreamLot,
        transformation_order_id: orderId,
        status: 'available',
      })
      .select('id')
      .single();

    if (stockItem) {
      await supabase
        .from('transformation_outputs')
        .update({ stock_item_id: stockItem.id })
        .eq('id', out.id as string);

      await supabase.from('stock_movements').insert({
        factory_site_id: siteId,
        stock_item_id: stockItem.id,
        movement_type: 'entry',
        quantity_kg: out.quantity_produced_kg as number,
        destination_warehouse_id: (out.warehouse_id as string) ?? null,
        reference_type: 'transformation_order',
        reference_id: orderId,
        created_by: userId,
      });
    }
  }

  for (const loss of losses) {
    await supabase.from('stock_movements').insert({
      factory_site_id: siteId,
      stock_item_id: inputs[0]?.stock_item_id,
      movement_type: 'loss',
      quantity_kg: loss.quantity_kg,
      reference_type: 'transformation_order',
      reference_id: orderId,
      notes: loss.loss_type,
      created_by: userId,
    });
  }

  return updateOrderStatus(supabase, orderId, 'validated', userId);
}
