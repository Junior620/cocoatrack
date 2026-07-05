'use client';

import Link from 'next/link';
import { FileText, Package, Receipt } from 'lucide-react';
import type { ReceiptPipelineStats } from '@/lib/api/dashboard';

interface ReceiptPipelineWidgetProps {
  stats: ReceiptPipelineStats | null;
  loading?: boolean;
}

function StatBlock({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof FileText;
  label: string;
  value: number | string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}

export function ReceiptPipelineWidget({ stats, loading = false }: ReceiptPipelineWidgetProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalReceipts = stats?.totalReceipts ?? 0;
  const fullyInvoiced = stats?.fullyInvoicedReceipts ?? 0;
  const invoicedPct = stats?.invoicedPct ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pipeline reçus → factures
          </h2>
          <p className="text-xs text-gray-500">
            {invoicedPct}% des reçus entièrement facturés
          </p>
        </div>
        <Link
          href="/receipts?invoice_status=not_invoiced"
          className="text-sm font-medium text-primary-600 hover:text-primary-800"
        >
          Voir les reçus à facturer
        </Link>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${Math.min(invoicedPct, 100)}%` }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatBlock
          icon={FileText}
          label="Reçus importés"
          value={totalReceipts}
          href="/receipts"
        />
        <StatBlock
          icon={Package}
          label="Livraisons non facturées"
          value={stats?.uninvoicedDeliveries ?? 0}
          href="/receipts?invoice_status=not_invoiced"
        />
        <StatBlock
          icon={Receipt}
          label="Reçus facturés"
          value={fullyInvoiced}
          href="/receipts?invoice_status=invoiced"
        />
      </div>
    </div>
  );
}
