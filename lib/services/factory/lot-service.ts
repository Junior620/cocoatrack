import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CocoaLot,
  CocoaLotStatus,
  GenealogyNode,
  LotPassport,
  LotRelationship,
  LotSource,
  OnccGrade,
} from '@/types/usinage';
import { resolveFactorySiteId } from './factory-context';
import { assertLotOperable, LotGuardError } from './lot-guards';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function createCocoaLotFromReceipt(
  supabase: UntypedDb,
  userId: string,
  receipt: {
    id: string;
    factory_site_id: string;
    receipt_number: string;
    upstream_lot_number: string | null;
    received_weight_kg: number;
    bag_count: number | null;
    warehouse_id: string | null;
    delivery_id: string | null;
    campaign_year?: number | null;
    tare_kg?: number | null;
    gross_weight_kg?: number | null;
  },
  opts: { status?: CocoaLotStatus; oncc_grade?: OnccGrade | null; moisture_pct?: number | null } = {}
): Promise<CocoaLot> {
  const { data: lot, error } = await supabase
    .from('cocoa_lots')
    .insert({
      factory_site_id: receipt.factory_site_id,
      lot_number: '',
      status: opts.status ?? 'received',
      oncc_grade: opts.oncc_grade ?? null,
      campaign_year: receipt.campaign_year ?? new Date().getFullYear(),
      net_weight_kg: receipt.received_weight_kg,
      gross_weight_kg: receipt.gross_weight_kg ?? null,
      tare_kg: receipt.tare_kg ?? null,
      bag_count: receipt.bag_count,
      moisture_pct: opts.moisture_pct ?? null,
      source_receipt_id: receipt.id,
      warehouse_id: receipt.warehouse_id,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('lot_status_history').insert({
    lot_id: lot.id,
    from_status: null,
    to_status: opts.status ?? 'received',
    reason: `Créé depuis réception ${receipt.receipt_number}`,
    changed_by: userId,
  });

  await supabase
    .from('factory_receipts')
    .update({ cocoa_lot_id: lot.id })
    .eq('id', receipt.id);

  if (receipt.delivery_id) {
    await linkLotSourcesFromDelivery(supabase, lot.id as string, receipt.delivery_id);
  }

  await supabase.from('traceability_events').insert({
    factory_site_id: receipt.factory_site_id,
    event_type: 'ObjectEvent',
    lot_id: lot.id,
    what_ref: lot.lot_number,
    why_biz_step: 'receiving',
    actor_id: userId,
    payload: { receipt_id: receipt.id },
  });

  return lot as CocoaLot;
}

export async function linkLotSourcesFromDelivery(
  supabase: UntypedDb,
  lotId: string,
  deliveryId: string
) {
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, planteur_id, weight_kg')
    .eq('id', deliveryId)
    .maybeSingle();

  if (!delivery) return;

  const { data: shares } = await supabase
    .from('delivery_parcelle_shares')
    .select('parcelle_id, weight_kg, share_percent')
    .eq('delivery_id', deliveryId);

  if (shares && shares.length > 0) {
    for (const share of shares) {
      await supabase.from('lot_sources').insert({
        lot_id: lotId,
        delivery_id: deliveryId,
        planteur_id: delivery.planteur_id,
        parcelle_id: share.parcelle_id,
        weight_kg: share.weight_kg,
        contribution_percent: share.share_percent,
      });
    }
  } else {
    await supabase.from('lot_sources').insert({
      lot_id: lotId,
      delivery_id: deliveryId,
      planteur_id: delivery.planteur_id,
      parcelle_id: null,
      weight_kg: delivery.weight_kg,
      contribution_percent: 100,
    });
  }

  await refreshLotEudrReady(supabase, lotId);
}

export async function refreshLotEudrReady(supabase: UntypedDb, lotId: string) {
  const { data: sources } = await supabase
    .from('lot_sources')
    .select('parcelle_id')
    .eq('lot_id', lotId);

  const hasParcelle = (sources ?? []).some((s) => s.parcelle_id);
  await supabase
    .from('cocoa_lots')
    .update({ eudr_ready: hasParcelle })
    .eq('id', lotId);
}

export async function changeLotStatus(
  supabase: UntypedDb,
  userId: string,
  lotId: string,
  toStatus: CocoaLotStatus,
  reason?: string
) {
  const { data: lot } = await supabase
    .from('cocoa_lots')
    .select('id, status, factory_site_id, lot_number')
    .eq('id', lotId)
    .maybeSingle();

  if (!lot) throw new LotGuardError('Lot introuvable', 'LOT_NOT_FOUND');

  const fromStatus = lot.status as CocoaLotStatus;
  const { error } = await supabase
    .from('cocoa_lots')
    .update({
      status: toStatus,
      blocked_reason: toStatus === 'blocked' ? reason ?? 'Bloqué' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lotId);

  if (error) throw new Error(error.message);

  await supabase.from('lot_status_history').insert({
    lot_id: lotId,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason ?? null,
    changed_by: userId,
  });

  await supabase.from('traceability_events').insert({
    factory_site_id: lot.factory_site_id,
    event_type: 'ObjectEvent',
    lot_id: lotId,
    what_ref: lot.lot_number,
    why_biz_step: `status_${toStatus}`,
    actor_id: userId,
    payload: { from: fromStatus, to: toStatus, reason },
  });

  return getCocoaLot(supabase, lotId);
}

export async function getCocoaLot(supabase: UntypedDb, lotId: string) {
  const { data, error } = await supabase
    .from('cocoa_lots')
    .select('*')
    .eq('id', lotId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CocoaLot | null;
}

export async function listCocoaLots(
  supabase: UntypedDb,
  userId: string,
  filters: { status?: string[]; search?: string; limit?: number } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  let query = supabase
    .from('cocoa_lots')
    .select('id, lot_number, status, oncc_grade, net_weight_kg, eudr_ready, campaign_year, updated_at')
    .eq('factory_site_id', siteId)
    .order('updated_at', { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.search) query = query.ilike('lot_number', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CocoaLot[];
}

export async function getCocoaLotByNumber(
  supabase: UntypedDb,
  userId: string,
  lotNumber: string
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('cocoa_lots')
    .select('*')
    .eq('factory_site_id', siteId)
    .ilike('lot_number', `%${lotNumber}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CocoaLot | null;
}

export async function createLotRelationship(
  supabase: UntypedDb,
  userId: string,
  input: {
    parent_lot_id: string;
    child_lot_id: string;
    weight_kg: number;
    contribution_percent?: number | null;
    transformation_order_id?: string | null;
  }
) {
  await assertLotOperable(supabase, input.parent_lot_id);

  const { data, error } = await supabase
    .from('lot_relationships')
    .insert({
      parent_lot_id: input.parent_lot_id,
      child_lot_id: input.child_lot_id,
      weight_kg: input.weight_kg,
      contribution_percent: input.contribution_percent ?? null,
      transformation_order_id: input.transformation_order_id ?? null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as LotRelationship;
}

export async function getLotPassport(supabase: UntypedDb, lotId: string): Promise<LotPassport | null> {
  const lot = await getCocoaLot(supabase, lotId);
  if (!lot) return null;

  const [historyRes, sourcesRes, parentsRes, childrenRes, packagingRes, qcRes, receiptRes, dispatchRes] =
    await Promise.all([
      supabase
        .from('lot_status_history')
        .select('from_status, to_status, reason, changed_at, changed_by')
        .eq('lot_id', lotId)
        .order('changed_at', { ascending: true }),
      supabase
        .from('lot_sources')
        .select(
          '*, parcelle:parcelles(id, code, label), planteur:planteurs(id, name, code), delivery:deliveries(id, code)'
        )
        .eq('lot_id', lotId),
      supabase
        .from('lot_relationships')
        .select('*, parent_lot:cocoa_lots!lot_relationships_parent_lot_id_fkey(*)')
        .eq('child_lot_id', lotId),
      supabase
        .from('lot_relationships')
        .select('*, child_lot:cocoa_lots!lot_relationships_child_lot_id_fkey(*)')
        .eq('parent_lot_id', lotId),
      supabase.from('packaging_units').select('*').eq('lot_id', lotId),
      supabase
        .from('quality_controls')
        .select('*')
        .eq('lot_id', lotId)
        .order('control_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      lot.source_receipt_id
        ? supabase.from('factory_receipts').select('*').eq('id', lot.source_receipt_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('dispatch_lots')
        .select('weight_kg, dispatch:factory_dispatches(dispatch_number, status)')
        .eq('lot_id', lotId),
    ]);

  const sources = (sourcesRes.data ?? []) as LotSource[];
  const parcelleIds = sources.filter((s) => s.parcelle_id).map((s) => s.parcelle_id!);
  const missing: string[] = [];
  if (parcelleIds.length === 0) missing.push('Aucune parcelle liée (EUDR incomplet)');

  const dispatches = (dispatchRes.data ?? []).map((d) => {
    const disp = d.dispatch as unknown as { dispatch_number: string; status: string } | null;
    return {
      dispatch_number: disp?.dispatch_number ?? '—',
      status: disp?.status ?? '—',
      weight_kg: Number(d.weight_kg),
    };
  });

  return {
    lot,
    status_history: (historyRes.data ?? []) as LotPassport['status_history'],
    sources,
    parents: (parentsRes.data ?? []) as LotRelationship[],
    children: (childrenRes.data ?? []) as LotRelationship[],
    packaging: (packagingRes.data ?? []) as LotPassport['packaging'],
    quality: qcRes.data ?? null,
    receipt: receiptRes.data ?? null,
    dispatches,
    eudr: {
      ready: lot.eudr_ready && parcelleIds.length > 0,
      parcelle_count: parcelleIds.length,
      missing,
    },
  };
}

export async function buildGenealogyDownstream(
  supabase: UntypedDb,
  lotId: string,
  depth = 0,
  maxDepth = 8
): Promise<GenealogyNode | null> {
  const lot = await getCocoaLot(supabase, lotId);
  if (!lot || depth > maxDepth) return null;

  const { data: rels } = await supabase
    .from('lot_relationships')
    .select('child_lot_id, weight_kg')
    .eq('parent_lot_id', lotId);

  const children: GenealogyNode[] = [];
  for (const rel of rels ?? []) {
    const child = await buildGenealogyDownstream(supabase, rel.child_lot_id, depth + 1, maxDepth);
    if (child) {
      child.weight_kg = Number(rel.weight_kg);
      children.push(child);
    }
  }

  return {
    lot_id: lot.id,
    lot_number: lot.lot_number,
    status: lot.status,
    weight_kg: lot.net_weight_kg,
    depth,
    children,
  };
}

export async function upsertDeliveryParcelleShares(
  supabase: UntypedDb,
  userId: string,
  deliveryId: string,
  shares: Array<{ parcelle_id: string; weight_kg: number; notes?: string }>
) {
  await supabase.from('delivery_parcelle_shares').delete().eq('delivery_id', deliveryId);

  const total = shares.reduce((s, x) => s + Number(x.weight_kg), 0);
  const rows = shares.map((s) => ({
    delivery_id: deliveryId,
    parcelle_id: s.parcelle_id,
    weight_kg: s.weight_kg,
    share_percent: total > 0 ? (Number(s.weight_kg) / total) * 100 : null,
    notes: s.notes ?? null,
    created_by: userId,
  }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from('delivery_parcelle_shares')
    .insert(rows)
    .select('*, parcelle:parcelles(id, code, label)');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listDeliveryParcelleShares(supabase: UntypedDb, deliveryId: string) {
  const { data, error } = await supabase
    .from('delivery_parcelle_shares')
    .select('*, parcelle:parcelles(id, code, label)')
    .eq('delivery_id', deliveryId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
