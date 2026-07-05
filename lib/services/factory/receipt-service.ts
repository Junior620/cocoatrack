import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateFactoryReceiptInput, QualityDecision } from '@/types/factory';
import { resolveFactorySiteId, getRawProductTypeId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

const RECEIPT_SELECT = `
  *,
  cooperative:cooperatives(id, name, code),
  waybill:delivery_waybills(id, code, lot_number)
`;

export async function listReceipts(
  supabase: UntypedDb,
  userId: string,
  filters: { status?: string; search?: string; page?: number; pageSize?: number } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('factory_receipts')
    .select(RECEIPT_SELECT, { count: 'exact' })
    .eq('factory_site_id', siteId)
    .order('received_date', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) {
    query = query.or(
      `receipt_number.ilike.%${filters.search}%,upstream_lot_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getReceipt(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('factory_receipts')
    .select(`${RECEIPT_SELECT}, quality_controls(*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const qcs = (row.quality_controls as unknown[]) ?? [];
  return { ...row, quality_control: qcs[0] ?? null, quality_controls: undefined };
}

export async function createReceipt(
  supabase: UntypedDb,
  userId: string,
  input: CreateFactoryReceiptInput
) {
  const siteId = await resolveFactorySiteId(supabase, userId, input.factory_site_id);

  const { data, error } = await supabase
    .from('factory_receipts')
    .insert({
      factory_site_id: siteId,
      receipt_number: '',
      cooperative_id: input.cooperative_id ?? null,
      waybill_id: input.waybill_id ?? null,
      delivery_id: input.delivery_id ?? null,
      upstream_lot_number: input.upstream_lot_number ?? null,
      supplier_name: input.supplier_name ?? null,
      transport_document_number: input.transport_document_number ?? null,
      vehicle_number: input.vehicle_number ?? null,
      driver_name: input.driver_name ?? null,
      received_date: input.received_date,
      declared_weight_kg: input.declared_weight_kg ?? null,
      received_weight_kg: input.received_weight_kg,
      bag_count: input.bag_count ?? null,
      warehouse_id: input.warehouse_id ?? null,
      notes: input.notes ?? null,
      status: 'pending_qc',
      created_by: userId,
    })
    .select(RECEIPT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function mapDecisionToReceiptStatus(decision: QualityDecision): string {
  switch (decision) {
    case 'conforme':
      return 'accepted';
    case 'accepted_with_reserve':
      return 'accepted_with_reserve';
    case 'rejete':
    case 'non_conforme':
      return 'rejected';
    default:
      return 'pending_qc';
  }
}

export async function createQualityControlAndStock(
  supabase: UntypedDb,
  userId: string,
  input: {
    receipt_id: string;
    control_date?: string;
    moisture_rate?: number | null;
    impurity_rate?: number | null;
    mold_rate?: number | null;
    flat_beans_rate?: number | null;
    broken_beans_rate?: number | null;
    defective_beans_rate?: number | null;
    grade?: string | null;
    decision: QualityDecision;
    observations?: string | null;
  }
) {
  const receipt = await getReceipt(supabase, input.receipt_id);
  if (!receipt) throw new Error('Réception introuvable');

  const receiptRow = receipt as Record<string, unknown>;
  const siteId = receiptRow.factory_site_id as string;
  const receiptStatus = mapDecisionToReceiptStatus(input.decision);

  const { data: qc, error: qcError } = await supabase
    .from('quality_controls')
    .insert({
      factory_site_id: siteId,
      receipt_id: input.receipt_id,
      control_date: input.control_date ?? new Date().toISOString().slice(0, 10),
      moisture_rate: input.moisture_rate ?? null,
      impurity_rate: input.impurity_rate ?? null,
      mold_rate: input.mold_rate ?? null,
      flat_beans_rate: input.flat_beans_rate ?? null,
      broken_beans_rate: input.broken_beans_rate ?? null,
      defective_beans_rate: input.defective_beans_rate ?? null,
      grade: input.grade ?? null,
      decision: input.decision,
      observations: input.observations ?? null,
      controlled_by: userId,
    })
    .select('*')
    .single();

  if (qcError) throw new Error(qcError.message);

  await supabase
    .from('factory_receipts')
    .update({ status: receiptStatus })
    .eq('id', input.receipt_id);

  const acceptedDecisions = ['conforme', 'accepted_with_reserve'];
  if (acceptedDecisions.includes(input.decision)) {
    const rawProductId = await getRawProductTypeId(supabase, siteId);
    if (!rawProductId) throw new Error('Type produit fèves non configuré');

    const r = receiptRow as {
      received_weight_kg: number;
      upstream_lot_number: string | null;
      receipt_number: string;
      warehouse_id: string | null;
    };

    const lotRef = r.upstream_lot_number || r.receipt_number;
    const stockStatus = input.decision === 'accepted_with_reserve' ? 'quarantine' : 'available';

    const { data: stockItem, error: stockError } = await supabase
      .from('stock_items')
      .insert({
        factory_site_id: siteId,
        product_type_id: rawProductId,
        lot_reference: lotRef,
        quantity_kg: r.received_weight_kg,
        warehouse_id: r.warehouse_id,
        source_receipt_id: input.receipt_id,
        source_lot_reference: lotRef,
        status: stockStatus,
      })
      .select('*')
      .single();

    if (stockError) throw new Error(stockError.message);

    await supabase.from('stock_movements').insert({
      factory_site_id: siteId,
      stock_item_id: stockItem.id,
      movement_type: 'entry',
      quantity_kg: r.received_weight_kg,
      destination_warehouse_id: r.warehouse_id,
      reference_type: 'factory_receipt',
      reference_id: input.receipt_id,
      created_by: userId,
    });

    await supabase
      .from('factory_receipts')
      .update({ status: 'stored' })
      .eq('id', input.receipt_id);
  }

  return qc;
}

export async function searchUpstream(
  supabase: UntypedDb,
  query: string
) {
  const { data: waybills } = await supabase
    .from('delivery_waybills')
    .select('id, code, lot_number, total_weight_kg, carrier_name, vehicle_plate, cooperative_id, cooperative:cooperatives(id, name)')
    .or(`code.ilike.%${query}%,lot_number.ilike.%${query}%,vehicle_plate.ilike.%${query}%`)
    .limit(10);

  return { waybills: waybills ?? [] };
}
