'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryOrder, useFactoryProductTypes, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';
import { YieldIndicatorBadge, getYieldIndicatorFromValues } from '@/components/factory/YieldIndicator';
import { TRANSFORMATION_TYPE_LABELS } from '@/types/factory';
import type { TransformationType, LossType } from '@/types/factory';

export default function FactoryOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: order, isLoading, error } = useFactoryOrder(id);
  const invalidate = useInvalidateFactory();
  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    setValidating(true);
    try {
      await factoryApi.validateOrder(id);
      invalidate();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setValidating(false);
    }
  };

  if (isLoading) return <p>Chargement…</p>;
  if (error || !order) return <div className="text-red-600">{error?.message || 'Ordre introuvable'}</div>;

  const indicator = order.actual_yield_rate != null
    ? getYieldIndicatorFromValues(Number(order.actual_yield_rate), order.theoretical_yield_rate != null ? Number(order.theoretical_yield_rate) : null)
    : 'green';

  return (
    <div className="space-y-6">
      <Link href="/factory/orders" className="text-sm text-[#8B6914] hover:underline">← Ordres</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">{order.order_number}</h1>
          <p className="text-sm text-gray-500">
            {TRANSFORMATION_TYPE_LABELS[order.transformation_type as TransformationType]}
          </p>
        </div>
        <FactoryStatusBadge status={order.status} type="order" />
      </div>

      {order.actual_yield_rate != null && (
        <YieldIndicatorBadge
          indicator={indicator}
          yieldPct={Number(order.actual_yield_rate)}
          expectedPct={order.theoretical_yield_rate != null ? Number(order.theoretical_yield_rate) : null}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Entrée" value={order.input_quantity_kg != null ? `${Number(order.input_quantity_kg).toFixed(0)} kg` : '-'} />
        <Stat label="Rendement réel" value={order.actual_yield_rate != null ? `${Number(order.actual_yield_rate).toFixed(1)}%` : '-'} />
        <Stat label="Pertes" value={order.loss_rate != null ? `${Number(order.loss_rate).toFixed(1)}%` : '-'} />
      </div>

      {order.outputs && order.outputs.length > 0 && (
        <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#5C4033]">Produits obtenus</h2>
          <ul className="space-y-2">
            {order.outputs.map((o) => (
              <li key={o.id} className="flex justify-between text-sm">
                <span>{o.product_name} ({o.output_lot_number})</span>
                <span className="font-medium">{Number(o.quantity_produced_kg).toFixed(2)} kg</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.losses && order.losses.length > 0 && (
        <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#5C4033]">Pertes</h2>
          <ul className="space-y-1 text-sm">
            {order.losses.map((l) => (
              <li key={l.id}>{l.loss_type}: {Number(l.quantity_kg).toFixed(2)} kg</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {['draft', 'planned', 'in_progress'].includes(order.status) && (
          <Link href={`/factory/orders/${id}/production`} className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white">
            Saisie production
          </Link>
        )}
        {order.status === 'completed' && (
          <button type="button" onClick={handleValidate} disabled={validating} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {validating ? 'Validation…' : 'Valider production (mise à jour stock)'}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
      <p className="text-xs text-[#8B6914]">{label}</p>
      <p className="text-xl font-bold text-[#5C4033]">{value}</p>
    </div>
  );
}
