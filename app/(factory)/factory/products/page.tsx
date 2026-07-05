'use client';

import Link from 'next/link';
import { useFactoryStocks } from '@/lib/hooks/useFactory';

export default function FactoryProductsPage() {
  const { data: items, isLoading } = useFactoryStocks({ finished: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5C4033]">Produits finis</h1>
        <p className="text-sm text-[#8B6914]">Stock de dérivés cacao</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d4c4b0] bg-white">
        <table className="min-w-full divide-y divide-[#d4c4b0]">
          <thead className="bg-[#faf6f1]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Lot</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Produit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Quantité</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Origine lot</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center">Chargement…</td></tr>
            ) : (items as Array<Record<string, unknown>> ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun produit fini en stock</td></tr>
            ) : (
              (items as Array<Record<string, unknown>>).map((item) => (
                <tr key={item.id as string}>
                  <td className="px-4 py-3 font-medium">{item.lot_reference as string}</td>
                  <td className="px-4 py-3 text-sm">{(item.product_type as { name?: string })?.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(item.quantity_kg).toFixed(2)} kg</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{(item.source_lot_reference as string) || '-'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/factory/traceability?output=${encodeURIComponent(item.lot_reference as string)}`} className="text-sm text-[#5C4033] hover:underline">
                      Traçabilité
                    </Link>
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
