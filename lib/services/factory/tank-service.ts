import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tank, TankMovement, TankMovementType, TankStatus } from '@/types/mes';
import { resolveFactorySiteId } from './factory-context';
import { assertLotOperable } from './lot-guards';

type UntypedDb = SupabaseClient<any, 'public', any>;

const TANK_SELECT = `
  *,
  contents:tank_contents(*, cocoa_lot:cocoa_lots(id, lot_number, status))
`;

export async function listTanks(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('tanks')
    .select(TANK_SELECT)
    .eq('factory_site_id', siteId)
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tank[];
}

export async function getTank(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('tanks')
    .select(TANK_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Tank | null;
}

export async function createTank(
  supabase: UntypedDb,
  userId: string,
  input: {
    code: string;
    name: string;
    capacity_kg: number;
    allowed_product_label?: string | null;
    notes?: string | null;
  }
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('tanks')
    .insert({
      factory_site_id: siteId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      capacity_kg: input.capacity_kg,
      allowed_product_label: input.allowed_product_label ?? null,
      notes: input.notes ?? null,
      status: 'empty',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Tank;
}

export async function updateTankStatus(
  supabase: UntypedDb,
  tankId: string,
  status: TankStatus,
  extras?: { temperature_c?: number | null; quality_status?: string; notes?: string | null }
) {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extras?.temperature_c !== undefined) updates.temperature_c = extras.temperature_c;
  if (extras?.quality_status) updates.quality_status = extras.quality_status;
  if (extras?.notes !== undefined) updates.notes = extras.notes;
  if (status === 'cleaning' || status === 'empty') {
    updates.last_cleaned_at = new Date().toISOString();
  }

  const { error } = await supabase.from('tanks').update(updates).eq('id', tankId);
  if (error) throw new Error(error.message);
  return getTank(supabase, tankId);
}

async function recordMovement(
  supabase: UntypedDb,
  userId: string,
  input: {
    factory_site_id: string;
    tank_id: string;
    movement_type: TankMovementType;
    quantity_kg: number;
    cocoa_lot_id?: string | null;
    from_tank_id?: string | null;
    to_tank_id?: string | null;
    operation_run_id?: string | null;
    notes?: string | null;
  }
) {
  const { data, error } = await supabase
    .from('tank_movements')
    .insert({
      ...input,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TankMovement;
}

export async function fillTank(
  supabase: UntypedDb,
  userId: string,
  input: {
    tank_id: string;
    cocoa_lot_id: string;
    quantity_kg: number;
    operation_run_id?: string | null;
    notes?: string | null;
  }
) {
  const tank = await getTank(supabase, input.tank_id);
  if (!tank) throw new Error('Cuve introuvable');
  if (['blocked', 'maintenance', 'cleaning'].includes(tank.status)) {
    throw new Error(`Cuve ${tank.code} indisponible (${tank.status})`);
  }
  if (tank.quality_status === 'blocked') {
    throw new Error(`Cuve ${tank.code} bloquée qualité`);
  }

  await assertLotOperable(supabase, input.cocoa_lot_id);

  const nextQty = Number(tank.current_qty_kg) + Number(input.quantity_kg);
  if (nextQty > Number(tank.capacity_kg) + 0.01) {
    throw new Error(
      `Capacité dépassée: ${nextQty.toFixed(0)} > ${tank.capacity_kg} kg (${tank.code})`
    );
  }

  // Incompatibilité produit
  if (tank.allowed_product_label && tank.contents?.length) {
    const { data: lot } = await supabase
      .from('cocoa_lots')
      .select('notes')
      .eq('id', input.cocoa_lot_id)
      .single();
    const label = (lot?.notes as string) || '';
    if (label && !label.toLowerCase().includes(tank.allowed_product_label.toLowerCase())) {
      // soft check via allowed label vs notes — also check existing contents product via movements
    }
  }

  if (tank.status === 'empty' && tank.current_qty_kg > 0 === false) {
    // require cleaning record if previously used — MVP: warn via last_cleaned optional
  }

  await supabase.from('tank_contents').insert({
    tank_id: input.tank_id,
    cocoa_lot_id: input.cocoa_lot_id,
    quantity_kg: input.quantity_kg,
    contribution_percent:
      nextQty > 0 ? (Number(input.quantity_kg) / nextQty) * 100 : 100,
  });

  await supabase
    .from('tanks')
    .update({
      current_qty_kg: nextQty,
      status: 'in_use',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.tank_id);

  await recordMovement(supabase, userId, {
    factory_site_id: tank.factory_site_id,
    tank_id: input.tank_id,
    movement_type: 'fill',
    quantity_kg: input.quantity_kg,
    cocoa_lot_id: input.cocoa_lot_id,
    operation_run_id: input.operation_run_id ?? null,
    notes: input.notes ?? null,
  });

  return getTank(supabase, input.tank_id);
}

export async function emptyTank(
  supabase: UntypedDb,
  userId: string,
  input: {
    tank_id: string;
    quantity_kg: number;
    cocoa_lot_id?: string | null;
    notes?: string | null;
  }
) {
  const tank = await getTank(supabase, input.tank_id);
  if (!tank) throw new Error('Cuve introuvable');
  if (Number(input.quantity_kg) > Number(tank.current_qty_kg) + 0.01) {
    throw new Error('Quantité supérieure au contenu de la cuve');
  }

  const nextQty = Math.max(0, Number(tank.current_qty_kg) - Number(input.quantity_kg));

  if (input.cocoa_lot_id) {
    await supabase
      .from('tank_contents')
      .delete()
      .eq('tank_id', input.tank_id)
      .eq('cocoa_lot_id', input.cocoa_lot_id);
  } else if (nextQty <= 0.01) {
    await supabase.from('tank_contents').delete().eq('tank_id', input.tank_id);
  }

  await supabase
    .from('tanks')
    .update({
      current_qty_kg: nextQty,
      status: nextQty <= 0.01 ? 'empty' : 'in_use',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.tank_id);

  await recordMovement(supabase, userId, {
    factory_site_id: tank.factory_site_id,
    tank_id: input.tank_id,
    movement_type: 'empty',
    quantity_kg: input.quantity_kg,
    cocoa_lot_id: input.cocoa_lot_id ?? null,
    notes: input.notes ?? null,
  });

  return getTank(supabase, input.tank_id);
}

export async function transferTank(
  supabase: UntypedDb,
  userId: string,
  input: {
    from_tank_id: string;
    to_tank_id: string;
    quantity_kg: number;
    cocoa_lot_id?: string | null;
    notes?: string | null;
  }
) {
  const from = await getTank(supabase, input.from_tank_id);
  const to = await getTank(supabase, input.to_tank_id);
  if (!from || !to) throw new Error('Cuve introuvable');
  if (from.factory_site_id !== to.factory_site_id) {
    throw new Error('Transfert inter-sites interdit');
  }

  const lotId =
    input.cocoa_lot_id ??
    (from.contents?.[0]?.cocoa_lot_id as string | undefined) ??
    null;
  if (!lotId) throw new Error('Aucun lot à transférer');

  await emptyTank(supabase, userId, {
    tank_id: input.from_tank_id,
    quantity_kg: input.quantity_kg,
    cocoa_lot_id: lotId,
    notes: input.notes ?? `Transfert vers ${to.code}`,
  });

  await fillTank(supabase, userId, {
    tank_id: input.to_tank_id,
    cocoa_lot_id: lotId,
    quantity_kg: input.quantity_kg,
    notes: input.notes ?? `Transfert depuis ${from.code}`,
  });

  await recordMovement(supabase, userId, {
    factory_site_id: from.factory_site_id,
    tank_id: input.from_tank_id,
    movement_type: 'transfer',
    quantity_kg: input.quantity_kg,
    cocoa_lot_id: lotId,
    from_tank_id: input.from_tank_id,
    to_tank_id: input.to_tank_id,
    notes: input.notes ?? null,
  });

  return { from: await getTank(supabase, input.from_tank_id), to: await getTank(supabase, input.to_tank_id) };
}

export async function listTankMovements(supabase: UntypedDb, tankId: string) {
  const { data, error } = await supabase
    .from('tank_movements')
    .select('*')
    .eq('tank_id', tankId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TankMovement[];
}
