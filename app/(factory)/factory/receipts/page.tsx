'use client';

import Link from 'next/link';
import { useFactoryReceipts } from '@/lib/hooks/useFactory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';
import { RECEIPT_STATUS_LABELS } from '@/types/factory';

export default function FactoryReceiptsPage() {
  const { data, isLoading, error } = useFactoryReceipts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Réceptions usine</h1>
          <p className="text-sm text-[#8B6914]">Lots de fèves reçus à l&apos;usine</p>
        </div>
        <Link
          href="/factory/receipts/new"
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a3329]"
        >
          Nouvelle réception
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error instanceof Error ? error.message : 'Erreur'}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#d4c4b0] bg-white shadow-sm">
        <table className="min-w-full divide-y divide-[#d4c4b0]">
          <thead className="bg-[#faf6f1]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">N°</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Coop / Fournisseur</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Lot amont</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#8B6914]">Poids reçu</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#8B6914]">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Chargement…</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune réception</td></tr>
            ) : (
              data!.data.map((r) => (
                <tr key={r.id} className="hover:bg-[#faf6f1]">
                  <td className="px-4 py-3">
                    <Link href={`/factory/receipts/${r.id}`} className="font-medium text-[#5C4033] hover:underline">
                      {r.receipt_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(r.received_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.cooperative?.name || r.supplier_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.upstream_lot_number || r.waybill?.code || '-'}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{Number(r.received_weight_kg).toFixed(0)} kg</td>
                  <td className="px-4 py-3"><FactoryStatusBadge status={r.status} type="receipt" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
