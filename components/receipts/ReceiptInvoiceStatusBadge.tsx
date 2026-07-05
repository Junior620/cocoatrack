'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  type DerivedReceiptInvoiceStatus,
  receiptStatusLabel,
} from '@/lib/utils/receipt-invoice-status';

interface ReceiptInvoiceStatusBadgeProps {
  status: DerivedReceiptInvoiceStatus;
  invoices?: Array<{ id: string; code: string }>;
}

const styles: Record<DerivedReceiptInvoiceStatus, string> = {
  invoiced: 'bg-green-100 text-green-800',
  partially_invoiced: 'bg-amber-100 text-amber-800',
  not_invoiced: 'bg-yellow-100 text-yellow-800',
};

export function ReceiptInvoiceStatusBadge({
  status,
  invoices = [],
}: ReceiptInvoiceStatusBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${styles[status]}`}
      >
        {receiptStatusLabel(status)}
      </span>
      {invoices.map((inv) => (
        <Link
          key={inv.id}
          href={`/invoices/${inv.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
        >
          {inv.code}
          <ExternalLink className="h-3 w-3" />
        </Link>
      ))}
    </div>
  );
}
