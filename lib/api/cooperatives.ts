// CocoaTrack V2 - Cooperatives API
// Client-side API functions for cooperative operations with aggregated stats

import { createClient } from '@/lib/supabase/client';

export interface CooperativeStats {
  id: string;
  name: string;
  code: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  nb_planteurs: number;
  nb_fournisseurs: number;
  total_membres: number;
  total_charge_kg: number;
  total_decharge_kg: number;
  pertes_kg: number;
  pourcentage_pertes: number;
}

export interface CooperativeDetail extends CooperativeStats {
  planteurs: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    region: string | null;
    departement: string | null;
    localite: string | null;
  }>;
  fournisseurs: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    region: string | null;
    departement: string | null;
    localite: string | null;
  }>;
}

export interface CooperativeGlobalStats {
  total_cooperatives: number;
  total_membres: number;
  total_production_kg: number;
}

/**
 * Cooperatives API - Client-side functions for cooperative operations
 */
export const cooperativesApi = {
  /**
   * Get global statistics for all cooperatives
   */
  async getGlobalStats(): Promise<CooperativeGlobalStats> {
    const supabase = createClient();

    // Get total cooperatives
    const { count: totalCooperatives } = await supabase
      .from('cooperatives')
      .select('*', { count: 'exact', head: true });

    // Get total planteurs
    const { count: totalPlanteurs } = await supabase
      .from('planteurs')
      .select('*', { count: 'exact', head: true });

    // Get total fournisseurs (chef_planteurs)
    const { count: totalFournisseurs } = await supabase
      .from('chef_planteurs')
      .select('*', { count: 'exact', head: true });

    // Get total production (sum of weight_kg from deliveries)
    const { data: productionData } = await supabase
      .from('deliveries')
      .select('weight_kg');

    const totalProduction = (productionData || []).reduce(
      (sum, d) => sum + (Number((d as { weight_kg: number }).weight_kg) || 0),
      0
    );

    return {
      total_cooperatives: totalCooperatives || 0,
      total_membres: (totalPlanteurs || 0) + (totalFournisseurs || 0),
      total_production_kg: totalProduction,
    };
  },

  /**
   * List all cooperatives with aggregated stats
   */
  async listWithStats(): Promise<CooperativeStats[]> {
    const supabase = createClient();

    // Get all cooperatives
    const { data: cooperatives, error: coopError } = await supabase
      .from('cooperatives')
      .select('*')
      .order('name');

    if (coopError) {
      throw new Error(`Failed to fetch cooperatives: ${coopError.message}`);
    }

    // Get stats for each cooperative
    const statsPromises = (cooperatives || []).map(async (coop) => {
      const coopData = coop as { id: string; name: string; code: string | null; region: string | null; address: string | null; phone: string | null };
      
      // Count planteurs for this cooperative
      const { count: nbPlanteurs } = await supabase
        .from('planteurs')
        .select('*', { count: 'exact', head: true })
        .eq('cooperative_id', coopData.id);

      // Count fournisseurs for this cooperative
      const { count: nbFournisseurs } = await supabase
        .from('chef_planteurs')
        .select('*', { count: 'exact', head: true })
        .eq('cooperative_id', coopData.id);

      // Get delivery stats for this cooperative (deliveries has cooperative_id directly)
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('weight_loaded_kg, weight_kg')
        .eq('cooperative_id', coopData.id);

      let totalChargeKg = 0;
      let totalDechargeKg = 0;

      (deliveries || []).forEach((d: any) => {
        totalChargeKg += Number(d.weight_loaded_kg) || 0;
        totalDechargeKg += Number(d.weight_kg) || 0;
      });

      const pertesKg = totalChargeKg - totalDechargeKg;
      const pourcentagePertes = totalChargeKg > 0 ? (pertesKg / totalChargeKg) * 100 : 0;

      return {
        id: coopData.id,
        name: coopData.name,
        code: coopData.code,
        region: coopData.region,
        address: coopData.address,
        phone: coopData.phone,
        nb_planteurs: nbPlanteurs || 0,
        nb_fournisseurs: nbFournisseurs || 0,
        total_membres: (nbPlanteurs || 0) + (nbFournisseurs || 0),
        total_charge_kg: totalChargeKg,
        total_decharge_kg: totalDechargeKg,
        pertes_kg: pertesKg,
        pourcentage_pertes: Math.round(pourcentagePertes * 100) / 100,
      };
    });

    return Promise.all(statsPromises);
  },

  /**
   * Get details of a single cooperative with members list
   */
  async getDetail(id: string): Promise<CooperativeDetail | null> {
    const supabase = createClient();

    // Get cooperative
    const { data: coop, error: coopError } = await supabase
      .from('cooperatives')
      .select('*')
      .eq('id', id)
      .single();

    if (coopError) {
      if (coopError.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch cooperative: ${coopError.message}`);
    }

    const coopData = coop as { id: string; name: string; code: string | null; region: string | null; address: string | null; phone: string | null };

    // Get planteurs for this cooperative
    const { data: planteurs } = await supabase
      .from('planteurs')
      .select('id, name, code, phone, region, departement, localite')
      .eq('cooperative_id', coopData.id)
      .order('name');

    // Get fournisseurs for this cooperative
    const { data: fournisseurs } = await supabase
      .from('chef_planteurs')
      .select('id, name, code, phone, region, departement, localite')
      .eq('cooperative_id', coopData.id)
      .order('name');

    // Get delivery stats (deliveries has cooperative_id directly)
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('weight_loaded_kg, weight_kg')
      .eq('cooperative_id', coopData.id);

    let totalChargeKg = 0;
    let totalDechargeKg = 0;

    (deliveries || []).forEach((d: any) => {
      totalChargeKg += Number(d.weight_loaded_kg) || 0;
      totalDechargeKg += Number(d.weight_kg) || 0;
    });

    const pertesKg = totalChargeKg - totalDechargeKg;
    const pourcentagePertes = totalChargeKg > 0 ? (pertesKg / totalChargeKg) * 100 : 0;

    return {
      id: coopData.id,
      name: coopData.name,
      code: coopData.code,
      region: coopData.region,
      address: coopData.address,
      phone: coopData.phone,
      nb_planteurs: (planteurs || []).length,
      nb_fournisseurs: (fournisseurs || []).length,
      total_membres: (planteurs || []).length + (fournisseurs || []).length,
      total_charge_kg: totalChargeKg,
      total_decharge_kg: totalDechargeKg,
      pertes_kg: pertesKg,
      pourcentage_pertes: Math.round(pourcentagePertes * 100) / 100,
      planteurs: (planteurs || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        phone: p.phone,
        region: p.region,
        departement: p.departement,
        localite: p.localite,
      })),
      fournisseurs: (fournisseurs || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        phone: f.phone,
        region: f.region,
        departement: f.departement,
        localite: f.localite,
      })),
    };
  },

  /**
   * Get list of cooperative names for autocomplete
   */
  async getNames(): Promise<string[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('cooperatives')
      .select('name')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch cooperative names: ${error.message}`);
    }

    return (data || []).map((c: { name: string }) => c.name);
  },

  /**
   * Search cooperatives by name
   */
  async search(query: string, limit: number = 10): Promise<Array<{ id: string; name: string; code: string | null }>> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('cooperatives')
      .select('id, name, code')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search cooperatives: ${error.message}`);
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
    }));
  },

  /**
   * Create a new cooperative
   */
  async create(data: { name: string; code?: string; region_id?: string; address?: string; phone?: string }): Promise<{ id: string; name: string; code: string | null }> {
    const supabase = createClient();

    // Generate code if not provided
    const code = data.code || `COOP${Date.now().toString().slice(-6)}`;

    // Get region_id - use provided one or fetch the first available region
    let regionId = data.region_id;
    if (!regionId) {
      const { data: regions } = await supabase
        .from('regions')
        .select('id')
        .limit(1)
        .single();
      
      if (!regions) {
        throw new Error('Aucune région disponible. Veuillez d\'abord créer une région.');
      }
      regionId = (regions as { id: string }).id;
    }

    const { data: newCoop, error } = await supabase
      .from('cooperatives')
      .insert({
        name: data.name,
        code,
        region_id: regionId,
        address: data.address || null,
        phone: data.phone || null,
      } as never)
      .select('id, name, code')
      .single();

    if (error) {
      throw new Error(`Failed to create cooperative: ${error.message}`);
    }

    const coopResult = newCoop as { id: string; name: string; code: string | null };
    return {
      id: coopResult.id,
      name: coopResult.name,
      code: coopResult.code,
    };
  },
};
