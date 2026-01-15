// CocoaTrack V2 - Analytics API
// Client-side API functions for synthesis/analytics operations

import { createClient } from '@/lib/supabase/client';

export interface PlanteurSummaryItem {
  planter_id: string;
  planter_name: string;
  planter_code: string;
  cooperative: string | null;
  total_kg: number;
  total_loaded_kg: number;
  pertes_kg: number;
  pct_pertes: number;
  nombre_livraisons: number;
}

export interface PlanteurSummaryResponse {
  items: PlanteurSummaryItem[];
  total_general: number;
  total_loaded: number;
  total_pertes: number;
  pct_pertes_global: number;
  total_planteurs: number;
}

export interface FournisseurSummaryItem {
  fournisseur_id: string;
  fournisseur_name: string;
  fournisseur_code: string;
  cooperative: string | null;
  total_loaded_kg: number;
  total_unloaded_kg: number;
  pertes_kg: number;
  pct_pertes: number;
  quantite_max_kg: number;
  pct_utilisation: number;
  nombre_livraisons: number;
  nombre_planteurs: number;
}

export interface FournisseurSummaryResponse {
  items: FournisseurSummaryItem[];
  total_loaded: number;
  total_unloaded: number;
  total_pertes: number;
  pct_pertes_global: number;
  total_max: number;
  pct_utilisation_global: number;
  total_fournisseurs: number;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
}

/**
 * Analytics API - Client-side functions for synthesis operations
 */
export const analyticsApi = {
  /**
   * Get summary by planteur with delivery stats
   */
  async getSummaryPlanteur(filters: AnalyticsFilters = {}): Promise<PlanteurSummaryResponse> {
    const supabase = createClient();

    // Get cooperatives for name lookup
    const { data: cooperatives } = await supabase
      .from('cooperatives')
      .select('id, name');
    
    const coopMap = new Map((cooperatives || []).map((c: any) => [c.id, c.name]));

    // Build query for deliveries with planteur info
    let query = supabase
      .from('deliveries')
      .select(`
        id,
        weight_kg,
        delivered_at,
        planteur:planteurs!inner(
          id,
          name,
          code,
          cooperative_id
        )
      `);

    // Apply date filters
    if (filters.from) {
      query = query.gte('delivered_at', filters.from);
    }
    if (filters.to) {
      query = query.lte('delivered_at', filters.to);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch planteur summary: ${error.message}`);
    }

    // Aggregate by planteur
    const planteurMap = new Map<string, {
      id: string;
      name: string;
      code: string;
      cooperative_id: string | null;
      total_kg: number;
      nombre_livraisons: number;
    }>();

    (deliveries || []).forEach((d: any) => {
      const planteur = d.planteur;
      const key = planteur.id;
      
      if (!planteurMap.has(key)) {
        planteurMap.set(key, {
          id: planteur.id,
          name: planteur.name,
          code: planteur.code,
          cooperative_id: planteur.cooperative_id,
          total_kg: 0,
          nombre_livraisons: 0,
        });
      }
      
      const stats = planteurMap.get(key)!;
      stats.total_kg += Number(d.weight_kg) || 0;
      stats.nombre_livraisons += 1;
    });

    // Convert to array and calculate stats
    const items: PlanteurSummaryItem[] = Array.from(planteurMap.values())
      .map((p) => {
        return {
          planter_id: p.id,
          planter_name: p.name,
          planter_code: p.code,
          cooperative: p.cooperative_id ? coopMap.get(p.cooperative_id) || null : null,
          total_kg: Math.round(p.total_kg * 100) / 100,
          total_loaded_kg: 0, // V2 schema doesn't have quantity_loaded_kg
          pertes_kg: 0,
          pct_pertes: 0,
          nombre_livraisons: p.nombre_livraisons,
        };
      })
      .sort((a, b) => b.total_kg - a.total_kg);

    // Calculate totals
    const totalGeneral = items.reduce((sum, i) => sum + i.total_kg, 0);

    return {
      items,
      total_general: Math.round(totalGeneral * 100) / 100,
      total_loaded: 0,
      total_pertes: 0,
      pct_pertes_global: 0,
      total_planteurs: items.length,
    };
  },

  /**
   * Get summary by fournisseur (chef planteur) with delivery stats
   */
  async getSummaryFournisseur(filters: AnalyticsFilters = {}): Promise<FournisseurSummaryResponse> {
    const supabase = createClient();

    // Get all chef_planteurs with their planteurs
    const { data: chefPlanteurs, error: chefError } = await supabase
      .from('chef_planteurs')
      .select(`
        id,
        name,
        code,
        cooperative_id,
        quantite_max_kg,
        planteurs(id)
      `)
      .order('name');

    if (chefError) {
      throw new Error(`Failed to fetch chef planteurs: ${chefError.message}`);
    }

    // Get cooperative names
    const { data: cooperatives } = await supabase
      .from('cooperatives')
      .select('id, name');

    const coopMap = new Map((cooperatives || []).map((c: any) => [c.id, c.name]));

    // For each chef planteur, get delivery stats
    const items: FournisseurSummaryItem[] = [];

    for (const chef of (chefPlanteurs || [])) {
      const chefData = chef as any;
      const planteurIds = (chefData.planteurs || []).map((p: any) => p.id);
      
      let totalKg = 0;
      let nombreLivraisons = 0;

      if (planteurIds.length > 0) {
        // Build query for deliveries
        let query = supabase
          .from('deliveries')
          .select('weight_kg')
          .in('planteur_id', planteurIds);

        if (filters.from) {
          query = query.gte('delivered_at', filters.from);
        }
        if (filters.to) {
          query = query.lte('delivered_at', filters.to);
        }

        const { data: deliveries } = await query;

        (deliveries || []).forEach((d: any) => {
          totalKg += Number(d.weight_kg) || 0;
          nombreLivraisons += 1;
        });
      }

      const maxKg = Number(chefData.quantite_max_kg) || 0;
      const pctUtilisation = maxKg > 0 ? (totalKg / maxKg) * 100 : 0;

      items.push({
        fournisseur_id: chefData.id,
        fournisseur_name: chefData.name,
        fournisseur_code: chefData.code,
        cooperative: chefData.cooperative_id ? coopMap.get(chefData.cooperative_id) || null : null,
        total_loaded_kg: Math.round(totalKg * 100) / 100,
        total_unloaded_kg: Math.round(totalKg * 100) / 100,
        pertes_kg: 0,
        pct_pertes: 0,
        quantite_max_kg: maxKg,
        pct_utilisation: Math.round(pctUtilisation * 100) / 100,
        nombre_livraisons: nombreLivraisons,
        nombre_planteurs: planteurIds.length,
      });
    }

    // Sort by total kg descending
    items.sort((a, b) => b.total_loaded_kg - a.total_loaded_kg);

    // Calculate global totals
    const totalKg = items.reduce((sum, i) => sum + i.total_loaded_kg, 0);
    const totalMax = items.reduce((sum, i) => sum + i.quantite_max_kg, 0);
    const pctUtilisationGlobal = totalMax > 0 ? (totalKg / totalMax) * 100 : 0;

    return {
      items,
      total_loaded: Math.round(totalKg * 100) / 100,
      total_unloaded: Math.round(totalKg * 100) / 100,
      total_pertes: 0,
      pct_pertes_global: 0,
      total_max: Math.round(totalMax * 100) / 100,
      pct_utilisation_global: Math.round(pctUtilisationGlobal * 100) / 100,
      total_fournisseurs: items.length,
    };
  },
};
