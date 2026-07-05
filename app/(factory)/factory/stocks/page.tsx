'use client';

import Link from 'next/link';
import { useFactoryStocks } from '@/lib/hooks/useFactory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';

export default function FactoryStocksPage() {
  const { data: items, isLoading, error } = useFactoryStocks({ raw: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Stock fèves brutes</h1>
          <p className="text-sm text-[#8B6914]">Lots disponibles pour transformation</p>
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
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Lot</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Produit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Quantité</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Magasin</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center">Chargement…</td></tr>
            ) : (items as Array<Record<string, unknown>> ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun stock</td></tr>
            ) : (
              (items as Array<Record<string, unknown>>).map((item) => (
                <tr key={item.id as string}>
                  <td className="px-4 py-3 font-medium">{item.lot_reference as string}</td>
                  <td className="px-4 py-3 text-sm">{(item.product_type as { name?: string })?.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(item.quantity_kg).toFixed(2)} kg</td>
                  <td className="px-4 py-3 text-sm">{(item.warehouse as { name?: string })?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.status === 'available' ? 'bg-green-100 text-green-800' : item.status === 'quarantine' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>
                      {item.status as string}
                    </span>
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
