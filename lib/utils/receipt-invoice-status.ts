// CocoaTrack V2 - Derived receipt invoice status utilities

export type DerivedReceiptInvoiceStatus =
  | 'not_invoiced'
  | 'partially_invoiced'
  | 'invoiced';

export interface ReceiptLinkedDelivery {
  id?: string;
  invoice_status?: 'not_invoiced' | 'invoiced' | string | null;
  invoice_id?: string | null;
  invoice?: { id: string; code: string } | null;
}

export function extractLinkedDeliveries<T extends ReceiptLinkedDelivery>(
  receiptDeliveries: Array<{ delivery: T | null }>
): T[] {
  return receiptDeliveries.map((rd) => rd.delivery).filter((d): d is T => d != null);
}

export function deriveReceiptInvoiceStatus(
  deliveries: ReceiptLinkedDelivery[]
): DerivedReceiptInvoiceStatus {
  if (deliveries.length === 0) return 'not_invoiced';

  const invoicedCount = deliveries.filter((d) => d.invoice_status === 'invoiced').length;
  if (invoicedCount === 0) return 'not_invoiced';
  if (invoicedCount === deliveries.length) return 'invoiced';
  return 'partially_invoiced';
}

export function getReceiptInvoices(
  deliveries: ReceiptLinkedDelivery[]
): Array<{ id: string; code: string }> {
  const seen = new Map<string, string>();
  for (const d of deliveries) {
    if (d.invoice?.id && d.invoice.code) {
      seen.set(d.invoice.id, d.invoice.code);
    }
  }
  return Array.from(seen.entries()).map(([id, code]) => ({ id, code }));
}

export function getBillableDeliveryIds(
  deliveries: Array<{ id: string; invoice_status?: string | null }>
): string[] {
  return deliveries
    .filter((d) => d.invoice_status !== 'invoiced')
    .map((d) => d.id);
}

export function receiptStatusLabel(status: DerivedReceiptInvoiceStatus): string {
  switch (status) {
    case 'invoiced':
      return 'Facturé';
    case 'partially_invoiced':
      return 'Partiellement facturé';
    default:
      return 'Non facturé';
  }
}

export function matchesReceiptInvoiceFilter(
  status: DerivedReceiptInvoiceStatus,
  filter: 'not_invoiced' | 'partially_invoiced' | 'invoiced' | 'all'
): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_invoiced') {
    return status === 'not_invoiced' || status === 'partially_invoiced';
  }
  return status === filter;
}
