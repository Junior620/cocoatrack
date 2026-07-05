'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { receiptsApi } from '@/lib/api/receipts';
import { invoicesApi } from '@/lib/api/invoices';
import type { CollectionReceiptListItem } from '@/lib/api/receipts';
import { ReceiptWorkflowPipeline } from '@/components/receipts/ReceiptWorkflowPipeline';
import { ReceiptInvoiceStatusBadge } from '@/components/receipts/ReceiptInvoiceStatusBadge';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
  getReceiptInvoices,
} from '@/lib/utils/receipt-invoice-status';

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const receiptId = params.id as string;

  const [receipt, setReceipt] = useState<CollectionReceiptListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);

  const canInvoice = user && hasPermission(user.role, 'invoices:create');

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await receiptsApi.get(receiptId);
      if (!data) {
        setError('Reçu non trouvé');
        return;
      }
      setReceipt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';

  const openPdf = async () => {
    if (!receipt) return;
    const res = await fetch(
      `/api/receipts/signed-url?path=${encodeURIComponent(receipt.pdf_url)}`
    );
    if (res.ok) {
      const { signedUrl } = await res.json();
      window.open(signedUrl, '_blank');
    }
  };

  const handleInvoice = async () => {
    if (!receipt || !canInvoice) return;

    const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
    const status = deriveReceiptInvoiceStatus(deliveries);
    const billableIds = receiptsApi.getBillableDeliveryIds(receipt);

    if (billableIds.length === 0) return;

    if (status === 'partially_invoiced') {
      router.push(
        `/invoices/generate?receipt_id=${receipt.id}&delivery_ids=${billableIds.join(',')}`
      );
      return;
    }

    setInvoicing(true);
    setError(null);
    try {
      const txDate = receipt.transaction_date.split('T')[0];
      const targetType = receipt.chef_planteur_id ? 'fournisseur' : 'cooperative';

      const invoice = await invoicesApi.generateFromDeliveriesExtended({
        target_type: targetType,
        cooperative_id: receipt.cooperative_id || undefined,
        chef_planteur_id:
          targetType === 'fournisseur' ? receipt.chef_planteur_id : undefined,
        period_start: txDate,
        period_end: txDate,
        delivery_ids: billableIds,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la facturation');
      setInvoicing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !receipt) {
    return (
      <div className="space-y-4">
        <Link href="/receipts" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Retour aux reçus
        </Link>
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!receipt) return null;

  const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
  const invoiceStatus = deriveReceiptInvoiceStatus(deliveries);
  const invoices = getReceiptInvoices(deliveries);
  const totalWeight = deliveries.reduce((s, d) => s + Number(d.weight_kg), 0);
  const totalAmount = deliveries.reduce((s, d) => s + Number(d.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/receipts"
            className="mb-3 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux reçus
          </Link>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{receipt.receipt_number}</h1>
              <p className="text-sm text-gray-500">
                Contrat {receipt.contract_number} · Campagne {receipt.campaign}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPdf}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voir PDF
          </button>
          {canInvoice && invoiceStatus !== 'invoiced' && deliveries.length > 0 && (
            <button
              type="button"
              onClick={handleInvoice}
              disabled={invoicing}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {invoicing ? 'Facturation…' : 'Facturer ce reçu'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <ReceiptWorkflowPipeline
        receipt={receipt}
        onInvoice={canInvoice && invoiceStatus !== 'invoiced' ? handleInvoice : undefined}
        invoicing={invoicing}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Informations
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Date transaction</dt>
              <dd className="font-medium text-gray-900">{formatDate(receipt.transaction_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Coopérative</dt>
              <dd className="font-medium text-gray-900">{receipt.cooperative?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Planteur</dt>
              <dd className="font-medium text-gray-900">{receipt.planteur?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Fournisseur</dt>
              <dd className="font-medium text-gray-900">{receipt.chef_planteur?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Montant versé</dt>
              <dd className="font-medium text-gray-900">
                {receipt.amount_paid != null ? formatCurrency(Number(receipt.amount_paid)) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Solde</dt>
              <dd className="font-medium text-gray-900">
                {receipt.balance != null ? formatCurrency(Number(receipt.balance)) : '—'}
              </dd>
            </div>
            <div className="border-t pt-3">
              <dt className="mb-2 text-gray-500">Statut facturation</dt>
              <dd>
                <ReceiptInvoiceStatusBadge status={invoiceStatus} invoices={invoices} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Livraisons liées ({deliveries.length})
            </h2>
            <div className="text-sm text-gray-600">
              {totalWeight.toLocaleString('fr-FR')} kg · {formatCurrency(totalAmount)}
            </div>
          </div>
          {deliveries.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune livraison liée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Code
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Poids
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Montant
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Facturation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link
                          href={`/deliveries/${d.id}`}
                          className="font-medium text-primary-600 hover:text-primary-800"
                        >
                          {d.code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {Number(d.weight_kg).toLocaleString('fr-FR')} kg
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(Number(d.total_amount))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {d.invoice_status === 'invoiced' ? (
                          d.invoice ? (
                            <Link
                              href={`/invoices/${d.invoice.id}`}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              {d.invoice.code}
                            </Link>
                          ) : (
                            <span className="text-green-700">Facturé</span>
                          )
                        ) : (
                          <span className="text-amber-700">Non facturé</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
