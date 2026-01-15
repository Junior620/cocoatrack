// CocoaTrack V2 - Chef Planteurs API
// Client-side API functions for chef_planteur operations
// @ts-nocheck - Types need to be regenerated from Supabase

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.gen';
import type {
  CreateChefPlanteurInput,
  UpdateChefPlanteurInput,
  ChefPlanteurFilters,
  ChefPlanteurStats,
  ChefPlanteurWithRelations,
} from '@/lib/validations/chef-planteur';
import type { PaginatedResult } from '@/types';

type ChefPlanteur = Database['public']['Tables']['chef_planteurs']['Row'];
type Planteur = Database['public']['Tables']['planteurs']['Row'];

/**
 * Chef Planteurs API - Client-side functions for chef_planteur operations
 */
export const chefPlanteursApi = {
  /**
   * List chef_planteurs with pagination and filters
   */
  async list(filters: ChefPlanteurFilters = {}): Promise<PaginatedResult<ChefPlanteurWithRelations>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      cooperative_id,
      region,
      validation_status,
      search,
      has_active_contract,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('chef_planteurs')
      .select(
        `
        *,
        cooperative:cooperatives!chef_planteurs_cooperative_id_fkey(id, name, code),
        validated_by_profile:profiles!chef_planteurs_validated_by_fkey(id, full_name),
        created_by_profile:profiles!chef_planteurs_created_by_fkey(id, full_name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (region) {
      query = query.eq('region', region);
    }
    if (validation_status) {
      query = query.eq('validation_status', validation_status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (has_active_contract !== undefined) {
      const today = new Date().toISOString().split('T')[0];
      if (has_active_contract) {
        query = query
          .lte('contract_start', today)
          .or(`contract_end.is.null,contract_end.gte.${today}`);
      } else {
        query = query.or(`contract_start.is.null,contract_end.lt.${today}`);
      }
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch chef_planteurs: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as ChefPlanteurWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * List chef_planteurs with stats from the view (includes delivery totals, planteur counts, etc.)
   */
  async listWithStats(filters: ChefPlanteurFilters = {}): Promise<PaginatedResult<ChefPlanteurWithRelations>> {
    const supabase = createClient();
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      cooperative_id,
      region,
      validation_status,
      search,
      is_exploited,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Try to use the view with stats
    let query = supabase
      .from('chef_planteurs_with_stats')
      .select('*', { count: 'exact' });

    // Apply filters
    if (cooperative_id) {
      query = query.eq('cooperative_id', cooperative_id);
    }
    if (region) {
      query = query.eq('region', region);
    }
    if (validation_status) {
      query = query.eq('validation_status', validation_status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (is_exploited !== undefined) {
      query = query.eq('est_exploite', is_exploited);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      // Fallback to regular list if view doesn't exist
      console.warn('chef_planteurs_with_stats view not available, falling back to regular list');
      return this.list(filters);
    }

    return {
      data: (data || []) as unknown as ChefPlanteurWithRelations[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Get a single chef_planteur by ID
   */
  async get(id: string): Promise<ChefPlanteurWithRelations | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('chef_planteurs')
      .select(
        `
        *,
        cooperative:cooperatives!chef_planteurs_cooperative_id_fkey(id, name, code),
        validated_by_profile:profiles!chef_planteurs_validated_by_fkey(id, full_name),
        created_by_profile:profiles!chef_planteurs_created_by_fkey(id, full_name)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch chef_planteur: ${error.message}`);
    }

    // Get planteurs count
    const { count: planteursCount } = await supabase
      .from('planteurs')
      .select('*', { count: 'exact', head: true })
      .eq('chef_planteur_id', id);

    return {
      ...(data as Record<string, unknown>),
      planteurs_count: planteursCount || 0,
    } as unknown as ChefPlanteurWithRelations;
  },

  /**
   * Create a new chef_planteur
   */
  async create(input: CreateChefPlanteurInput): Promise<ChefPlanteur> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const insertData = {
      ...input,
      created_by: user.id,
      validation_status: 'pending',
    };

    const { data, error } = await supabase
      .from('chef_planteurs')
      .insert(insertData as Database['public']['Tables']['chef_planteurs']['Insert'])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create chef_planteur: ${error.message}`);
    }

    return data as ChefPlanteur;
  },

  /**
   * Update an existing chef_planteur
   */
  async update(id: string, input: UpdateChefPlanteurInput): Promise<ChefPlanteur> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('chef_planteurs')
      .update(input as Database['public']['Tables']['chef_planteurs']['Update'])
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update chef_planteur: ${error.message}`);
    }

    return data as ChefPlanteur;
  },

  /**
   * Soft delete a chef_planteur (set is_active to false)
   */
  async softDelete(id: string): Promise<ChefPlanteur> {
    return this.update(id, { is_active: false } as UpdateChefPlanteurInput);
  },

  /**
   * Restore a soft-deleted chef_planteur
   */
  async restore(id: string): Promise<ChefPlanteur> {
    return this.update(id, { is_active: true } as UpdateChefPlanteurInput);
  },

  /**
   * Validate a chef_planteur (manager+ only)
   */
  async validate(id: string): Promise<ChefPlanteur> {
    const supabase = createClient();

    // Use the RPC function for validation
    const { data, error } = await supabase.rpc('validate_chef_planteur', {
      p_chef_planteur_id: id,
    });

    if (error) {
      throw new Error(`Failed to validate chef_planteur: ${error.message}`);
    }

    return data as ChefPlanteur;
  },

  /**
   * Reject a chef_planteur (manager+ only)
   */
  async reject(id: string, rejectionReason: string): Promise<ChefPlanteur> {
    const supabase = createClient();

    // Use the RPC function for rejection
    const { data, error } = await supabase.rpc('reject_chef_planteur', {
      p_chef_planteur_id: id,
      p_rejection_reason: rejectionReason,
    });

    if (error) {
      throw new Error(`Failed to reject chef_planteur: ${error.message}`);
    }

    return data as ChefPlanteur;
  },

  /**
   * Get all planteurs associated with a chef_planteur
   */
  async getAssociatedPlanters(
    chefPlanteurId: string,
    options: { page?: number; pageSize?: number; is_active?: boolean } = {}
  ): Promise<PaginatedResult<Planteur>> {
    const supabase = createClient();
    const { page = 1, pageSize = 20, is_active } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('planteurs')
      .select('*', { count: 'exact' })
      .eq('chef_planteur_id', chefPlanteurId);

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch associated planters: ${error.message}`);
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Search chef_planteurs by name, code, or phone
   */
  async search(query: string, limit: number = 10): Promise<ChefPlanteur[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('chef_planteurs')
      .select('*')
      .or(`name.ilike.%${query}%,code.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search chef_planteurs: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get statistics for a chef_planteur
   */
  async getStats(chefPlanteurId: string): Promise<ChefPlanteurStats> {
    const supabase = createClient();

    // Get chef_planteur for quantite_max_kg
    const { data: chefPlanteur, error: chefError } = await supabase
      .from('chef_planteurs')
      .select('quantite_max_kg')
      .eq('id', chefPlanteurId)
      .single();

    if (chefError) {
      throw new Error(`Failed to fetch chef_planteur: ${chefError.message}`);
    }

    // Get planteurs count
    const { count: totalPlanteurs } = await supabase
      .from('planteurs')
      .select('*', { count: 'exact', head: true })
      .eq('chef_planteur_id', chefPlanteurId);

    const { count: activePlanteurs } = await supabase
      .from('planteurs')
      .select('*', { count: 'exact', head: true })
      .eq('chef_planteur_id', chefPlanteurId)
      .eq('is_active', true);

    // Get delivery stats
    const { data: deliveries, error: deliveryError } = await supabase
      .from('deliveries')
      .select('weight_kg, total_amount, delivered_at')
      .eq('chef_planteur_id', chefPlanteurId);

    if (deliveryError) {
      throw new Error(`Failed to fetch delivery stats: ${deliveryError.message}`);
    }

    const deliveryStats = (deliveries || []).reduce(
      (acc, delivery) => {
        const d = delivery as { weight_kg: number; total_amount: number; delivered_at: string };
        acc.total_deliveries += 1;
        acc.total_weight_kg += Number(d.weight_kg);
        acc.total_amount_xaf += Number(d.total_amount);
        
        const deliveryDate = new Date(d.delivered_at);
        if (!acc.last_delivery_date || deliveryDate > new Date(acc.last_delivery_date)) {
          acc.last_delivery_date = d.delivered_at;
        }
        
        return acc;
      },
      {
        total_deliveries: 0,
        total_weight_kg: 0,
        total_amount_xaf: 0,
        last_delivery_date: null as string | null,
      }
    );

    const cp = chefPlanteur as { quantite_max_kg: number };
    const quantiteMaxKg = Number(cp.quantite_max_kg) || 0;
    const quantityRemainingKg = quantiteMaxKg - deliveryStats.total_weight_kg;

    return {
      total_planteurs: totalPlanteurs || 0,
      active_planteurs: activePlanteurs || 0,
      total_deliveries: deliveryStats.total_deliveries,
      total_weight_kg: Math.round(deliveryStats.total_weight_kg * 100) / 100,
      total_amount_xaf: deliveryStats.total_amount_xaf,
      quantity_remaining_kg: Math.round(quantityRemainingKg * 100) / 100,
      is_quantity_exceeded: quantityRemainingKg < 0,
      last_delivery_date: deliveryStats.last_delivery_date,
    };
  },

  /**
   * Get distinct regions for filtering
   */
  async getDistinctRegions(): Promise<string[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('chef_planteurs')
      .select('region')
      .not('region', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch regions: ${error.message}`);
    }

    // Get unique regions
    const regions = [...new Set((data || []).map((d) => (d as { region: string | null }).region).filter(Boolean))] as string[];
    return regions.sort();
  },
};
