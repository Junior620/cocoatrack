import type { SupabaseClient } from '@supabase/supabase-js';
import type { DispatchStatus, FactoryDispatch, OnccGrade } from '@/types/usinage';
import { resolveFactorySiteId } from './factory-context';
import { assertLotOperable, assertLotReleasedForUse } from './lot-guards';
import { changeLotStatus } from './lot-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

const DEFAULT_CHECKLIST = {
  grade_ok: false,
  moisture_ok: false,
  bag_count_ok: false,
  seals_ok: false,
  documents_ok: false,
  photos_ok: false,
  eudr_ok: false,
};

export async function listDispatches(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('factory_dispatches')
    .select('*, client:clients(id, name), lots:dispatch_lots(*, lot:cocoa_lots(id, lot_number, status))')
    .eq('factory_site_id', siteId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDispatch(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('factory_dispatches')
    .select('*, client:clients(id, name), lots:dispatch_lots(*, lot:cocoa_lots(*), packaging_unit:packaging_units(*))')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createDispatch(
  supabase: UntypedDb,
  userId: string,
  input: {
    client_id?: string | null;
    destination?: string | null;
    product_label?: string | null;
    requested_grade?: OnccGrade | null;
    requested_weight_kg?: number | null;
    departure_date?: string | null;
    notes?: string | null;
  }
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('factory_dispatches')
    .insert({
      factory_site_id: siteId,
      dispatch_number: '',
      client_id: input.client_id ?? null,
      destination: input.destination ?? null,
      product_label: input.product_label ?? null,
      requested_grade: input.requested_grade ?? null,
      requested_weight_kg: input.requested_weight_kg ?? null,
      departure_date: input.departure_date ?? null,
      notes: input.notes ?? null,
      checklist: DEFAULT_CHECKLIST,
      status: 'draft',
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as FactoryDispatch;
}

export async function addLotToDispatch(
  supabase: UntypedDb,
  userId: string,
  dispatchId: string,
  input: { lot_id: string; weight_kg: number; bag_count?: number | null; packaging_unit_id?: string | null }
) {
  await assertLotOperable(supabase, input.lot_id);
  await assertLotReleasedForUse(supabase, input.lot_id);

  const { data: lot } = await supabase
    .from('cocoa_lots')
    .select('status, eudr_ready')
    .eq('id', input.lot_id)
    .single();

  if (lot?.status === 'blocked' || lot?.status === 'rejected') {
    throw new Error('Lot bloqué ou rejeté: expédition interdite');
  }
  if (lot?.status === 'quarantine') {
    throw new Error('Lot en quarantaine: expédition interdite');
  }

  const { data, error } = await supabase
    .from('dispatch_lots')
    .insert({
      dispatch_id: dispatchId,
      lot_id: input.lot_id,
      packaging_unit_id: input.packaging_unit_id ?? null,
      weight_kg: input.weight_kg,
      bag_count: input.bag_count ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await changeLotStatus(supabase, userId, input.lot_id, 'reserved', `Réservé pour expédition ${dispatchId}`);
  return data;
}

export async function updateDispatchChecklist(
  supabase: UntypedDb,
  dispatchId: string,
  checklist: Record<string, boolean>
) {
  const { data: current } = await supabase
    .from('factory_dispatches')
    .select('checklist')
    .eq('id', dispatchId)
    .single();

  const merged = { ...(current?.checklist as object), ...checklist };
  const { error } = await supabase
    .from('factory_dispatches')
    .update({ checklist: merged })
    .eq('id', dispatchId);
  if (error) throw new Error(error.message);
  return getDispatch(supabase, dispatchId);
}

export async function shipDispatch(supabase: UntypedDb, userId: string, dispatchId: string) {
  const dispatch = await getDispatch(supabase, dispatchId);
  if (!dispatch) throw new Error('Expédition introuvable');

  const checklist = (dispatch.checklist ?? {}) as Record<string, boolean>;
  const required = ['grade_ok', 'moisture_ok', 'bag_count_ok', 'documents_ok'];
  const missing = required.filter((k) => !checklist[k]);
  if (missing.length) {
    throw new Error(`Checklist incomplete: ${missing.join(', ')}`);
  }

  const lots = (dispatch.lots as Array<{ lot_id: string }>) ?? [];
  for (const row of lots) {
    await assertLotOperable(supabase, row.lot_id);
    await assertLotReleasedForUse(supabase, row.lot_id);
    await changeLotStatus(supabase, userId, row.lot_id, 'dispatched', `Expédié ${dispatch.dispatch_number}`);
    await supabase
      .from('packaging_units')
      .update({ status: 'dispatched' })
      .eq('lot_id', row.lot_id);
  }

  const { error } = await supabase
    .from('factory_dispatches')
    .update({
      status: 'shipped' as DispatchStatus,
      validated_by: userId,
      validated_at: new Date().toISOString(),
    })
    .eq('id', dispatchId);

  if (error) throw new Error(error.message);
  return getDispatch(supabase, dispatchId);
}
