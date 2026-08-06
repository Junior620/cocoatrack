'use client';

import Link from 'next/link';
import { useProductionOrders } from '@/lib/hooks/useFactory';
import { PRODUCTION_ORDER_STATUS_LABELS } from '@/types/mes';
import type { ProductionOrder, ProductionOrderStatus } from '@/types/mes';

export default function ProductionOrdersPage() {
  const { data, isLoading, error } = useProductionOrders();
  const orders = (data?.data ?? []) as ProductionOrder[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Ordres de fabrication</h1>
          <p className="text-sm text-[#8B6914]">MES — recettes, réservation, exécution</p>
        </div>
        <Link
          href="/factory/production-orders/new"
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white"
        >
          Nouvel OF
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}

      <div className="overflow-hidden rounded-xl border border-[#d4c4b0] bg-white">
        <table className="min-w-full divide-y divide-[#d4c4b0]">
          <thead className="bg-[#faf6f1]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">N° OF</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Produit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Qté (kg)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  Chargement…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Aucun OF
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/factory/production-orders/${o.id}`}
                      className="font-medium text-[#5C4033] hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{o.product_label ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {Number(o.planned_quantity_kg).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {PRODUCTION_ORDER_STATUS_LABELS[o.status as ProductionOrderStatus] ?? o.status}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === 'in_progress' && (
                      <Link
                        href={`/factory/production-orders/${o.id}`}
                        className="text-sm text-[#5C4033] hover:underline"
                      >
                        Exécuter →
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
