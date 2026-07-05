import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactoryDashboardMetrics } from '@/types/factory';
import { resolveFactorySiteId } from './factory-context';
import { getYieldIndicator } from './yield-calculator';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function getDashboardMetrics(
  supabase: UntypedDb,
  userId: string
): Promise<FactoryDashboardMetrics> {
  const siteId = await resolveFactorySiteId(supabase, userId);

  const { data: receipts } = await supabase
    .from('factory_receipts')
    .select('received_weight_kg, status')
    .eq('factory_site_id', siteId);

  const { data: rawStocks } = await supabase
    .from('stock_items')
    .select('quantity_kg, status, product_type:product_types(is_raw_material, is_finished_product)')
    .eq('factory_site_id', siteId)
    .neq('status', 'depleted');

  const { data: orders } = await supabase
    .from('transformation_orders')
    .select('status, input_quantity_kg, actual_yield_rate, loss_rate, theoretical_yield_rate')
    .eq('factory_site_id', siteId);

  const receiptRows = receipts ?? [];
  const stockRows = rawStocks ?? [];
  const orderRows = orders ?? [];

  const beans_received_kg = receiptRows.reduce((s, r) => s + Number(r.received_weight_kg), 0);
  const pending_qc_count = receiptRows.filter((r) => r.status === 'pending_qc').length;

  let beans_stock_kg = 0;
  let finished_stock_kg = 0;
  for (const s of stockRows) {
    const pt = s.product_type as { is_raw_material?: boolean; is_finished_product?: boolean } | null;
    const qty = Number(s.quantity_kg);
    if (pt?.is_raw_material) beans_stock_kg += qty;
    if (pt?.is_finished_product) finished_stock_kg += qty;
  }

  const validatedOrders = orderRows.filter((o) =>
    ['completed', 'validated'].includes(o.status as string)
  );
  const beans_transformed_kg = validatedOrders.reduce(
    (s, o) => s + Number(o.input_quantity_kg ?? 0),
    0
  );
  const orders_in_progress = orderRows.filter((o) => o.status === 'in_progress').length;

  const yieldOrders = validatedOrders.filter((o) => o.actual_yield_rate != null);
  const avg_yield_pct =
    yieldOrders.length > 0
      ? yieldOrders.reduce((s, o) => s + Number(o.actual_yield_rate), 0) / yieldOrders.length
      : 0;
  const avg_loss_pct =
    yieldOrders.length > 0
      ? yieldOrders.reduce((s, o) => s + Number(o.loss_rate ?? 0), 0) / yieldOrders.length
      : 0;

  let yield_alerts = 0;
  for (const o of yieldOrders) {
    const indicator = getYieldIndicator(
      Number(o.actual_yield_rate),
      o.theoretical_yield_rate != null ? Number(o.theoretical_yield_rate) : null
    );
    if (indicator === 'red' || indicator === 'orange') yield_alerts++;
  }

  const low_stock_alerts = beans_stock_kg < 500 ? 1 : 0;

  return {
    beans_received_kg,
    beans_stock_kg,
    beans_transformed_kg,
    finished_stock_kg,
    avg_yield_pct,
    avg_loss_pct,
    pending_qc_count,
    orders_in_progress,
    yield_alerts,
    low_stock_alerts,
  };
}

export async function listStockItems(
  supabase: UntypedDb,
  userId: string,
  filters: { rawOnly?: boolean; finishedOnly?: boolean } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);

  const { data, error } = await supabase
    .from('stock_items')
    .select('*, product_type:product_types(*), warehouse:warehouses(id, name, code)')
    .eq('factory_site_id', siteId)
    .neq('status', 'depleted')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  let items = data ?? [];
  if (filters.rawOnly) {
    items = items.filter(
      (i) => (i.product_type as { is_raw_material?: boolean })?.is_raw_material
    );
  }
  if (filters.finishedOnly) {
    items = items.filter(
      (i) => (i.product_type as { is_finished_product?: boolean })?.is_finished_product
    );
  }
  return items;
}

export async function listPendingQuality(
  supabase: UntypedDb,
  userId: string
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('factory_receipts')
    .select('*, cooperative:cooperatives(id, name)')
    .eq('factory_site_id', siteId)
    .eq('status', 'pending_qc')
    .order('received_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listProductTypes(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('product_types')
    .select('*')
    .eq('factory_site_id', siteId)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listProductionLines(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('production_lines')
    .select('*')
    .eq('factory_site_id', siteId)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listYieldStandards(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('yield_standards')
    .select('*')
    .eq('factory_site_id', siteId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
