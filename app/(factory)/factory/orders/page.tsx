'use client';

import Link from 'next/link';
import { useFactoryOrders } from '@/lib/hooks/useFactory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';
import { TRANSFORMATION_TYPE_LABELS } from '@/types/factory';
import type { TransformationType } from '@/types/factory';

export default function FactoryOrdersPage() {
  const { data, isLoading, error } = useFactoryOrders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Ordres de transformation</h1>
          <p className="text-sm text-[#8B6914]">Production et rendement</p>
        </div>
        <Link href="/factory/orders/new" className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white">
          Nouvel ordre
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}

      <div className="overflow-hidden rounded-xl border border-[#d4c4b0] bg-white">
        <table className="min-w-full divide-y divide-[#d4c4b0]">
          <thead className="bg-[#faf6f1]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">N° ordre</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Entrée (kg)</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Rendement</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center">Chargement…</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun ordre</td></tr>
            ) : (
              data!.data.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link href={`/factory/orders/${o.id}`} className="font-medium text-[#5C4033] hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {TRANSFORMATION_TYPE_LABELS[o.transformation_type as TransformationType] ?? o.transformation_type}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{o.input_quantity_kg != null ? Number(o.input_quantity_kg).toFixed(0) : '-'}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {o.actual_yield_rate != null ? `${Number(o.actual_yield_rate).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3"><FactoryStatusBadge status={o.status} type="order" /></td>
                  <td className="px-4 py-3 text-right">
                    {['draft', 'planned', 'in_progress'].includes(o.status) && (
                      <Link href={`/factory/orders/${o.id}/production`} className="text-sm text-[#5C4033] hover:underline">
                        Saisie →
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
