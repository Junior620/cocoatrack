'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { FileText, Plus, Truck } from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { DeliveriesSubNav } from '@/components/deliveries/DeliveriesSubNav';
import { useWaybillsList } from '@/lib/hooks/useWaybills';

export default function WaybillsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const filters = useMemo(
    () => ({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: 20,
      cooperative_id:
        searchParams.get('cooperative_id') ||
        (isAdmin ? undefined : user?.cooperative_id || undefined),
      search: searchParams.get('search') || undefined,
    }),
    [searchParams, isAdmin, user?.cooperative_id]
  );

  const { data, isLoading, error } = useWaybillsList(filters);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="space-y-6">
      <DeliveriesSubNav />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lettres de voiture</h1>
          <p className="mt-1 text-sm text-gray-500">
            Transports et preuves logistiques rattachés aux livraisons
          </p>
        </div>
        <Link
          href="/deliveries/waybills/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle lettre de voiture
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Trajet</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Livraisons</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Poids</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Lot</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Doc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Aucune lettre de voiture
                </td>
              </tr>
            )}
            {data?.data.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/deliveries/waybills/${w.id}`}
                    className="font-medium text-primary-600 hover:text-primary-800"
                  >
                    {w.code}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {formatDate(w.loading_date)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {[w.origin_location, w.destination_location].filter(Boolean).join(' → ') || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5 text-gray-400" />
                    {w.delivery_count}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {w.total_weight_kg != null
                    ? `${Number(w.total_weight_kg).toLocaleString('fr-FR')} kg`
                    : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {w.lot_number || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {w.document_storage_path ? (
                    <FileText className="inline h-4 w-4 text-green-600" aria-label="Scan présent" />
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', String(p));
                router.push(`/deliveries/waybills?${params.toString()}`);
              }}
              className={`rounded px-3 py-1 text-sm ${
                p === filters.page ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
