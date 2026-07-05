'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryOrder, useFactoryProductTypes, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { YieldIndicatorBadge } from '@/components/factory/YieldIndicator';
import type { LossType } from '@/types/factory';

export default function FactoryProductionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: order } = useFactoryOrder(id);
  const { data: productTypes } = useFactoryProductTypes();
  const invalidate = useInvalidateFactory();

  const [inputs, setInputs] = useState<Array<{ stock_item_id: string; quantity_used_kg: string; label: string }>>([]);
  const [outputs, setOutputs] = useState([{ product_type_id: '', product_name: '', output_lot_number: '', quantity_produced_kg: '' }]);
  const [losses, setLosses] = useState([{ loss_type: 'evaporation' as LossType, quantity_kg: '', reason: '' }]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ globalYieldPct: number; indicator: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order?.inputs?.length) {
      setInputs(
        order.inputs.map((inp) => ({
          stock_item_id: inp.stock_item_id,
          quantity_used_kg: String(inp.quantity_used_kg || ''),
          label: inp.stock_item?.lot_reference || inp.source_lot_reference || inp.stock_item_id,
        }))
      );
    }
  }, [order]);

  const finishedTypes = ((productTypes as Array<{ id: string; name: string; is_finished_product: boolean }>) ?? []).filter(
    (p) => p.is_finished_product
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await factoryApi.saveProduction(id, {
        inputs: inputs.map((i) => ({
          stock_item_id: i.stock_item_id,
          quantity_used_kg: parseFloat(i.quantity_used_kg),
        })),
        outputs: outputs
          .filter((o) => o.product_name && o.quantity_produced_kg)
          .map((o) => ({
            product_type_id: o.product_type_id,
            product_name: o.product_name,
            output_lot_number: o.output_lot_number || `OUT-${Date.now()}`,
            quantity_produced_kg: parseFloat(o.quantity_produced_kg),
          })),
        losses: losses
          .filter((l) => l.quantity_kg)
          .map((l) => ({
            loss_type: l.loss_type,
            quantity_kg: parseFloat(l.quantity_kg),
            reason: l.reason || null,
          })),
      });
      setResult({
        globalYieldPct: (res as { yield: { globalYieldPct: number; indicator: string } }).yield.globalYieldPct,
        indicator: (res as { yield: { indicator: string } }).yield.indicator,
      });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/factory/orders/${id}`} className="text-sm text-[#8B6914] hover:underline">← Ordre {order?.order_number}</Link>
      <h1 className="text-2xl font-bold text-[#5C4033]">Saisie production</h1>

      {result && (
        <div className="space-y-3">
          <YieldIndicatorBadge indicator={result.indicator as 'green' | 'orange' | 'red'} yieldPct={result.globalYieldPct} expectedPct={order?.theoretical_yield_rate != null ? Number(order.theoretical_yield_rate) : null} />
          <Link href={`/factory/orders/${id}`} className="inline-block rounded-lg bg-green-700 px-4 py-2 text-sm text-white">
            Voir l&apos;ordre et valider →
          </Link>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold">Entrées (fèves utilisées)</h2>
          {inputs.map((inp, idx) => (
            <div key={inp.stock_item_id} className="mb-2 flex items-center gap-3">
              <span className="flex-1 text-sm">{inp.label}</span>
              <input
                type="number"
                step="0.01"
                required
                className="w-32 rounded border px-2 py-1 text-sm"
                placeholder="kg"
                value={inp.quantity_used_kg}
                onChange={(e) => {
                  const next = [...inputs];
                  next[idx] = { ...next[idx], quantity_used_kg: e.target.value };
                  setInputs(next);
                }}
              />
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold">Sorties (produits obtenus)</h2>
          {outputs.map((out, idx) => (
            <div key={idx} className="mb-3 grid gap-2 sm:grid-cols-4">
              <select
                className="rounded border px-2 py-1 text-sm"
                value={out.product_type_id}
                onChange={(e) => {
                  const pt = finishedTypes.find((p) => p.id === e.target.value);
                  const next = [...outputs];
                  next[idx] = { ...next[idx], product_type_id: e.target.value, product_name: pt?.name || '' };
                  setOutputs(next);
                }}
              >
                <option value="">Produit</option>
                {finishedTypes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input className="rounded border px-2 py-1 text-sm" placeholder="N° lot sortie" value={out.output_lot_number} onChange={(e) => { const next = [...outputs]; next[idx].output_lot_number = e.target.value; setOutputs(next); }} />
              <input type="number" step="0.01" required className="rounded border px-2 py-1 text-sm" placeholder="kg" value={out.quantity_produced_kg} onChange={(e) => { const next = [...outputs]; next[idx].quantity_produced_kg = e.target.value; setOutputs(next); }} />
            </div>
          ))}
          <button type="button" onClick={() => setOutputs([...outputs, { product_type_id: '', product_name: '', output_lot_number: '', quantity_produced_kg: '' }])} className="text-sm text-[#5C4033] hover:underline">
            + Ajouter un produit
          </button>
        </section>

        <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold">Pertes</h2>
          {losses.map((loss, idx) => (
            <div key={idx} className="mb-2 flex gap-2">
              <select className="rounded border px-2 py-1 text-sm" value={loss.loss_type} onChange={(e) => { const next = [...losses]; next[idx].loss_type = e.target.value as LossType; setLosses(next); }}>
                <option value="waste">Déchets</option>
                <option value="evaporation">Évaporation</option>
                <option value="rejected_beans">Fèves rejetées</option>
                <option value="breakage">Casse</option>
                <option value="unexplained">Écart non expliqué</option>
                <option value="other">Autre</option>
              </select>
              <input type="number" step="0.01" className="w-24 rounded border px-2 py-1 text-sm" placeholder="kg" value={loss.quantity_kg} onChange={(e) => { const next = [...losses]; next[idx].quantity_kg = e.target.value; setLosses(next); }} />
            </div>
          ))}
        </section>

        <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#5C4033] py-3 text-white disabled:opacity-50">
          {saving ? 'Calcul…' : 'Enregistrer et calculer le rendement'}
        </button>
      </form>
    </div>
  );
}
