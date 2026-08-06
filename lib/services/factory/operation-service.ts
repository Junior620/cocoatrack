import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompleteOperationInput, OperationRun } from '@/types/mes';
import { checkMassBalance } from './grade-service';
import { assertLotOperable, assertLotReleasedForUse, LotGuardError } from './lot-guards';
import { createLotRelationship } from './lot-service';
import { getProductionOrder } from './production-order-service';
import { createPendingRelease } from './release-service';
import { fillTank } from './tank-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

const RUN_SELECT = `
  *,
  inputs:operation_inputs(*),
  outputs:operation_outputs(*),
  parameters:operation_parameters(*),
  losses:operation_losses(*)
`;

export async function getOperationRun(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('operation_runs')
    .select(RUN_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OperationRun | null;
}

export async function startOperationRun(supabase: UntypedDb, userId: string, runId: string) {
  const run = await getOperationRun(supabase, runId);
  if (!run) throw new Error('Opération introuvable');

  const order = await getProductionOrder(supabase, run.production_order_id);
  if (!order || order.status !== 'in_progress') {
    throw new Error('L’OF doit être en cours pour démarrer une étape');
  }

  const prior = (order.operation_runs ?? []).filter((r) => r.step_order < run.step_order);
  const unfinished = prior.filter((r) => !['validated', 'completed', 'cancelled'].includes(r.status));
  if (unfinished.length) {
    throw new Error('Terminez les étapes précédentes avant de démarrer celle-ci');
  }

  const { error } = await supabase
    .from('operation_runs')
    .update({
      status: 'in_progress',
      started_at: run.started_at ?? new Date().toISOString(),
      operator_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
  if (error) throw new Error(error.message);
  return getOperationRun(supabase, runId);
}

export async function completeOperationRun(
  supabase: UntypedDb,
  userId: string,
  runId: string,
  entry: CompleteOperationInput
) {
  const run = await getOperationRun(supabase, runId);
  if (!run) throw new Error('Opération introuvable');
  if (!['in_progress', 'pending', 'awaiting_quality'].includes(run.status)) {
    throw new Error(`Opération non saisissable (statut ${run.status})`);
  }

  const order = await getProductionOrder(supabase, run.production_order_id);
  if (!order) throw new Error('OF introuvable');

  const tolerance = Number(order.recipe_version?.mass_balance_tolerance_pct ?? 2);
  const inputKg = entry.inputs.reduce((s, i) => s + Number(i.quantity_kg), 0);
  const outputKg = entry.outputs.reduce((s, o) => s + Number(o.quantity_kg), 0);
  const lossKg = (entry.losses ?? []).reduce((s, l) => s + Number(l.quantity_kg), 0);
  const balance = checkMassBalance(inputKg, outputKg, lossKg, tolerance);

  if (!balance.ok && !entry.variance_justification?.trim()) {
    throw new Error(
      `Bilan matière hors tolérance (écart ${balance.deltaKg.toFixed(2)} kg > ${balance.allowedKg.toFixed(2)} kg). Justification requise.`
    );
  }

  await supabase.from('operation_inputs').delete().eq('operation_run_id', runId);
  await supabase.from('operation_outputs').delete().eq('operation_run_id', runId);
  await supabase.from('operation_losses').delete().eq('operation_run_id', runId);
  await supabase.from('operation_parameters').delete().eq('operation_run_id', runId);

  const parentLotIds: string[] = [];

  for (const inp of entry.inputs) {
    if (inp.cocoa_lot_id) {
      await assertLotOperable(supabase, inp.cocoa_lot_id);
      // Intermédiaires du même OF : pas de libération requise
      const { data: priorOut } = await supabase
        .from('operation_outputs')
        .select('id, operation_run:operation_runs!inner(production_order_id)')
        .eq('cocoa_lot_id', inp.cocoa_lot_id)
        .eq('operation_run.production_order_id', order.id)
        .limit(1)
        .maybeSingle();
      if (!priorOut) {
        await assertLotReleasedForUse(supabase, inp.cocoa_lot_id);
      }
      parentLotIds.push(inp.cocoa_lot_id);

      const { data: lot } = await supabase
        .from('cocoa_lots')
        .select('net_weight_kg')
        .eq('id', inp.cocoa_lot_id)
        .single();
      if (lot) {
        const next = Math.max(0, Number(lot.net_weight_kg) - Number(inp.quantity_kg));
        await supabase
          .from('cocoa_lots')
          .update({
            net_weight_kg: next,
            status: next <= 0.01 ? 'dispatched' : 'in_processing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', inp.cocoa_lot_id);
      }

      await supabase
        .from('production_order_materials')
        .update({
          consumed_qty_kg: inp.quantity_kg,
          status: 'consumed',
        })
        .eq('production_order_id', order.id)
        .eq('cocoa_lot_id', inp.cocoa_lot_id);
    }

    const { error } = await supabase.from('operation_inputs').insert({
      operation_run_id: runId,
      cocoa_lot_id: inp.cocoa_lot_id ?? null,
      stock_item_id: inp.stock_item_id ?? null,
      quantity_kg: inp.quantity_kg,
    });
    if (error) throw new Error(error.message);
  }

  for (const loss of entry.losses ?? []) {
    await supabase.from('operation_losses').insert({
      operation_run_id: runId,
      loss_kind: loss.loss_kind ?? 'process',
      quantity_kg: loss.quantity_kg,
      reason: loss.reason ?? null,
    });
  }

  const stepTargets = (run.parameters_json ?? {}) as Record<string, number>;
  for (const p of entry.parameters ?? []) {
    const target = p.target_value ?? stepTargets[p.param_key] ?? null;
    let within: boolean | null = null;
    if (target != null && p.actual_value != null) {
      const tolMap = ((order.recipe_version?.steps ?? []).find((s) => s.id === run.recipe_step_id)
        ?.tolerances_json ?? {}) as Record<string, number>;
      const tol = tolMap[p.param_key] ?? Math.abs(target) * 0.05;
      within = Math.abs(Number(p.actual_value) - Number(target)) <= Number(tol);
    }
    await supabase.from('operation_parameters').insert({
      operation_run_id: runId,
      param_key: p.param_key,
      target_value: target,
      actual_value: p.actual_value ?? null,
      unit: p.unit ?? null,
      within_tolerance: within,
    });
  }

  const childLotIds: string[] = [];
  const isLastStep = !(order.operation_runs ?? []).some(
    (r) => r.step_order > run.step_order && r.status !== 'cancelled'
  );

  for (const out of entry.outputs) {
    if (out.output_kind === 'waste') {
      await supabase.from('operation_outputs').insert({
        operation_run_id: runId,
        product_label: out.product_label,
        output_kind: 'waste',
        quantity_kg: out.quantity_kg,
        tank_id: out.tank_id ?? null,
      });
      continue;
    }

    const lotNumber = `LOT-${run.step_type.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}`;
    const { data: childLot, error: lotErr } = await supabase
      .from('cocoa_lots')
      .insert({
        factory_site_id: run.factory_site_id,
        lot_number: lotNumber,
        status: isLastStep ? 'quarantine' : 'in_processing',
        net_weight_kg: out.quantity_kg,
        notes: `Sortie ${out.product_label} — OF ${order.order_number} / ${run.name}`,
        created_by: userId,
      })
      .select('*')
      .single();

    if (lotErr) throw new Error(lotErr.message);
    childLotIds.push(childLot.id as string);

    for (const parentId of parentLotIds) {
      const contribution =
        inputKg > 0 ? (Number(out.quantity_kg) / inputKg) * (100 / Math.max(parentLotIds.length, 1)) : null;
      try {
        await createLotRelationship(supabase, userId, {
          parent_lot_id: parentId,
          child_lot_id: childLot.id as string,
          weight_kg: out.quantity_kg / Math.max(parentLotIds.length, 1),
          contribution_percent: contribution,
        });
      } catch (e) {
        if (!(e instanceof LotGuardError)) throw e;
      }
    }

    await supabase.from('operation_outputs').insert({
      operation_run_id: runId,
      product_label: out.product_label,
      output_kind: out.output_kind ?? 'main',
      quantity_kg: out.quantity_kg,
      cocoa_lot_id: childLot.id,
      tank_id: out.tank_id ?? entry.tank_id ?? null,
    });

    // Libération formelle sur produit fini / dernière étape uniquement
    if (isLastStep) {
      await createPendingRelease(supabase, userId, {
        cocoa_lot_id: childLot.id as string,
        production_order_id: order.id,
      });
    }

    const tankId = out.tank_id ?? entry.tank_id;
    if (tankId) {
      await fillTank(supabase, userId, {
        tank_id: tankId,
        cocoa_lot_id: childLot.id as string,
        quantity_kg: out.quantity_kg,
        operation_run_id: runId,
      });
    }
  }

  const { error: updErr } = await supabase
    .from('operation_runs')
    .update({
      status: 'validated',
      ended_at: new Date().toISOString(),
      operator_id: userId,
      input_qty_kg: inputKg,
      output_qty_kg: outputKg,
      loss_qty_kg: lossKg,
      mass_balance_ok: balance.ok,
      variance_justification: entry.variance_justification ?? null,
      notes: entry.notes ?? null,
      tank_id: entry.tank_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
  if (updErr) throw new Error(updErr.message);

  await supabase.from('traceability_events').insert({
    factory_site_id: run.factory_site_id,
    event_type: 'TransformationEvent',
    what_ref: order.order_number,
    why_biz_step: run.step_type,
    actor_id: userId,
    payload: {
      operation_run_id: runId,
      inputs: entry.inputs,
      outputs: childLotIds,
      mass_balance: balance,
    },
  });

  // Advance next step / complete OF
  const refreshed = await getProductionOrder(supabase, order.id);
  const runs = refreshed?.operation_runs ?? [];
  const next = runs.find((r) => r.step_order > run.step_order && r.status === 'pending');
  if (next) {
    await supabase
      .from('operation_runs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', next.id);
  } else {
    const allDone = runs.every(
      (r) => r.id === runId || ['validated', 'completed', 'cancelled'].includes(r.status)
    );
    if (allDone) {
      await supabase
        .from('production_orders')
        .update({
          status: 'awaiting_quality',
          actual_quantity_kg: outputKg,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }
  }

  return getOperationRun(supabase, runId);
}
