// CocoaTrack V2 - Deliveries API
// Client-side API functions for delivery operations
// @ts-nocheck - Types need to be regenerated from Supabase

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.gen';
import type { PaginatedResult, QualityGrade, PaymentStatus } from '@/types';
import {
  offlineCreate,
  offlineUpdate,
  isOnline,
  type OfflineOperationResult,
} from './offline-api-helper';

type Delivery = Database['public']['Tables']['deliveries']['Row'];
type DeliveryInsert = Database['public']['Tables']['deliveries']['Insert'];
type DeliveryUpdate = Database['public']['Tables']['deliveries']['Update'];
type DeliveryPhoto = Database['public']['Tables']['delivery_photos']['Row'];

// ============================================================================
// TYPES
// ============================================================================

export interface DeliveryFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  planteur_id?: string;
  chef_planteur_id?: string;
  cooperative_id?: string;
  warehouse_id?: string;
  quality_grade?: QualityGrade;
  payment_status?: PaymentStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CreateDeliveryInput {
  planteur_id: string;
  chef_planteur_id: string;
  warehouse_id: string;
  weight_kg: number;
  price_per_kg: number;
  quality_grade?: QualityGrade;
  notes?: string;
  delivered_at?: string;
}

export interface UpdateDeliveryInput {
  weight_kg?: number;
  price_per_kg?: number;
  quality_grade?: QualityGrade;
  payment_status?: PaymentStatus;
  payment_amount_paid?: number;
  notes?: string;
  delivered_at?: string;
}

export interface BatchDeliveryInput {
  deliveries: CreateDeliveryInput[];
}

export interface DeliveryWithRelations extends Delivery {
  planteur?: {
    id: string;
    name: string;
    code: string;
  };
  chef_planteur?: {
    id: string;
    name: string;
    code: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  cooperative?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
  };
  photos?: DeliveryPhoto[];
}

export interface DeliveryStats {
  total_deliveries: number;
  total_weight_kg: number;
  total_amount_xaf: number;
  average_price_per_kg: number;
  pending_count: number;
  paid_count: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Deliveries API - Client-side functions for delivery operations
 */
export const deliveriesApi = {
  /**
   * List deliveries with pagination and filters
   */
  async list(filters: DeliveryFilters = {}): Promise<PaginatedResult<DeliveryWithRelations>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'delivered_at',
      sortOrder = 'desc',
      planteur_id,
      chef_planteur_id,
      cooperative_id,
      warehouse_id,
      quality_grade,
      payment_status,
      date_from,
      date_to,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('deliveries')
      .select(
        `
        *,
        planteur:planteurs!deliveries_planteur_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!deliveries_chef_planteur_id_fkey(id, name, code),
        warehouse:warehouses!deliveries_warehouse_id_fkey(id, name, code),
        cooperative:cooperatives!deliveries_cooperative_id_fkey(id, name, code),
        created_by_profile:profiles!deliveries_created_by_fkey(id, full_name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (planteur_id) {
      query = query.eq('planteur_id', planteur_id);
    }
    if (chef_planteur_id) {
      query = query.eq('chef_planteur_id', chef_planteur_id);
    }
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }
    if (quality_grade) {
      query = query.eq('quality_grade', quality_grade);
    }
    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }
    if (date_from) {
      query = query.gte('delivered_at', date_from);
    }
    if (date_to) {
      query = query.lte('delivered_at', date_to);
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
      throw new Error(`Failed to fetch deliveries: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as DeliveryWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get a single delivery by ID with all relations
   */
  async get(id: string): Promise<DeliveryWithRelations | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('deliveries')
      .select(
        `
        *,
        planteur:planteurs!deliveries_planteur_id_fkey(id, name, code),
        chef_planteur:chef_planteurs!deliveries_chef_planteur_id_fkey(id, name, code),
        warehouse:warehouses!deliveries_warehouse_id_fkey(id, name, code),
        cooperative:cooperatives!deliveries_cooperative_id_fkey(id, name, code),
        created_by_profile:profiles!deliveries_created_by_fkey(id, full_name),
        photos:delivery_photos(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch delivery: ${error.message}`);
    }

    return data as unknown as DeliveryWithRelations;
  },

