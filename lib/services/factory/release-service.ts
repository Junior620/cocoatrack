import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductRelease, ProductReleaseStatus } from '@/types/mes';
import { resolveFactorySiteId } from './factory-context';
import { changeLotStatus } from './lot-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function createPendingRelease(
  supabase: UntypedDb,
  userId: string,
  input: { cocoa_lot_id: string; production_order_id?: string | null }
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('product_releases')
    .insert({
      factory_site_id: siteId,
      cocoa_lot_id: input.cocoa_lot_id,
      production_order_id: input.production_order_id ?? null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ProductRelease;
}

export async function listProductReleases(
  supabase: UntypedDb,
  userId: string,
  filters: { status?: string } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  let query = supabase
    .from('product_releases')
    .select('*, cocoa_lot:cocoa_lots(id, lot_number, status, net_weight_kg)')
    .eq('factory_site_id', siteId)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductRelease[];
}

export async function decideProductRelease(
  supabase: UntypedDb,
  userId: string,
  releaseId: string,
  status: Exclude<ProductReleaseStatus, 'pending'>,
  decisionNotes?: string | null
) {
  const { data: release, error: gErr } = await supabase
    .from('product_releases')
    .select('*')
    .eq('id', releaseId)
    .maybeSingle();
  if (gErr) throw new Error(gErr.message);
  if (!release) throw new Error('Libération introuvable');
  if (release.status !== 'pending') throw new Error('Décision déjà prise');

  const { error } = await supabase
    .from('product_releases')
    .update({
      status,
      decision_notes: decisionNotes ?? null,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', releaseId);
  if (error) throw new Error(error.message);

  if (status === 'released' || status === 'released_with_reserve') {
    await changeLotStatus(
      supabase,
      userId,
      release.cocoa_lot_id as string,
      'released',
      decisionNotes ?? `Libération qualité ${status}`
    );
  } else if (status === 'blocked') {
    await changeLotStatus(
      supabase,
      userId,
      release.cocoa_lot_id as string,
      'blocked',
      decisionNotes ?? 'Bloqué à la libération'
    );
  } else if (status === 'rejected') {
    await changeLotStatus(
      supabase,
      userId,
      release.cocoa_lot_id as string,
      'rejected',
      decisionNotes ?? 'Rejeté à la libération'
    );
  }

  if (release.production_order_id && (status === 'released' || status === 'released_with_reserve')) {
    const { data: pending } = await supabase
      .from('product_releases')
      .select('id')
      .eq('production_order_id', release.production_order_id)
      .eq('status', 'pending')
      .limit(1);
    if (!pending?.length) {
      await supabase
        .from('production_orders')
        .update({ status: 'released', updated_at: new Date().toISOString() })
        .eq('id', release.production_order_id)
        .in('status', ['awaiting_quality', 'completed']);
    }
  }

  const { data: updated } = await supabase
    .from('product_releases')
    .select('*, cocoa_lot:cocoa_lots(id, lot_number, status, net_weight_kg)')
    .eq('id', releaseId)
    .single();
  return updated as ProductRelease;
}

export async function getLatestReleaseForLot(supabase: UntypedDb, lotId: string) {
  const { data, error } = await supabase
    .from('product_releases')
    .select('*')
    .eq('cocoa_lot_id', lotId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProductRelease | null;
}
