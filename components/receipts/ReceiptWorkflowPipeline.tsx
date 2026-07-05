'use client';

import Link from 'next/link';
import { Check, FileText, Package, Receipt } from 'lucide-react';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
  getReceiptInvoices,
  type DerivedReceiptInvoiceStatus,
} from '@/lib/utils/receipt-invoice-status';
import type { CollectionReceiptListItem } from '@/lib/api/receipts';

interface ReceiptWorkflowPipelineProps {
  receipt: CollectionReceiptListItem;
  onInvoice?: () => void;
  invoicing?: boolean;
}

type StepState = 'done' | 'active' | 'pending';

function stepStateForIndex(
  index: number,
  invoiceStatus: DerivedReceiptInvoiceStatus
): StepState {
  if (index === 0) return 'done';
  if (index === 1) {
    return invoiceStatus === 'not_invoiced' ? 'active' : 'done';
  }
  if (invoiceStatus === 'invoiced') return 'done';
  if (invoiceStatus === 'partially_invoiced') return 'active';
  return 'pending';
}

export function ReceiptWorkflowPipeline({
  receipt,
  onInvoice,
  invoicing = false,
}: ReceiptWorkflowPipelineProps) {
  const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
  const invoiceStatus = deriveReceiptInvoiceStatus(deliveries);
  const invoices = getReceiptInvoices(deliveries);
  const invoicedCount = deliveries.filter((d) => d.invoice_status === 'invoiced').length;

  const steps = [
    {
      label: 'Reçu importé',
      description: receipt.receipt_number,
      icon: FileText,
    },
    {
      label: 'Livraisons',
      description: `${deliveries.length} créée(s) · ${invoicedCount}/${deliveries.length} facturée(s)`,
      icon: Package,
    },
    {
      label: 'Facturation',
      description:
        invoiceStatus === 'invoiced'
          ? `${invoices.length} facture(s)`
          : invoiceStatus === 'partially_invoiced'
            ? 'En cours'
            : 'À faire',
      icon: Receipt,
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Pipeline reçu → livraisons → facture
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const state = stepStateForIndex(index, invoiceStatus);
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative flex items-start gap-3">
              {index < steps.length - 1 && (
                <div
                  className="absolute left-5 top-10 hidden h-px w-[calc(100%-1.25rem)] bg-gray-200 md:block"
                  aria-hidden
                />
              )}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  state === 'done'
                    ? 'bg-green-100 text-green-700'
                    : state === 'active'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {state === 'done' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm font-medium text-gray-900">{step.label}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
                {index === 2 && invoices.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invoices.map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800"
                      >
                        {inv.code}
                      </Link>
                    ))}
                  </div>
                )}
                {index === 2 &&
                  invoiceStatus !== 'invoiced' &&
                  onInvoice &&
                  deliveries.length > 0 && (
                    <button
                      type="button"
                      onClick={onInvoice}
                      disabled={invoicing}
                      className="mt-2 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {invoicing ? 'Facturation…' : 'Facturer ce reçu'}
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
