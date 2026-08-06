import type { SupabaseClient } from '@supabase/supabase-js';
import type { CocoaLotStatus } from '@/types/usinage';
import { NON_OPERABLE_LOT_STATUSES } from '@/types/usinage';

type UntypedDb = SupabaseClient<any, 'public', any>;

export class LotGuardError extends Error {
  constructor(
    message: string,
    public code:
      | 'LOT_NOT_FOUND'
      | 'LOT_NOT_OPERABLE'
      | 'STOCK_NOT_OPERABLE'
      | 'SEGREGATION'
      | 'LOT_NOT_RELEASED'
  ) {
    super(message);
    this.name = 'LotGuardError';
  }
}

export async function assertLotOperable(
  supabase: UntypedDb,
  lotId: string
): Promise<{ id: string; status: CocoaLotStatus; lot_number: string }> {
  const { data, error } = await supabase
    .from('cocoa_lots')
    .select('id, status, lot_number')
    .eq('id', lotId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new LotGuardError(`Lot introuvable: ${lotId}`, 'LOT_NOT_FOUND');

  const status = data.status as CocoaLotStatus;
  if (NON_OPERABLE_LOT_STATUSES.includes(status)) {
    throw new LotGuardError(
      `Lot ${data.lot_number} non opérable (statut: ${status})`,
      'LOT_NOT_OPERABLE'
    );
  }
  return data as { id: string; status: CocoaLotStatus; lot_number: string };
}

export async function assertStockItemOperable(supabase: UntypedDb, stockItemId: string) {
  const { data, error } = await supabase
    .from('stock_items')
    .select('id, status, lot_reference, cocoa_lot_id')
    .eq('id', stockItemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new LotGuardError(`Stock introuvable: ${stockItemId}`, 'STOCK_NOT_OPERABLE');

  if (['blocked', 'quarantine', 'depleted'].includes(data.status as string)) {
    throw new LotGuardError(
      `Stock ${data.lot_reference} non opérable (statut: ${data.status})`,
      'STOCK_NOT_OPERABLE'
    );
  }

  if (data.cocoa_lot_id) {
    await assertLotOperable(supabase, data.cocoa_lot_id as string);
  }

  return data;
}

/**
 * Lots issus du MES (product_releases) : consommables / expédiables
 * uniquement si libérés (ou jamais soumis à libération formelle).
 */
export async function assertLotReleasedForUse(supabase: UntypedDb, lotId: string) {
  const { data: release, error } = await supabase
    .from('product_releases')
    .select('id, status')
    .eq('cocoa_lot_id', lotId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!release) return; // lots amont / primaire sans dossier de libération

  if (!['released', 'released_with_reserve'].includes(release.status as string)) {
    throw new LotGuardError(
      `Lot non libéré qualité (statut libération: ${release.status})`,
      'LOT_NOT_RELEASED'
    );
  }
}

/**
 * Séparation des devoirs : même opérateur ne peut pas être
 * réceptionnaire + QC + validateur sans droit spécial.
 */
export async function assertSegregationOfDuties(
  supabase: UntypedDb,
  userId: string,
  checks: { receiptCreatedBy?: string | null; qcControlledBy?: string | null }
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('can_solo_validate_lot, role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role === 'admin' || profile?.can_solo_validate_lot) return;

  const actors = [checks.receiptCreatedBy, checks.qcControlledBy, userId].filter(Boolean);
  const unique = new Set(actors);
  if (actors.length >= 3 && unique.size === 1) {
    throw new LotGuardError(
      'Séparation des devoirs: un seul utilisateur ne peut pas réceptionner, contrôler et valider le même lot',
      'SEGREGATION'
    );
  }
}
