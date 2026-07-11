'use client';

// CocoaTrack V2 - Collection Receipts List Page
// Displays all imported collection receipts with filters and invoice status
// Requirements: 19.2, 19.3, 19.7

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Search, FileText } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { receiptsApi } from '@/lib/api/receipts';
import { ReceiptImportButton } from '@/components/receipts/ReceiptImportButton';
import { ReceiptInvoiceStatusBadge } from '@/components/receipts/ReceiptInvoiceStatusBadge';
import type { CollectionReceiptListItem, ReceiptFilters, ReceiptInvoiceStatus } from '@/lib/api/receipts';
import type { PaginatedResult } from '@/types';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
  getReceiptInvoices,
} from '@/lib/utils/receipt-invoice-status';

export default function ReceiptsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [data, setData] = useState<PaginatedResult<CollectionReceiptListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters: ReceiptFilters = {
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '20'),
    search: searchParams.get('search') || undefined,
    cooperative_id: searchParams.get('cooperative_id') || undefined,
    planteur_id: searchParams.get('planteur_id') || undefined,
    chef_planteur_id: searchParams.get('chef_planteur_id') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    invoice_status: (searchParams.get('invoice_status') as ReceiptInvoiceStatus) || 'all',
  };

  const canImport = user && (user.role === 'manager' || user.role === 'admin');
  const canInvoice = user && hasPermission(user.role, 'invoices:create');

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await receiptsApi.list(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des reçus');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const updateFilters = (newFilters: Partial<ReceiptFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`/receipts?${params.toString()}`);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const handleInvoiceReceipt = (receipt: CollectionReceiptListItem) => {
    const status = deriveReceiptInvoiceStatus(extractLinkedDeliveries(receipt.receipt_deliveries));
    const billableIds = receiptsApi.getBillableDeliveryIds(receipt);
    if (status === 'partially_invoiced' && billableIds.length > 0) {
      router.push(
        `/invoices/generate?receipt_id=${receipt.id}&delivery_ids=${billableIds.join(',')}`
      );
      return;
    }
    router.push(`/receipts/${receipt.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reçus de collecte</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reçus importés, {data?.total ?? 0} au total
          </p>
        </div>
        {canImport && (
          <ReceiptImportButton onImportComplete={() => fetchReceipts()} />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro de reçu..."
            defaultValue={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value || undefined, page: 1 })}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Invoice status filter */}
        <select
          value={filters.invoice_status || 'all'}
          onChange={(e) =>
            updateFilters({ invoice_status: e.target.value as ReceiptInvoiceStatus, page: 1 })
          }
          className="rounded-md border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="not_invoiced">À facturer</option>
          <option value="partially_invoiced">Partiellement facturés</option>
          <option value="invoiced">Facturés</option>
        </select>

        {/* Date from */}
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => updateFilters({ date_from: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />

        {/* Date to */}
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => updateFilters({ date_to: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white p-4 shadow">
              <div className="h-4 w-1/4 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        <>
          <div className="overflow-hidden rounded-lg bg-white shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    N° Reçu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Planteur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Campagne
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Livraisons
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Statut facture
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                      Aucun reçu trouvé
                    </td>
                  </tr>
                ) : (
                  data.data.map((receipt) => {
                    const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
                    const invoiceStatus = deriveReceiptInvoiceStatus(deliveries);
                    const invoices = getReceiptInvoices(deliveries);
                    const deliveryCount = receipt.receipt_deliveries.length;

                    return (
                      <tr key={receipt.id} className="hover:bg-gray-50">
                        {/* Receipt number */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <Link
                                href={`/receipts/${receipt.id}`}
                                className="font-medium text-primary-600 hover:text-primary-800"
                              >
                                {receipt.receipt_number}
                              </Link>
                              <div className="text-xs text-gray-500">{receipt.contract_number}</div>
                            </div>
                          </div>
                        </td>

                        {/* Planteur */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {receipt.planteur?.name ?? '-'}
                        </td>

                        {/* Chef planteur */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {receipt.chef_planteur?.name ?? '-'}
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(receipt.transaction_date)}
                        </td>

                        {/* Campaign */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {receipt.campaign}
                        </td>

                        {/* Delivery count */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {deliveryCount} livraison{deliveryCount !== 1 ? 's' : ''}
                        </td>

                        {/* Invoice status */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <ReceiptInvoiceStatusBadge
                            status={invoiceStatus}
                            invoices={invoices}
                          />
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/receipts/${receipt.id}`}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Voir
                            </Link>
                            {canInvoice && invoiceStatus !== 'invoiced' && deliveryCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleInvoiceReceipt(receipt)}
                                className="text-primary-600 hover:text-primary-900 font-medium"
                              >
                                Facturer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/receipts/signed-url?path=${encodeURIComponent(receipt.pdf_url)}`);
                                if (res.ok) {
                                  const { signedUrl } = await res.json();
                                  window.open(signedUrl, '_blank');
                                }
                              }}
                              className="text-primary-600 hover:text-primary-900 font-medium"
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => updateFilters({ page: (filters.page ?? 1) - 1 })}
                disabled={(filters.page ?? 1) === 1}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-700">
                Page {filters.page} sur {data.totalPages}
              </span>
              <button
                onClick={() => updateFilters({ page: (filters.page ?? 1) + 1 })}
                disabled={(filters.page ?? 1) === data.totalPages}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
