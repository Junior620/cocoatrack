'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useProductionOrder, useInvalidateFactory, useFactoryTanks } from '@/lib/hooks/useFactory';
import {
  PRODUCTION_ORDER_STATUS_LABELS,
  RECIPE_STEP_TYPE_LABELS,
} from '@/types/mes';
import type {
  CompleteOperationInput,
  OperationRun,
  ProductionOrder,
  ProductionOrderStatus,
  RecipeStepType,
  Tank,
} from '@/types/mes';

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading, error, refetch } = useProductionOrder(id);
  const { data: tanksData } = useFactoryTanks();
  const invalidate = useInvalidateFactory();
  const order = data as ProductionOrder | undefined;
  const tanks = (tanksData?.data ?? []) as Tank[];

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [proposals, setProposals] = useState<
    Array<{ cocoa_lot_id: string; lot_number: string; planned_qty_kg: number; available_kg: number }>
  >([]);
  const [activeRun, setActiveRun] = useState<OperationRun | null>(null);
  const [entry, setEntry] = useState({
    input_lot_id: '',
    input_qty: '',
    output_label: '',
    output_qty: '',
    loss_qty: '0',
    variance: '',
    tank_id: '',
    param_key: '',
    param_value: '',
  });

  const refresh = async () => {
    invalidate();
    await refetch();
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const handlePropose = () =>
    runAction(async () => {
      const res = (await factoryApi.proposeMaterials(id)) as {
        proposals: typeof proposals;
        shortfall_kg: number;
      };
      setProposals(res.proposals);
      if (res.shortfall_kg > 0) {
        setMsg(`Couverture partielle — manque ${res.shortfall_kg.toFixed(0)} kg`);
      }
    });

  const handleReserve = () =>
    runAction(async () => {
      if (!proposals.length) throw new Error('Proposez d’abord des lots');
      await factoryApi.reserveMaterials(
        id,
        proposals.map((p) => ({
          cocoa_lot_id: p.cocoa_lot_id,
          planned_qty_kg: p.planned_qty_kg,
        }))
      );
      setMsg('Matières réservées');
    });

  const handleStart = () => runAction(() => factoryApi.startProductionOrder(id));

  const handleClose = () =>
    runAction(() => factoryApi.closeProductionOrder(id, entry.variance || undefined));

  const openRun = (run: OperationRun) => {
    setActiveRun(run);
    const reserved = order?.materials?.find((m) => m.status === 'reserved' || m.status === 'consumed');
    const priorOut = (order?.operation_runs ?? [])
      .filter((r) => r.step_order < run.step_order && r.status === 'validated')
      .sort((a, b) => b.step_order - a.step_order)[0];
    const priorLotId = priorOut?.outputs?.[0]?.cocoa_lot_id ?? '';

    setEntry({
      input_lot_id: priorLotId || reserved?.cocoa_lot_id || '',
      input_qty: String(
        priorOut?.output_qty_kg ?? reserved?.reserved_qty_kg ?? order?.planned_quantity_kg ?? ''
      ),
      output_label: run.name,
      output_qty: '',
      loss_qty: '0',
      variance: '',
      tank_id: '',
      param_key: Object.keys(run.parameters_json ?? {})[0] || '',
      param_value: '',
    });
  };

  const handleCompleteRun = () =>
    runAction(async () => {
      if (!activeRun) return;
      const payload: CompleteOperationInput = {
        inputs: [
          {
            cocoa_lot_id: entry.input_lot_id || null,
            quantity_kg: parseFloat(entry.input_qty),
          },
        ],
        outputs: [
          {
            product_label: entry.output_label || activeRun.name,
            output_kind: 'main',
            quantity_kg: parseFloat(entry.output_qty),
            tank_id: entry.tank_id || null,
          },
        ],
        losses: entry.loss_qty
          ? [{ loss_kind: 'process', quantity_kg: parseFloat(entry.loss_qty) }]
          : [],
        parameters:
          entry.param_key && entry.param_value
            ? [{ param_key: entry.param_key, actual_value: parseFloat(entry.param_value) }]
            : [],
        variance_justification: entry.variance || null,
        tank_id: entry.tank_id || null,
      };
      await factoryApi.completeOperationRun(activeRun.id, payload as unknown as Record<string, unknown>);
      setActiveRun(null);
      setMsg('Étape validée — généalogie et bilan enregistrés');
    });

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>;
  if (!order) return <p>OF introuvable</p>;

  const canReserve = ['draft', 'planned', 'validated', 'materials_reserved'].includes(order.status);
  const canStart = order.status === 'materials_reserved' || order.status === 'ready';
  const canClose = ['completed', 'awaiting_quality', 'released', 'in_progress'].includes(order.status);

  return (
    <div className="space-y-6">
      <Link href="/factory/production-orders" className="text-sm text-[#8B6914] hover:underline">
        ← OF
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">{order.order_number}</h1>
          <p className="text-sm text-[#8B6914]">
            {order.product_label} · {Number(order.planned_quantity_kg).toFixed(0)} kg ·{' '}
            {PRODUCTION_ORDER_STATUS_LABELS[order.status as ProductionOrderStatus]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReserve && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handlePropose}
                className="rounded border border-[#5C4033] px-3 py-1.5 text-sm text-[#5C4033]"
              >
                Proposer lots
              </button>
              <button
                type="button"
                disabled={busy || !proposals.length}
                onClick={handleReserve}
                className="rounded border border-[#5C4033] px-3 py-1.5 text-sm text-[#5C4033] disabled:opacity-40"
              >
                Réserver
              </button>
            </>
          )}
          {canStart && (
            <button
              type="button"
              disabled={busy}
              onClick={handleStart}
              className="rounded bg-[#5C4033] px-3 py-1.5 text-sm text-white"
            >
              Démarrer OF
            </button>
          )}
          {canClose && order.status !== 'closed' && (
            <button
              type="button"
              disabled={busy}
              onClick={handleClose}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Clôturer
            </button>
          )}
        </div>
      </div>

      {msg && <div className="rounded-lg bg-[#faf6f1] p-3 text-sm text-[#5C4033]">{msg}</div>}

      {proposals.length > 0 && (
        <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-2 font-medium text-[#5C4033]">Lots proposés (FIFO)</h2>
          <ul className="space-y-1 text-sm">
            {proposals.map((p) => (
              <li key={p.cocoa_lot_id} className="flex justify-between">
                <span>{p.lot_number}</span>
                <span>
                  {p.planned_qty_kg.toFixed(0)} / {p.available_kg.toFixed(0)} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-medium text-[#5C4033]">Matières</h2>
        {(order.materials ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucune réservation</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.materials!.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>
                  {m.cocoa_lot?.lot_number ?? m.cocoa_lot_id} · {m.status}
                </span>
                <span>{Number(m.planned_qty_kg).toFixed(0)} kg</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-medium text-[#5C4033]">Opérations</h2>
        <div className="space-y-2">
          {(order.operation_runs ?? []).map((run) => (
            <div
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#f0e6da] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-[#3d2b1f]">
                  {run.step_order}. {run.name}
                </p>
                <p className="text-xs text-[#8B6914]">
                  {RECIPE_STEP_TYPE_LABELS[run.step_type as RecipeStepType]} · {run.status}
                  {run.mass_balance_ok === false && ' · bilan hors tolérance'}
                  {run.mass_balance_ok === true && ' · bilan OK'}
                </p>
              </div>
              {['pending', 'in_progress'].includes(run.status) && order.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={() => openRun(run)}
                  className="text-sm text-[#5C4033] hover:underline"
                >
                  Saisir →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {activeRun && (
        <div className="rounded-xl border-2 border-[#5C4033] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-[#5C4033]">
            Saisie — {activeRun.name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Lot entrée (UUID)
              <input
                className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
                value={entry.input_lot_id}
                onChange={(e) => setEntry({ ...entry, input_lot_id: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Qté entrée (kg)
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.input_qty}
                onChange={(e) => setEntry({ ...entry, input_qty: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Libellé sortie
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.output_label}
                onChange={(e) => setEntry({ ...entry, output_label: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Qté sortie (kg)
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.output_qty}
                onChange={(e) => setEntry({ ...entry, output_qty: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Pertes (kg)
              <input
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.loss_qty}
                onChange={(e) => setEntry({ ...entry, loss_qty: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Cuve (optionnel)
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.tank_id}
                onChange={(e) => setEntry({ ...entry, tank_id: e.target.value })}
              >
                <option value="">—</option>
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} ({t.current_qty_kg}/{t.capacity_kg} kg)
                  </option>
                ))}
              </select>
            </label>
            {entry.param_key && (
              <label className="block text-sm">
                Paramètre {entry.param_key}
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={entry.param_value}
                  onChange={(e) => setEntry({ ...entry, param_value: e.target.value })}
                />
              </label>
            )}
            <label className="block text-sm sm:col-span-2">
              Justification écart bilan (si hors tolérance)
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={entry.variance}
                onChange={(e) => setEntry({ ...entry, variance: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleCompleteRun}
              className="rounded bg-[#5C4033] px-4 py-2 text-sm text-white"
            >
              Valider l&apos;étape
            </button>
            <button type="button" onClick={() => setActiveRun(null)} className="rounded border px-4 py-2 text-sm">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
