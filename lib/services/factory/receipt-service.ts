import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateFactoryReceiptInput, QualityDecision } from '@/types/factory';
import type { OnccGrade } from '@/types/usinage';
import { resolveFactorySiteId, getRawProductTypeId } from './factory-context';
import { createCocoaLotFromReceipt, changeLotStatus } from './lot-service';
import { evaluateGrade, ensureDefaultGradeRule } from './grade-service';
import { assertSegregationOfDuties } from './lot-guards';

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

  const campaignYear = input.campaign_year ?? new Date(input.received_date).getFullYear();
  const tareKg = input.tare_kg ?? null;
  const grossKg = input.gross_weight_kg ?? null;
  const photoUrls = input.photo_urls ?? [];

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
      campaign_year: campaignYear,
      tare_kg: tareKg,
      gross_weight_kg: grossKg,
      photo_urls: photoUrls,
      status: 'pending_qc',
      created_by: userId,
    })
    .select(RECEIPT_SELECT)
    .single();

  if (error) throw new Error(error.message);

  // Lot cacao en quarantaine dès réception (avant QC)
  try {
    await createCocoaLotFromReceipt(supabase, userId, {
      id: data.id as string,
      factory_site_id: siteId,
      receipt_number: data.receipt_number as string,
      upstream_lot_number: data.upstream_lot_number as string | null,
      received_weight_kg: data.received_weight_kg as number,
      bag_count: data.bag_count as number | null,
      warehouse_id: data.warehouse_id as string | null,
      delivery_id: data.delivery_id as string | null,
      campaign_year: campaignYear,
      tare_kg: tareKg,
      gross_weight_kg: grossKg,
    }, { status: 'quarantine' });
  } catch {
    // Tables usinage pas encore migrées : réception reste valide
  }

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
    slate_rate?: number | null;
    insect_rate?: number | null;
    foreign_matter_rate?: number | null;
    smoke_odor?: boolean | null;
    mold_odor?: boolean | null;
    chemical_odor?: boolean | null;
    sample_id?: string | null;
    seal_number?: string | null;
    oncc_grade?: OnccGrade | null;
    grade?: string | null;
    decision: QualityDecision;
    observations?: string | null;
  }
) {
  const receipt = await getReceipt(supabase, input.receipt_id);
  if (!receipt) throw new Error('Réception introuvable');

  const receiptRow = receipt as Record<string, unknown>;
  const siteId = receiptRow.factory_site_id as string;
  const cocoaLotId = receiptRow.cocoa_lot_id as string | null;

  await assertSegregationOfDuties(supabase, userId, {
    receiptCreatedBy: receiptRow.created_by as string,
    qcControlledBy: userId,
  });

  let onccGrade = input.oncc_grade ?? null;
  try {
    const rule = await ensureDefaultGradeRule(supabase, userId);
    const evaluation = evaluateGrade(
      {
        moisture_rate: input.moisture_rate,
        mold_rate: input.mold_rate,
        slate_rate: input.slate_rate,
        insect_rate: input.insect_rate,
        foreign_matter_rate: input.foreign_matter_rate,
        smoke_odor: input.smoke_odor,
        mold_odor: input.mold_odor,
        chemical_odor: input.chemical_odor,
      },
      rule
    );
    if (!onccGrade) onccGrade = evaluation.suggested_grade;
    if (evaluation.block && input.decision === 'conforme') {
      throw new Error(`QC bloqué par règles grade: ${evaluation.alerts.join('; ')}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('QC bloqué')) throw e;
  }

  const receiptStatus = mapDecisionToReceiptStatus(input.decision);

  const { data: qc, error: qcError } = await supabase
    .from('quality_controls')
    .insert({
      factory_site_id: siteId,
      receipt_id: input.receipt_id,
      lot_id: cocoaLotId,
      control_date: input.control_date ?? new Date().toISOString().slice(0, 10),
      moisture_rate: input.moisture_rate ?? null,
      impurity_rate: input.impurity_rate ?? null,
      mold_rate: input.mold_rate ?? null,
      flat_beans_rate: input.flat_beans_rate ?? null,
      broken_beans_rate: input.broken_beans_rate ?? null,
      defective_beans_rate: input.defective_beans_rate ?? null,
      slate_rate: input.slate_rate ?? null,
      insect_rate: input.insect_rate ?? null,
      foreign_matter_rate: input.foreign_matter_rate ?? null,
      smoke_odor: input.smoke_odor ?? false,
      mold_odor: input.mold_odor ?? false,
      chemical_odor: input.chemical_odor ?? false,
      sample_id: input.sample_id ?? null,
      seal_number: input.seal_number ?? null,
      oncc_grade: onccGrade,
      grade: input.grade ?? null,
      decision: input.decision,
      observations: input.observations ?? null,
      controlled_by: userId,
    })
    .select('*')
    .single();

  if (qcError) throw new Error(qcError.message);

  try {
    await supabase.from('quality_decision_history').insert({
      quality_control_id: qc.id,
      from_decision: null,
      to_decision: input.decision,
      justification: input.observations || `Décision QC: ${input.decision}`,
      changed_by: userId,
    });
  } catch {
    // table absente si migration non appliquée
  }

  await supabase
    .from('factory_receipts')
    .update({ status: receiptStatus })
    .eq('id', input.receipt_id);

  if (cocoaLotId) {
    const lotStatus =
      input.decision === 'conforme'
        ? 'accepted'
        : input.decision === 'accepted_with_reserve'
          ? 'quarantine'
          : input.decision === 'rejete' || input.decision === 'non_conforme'
            ? 'rejected'
            : 'qc_in_progress';
    await changeLotStatus(supabase, userId, cocoaLotId, lotStatus, `QC: ${input.decision}`);
    await supabase
      .from('cocoa_lots')
      .update({
        oncc_grade: onccGrade,
        moisture_pct: input.moisture_rate ?? null,
      })
      .eq('id', cocoaLotId);
  }

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
        cocoa_lot_id: cocoaLotId,
        oncc_grade: onccGrade,
        status: stockStatus,
      })
      .select('*')
      .single();

    if (stockError) throw new Error(stockError.message);

    if (cocoaLotId) {
      await supabase
        .from('cocoa_lots')
        .update({ source_stock_item_id: stockItem.id, status: stockStatus === 'quarantine' ? 'quarantine' : 'stored' })
        .eq('id', cocoaLotId);
    }

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
    .select(
      `id, code, lot_number, total_weight_kg, carrier_name, vehicle_plate, cooperative_id,
       cooperative:cooperatives(id, name),
       waybill_deliveries(delivery_id, delivery:deliveries(id, code, weight_kg, planteur_id, planteur:planteurs(id, name, code)))`
    )
    .or(`code.ilike.%${query}%,lot_number.ilike.%${query}%,vehicle_plate.ilike.%${query}%`)
    .limit(10);

  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('id, code, weight_kg, planteur_id, planteur:planteurs(id, name, code)')
    .or(`code.ilike.%${query}%`)
    .limit(10);

  return { waybills: waybills ?? [], deliveries: deliveries ?? [] };
}
