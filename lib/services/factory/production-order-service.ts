import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateProductionOrderInput,
  ProductionOrder,
  ProductionOrderStatus,
} from '@/types/mes';
import { resolveFactorySiteId } from './factory-context';
import { assertLotOperable, assertLotReleasedForUse } from './lot-guards';
import { changeLotStatus } from './lot-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

const ORDER_SELECT = `
  *,
  recipe:production_recipes(*),
  recipe_version:recipe_versions(*, steps:recipe_steps(*)),
  materials:production_order_materials(*, cocoa_lot:cocoa_lots(id, lot_number, status, net_weight_kg, eudr_ready)),
  operation_runs(*, outputs:operation_outputs(*), inputs:operation_inputs(*))
`;

export async function listProductionOrders(
  supabase: UntypedDb,
  userId: string,
  filters: { status?: string; page?: number; pageSize?: number } = {}
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('production_orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .eq('factory_site_id', siteId)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  const orders = (data ?? []) as ProductionOrder[];
  for (const o of orders) {
    if (o.operation_runs) o.operation_runs.sort((a, b) => a.step_order - b.step_order);
    if (o.recipe_version?.steps) {
      o.recipe_version.steps.sort((a, b) => a.step_order - b.step_order);
    }
  }
  return { data: orders, total: count ?? 0, page, pageSize };
}

export async function getProductionOrder(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('production_orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const order = data as ProductionOrder;
  if (order.operation_runs) order.operation_runs.sort((a, b) => a.step_order - b.step_order);
  if (order.recipe_version?.steps) {
    order.recipe_version.steps.sort((a, b) => a.step_order - b.step_order);
  }
  return order;
}

export async function createProductionOrder(
  supabase: UntypedDb,
  userId: string,
  input: CreateProductionOrderInput
) {
  const siteId = await resolveFactorySiteId(supabase, userId);

  const { data: version, error: vErr } = await supabase
    .from('recipe_versions')
    .select('*, recipe:production_recipes(*), steps:recipe_steps(*)')
    .eq('id', input.recipe_version_id)
    .maybeSingle();

  if (vErr) throw new Error(vErr.message);
  if (!version) throw new Error('Version de recette introuvable');
  if (version.status !== 'active') {
    throw new Error('Seule une version de recette active peut démarrer un OF');
  }
  if (!version.steps?.length) throw new Error('La recette n’a aucune étape');

  const recipe = version.recipe as { id: string; is_active: boolean; name: string } | null;
  if (!recipe?.is_active) throw new Error('Recette inactive');

  const { data: order, error } = await supabase
    .from('production_orders')
    .insert({
      factory_site_id: siteId,
      order_number: '',
      status: 'draft',
      product_type_id: input.product_type_id ?? null,
      product_label: input.product_label ?? recipe.name,
      planned_quantity_kg: input.planned_quantity_kg,
      recipe_id: recipe.id,
      recipe_version_id: input.recipe_version_id,
      production_line_id: input.production_line_id ?? null,
      client_id: input.client_id ?? null,
      planned_start: input.planned_start ?? null,
      planned_end: input.planned_end ?? null,
      priority: input.priority ?? 5,
      quality_requirements: input.quality_requirements ?? null,
      notes: input.notes ?? null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const steps = [...(version.steps as Array<Record<string, unknown>>)].sort(
    (a, b) => Number(a.step_order) - Number(b.step_order)
  );

  const { error: runErr } = await supabase.from('operation_runs').insert(
    steps.map((s) => ({
      factory_site_id: siteId,
      production_order_id: order.id,
      recipe_step_id: s.id as string,
      step_order: s.step_order as number,
      step_type: s.step_type as string,
      name: s.name as string,
      status: 'pending',
      equipment_hint: (s.equipment_hint as string) ?? null,
      parameters_json: (s.parameters_json as Record<string, unknown>) ?? {},
    }))
  );
  if (runErr) throw new Error(runErr.message);

  if (input.materials?.length) {
    for (const m of input.materials) {
      if (m.cocoa_lot_id) {
        await assertLotOperable(supabase, m.cocoa_lot_id);
        await assertLotReleasedForUse(supabase, m.cocoa_lot_id);
      }
      const { error: mErr } = await supabase.from('production_order_materials').insert({
        production_order_id: order.id,
        cocoa_lot_id: m.cocoa_lot_id ?? null,
        stock_item_id: m.stock_item_id ?? null,
        planned_qty_kg: m.planned_qty_kg,
        status: 'proposed',
      });
      if (mErr) throw new Error(mErr.message);
    }
  }

  return getProductionOrder(supabase, order.id as string);
}

export async function proposeMaterials(
  supabase: UntypedDb,
  userId: string,
  orderId: string,
  quantityKg?: number
) {
  const order = await getProductionOrder(supabase, orderId);
  if (!order) throw new Error('OF introuvable');

  const need = quantityKg ?? Number(order.planned_quantity_kg);
  const siteId = order.factory_site_id;

  const { data: lots, error } = await supabase
    .from('cocoa_lots')
    .select('id, lot_number, status, net_weight_kg, eudr_ready, oncc_grade, updated_at')
    .eq('factory_site_id', siteId)
    .in('status', ['accepted', 'stored', 'packaged', 'released', 'to_clean'])
    .gt('net_weight_kg', 0)
    .order('updated_at', { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  const proposed: Array<{
    cocoa_lot_id: string;
    lot_number: string;
    available_kg: number;
    planned_qty_kg: number;
    eudr_ready: boolean;
    status: string;
  }> = [];

  let remaining = need;
  for (const lot of lots ?? []) {
    if (remaining <= 0) break;
    try {
      await assertLotReleasedForUse(supabase, lot.id as string);
    } catch {
      continue;
    }
    const avail = Number(lot.net_weight_kg);
    const take = Math.min(avail, remaining);
    proposed.push({
      cocoa_lot_id: lot.id as string,
      lot_number: lot.lot_number as string,
      available_kg: avail,
      planned_qty_kg: take,
      eudr_ready: !!lot.eudr_ready,
      status: lot.status as string,
    });
    remaining -= take;
  }

  return {
    needed_kg: need,
    covered_kg: need - remaining,
    shortfall_kg: Math.max(0, remaining),
    proposals: proposed,
  };
}

export async function reserveMaterials(
  supabase: UntypedDb,
  userId: string,
  orderId: string,
  materials: Array<{ cocoa_lot_id: string; planned_qty_kg: number }>
) {
  const order = await getProductionOrder(supabase, orderId);
  if (!order) throw new Error('OF introuvable');
  if (!['draft', 'planned', 'validated', 'materials_reserved'].includes(order.status)) {
    throw new Error(`Réservation impossible au statut ${order.status}`);
  }

  await supabase.from('production_order_materials').delete().eq('production_order_id', orderId);

  let total = 0;
  for (const m of materials) {
    await assertLotOperable(supabase, m.cocoa_lot_id);
    await assertLotReleasedForUse(supabase, m.cocoa_lot_id);

    const { data: lot } = await supabase
      .from('cocoa_lots')
      .select('net_weight_kg, status')
      .eq('id', m.cocoa_lot_id)
      .single();

    if (!lot || Number(lot.net_weight_kg) < m.planned_qty_kg) {
      throw new Error(`Stock insuffisant sur le lot ${m.cocoa_lot_id}`);
    }

    const { error } = await supabase.from('production_order_materials').insert({
      production_order_id: orderId,
      cocoa_lot_id: m.cocoa_lot_id,
      planned_qty_kg: m.planned_qty_kg,
      reserved_qty_kg: m.planned_qty_kg,
      status: 'reserved',
    });
    if (error) throw new Error(error.message);

    await changeLotStatus(supabase, userId, m.cocoa_lot_id, 'reserved', `Réservé OF ${order.order_number}`);
    total += m.planned_qty_kg;
  }

  if (total + 0.01 < Number(order.planned_quantity_kg) * 0.9) {
    throw new Error(
      `Couverture matière insuffisante (${total.toFixed(0)} kg / ${order.planned_quantity_kg} kg prévus)`
    );
  }

  return updateProductionOrderStatus(supabase, orderId, 'materials_reserved', userId);
}

export async function startProductionOrder(supabase: UntypedDb, userId: string, orderId: string) {
  const order = await getProductionOrder(supabase, orderId);
  if (!order) throw new Error('OF introuvable');

  if (!order.recipe_version || order.recipe_version.status !== 'active') {
    // version was snapshotted; allow if it was active at creation — re-check recipe active
    const { data: recipe } = await supabase
      .from('production_recipes')
      .select('is_active')
      .eq('id', order.recipe_id)
      .maybeSingle();
    if (!recipe?.is_active) throw new Error('Recette inactive: démarrage interdit');
  }

  const materials = order.materials ?? [];
  if (!materials.length || !materials.some((m) => m.status === 'reserved')) {
    throw new Error('Aucune matière réservée: démarrage interdit');
  }

  for (const m of materials) {
    if (m.status !== 'reserved' || !m.cocoa_lot_id) continue;
    const { data: lot } = await supabase
      .from('cocoa_lots')
      .select('status, net_weight_kg')
      .eq('id', m.cocoa_lot_id)
      .single();
    if (!lot || ['blocked', 'rejected', 'under_investigation'].includes(lot.status as string)) {
      throw new Error(`Matière bloquée sur lot ${m.cocoa_lot?.lot_number ?? m.cocoa_lot_id}`);
    }
    if (Number(lot.net_weight_kg) < Number(m.reserved_qty_kg ?? m.planned_qty_kg)) {
      throw new Error(`Stock insuffisant: ${m.cocoa_lot?.lot_number ?? m.cocoa_lot_id}`);
    }
  }

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);

  const firstRun = order.operation_runs?.find((r) => r.status === 'pending');
  if (firstRun) {
    await supabase
      .from('operation_runs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        operator_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', firstRun.id);
  }

  return getProductionOrder(supabase, orderId);
}

export async function updateProductionOrderStatus(
  supabase: UntypedDb,
  orderId: string,
  status: ProductionOrderStatus,
  userId?: string
) {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'in_progress') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'closed') {
    updates.completed_at = new Date().toISOString();
  }
  if (status === 'validated' && userId) updates.validated_by = userId;

  const { error } = await supabase.from('production_orders').update(updates).eq('id', orderId);
  if (error) throw new Error(error.message);
  return getProductionOrder(supabase, orderId);
}

export async function closeProductionOrder(
  supabase: UntypedDb,
  userId: string,
  orderId: string,
  varianceJustification?: string | null
) {
  const order = await getProductionOrder(supabase, orderId);
  if (!order) throw new Error('OF introuvable');

  const runs = order.operation_runs ?? [];
  const incomplete = runs.filter((r) => !['validated', 'completed', 'cancelled'].includes(r.status));
  if (incomplete.length) {
    throw new Error('Toutes les opérations doivent être terminées avant clôture');
  }

  const materials = order.materials ?? [];
  let planned = 0;
  let consumed = 0;
  for (const m of materials) {
    planned += Number(m.planned_qty_kg);
    consumed += Number(m.consumed_qty_kg ?? m.reserved_qty_kg ?? 0);
  }
  const deltaPct = planned > 0 ? (Math.abs(planned - consumed) / planned) * 100 : 0;
  const tolerance = Number(order.recipe_version?.mass_balance_tolerance_pct ?? 2);
  if (deltaPct > tolerance && !varianceJustification) {
    throw new Error(
      `Écart matière ${deltaPct.toFixed(1)}% > tolérance ${tolerance}%: justification requise`
    );
  }

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'closed',
      completed_at: new Date().toISOString(),
      variance_justification: varianceJustification ?? order.variance_justification,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) throw new Error(error.message);

  return getProductionOrder(supabase, orderId);
}