  /**
   * Create a new delivery
   * Note: code and total_amount are auto-generated by database triggers
   */
  async create(input: CreateDeliveryInput): Promise<Delivery> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get cooperative_id from chef_planteur (will be synced by trigger)
    const { data: chefPlanteur } = await supabase
      .from('chef_planteurs')
      .select('cooperative_id')
      .eq('id', input.chef_planteur_id)
      .single();

    if (!chefPlanteur) {
      throw new Error('Chef planteur not found');
    }

    // Note: code is auto-generated by set_delivery_code trigger
    // Note: total_amount is auto-calculated by calculate_delivery_total trigger
    // Note: cooperative_id is auto-synced by sync_delivery_cooperative_id trigger
    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        planteur_id: input.planteur_id,
        chef_planteur_id: input.chef_planteur_id,
        warehouse_id: input.warehouse_id,
        weight_kg: input.weight_kg,
        price_per_kg: input.price_per_kg,
        quality_grade: input.quality_grade || 'B',
        notes: input.notes,
        delivered_at: input.delivered_at || new Date().toISOString(),
        created_by: user.id,
        // These will be set by triggers:
        code: '', // Will be overwritten by trigger
        cooperative_id: chefPlanteur.cooperative_id, // Will be verified by trigger
        total_amount: 0, // Will be calculated by trigger
      } as DeliveryInsert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create delivery: ${error.message}`);
    }

    return data;
  },

  /**
   * Update an existing delivery
   * Note: total_amount is auto-recalculated if weight_kg or price_per_kg changes
   */
  async update(id: string, input: UpdateDeliveryInput): Promise<Delivery> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('deliveries')
      .update(input as DeliveryUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Check for paid delivery lock error
      if (error.message.includes('paid delivery')) {
        throw new Error('Cannot modify critical fields on paid delivery. Contact a manager.');
      }
      throw new Error(`Failed to update delivery: ${error.message}`);
    }

    return data;
  },

  /**
   * Create multiple deliveries in batch
   */
  async createBatch(input: BatchDeliveryInput): Promise<Delivery[]> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get cooperative_ids for all chef_planteurs
    const chefPlanteurIds = [...new Set(input.deliveries.map(d => d.chef_planteur_id))];
    const { data: chefPlanteurs } = await supabase
      .from('chef_planteurs')
      .select('id, cooperative_id')
      .in('id', chefPlanteurIds);

    if (!chefPlanteurs || chefPlanteurs.length !== chefPlanteurIds.length) {
      throw new Error('One or more chef planteurs not found');
    }

    const coopMap = new Map(chefPlanteurs.map(cp => {
      const c = cp as { id: string; cooperative_id: string };
      return [c.id, c.cooperative_id];
    }));

    // Prepare insert data
    const insertData = input.deliveries.map(delivery => ({
      planteur_id: delivery.planteur_id,
      chef_planteur_id: delivery.chef_planteur_id,
      warehouse_id: delivery.warehouse_id,
      weight_kg: delivery.weight_kg,
      price_per_kg: delivery.price_per_kg,
      quality_grade: delivery.quality_grade || 'B',
      notes: delivery.notes,
      delivered_at: delivery.delivered_at || new Date().toISOString(),
      created_by: user.id,
      code: '', // Will be overwritten by trigger
      cooperative_id: coopMap.get(delivery.chef_planteur_id)!,
      total_amount: 0, // Will be calculated by trigger
    } as DeliveryInsert));

    const { data, error } = await supabase
      .from('deliveries')
      .insert(insertData)
      .select();

    if (error) {
      throw new Error(`Failed to create batch deliveries: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get delivery statistics for dashboard
   */
  async getStats(filters: {
    cooperative_id?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<DeliveryStats> {
    const supabase = createClient();

    let query = supabase
      .from('deliveries')
      .select('weight_kg, total_amount, price_per_kg, payment_status');

    if (filters.cooperative_id) {
      query = query.eq('cooperative_id', filters.cooperative_id);
    }
    if (filters.date_from) {
      query = query.gte('delivered_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('delivered_at', filters.date_to);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch delivery stats: ${error.message}`);
    }

    const stats = (deliveries || []).reduce(
      (acc, delivery) => {
        const d = delivery as { weight_kg: number; total_amount: number; price_per_kg: number; payment_status: string };
        acc.total_deliveries += 1;
        acc.total_weight_kg += Number(d.weight_kg);
        acc.total_amount_xaf += Number(d.total_amount);
        acc.sum_price_per_kg += Number(d.price_per_kg);
        
        if (d.payment_status === 'pending') {
          acc.pending_count += 1;
        } else if (d.payment_status === 'paid') {
          acc.paid_count += 1;
        }
        
        return acc;
      },
      {
        total_deliveries: 0,
        total_weight_kg: 0,
        total_amount_xaf: 0,
        sum_price_per_kg: 0,
        pending_count: 0,
        paid_count: 0,
      }
    );

    return {
      total_deliveries: stats.total_deliveries,
      total_weight_kg: Math.round(stats.total_weight_kg * 100) / 100,
      total_amount_xaf: stats.total_amount_xaf,
      average_price_per_kg:
        stats.total_deliveries > 0
          ? Math.round((stats.sum_price_per_kg / stats.total_deliveries) * 100) / 100
          : 0,
      pending_count: stats.pending_count,
      paid_count: stats.paid_count,
    };
  },

  /**
   * Get photos for a delivery
   */
  async getPhotos(deliveryId: string): Promise<DeliveryPhoto[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('delivery_photos')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch delivery photos: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Sync operation for offline support
   * Uses the sync_operation RPC function
   */
  async syncOperation(
    idempotencyKey: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    recordId: string,
    data: Record<string, unknown>
  ): Promise<{ status: string; code?: string; message?: string }> {
    const supabase = createClient();

    const { data: result, error } = await supabase.rpc('sync_operation', {
      p_idempotency_key: idempotencyKey,
      p_table: 'deliveries',
      p_operation: operation,
      p_record_id: recordId,
      p_data: data,
    });

    if (error) {
      throw new Error(`Sync operation failed: ${error.message}`);
    }

    return result as { status: string; code?: string; message?: string };
  },

  // ============================================================================
  // OFFLINE-AWARE METHODS
  // REQ-OFF-006: Minimum Offline Usable Set
  // ============================================================================

  /**
   * Create a delivery with offline support
   * When offline: Queues the operation and shows "Enregistré hors ligne" toast
   * When online: Creates directly via Supabase
   * 
   * @param input - Delivery data
   * @param options - User and cooperative info for offline queue
   * @returns Result with delivery data or queued operation info
   */
  async createOffline(
    input: CreateDeliveryInput,
    options: { userId: string; cooperativeId: string; showToast?: boolean }
  ): Promise<OfflineOperationResult<Delivery>> {
    const { userId, cooperativeId, showToast = true } = options;

    // Prepare the delivery data
    const deliveryData = {
      planteur_id: input.planteur_id,
      chef_planteur_id: input.chef_planteur_id,
      warehouse_id: input.warehouse_id,
      weight_kg: input.weight_kg,
      price_per_kg: input.price_per_kg,
      quality_grade: input.quality_grade || 'B',
      notes: input.notes || null,
      delivered_at: input.delivered_at || new Date().toISOString(),
      created_by: userId,
      cooperative_id: cooperativeId,
      // These will be set by triggers when synced:
      code: `OFFLINE-${Date.now()}`, // Temporary code
      total_amount: input.weight_kg * input.price_per_kg, // Calculate locally
      payment_status: 'pending',
    };

    return offlineCreate<Delivery>('deliveries', deliveryData as unknown as Delivery, {
      userId,
      cooperativeId,
      showToast,
      priority: 'critical', // Deliveries are critical operations
    });
  },

  /**
   * Update a delivery with offline support
   * When offline: Queues the operation and shows "Enregistré hors ligne" toast
   * When online: Updates directly via Supabase
   * 
   * @param id - Delivery ID
   * @param input - Update data
   * @param options - User and cooperative info for offline queue
   * @returns Result with delivery data or queued operation info
   */
  async updateOffline(
    id: string,
    input: UpdateDeliveryInput,
    options: {
      userId: string;
      cooperativeId: string;
      baseSnapshot?: Record<string, unknown>;
      showToast?: boolean;
    }
  ): Promise<OfflineOperationResult<Delivery>> {
    const { userId, cooperativeId, baseSnapshot, showToast = true } = options;

    return offlineUpdate<Delivery>('deliveries', id, input as unknown as Delivery, {
      userId,
      cooperativeId,
      showToast,
      priority: 'critical',
      baseSnapshot,
    });
  },

  /**
   * Check if the app is currently online
   */
  isOnline(): boolean {
    return isOnline();
  },
};
