// CocoaTrack V2 - Invoices API
// Client-side API functions for invoice operations
// @ts-nocheck - Types need to be regenerated from Supabase

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.gen';
import type { PaginatedResult } from '@/types';
import type {
  InvoiceFilters,
  InvoiceWithRelations,
  InvoiceDelivery,
  InvoiceSummary,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  GenerateInvoiceInput,
  BulkGenerateInvoiceInput,
  InvoiceStatus,
} from '@/lib/validations/invoice';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Invoices API - Client-side functions for invoice operations
 */
export const invoicesApi = {
  /**
   * List invoices with pagination and filters
   */
  async list(filters: InvoiceFilters = {}): Promise<PaginatedResult<InvoiceWithRelations>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      cooperative_id,
      status,
      period_start_from,
      period_start_to,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('invoices')
      .select(
        `
        *,
        cooperative:cooperatives!invoices_cooperative_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!invoices_chef_planteur_id_fkey(id, name, code),
        planteur:planteurs!invoices_planteur_id_fkey(id, name, code),
        created_by_profile:profiles!invoices_created_by_fkey(id, full_name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (period_start_from) {
      query = query.gte('period_start', period_start_from);
    }
    if (period_start_to) {
      query = query.lte('period_start', period_start_to);
    }
    if (search) {
      query = query.ilike('code', `%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as InvoiceWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get a single invoice by ID with all relations
   */
  async get(id: string): Promise<InvoiceWithRelations | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        cooperative:cooperatives!invoices_cooperative_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!invoices_chef_planteur_id_fkey(id, name, code),
        planteur:planteurs!invoices_planteur_id_fkey(id, name, code),
        created_by_profile:profiles!invoices_created_by_fkey(id, full_name)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    return data as unknown as InvoiceWithRelations;
  },

  /**
   * Get deliveries associated with an invoice
   */
  async getDeliveries(invoiceId: string): Promise<InvoiceDelivery[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('invoice_deliveries')
      .select(
        `
        *,
        delivery:deliveries!invoice_deliveries_delivery_id_fkey(
          id, code, weight_kg, price_per_kg, total_amount, delivered_at,
          planteur:planteurs!deliveries_planteur_id_fkey(id, name, code)
        )
      `
      )
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch invoice deliveries: ${error.message}`);
    }

    return (data || []) as unknown as InvoiceDelivery[];
  },

  /**
   * Create a new invoice (empty, without deliveries)
   */
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        cooperative_id: input.cooperative_id,
        period_start: input.period_start,
        period_end: input.period_end,
        created_by: user.id,
        code: '', // Will be generated by trigger
        total_weight_kg: 0,
        total_amount: 0,
        status: 'draft',
      } as InvoiceInsert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    return data;
  },

  /**
   * Generate an invoice from deliveries
   * Calculates totals automatically from the deliveries in the period
   */
  async generateFromDeliveries(input: GenerateInvoiceInput): Promise<Invoice> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get deliveries for the period that are not already invoiced
    let deliveriesQuery = supabase
      .from('deliveries')
      .select('id, weight_kg, total_amount')
      .eq('cooperative_id', input.cooperative_id)
      .gte('delivered_at', `${input.period_start}T00:00:00Z`)
      .lte('delivered_at', `${input.period_end}T23:59:59Z`);

    // If specific delivery IDs are provided, filter by them
    if (input.delivery_ids && input.delivery_ids.length > 0) {
      deliveriesQuery = deliveriesQuery.in('id', input.delivery_ids);
    }

    const { data: deliveries, error: deliveriesError } = await deliveriesQuery;

    if (deliveriesError) {
      throw new Error(`Failed to fetch deliveries: ${deliveriesError.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      throw new Error('No deliveries found for the specified period');
    }

    // Check if any deliveries are already invoiced
    const deliveryIds = deliveries.map(d => d.id);
    const { data: existingInvoiceDeliveries } = await supabase
      .from('invoice_deliveries')
      .select('delivery_id')
      .in('delivery_id', deliveryIds);

    if (existingInvoiceDeliveries && existingInvoiceDeliveries.length > 0) {
      const invoicedIds = existingInvoiceDeliveries.map(id => id.delivery_id);
      throw new Error(`Some deliveries are already invoiced: ${invoicedIds.length} delivery(ies)`);
    }

    // Calculate totals
    const totalWeightKg = deliveries.reduce((sum, d) => sum + Number(d.weight_kg), 0);
    const totalAmount = deliveries.reduce((sum, d) => sum + Number(d.total_amount), 0);

    // Create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        cooperative_id: input.cooperative_id,
        period_start: input.period_start,
        period_end: input.period_end,
        total_weight_kg: Math.round(totalWeightKg * 100) / 100,
        total_amount: totalAmount,
        created_by: user.id,
        code: '', // Will be generated by trigger
        status: 'draft',
      } as InvoiceInsert)
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    // Link deliveries to the invoice
    const invoiceDeliveries = deliveryIds.map(deliveryId => ({
      invoice_id: invoice.id,
      delivery_id: deliveryId,
    }));

    const { error: linkError } = await supabase
      .from('invoice_deliveries')
      .insert(invoiceDeliveries);

    if (linkError) {
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw new Error(`Failed to link deliveries to invoice: ${linkError.message}`);
    }

    return invoice;
  },

  /**
   * Generate an invoice from deliveries with extended target support
   * Supports invoicing by cooperative, chef_planteur (fournisseur), or planteur
   */
  async generateFromDeliveriesExtended(input: {
    target_type: 'cooperative' | 'fournisseur' | 'planteur';
    cooperative_id?: string;
    chef_planteur_id?: string;
    planteur_id?: string;
    period_start: string;
    period_end: string;
    delivery_ids: string[];
  }): Promise<Invoice> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Validate we have the required selection based on target type
    if (input.target_type === 'cooperative' && !input.cooperative_id) {
      throw new Error('Cooperative ID is required for cooperative invoicing');
    }
    if (input.target_type === 'fournisseur' && !input.chef_planteur_id) {
      throw new Error('Chef Planteur ID is required for fournisseur invoicing');
    }
    if (input.target_type === 'planteur' && !input.planteur_id) {
      throw new Error('Planteur ID is required for planteur invoicing');
    }

    if (!input.delivery_ids || input.delivery_ids.length === 0) {
      throw new Error('At least one delivery must be selected');
    }

    // Get the selected deliveries
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('id, weight_kg, total_amount, cooperative_id')
      .in('id', input.delivery_ids);

    if (deliveriesError) {
      throw new Error(`Failed to fetch deliveries: ${deliveriesError.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      throw new Error('No deliveries found');
    }

    // Check if any deliveries are already invoiced (batch to avoid URL length limits)
    const invoicedIds = new Set<string>();
    const batchSize = 20;
    for (let i = 0; i < input.delivery_ids.length; i += batchSize) {
      const batch = input.delivery_ids.slice(i, i + batchSize);
      const { data: existingInvoiceDeliveries } = await supabase
        .from('invoice_deliveries')
        .select('delivery_id')
        .in('delivery_id', batch);
      
      if (existingInvoiceDeliveries) {
        existingInvoiceDeliveries.forEach(id => invoicedIds.add(id.delivery_id));
      }
    }

    if (invoicedIds.size > 0) {
      throw new Error(`${invoicedIds.size} livraison(s) déjà facturée(s)`);
    }

    // Calculate totals
    const totalWeightKg = deliveries.reduce((sum, d) => sum + Number(d.weight_kg), 0);
    const totalAmount = deliveries.reduce((sum, d) => sum + Number(d.total_amount), 0);

    // Determine cooperative_id for the invoice
    // For fournisseur/planteur invoices, use the cooperative from the first delivery or the selected one
    let invoiceCooperativeId = input.cooperative_id;
    if (!invoiceCooperativeId && deliveries[0]?.cooperative_id) {
      invoiceCooperativeId = deliveries[0].cooperative_id;
    }

    // Create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        cooperative_id: invoiceCooperativeId,
        chef_planteur_id: input.target_type === 'fournisseur' ? input.chef_planteur_id : null,
        planteur_id: input.target_type === 'planteur' ? input.planteur_id : null,
        period_start: input.period_start,
        period_end: input.period_end,
        total_weight_kg: Math.round(totalWeightKg * 100) / 100,
        total_amount: totalAmount,
        created_by: user.id,
        code: '', // Will be generated by trigger
        status: 'draft',
      } as InvoiceInsert)
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    // Link deliveries to the invoice
    const invoiceDeliveries = input.delivery_ids.map(deliveryId => ({
      invoice_id: invoice.id,
      delivery_id: deliveryId,
    }));

    const { error: linkError } = await supabase
      .from('invoice_deliveries')
      .insert(invoiceDeliveries);

    if (linkError) {
      // Rollback: delete the invoice
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw new Error(`Failed to link deliveries to invoice: ${linkError.message}`);
    }

    return invoice;
  },

  /**
   * Update an existing invoice
   */
  async update(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('invoices')
      .update(input as InvoiceUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }

    return data;
  },

  /**
   * Update invoice status
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    return this.update(id, { status });
  },

  /**
   * Delete an invoice (admin only, handled by RLS)
   */
  async delete(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }
  },

  /**
   * Get invoice summary/statistics
   */
  async getSummary(invoiceId: string): Promise<InvoiceSummary> {
    const supabase = createClient();

    // Get all deliveries for this invoice
    const { data: invoiceDeliveries, error } = await supabase
      .from('invoice_deliveries')
      .select(`
        delivery:deliveries!invoice_deliveries_delivery_id_fkey(
          weight_kg, price_per_kg, total_amount, quality_grade
        )
      `)
      .eq('invoice_id', invoiceId);

    if (error) {
      throw new Error(`Failed to fetch invoice summary: ${error.message}`);
    }

    const deliveries = (invoiceDeliveries || [])
      .map(id => id.delivery)
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const summary: InvoiceSummary = {
      total_deliveries: deliveries.length,
      total_weight_kg: 0,
      total_amount_xaf: 0,
      average_price_per_kg: 0,
      deliveries_by_grade: { A: 0, B: 0, C: 0 },
    };

    if (deliveries.length === 0) {
      return summary;
    }

    let totalPriceSum = 0;
    for (const delivery of deliveries) {
      summary.total_weight_kg += Number(delivery.weight_kg);
      summary.total_amount_xaf += Number(delivery.total_amount);
      totalPriceSum += Number(delivery.price_per_kg);
      
      const grade = delivery.quality_grade as 'A' | 'B' | 'C';
      if (grade in summary.deliveries_by_grade) {
        summary.deliveries_by_grade[grade]++;
      }
    }

    summary.total_weight_kg = Math.round(summary.total_weight_kg * 100) / 100;
    summary.average_price_per_kg = Math.round((totalPriceSum / deliveries.length) * 100) / 100;

    return summary;
  },

  /**
   * Get available deliveries for invoicing (not yet invoiced)
   */
  async getAvailableDeliveries(
    cooperativeId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<{ id: string; code: string; weight_kg: number; total_amount: number; delivered_at: string }[]> {
    const supabase = createClient();

    // Get all deliveries in the period
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('id, code, weight_kg, total_amount, delivered_at')
      .eq('cooperative_id', cooperativeId)
      .gte('delivered_at', `${periodStart}T00:00:00Z`)
      .lte('delivered_at', `${periodEnd}T23:59:59Z`)
      .order('delivered_at', { ascending: true });

    if (deliveriesError) {
      throw new Error(`Failed to fetch deliveries: ${deliveriesError.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      return [];
    }

    // Get already invoiced delivery IDs
    const deliveryIds = deliveries.map(d => d.id);
    const { data: invoicedDeliveries } = await supabase
      .from('invoice_deliveries')
      .select('delivery_id')
      .in('delivery_id', deliveryIds);

    const invoicedIds = new Set((invoicedDeliveries || []).map(id => id.delivery_id));

    // Filter out already invoiced deliveries
    return deliveries.filter(d => !invoicedIds.has(d.id));
  },

  /**
   * Get available deliveries for invoicing with extended filters
   * Supports filtering by cooperative, chef_planteur, or planteur
   */
  async getAvailableDeliveriesExtended(params: {
    target_type: 'cooperative' | 'fournisseur' | 'planteur';
    cooperative_id?: string;
    chef_planteur_id?: string;
    planteur_id?: string;
    period_start: string;
    period_end: string;
  }): Promise<{ id: string; code: string; weight_kg: number; total_amount: number; delivered_at: string; planteur_name?: string }[]> {
    const supabase = createClient();

    // Build query based on target type
    let query = supabase
      .from('deliveries')
      .select(`
        id, code, weight_kg, total_amount, delivered_at,
        planteur:planteurs!deliveries_planteur_id_fkey(id, name, chef_planteur_id)
      `)
      .gte('delivered_at', `${params.period_start}T00:00:00Z`)
      .lte('delivered_at', `${params.period_end}T23:59:59Z`)
      .order('delivered_at', { ascending: true });

    // Apply filters based on target type
    if (params.target_type === 'cooperative' && params.cooperative_id) {
      query = query.eq('cooperative_id', params.cooperative_id);
    } else if (params.target_type === 'fournisseur' && params.chef_planteur_id) {
      // Filter by chef_planteur: get deliveries from planteurs belonging to this chef
      // First get planteur IDs for this chef_planteur
      const { data: planteurIds } = await supabase
        .from('planteurs')
        .select('id')
        .eq('chef_planteur_id', params.chef_planteur_id);
      
      if (!planteurIds || planteurIds.length === 0) {
        return [];
      }
      query = query.in('planteur_id', planteurIds.map(p => p.id));
    } else if (params.target_type === 'planteur' && params.planteur_id) {
      query = query.eq('planteur_id', params.planteur_id);
    }

    const { data: deliveries, error: deliveriesError } = await query;

    if (deliveriesError) {
      throw new Error(`Failed to fetch deliveries: ${deliveriesError.message}`);
    }

    if (!deliveries || deliveries.length === 0) {
      return [];
    }

    // Get already invoiced delivery IDs (batch to avoid URL length limits)
    const deliveryIds = deliveries.map(d => d.id);
    const invoicedIds = new Set<string>();
    
    // Batch queries to ~20 items per batch (PostgREST URL length limit)
    const batchSize = 20;
    for (let i = 0; i < deliveryIds.length; i += batchSize) {
      const batch = deliveryIds.slice(i, i + batchSize);
      const { data: invoicedDeliveries } = await supabase
        .from('invoice_deliveries')
        .select('delivery_id')
        .in('delivery_id', batch);
      
      if (invoicedDeliveries) {
        invoicedDeliveries.forEach(id => invoicedIds.add(id.delivery_id));
      }
    }

    // Filter out already invoiced deliveries and format response
    return deliveries
      .filter(d => !invoicedIds.has(d.id))
      .map(d => ({
        id: d.id,
        code: d.code,
        weight_kg: d.weight_kg,
        total_amount: d.total_amount,
        delivered_at: d.delivered_at,
        planteur_name: (d.planteur as { name?: string } | null)?.name,
      }));
  },

  /**
   * Bulk generate invoices for multiple cooperatives
   */
  async bulkGenerate(input: BulkGenerateInvoiceInput): Promise<Invoice[]> {
    const results: Invoice[] = [];
    const errors: string[] = [];

    for (const cooperativeId of input.cooperative_ids) {
      try {
        const invoice = await this.generateFromDeliveries({
          cooperative_id: cooperativeId,
          period_start: input.period_start,
          period_end: input.period_end,
        });
        results.push(invoice);
      } catch (err) {
        errors.push(`Cooperative ${cooperativeId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new Error(`Failed to generate any invoices:\n${errors.join('\n')}`);
    }

    return results;
  },

  /**
   * Update PDF path after PDF generation
   */
  async setPdfPath(id: string, pdfPath: string): Promise<Invoice> {
    return this.update(id, { pdf_path: pdfPath });
  },
};
