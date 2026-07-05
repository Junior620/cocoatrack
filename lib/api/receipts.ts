// CocoaTrack V2 - Collection Receipts API
// Client-side API functions for listing and filtering imported collection receipts
// Requirements: 19.2, 19.3, 19.7

import { createClient } from '@/lib/supabase/client';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
  getBillableDeliveryIds,
  matchesReceiptInvoiceFilter,
} from '@/lib/utils/receipt-invoice-status';
import type { PaginatedResult } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type ReceiptInvoiceStatus =
  | 'not_invoiced'
  | 'partially_invoiced'
  | 'invoiced'
  | 'all';

export interface ReceiptFilters {
  page?: number;
  pageSize?: number;
  cooperative_id?: string;
  planteur_id?: string;
  chef_planteur_id?: string;
  date_from?: string;
  date_to?: string;
  invoice_status?: ReceiptInvoiceStatus;
  search?: string;
}

export interface CollectionReceiptListItem {
  id: string;
  receipt_number: string;
  contract_number: string;
  campaign: string;
  transaction_date: string;
  cooperative_id: string;
  planteur_id: string;
  chef_planteur_id: string;
  payment_mode: string | null;
  amount_paid: number | null;
  balance: number | null;
  extraction_method: 'manual' | 'ocr';
  created_at: string;
  pdf_url: string;
  // Relations
  cooperative: { id: string; name: string; code: string } | null;
  planteur: { id: string; name: string; code: string } | null;
  chef_planteur: { id: string; name: string; code: string } | null;
  // Deliveries with invoice status
  receipt_deliveries: Array<{
    delivery: {
      id: string;
      code: string;
      weight_kg: number;
      total_amount: number;
      invoice_status: 'not_invoiced' | 'invoiced';
      invoice_id: string | null;
      invoice: { id: string; code: string } | null;
    } | null;
  }>;
}

// ============================================================================
// API
// ============================================================================

export const receiptsApi = {
  /**
   * List collection receipts with pagination and filters
   * Requirements: 19.2, 19.3
   */
  async list(filters: ReceiptFilters = {}): Promise<PaginatedResult<CollectionReceiptListItem>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      cooperative_id,
      planteur_id,
      chef_planteur_id,
      date_from,
      date_to,
      invoice_status,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('collection_receipts')
      .select(
        `
        id,
        receipt_number,
        contract_number,
        campaign,
        transaction_date,
        cooperative_id,
        planteur_id,
        chef_planteur_id,
        payment_mode,
        amount_paid,
        balance,
        extraction_method,
        created_at,
        pdf_url,
        cooperative:cooperatives!collection_receipts_cooperative_id_fkey(id, name, code),
        planteur:planteurs!collection_receipts_planteur_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!collection_receipts_chef_planteur_id_fkey(id, name, code),
        receipt_deliveries(
          delivery:deliveries!receipt_deliveries_delivery_id_fkey(
            id, code, weight_kg, total_amount, invoice_status, invoice_id,
            invoice:invoices!deliveries_invoice_id_fkey(id, code)
          )
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (cooperative_id) query = query.eq('cooperative_id', cooperative_id);
    if (planteur_id) query = query.eq('planteur_id', planteur_id);
    if (chef_planteur_id) query = query.eq('chef_planteur_id', chef_planteur_id);
    if (date_from) query = query.gte('transaction_date', date_from);
    if (date_to) query = query.lte('transaction_date', date_to);
    if (search) query = query.ilike('receipt_number', `%${search}%`);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch receipts: ${error.message}`);

    let items = (data || []) as unknown as CollectionReceiptListItem[];

    // Filter by invoice_status client-side (derived from linked deliveries)
    if (invoice_status && invoice_status !== 'all') {
      items = items.filter((r) => {
        const deliveries = extractLinkedDeliveries(r.receipt_deliveries);
        const status = deriveReceiptInvoiceStatus(deliveries);
        return matchesReceiptInvoiceFilter(status, invoice_status);
      });
    }

    return {
      data: items,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get a single receipt by ID
   */
  async get(id: string): Promise<CollectionReceiptListItem | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('collection_receipts')
      .select(
        `
        id, receipt_number, contract_number, campaign, transaction_date,
        cooperative_id, planteur_id, chef_planteur_id, payment_mode,
        amount_paid, balance, extraction_method, created_at, pdf_url,
        cooperative:cooperatives!collection_receipts_cooperative_id_fkey(id, name, code),
        planteur:planteurs!collection_receipts_planteur_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!collection_receipts_chef_planteur_id_fkey(id, name, code),
        receipt_deliveries(
          delivery:deliveries!receipt_deliveries_delivery_id_fkey(
            id, code, weight_kg, total_amount, invoice_status, invoice_id,
            invoice:invoices!deliveries_invoice_id_fkey(id, code)
          )
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch receipt: ${error.message}`);
    }

    return data as unknown as CollectionReceiptListItem;
  },

  /** Delivery IDs from a receipt that are not yet invoiced */
  getBillableDeliveryIds(receipt: CollectionReceiptListItem): string[] {
    const deliveries = extractLinkedDeliveries(receipt.receipt_deliveries);
    return getBillableDeliveryIds(
      deliveries.map((d) => ({ id: d.id, invoice_status: d.invoice_status }))
    );
  },
};
