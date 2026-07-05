'use client';

import Link from 'next/link';
import { FileText, Package, Receipt, Plus } from 'lucide-react';
import { ReceiptPipelineWidget } from '@/components/dashboard/ReceiptPipelineWidget';
import { ReceiptInvoiceStatusBadge } from '@/components/receipts/ReceiptInvoiceStatusBadge';
import { ReceiptImportButton } from '@/components/receipts/ReceiptImportButton';
import type { CooperativeOperationalSummary } from '@/lib/api/cooperatives';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
} from '@/lib/utils/receipt-invoice-status';

interface CooperativeOperationalHubProps {
  cooperativeId: string;
  cooperativeName: string;
  summary: CooperativeOperationalSummary | null;
  loading?: boolean;
  canImport?: boolean;
  onImportComplete?: () => void;
}

export function CooperativeOperationalHub({
  cooperativeId,
  cooperativeName,
  summary,
  loading = false,
  canImport = false,
  onImportComplete,
}: CooperativeOperationalHubProps) {
  if (loading || !summary) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-24 rounded bg-gray-100" />
      </div>
    );
  }

  const pipelineStats = {
    totalReceipts: summary.receipts.total,
    uninvoicedDeliveries: summary.pipeline.uninvoicedDeliveries,
    fullyInvoicedReceipts: summary.receipts.fullyInvoiced,
    invoicedPct: summary.pipeline.invoicedPct,
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(n) + ' XAF';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Activité opérationnelle</h2>
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <ReceiptImportButton
              cooperativeId={cooperativeId}
              onImportComplete={() => onImportComplete?.()}
            />
          )}
          <Link
            href={`/invoices/generate?cooperative_id=${cooperativeId}`}
            className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Générer une facture
          </Link>
          <Link
            href={`/receipts?cooperative_id=${cooperativeId}&invoice_status=not_invoiced`}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reçus à facturer ({summary.receipts.toInvoice})
          </Link>
        </div>
      </div>

      <ReceiptPipelineWidget stats={pipelineStats} loading={false} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href={`/deliveries?cooperative_id=${cooperativeId}`}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-primary-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Livraisons</p>
              <p className="text-xl font-bold text-gray-900">{summary.deliveries.total}</p>
              <p className="text-xs text-gray-500">
                {summary.deliveries.uninvoiced} non facturée(s)
              </p>
            </div>
          </div>
        </Link>
        <Link
          href={`/receipts?cooperative_id=${cooperativeId}`}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-primary-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Reçus</p>
              <p className="text-xl font-bold text-gray-900">{summary.receipts.total}</p>
              <p className="text-xs text-gray-500">{summary.receipts.toInvoice} à traiter</p>
            </div>
          </div>
        </Link>
        <Link
          href={`/invoices?cooperative_id=${cooperativeId}`}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-primary-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Factures</p>
              <p className="text-xl font-bold text-gray-900">{summary.invoices.total}</p>
              <p className="text-xs text-gray-500">{summary.invoices.draft} brouillon(s)</p>
            </div>
          </div>
        </Link>
      </div>

      {summary.recentReceipts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Reçus récents — {cooperativeName}</h3>
            <Link
              href={`/receipts?cooperative_id=${cooperativeId}`}
              className="text-xs font-medium text-primary-600 hover:text-primary-800"
            >
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {summary.recentReceipts.map((receipt) => {
              const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
              const status = deriveReceiptInvoiceStatus(deliveries);
              return (
                <div
                  key={receipt.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <Link
                      href={`/receipts/${receipt.id}`}
                      className="font-medium text-primary-600 hover:text-primary-800"
                    >
                      {receipt.receipt_number}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {receipt.planteur?.name ?? '—'} ·{' '}
                      {new Date(receipt.transaction_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <ReceiptInvoiceStatusBadge status={status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.invoices.recent.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Factures récentes</h3>
          <div className="divide-y divide-gray-100">
            {summary.invoices.recent.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/invoices/${inv.id}`} className="font-medium text-primary-600">
                  {inv.code}
                </Link>
                <span className="text-gray-600">{formatCurrency(Number(inv.total_amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/planteurs/new?cooperative_id=${cooperativeId}`}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter un planteur
        </Link>
        <Link
          href={`/chef-planteurs/new?cooperative_id=${cooperativeId}`}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter un fournisseur
        </Link>
      </div>
    </div>
  );
}
