// Client-side waybill API (reads + helpers)

import { createClient } from '@/lib/supabase/client';
import type { PaginatedResult } from '@/types';
import type {
  CreateWaybillInput,
  DeliveryWaybill,
  WaybillFilters,
  WaybillWithDeliveries,
} from '@/types/waybills';

type WaybillRow = DeliveryWaybill & {
  waybill_deliveries?: Array<{
    id: string;
    delivery_id: string;
    delivery?: {
      id: string;
      code: string;
      weight_kg: number;
      planteur?: { name: string; code: string } | null;
    } | null;
  }>;
};

function mapWaybill(row: WaybillRow): WaybillWithDeliveries {
  const { waybill_deliveries: linksRaw, ...rest } = row;
  const links = linksRaw || [];
  const linkedWeight = links.reduce(
    (sum, l) => sum + (Number(l.delivery?.weight_kg) || 0),
    0
  );
  return {
    ...rest,
    deliveries: links.map((l) => ({
      id: l.id,
      waybill_id: row.id,
      delivery_id: l.delivery_id,
      delivery: l.delivery ?? undefined,
    })),
    delivery_count: links.length,
    linked_weight_kg: linkedWeight,
  };
}

export const waybillsApi = {
  async list(filters: WaybillFilters = {}): Promise<PaginatedResult<WaybillWithDeliveries>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      cooperative_id,
      loading_date_from,
      loading_date_to,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('delivery_waybills')
      .select(
        `
        *,
        waybill_deliveries(
          id,
          delivery_id,
          delivery:deliveries(id, code, weight_kg, planteur:planteurs(name, code))
        )
      `,
        { count: 'exact' }
      )
      .order('loading_date', { ascending: false });

    if (cooperative_id) query = query.eq('cooperative_id', cooperative_id);
    if (loading_date_from) query = query.gte('loading_date', loading_date_from);
    if (loading_date_to) query = query.lte('loading_date', loading_date_to);
    if (search) {
      query = query.or(
        `code.ilike.%${search}%,lot_number.ilike.%${search}%,origin_location.ilike.%${search}%,destination_location.ilike.%${search}%`
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch waybills: ${error.message}`);

    const rows = (data || []) as unknown as WaybillRow[];
    return {
      data: rows.map(mapWaybill),
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  async get(id: string): Promise<WaybillWithDeliveries | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('delivery_waybills')
      .select(
        `
        *,
        waybill_deliveries(
          id,
          delivery_id,
          delivery:deliveries(id, code, weight_kg, planteur:planteurs(name, code))
        )
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch waybill: ${error.message}`);
    if (!data) return null;
    return mapWaybill(data as unknown as WaybillRow);
  },

  async getForDelivery(deliveryId: string): Promise<WaybillWithDeliveries | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('waybill_deliveries')
      .select(
        `
        waybill:delivery_waybills(
          *,
          waybill_deliveries(
            id,
            delivery_id,
            delivery:deliveries(id, code, weight_kg, planteur:planteurs(name, code))
          )
        )
      `
      )
      .eq('delivery_id', deliveryId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch waybill for delivery: ${error.message}`);
    const waybill = (data as { waybill?: WaybillRow } | null)?.waybill;
    if (!waybill) return null;
    return mapWaybill(waybill);
  },

  async getLinkedDeliveryIds(): Promise<Set<string>> {
    const supabase = createClient();
    const { data, error } = await supabase.from('waybill_deliveries').select('delivery_id');
    if (error) throw new Error(error.message);
    return new Set((data || []).map((r: { delivery_id: string }) => r.delivery_id));
  },

  async createWithDocument(
    input: CreateWaybillInput,
    file?: File | null
  ): Promise<WaybillWithDeliveries> {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(input));
    if (file) formData.append('file', file);

    const response = await fetch('/api/waybills', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Échec de la création de la lettre de voiture');
    }

    return response.json();
  },

  async linkDeliveries(waybillId: string, deliveryIds: string[]): Promise<void> {
    const response = await fetch(`/api/waybills/${waybillId}/deliveries`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_ids: deliveryIds }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Échec de la liaison des livraisons');
    }
  },

  async getDocumentUrl(waybillId: string): Promise<string | null> {
    const response = await fetch(`/api/waybills/${waybillId}/document`);
    if (!response.ok) return null;
    const body = await response.json();
    return body.url ?? null;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/waybills/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Échec de la suppression');
    }
  },
};
