// CocoaTrack V2 - Planteurs API
// Client-side API functions for planteur operations

import { createClient } from '@/lib/supabase/client';
import type { Database, Planteur as PlanteurRow, Delivery as DeliveryRow } from '@/types/database.gen';
import type {
  CreatePlanteurInput,
  UpdatePlanteurInput,
  PlanteurFilters,
  PlanteurStats,
  PlanteurWithRelations,
} from '@/lib/validations/planteur';
import type { PaginatedResult } from '@/types';
import {
  offlineCreate,
  offlineUpdate,
  isOnline,
  type OfflineOperationResult,
} from './offline-api-helper';

type Planteur = PlanteurRow;
type Delivery = DeliveryRow;

// Helper to get typed client
const getTypedClient = () => createClient();

/**
 * Planteurs API - Client-side functions for planteur operations
 */
export const planteursApi = {
  /**
   * List planteurs with pagination and filters
   */
  async list(filters: PlanteurFilters = {}): Promise<PaginatedResult<PlanteurWithRelations>> {
    const supabase = getTypedClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      chef_planteur_id,
      cooperative_id,
      is_active,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('planteurs')
      .select(
        `
        *,
        chef_planteur:chef_planteurs!planteurs_chef_planteur_id_fkey(id, name, code, cooperative_id),
        cooperative:cooperatives!planteurs_cooperative_id_fkey(id, name, code),
        created_by_profile:profiles!planteurs_created_by_fkey(id, full_name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (chef_planteur_id) {
      query = query.eq('chef_planteur_id', chef_planteur_id);
    }
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch planteurs: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as PlanteurWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * List planteurs with stats from the view (includes production limits, losses, etc.)
   */
  async listWithStats(filters: PlanteurFilters = {}): Promise<PaginatedResult<PlanteurWithRelations>> {
    const supabase = getTypedClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      chef_planteur_id,
      cooperative_id,
      is_active,
      search,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Try to use the view with stats
    let query = supabase
      .from('planteurs_with_stats')
      .select('*', { count: 'exact' });

    // Apply filters
    if (chef_planteur_id) {
      query = query.eq('chef_planteur_id', chef_planteur_id);
    }
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      // Fallback to regular list if view doesn't exist
      console.warn('planteurs_with_stats view not available, falling back to regular list');
      return this.list(filters);
    }

    // Transform data to include chef_planteur relation
    const transformedData = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      chef_planteur: row.chef_planteur_name ? {
        id: row.chef_planteur_id,
        name: row.chef_planteur_name,
        code: row.chef_planteur_code,
      } : null,
    }));

    return {
      data: transformedData as unknown as PlanteurWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get a single planteur by ID
   */
  async get(id: string): Promise<PlanteurWithRelations | null> {
    const supabase = getTypedClient();

    const { data, error } = await supabase
      .from('planteurs')
      .select(
        `
        *,
        chef_planteur:chef_planteurs!planteurs_chef_planteur_id_fkey(id, name, code, cooperative_id),
        cooperative:cooperatives!planteurs_cooperative_id_fkey(id, name, code),
        created_by_profile:profiles!planteurs_created_by_fkey(id, full_name)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch planteur: ${error.message}`);
    }

    return data as unknown as PlanteurWithRelations;
  },

  /**
   * Create a new planteur
   */
  async create(input: CreatePlanteurInput): Promise<Planteur> {
    const supabase = getTypedClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's profile for cooperative_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('cooperative_id')
      .eq('id', user.id)
      .single();

    let cooperativeId: string | null = (profile as { cooperative_id: string | null } | null)?.cooperative_id ?? null;

    // If chef_planteur_id is provided, get cooperative_id from chef_planteur
    if (input.chef_planteur_id && input.chef_planteur_id !== '') {
      const { data: chefPlanteur } = await supabase
        .from('chef_planteurs')
        .select('cooperative_id')
        .eq('id', input.chef_planteur_id)
        .single();

      if (chefPlanteur) {
        cooperativeId = (chefPlanteur as { cooperative_id: string }).cooperative_id;
      }
    }

    if (!cooperativeId) {
      throw new Error('Coopérative non définie. Veuillez sélectionner un fournisseur ou configurer votre coopérative.');
    }

    // Generate code if not provided
    const code = input.code || await this.generateCode(cooperativeId);

    // Clean up chef_planteur_id if empty string
    const chefPlanteurId = input.chef_planteur_id && input.chef_planteur_id !== '' 
      ? input.chef_planteur_id 
      : null;

    const insertData = {
      ...input,
      code,
      chef_planteur_id: chefPlanteurId,
      cooperative_id: cooperativeId,
      created_by: user.id,
    } as Database['public']['Tables']['planteurs']['Insert'];

    const { data, error } = await (supabase
      .from('planteurs') as unknown as { insert: (data: Database['public']['Tables']['planteurs']['Insert']) => { select: () => { single: () => Promise<{ data: Planteur | null; error: Error | null }> } } })
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create planteur: ${error.message}`);
    }

    return data as Planteur;
  },

  /**
   * Generate a unique code for a planteur
   */
  async generateCode(cooperativeId: string): Promise<string> {
    const supabase = getTypedClient();
    
    // Get count of planteurs in this cooperative
    const { count } = await supabase
      .from('planteurs')
      .select('*', { count: 'exact', head: true })
      .eq('cooperative_id', cooperativeId);

    const nextNumber = (count || 0) + 1;
    return `PL${String(nextNumber).padStart(4, '0')}`;
  },

  /**
   * Update an existing planteur
   */
  async update(id: string, input: UpdatePlanteurInput): Promise<Planteur> {
    const supabase = getTypedClient();

    const updateData = input as Database['public']['Tables']['planteurs']['Update'];

    const { data, error } = await (supabase
      .from('planteurs') as unknown as { update: (data: Database['public']['Tables']['planteurs']['Update']) => { eq: (col: string, val: string) => { select: () => { single: () => Promise<{ data: Planteur | null; error: Error | null }> } } } })
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update planteur: ${error.message}`);
    }

    return data as Planteur;
  },

  /**
   * Soft delete a planteur (set is_active to false)
   */
  async softDelete(id: string): Promise<Planteur> {
    return this.update(id, { is_active: false });
  },

  /**
   * Restore a soft-deleted planteur
   */
  async restore(id: string): Promise<Planteur> {
    return this.update(id, { is_active: true });
  },

  /**
   * Search planteurs by name, code, or phone
   */
  async search(query: string, limit: number = 10): Promise<Planteur[]> {
    const supabase = getTypedClient();

    const { data, error } = await supabase
      .from('planteurs')
      .select('*')
      .or(`name.ilike.%${query}%,code.ilike.%${query}%,phone.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search planteurs: ${error.message}`);
    }

    return (data || []) as Planteur[];
  },

  /**
   * Get delivery history for a planteur
   */
  async getDeliveryHistory(
    planteurId: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<PaginatedResult<Delivery>> {
    const supabase = getTypedClient();
    const { page = 1, pageSize = 20 } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('deliveries')
      .select('*', { count: 'exact' })
      .eq('planteur_id', planteurId)
      .order('delivered_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch delivery history: ${error.message}`);
    }

    return {
      data: (data || []) as Delivery[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get statistics for a planteur
   */
  async getStats(planteurId: string): Promise<PlanteurStats> {
    const supabase = getTypedClient();

    // Get aggregated delivery stats
    const { data: deliveries, error } = await supabase
      .from('deliveries')
      .select('weight_kg, total_amount, price_per_kg, delivered_at')
      .eq('planteur_id', planteurId);

    if (error) {
      throw new Error(`Failed to fetch planteur stats: ${error.message}`);
    }

    type DeliveryStats = { weight_kg: number; total_amount: number; price_per_kg: number; delivered_at: string };
    const stats = ((deliveries || []) as DeliveryStats[]).reduce(
      (acc, delivery) => {
        acc.total_deliveries += 1;
        acc.total_weight_kg += Number(delivery.weight_kg);
        acc.total_amount_xaf += Number(delivery.total_amount);
        acc.sum_price_per_kg += Number(delivery.price_per_kg);
        
        const deliveryDate = new Date(delivery.delivered_at);
        if (!acc.last_delivery_date || deliveryDate > new Date(acc.last_delivery_date)) {
          acc.last_delivery_date = delivery.delivered_at;
        }
        
        return acc;
      },
      {
        total_deliveries: 0,
        total_weight_kg: 0,
        total_amount_xaf: 0,
        sum_price_per_kg: 0,
        last_delivery_date: null as string | null,
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
      last_delivery_date: stats.last_delivery_date,
    };
  },

  // ============================================================================
  // OFFLINE-AWARE METHODS
  // REQ-OFF-006: Minimum Offline Usable Set
  // ============================================================================

  /**
   * Create a planteur with offline support
   * When offline: Queues the operation and shows "Enregistré hors ligne" toast
   * When online: Creates directly via Supabase
   * 
   * @param input - Planteur data
   * @param options - User and cooperative info for offline queue
   * @returns Result with planteur data or queued operation info
   */
  async createOffline(
    input: CreatePlanteurInput,
    options: { userId: string; cooperativeId: string; showToast?: boolean }
  ): Promise<OfflineOperationResult<Planteur>> {
    const { userId, cooperativeId, showToast = true } = options;

    // Generate a temporary code for offline
    const code = input.code || `OFFLINE-PL-${Date.now()}`;

    // Clean up chef_planteur_id if empty string
    const chefPlanteurId = input.chef_planteur_id && input.chef_planteur_id !== '' 
      ? input.chef_planteur_id 
      : null;

    // Prepare the planteur data
    const planteurData = {
      name: input.name,
      code,
      phone: input.phone || null,
      cni: input.cni || null,
      chef_planteur_id: chefPlanteurId,
      cooperative_id: cooperativeId,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      is_active: true,
      created_by: userId,
    };

    return offlineCreate<Planteur>('planteurs', planteurData as unknown as Planteur, {
      userId,
      cooperativeId,
      showToast,
      priority: 'high', // Planteurs are high priority
    });
  },

  /**
   * Update a planteur with offline support
   * When offline: Queues the operation and shows "Enregistré hors ligne" toast
   * When online: Updates directly via Supabase
   * 
   * @param id - Planteur ID
   * @param input - Update data
   * @param options - User and cooperative info for offline queue
   * @returns Result with planteur data or queued operation info
   */
  async updateOffline(
    id: string,
    input: UpdatePlanteurInput,
    options: {
      userId: string;
      cooperativeId: string;
      baseSnapshot?: Record<string, unknown>;
      showToast?: boolean;
    }
  ): Promise<OfflineOperationResult<Planteur>> {
    const { userId, cooperativeId, baseSnapshot, showToast = true } = options;

    return offlineUpdate<Planteur>('planteurs', id, input as unknown as Planteur, {
      userId,
      cooperativeId,
      showToast,
      priority: 'high',
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
