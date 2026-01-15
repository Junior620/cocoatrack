// CocoaTrack V2 - Invoice Validation Schemas
// Zod schemas for invoice data validation

import { z } from 'zod';
import type { Database } from '@/types/database.gen';

type Invoice = Database['public']['Tables']['invoices']['Row'];

// ============================================================================
// ENUMS
// ============================================================================

export const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

// ============================================================================
// CREATE INVOICE SCHEMA
// ============================================================================

export const createInvoiceSchema = z.object({
  cooperative_id: z.string().uuid('Invalid cooperative ID'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
}).refine(
  (data) => new Date(data.period_start) <= new Date(data.period_end),
  { message: 'Period start must be before or equal to period end', path: ['period_end'] }
);

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ============================================================================
// UPDATE INVOICE SCHEMA
// ============================================================================

export const updateInvoiceSchema = z.object({
  status: invoiceStatusSchema.optional(),
  pdf_path: z.string().max(500).optional().nullable(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ============================================================================
// GENERATE INVOICE SCHEMA
// Used when generating an invoice from deliveries
// ============================================================================

export const generateInvoiceSchema = z.object({
  cooperative_id: z.string().uuid('Invalid cooperative ID'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  delivery_ids: z.array(z.string().uuid()).optional(), // If not provided, all deliveries in period are included
}).refine(
  (data) => new Date(data.period_start) <= new Date(data.period_end),
  { message: 'Period start must be before or equal to period end', path: ['period_end'] }
);

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

// ============================================================================
// BULK GENERATE INVOICE SCHEMA
// ============================================================================

export const bulkGenerateInvoiceSchema = z.object({
  cooperative_ids: z.array(z.string().uuid()).min(1, 'At least one cooperative is required'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
}).refine(
  (data) => new Date(data.period_start) <= new Date(data.period_end),
  { message: 'Period start must be before or equal to period end', path: ['period_end'] }
);

export type BulkGenerateInvoiceInput = z.infer<typeof bulkGenerateInvoiceSchema>;

// ============================================================================
// INVOICE FILTERS SCHEMA
// ============================================================================

export const invoiceFiltersSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  cooperative_id: z.string().uuid().optional(),
  status: invoiceStatusSchema.optional(),
  period_start_from: z.string().optional(),
  period_start_to: z.string().optional(),
  search: z.string().max(100).optional(),
});

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;

// ============================================================================
// INVOICE WITH RELATIONS TYPE
// ============================================================================

export interface InvoiceWithRelations extends Invoice {
  cooperative?: {
    id: string;
    name: string;
    code: string;
  } | null;
  chef_planteur?: {
    id: string;
    name: string;
    code: string;
  } | null;
  planteur?: {
    id: string;
    name: string;
    code: string;
  } | null;
  created_by_profile?: {
    id: string;
    full_name: string;
  };
  delivery_count?: number;
}

// ============================================================================
// INVOICE DELIVERY TYPE
// ============================================================================

export interface InvoiceDelivery {
  id: string;
  invoice_id: string;
  delivery_id: string;
  created_at: string;
  delivery?: {
    id: string;
    code: string;
    weight_kg: number;
    price_per_kg: number;
    total_amount: number;
    delivered_at: string;
    planteur?: {
      id: string;
      name: string;
      code: string;
    };
  };
}

// ============================================================================
// INVOICE SUMMARY TYPE
// ============================================================================

export interface InvoiceSummary {
  total_deliveries: number;
  total_weight_kg: number;
  total_amount_xaf: number;
  average_price_per_kg: number;
  deliveries_by_grade: {
    A: number;
    B: number;
    C: number;
  };
}
