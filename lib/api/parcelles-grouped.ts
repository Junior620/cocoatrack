// CocoaTrack V2 - Parcelles Grouped API
// Client-side API functions for parcelles grouped by planteur
// Provides "Vue par Planteur" functionality with statistics
// @ts-nocheck - Types need to be regenerated from Supabase after migration

import { createClient } from '@/lib/supabase/client';
import type {
  Parcelle,
  PlanteurWithParcelles,
  ParcelleStats,
} from '@/types/parcelles';

// Helper to get typed client
const getTypedClient = () => createClient();

/**
 * Response type for getParcellesByPlanteur
 */
export interface ParcellesByPlanteurResponse {
  /** Parcelles grouped by planteur (assigned parcelles) */
  groups: PlanteurWithParcelles[];
  /** Orphan parcelles group (planteur_id IS NULL) */
  orphans: PlanteurWithParcelles | null;
  /** Statistics for all parcelles */
  stats: ParcelleStats;
}

/**
 * Filters for getParcellesByPlanteur
 */
export interface ParcellesByPlanteurFilters {
  /** Page number (1-indexed, default: 1) */
  page?: number;
  /** Number of planteur groups per page (default: 20) */
  pageSize?: number;
  /** Include orphan parcelles in response (default: true) */
  include_orphans?: boolean;
  /** Search by planteur name or code */
  search?: string;
}

/**
 * Raw row type from parcelles query with planteur join
 */
interface ParcelleWithPlanteurRow {
  id: string;
  planteur_id: string | null;
  code: string | null;
  label: string | null;
  village: string | null;
  surface_hectares: number;
  is_active: boolean;
  created_at: string;
  // Planteur relation (may be null for orphans)
  planteur?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Parcelles Grouped API - Client-side functions for grouped view
 */
export const parcellesGroupedApi = {
  /**
   * Get parcelles grouped by planteur with statistics
   * 
   * This function performs two queries:
   * 1. Parcelles grouped by planteur_id (assigned parcelles)
   * 2. Orphan parcelles (planteur_id IS NULL)
   * 
   * Statistics are calculated from the query results:
   * - total_parcelles = assigned_parcelles + orphan_parcelles
   * - total_surface_ha = assigned_surface_ha + orphan_surface_ha
   * 
   * RLS enforces cooperative isolation:
   * - Assigned parcelles: via planteur.cooperative_id
   * - Orphan parcelles: via import_file.cooperative_id
   * 
   * @param filters - Optional filters for pagination and search
   * @returns ParcellesByPlanteurResponse with groups, orphans, and stats
   * 
   * @see Requirements 4.2, 4.3, 4.4
   */
  async getParcellesByPlanteur(
    filters: ParcellesByPlanteurFilters = {}
  ): Promise<ParcellesByPlanteurResponse> {
    const supabase = getTypedClient();
    
    const {
      page = 1,
      pageSize = 20,
      include_orphans = true,
      search,
    } = filters;

    // =========================================================================
    // Query 1: Get assigned parcelles grouped by planteur
    // =========================================================================
    
    // First, get all active parcelles with planteur relation
    let assignedQuery = supabase
      .from('parcelles')
      .select(`
        id,
        planteur_id,
        code,
        label,
        village,
        surface_hectares,
        is_active,
        created_at,
        planteur:planteurs!parcelles_planteur_id_fkey(
          id,
          name,
          code
        )
      `)
      .eq('is_active', true)
      .not('planteur_id', 'is', null);

    // Apply search filter on planteur name/code if provided
    if (search) {
      // We need to filter by planteur name/code, which requires a different approach
      // First get matching planteur IDs, then filter parcelles
      const { data: matchingPlanteurs } = await supabase
        .from('planteurs')
        .select('id')
        .eq('is_active', true)
        .or(`name.ilike.%${search}%,code.ilike.%${search}%`);
      
      if (matchingPlanteurs && matchingPlanteurs.length > 0) {
        const planteurIds = matchingPlanteurs.map(p => p.id);
        assignedQuery = assignedQuery.in('planteur_id', planteurIds);
      } else {
        // No matching planteurs, return empty result for assigned
        assignedQuery = assignedQuery.eq('planteur_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: assignedParcelles, error: assignedError } = await assignedQuery;

    if (assignedError) {
      throw new Error(`Failed to fetch assigned parcelles: ${assignedError.message}`);
    }

    // =========================================================================
    // Query 2: Get orphan parcelles (planteur_id IS NULL)
    // =========================================================================
    
    let orphanParcelles: ParcelleWithPlanteurRow[] = [];
    
    if (include_orphans) {
      const { data: orphans, error: orphanError } = await supabase
        .from('parcelles')
        .select(`
          id,
          planteur_id,
          code,
          label,
          village,
          surface_hectares,
          is_active,
          created_at
        `)
        .eq('is_active', true)
        .is('planteur_id', null);

      if (orphanError) {
        throw new Error(`Failed to fetch orphan parcelles: ${orphanError.message}`);
      }

      orphanParcelles = (orphans || []) as ParcelleWithPlanteurRow[];
    }

    // =========================================================================
    // Group parcelles by planteur
    // =========================================================================
    
    const planteurMap = new Map<string, {
      planteur: { id: string; name: string; code: string };
      parcelles: ParcelleWithPlanteurRow[];
      total_surface_ha: number;
    }>();

    for (const parcelle of (assignedParcelles || []) as ParcelleWithPlanteurRow[]) {
      if (!parcelle.planteur_id || !parcelle.planteur) continue;

      const planteurId = parcelle.planteur_id;
      
      if (!planteurMap.has(planteurId)) {
        planteurMap.set(planteurId, {
          planteur: parcelle.planteur,
          parcelles: [],
          total_surface_ha: 0,
        });
      }

      const group = planteurMap.get(planteurId)!;
      group.parcelles.push(parcelle);
      group.total_surface_ha += Number(parcelle.surface_hectares) || 0;
    }

    // Convert map to array and sort by planteur name
    const allGroups = Array.from(planteurMap.values())
      .sort((a, b) => a.planteur.name.localeCompare(b.planteur.name));

    // Apply pagination to groups
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedGroups = allGroups.slice(startIndex, endIndex);

    // Transform to PlanteurWithParcelles format
    const groups: PlanteurWithParcelles[] = paginatedGroups.map(group => ({
      planteur: group.planteur,
      parcelles_count: group.parcelles.length,
      total_surface_ha: Math.round(group.total_surface_ha * 100) / 100, // Round to 2 decimals
      // Note: parcelles array is not included by default for performance
      // Use a separate endpoint to fetch parcelles for a specific planteur
    }));

    // =========================================================================
    // Build orphans group
    // =========================================================================
    
    let orphansGroup: PlanteurWithParcelles | null = null;
    
    if (include_orphans && orphanParcelles.length > 0) {
      const orphanSurface = orphanParcelles.reduce(
        (sum, p) => sum + (Number(p.surface_hectares) || 0),
        0
      );

      orphansGroup = {
        planteur: null, // null indicates orphan group
        parcelles_count: orphanParcelles.length,
        total_surface_ha: Math.round(orphanSurface * 100) / 100,
      };
    }

    // =========================================================================
    // Calculate statistics
    // =========================================================================
    
    const assignedCount = (assignedParcelles || []).length;
    const orphanCount = orphanParcelles.length;
    
    const assignedSurface = (assignedParcelles || []).reduce(
      (sum, p) => sum + (Number((p as ParcelleWithPlanteurRow).surface_hectares) || 0),
      0
    );
    const orphanSurface = orphanParcelles.reduce(
      (sum, p) => sum + (Number(p.surface_hectares) || 0),
      0
    );

    const stats: ParcelleStats = {
      total_parcelles: assignedCount + orphanCount,
      assigned_parcelles: assignedCount,
      orphan_parcelles: orphanCount,
      total_surface_ha: Math.round((assignedSurface + orphanSurface) * 100) / 100,
      assigned_surface_ha: Math.round(assignedSurface * 100) / 100,
      orphan_surface_ha: Math.round(orphanSurface * 100) / 100,
    };

    return {
      groups,
      orphans: orphansGroup,
      stats,
    };
  },

  /**
   * Get parcelles for a specific planteur
   * 
   * Returns all active parcelles belonging to a planteur.
   * Used when expanding a planteur group in the UI.
   * 
   * @param planteurId - UUID of the planteur
   * @returns Array of Parcelle objects
   */
  async getParcellesForPlanteur(planteurId: string): Promise<Parcelle[]> {
    const supabase = getTypedClient();

    const { data, error } = await supabase
      .from('parcelles')
      .select('*')
      .eq('planteur_id', planteurId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch parcelles for planteur: ${error.message}`);
    }

    // Transform to Parcelle type
    return (data || []).map(row => ({
      id: row.id,
      planteur_id: row.planteur_id,
      code: row.code,
      label: row.label,
      village: row.village,
      geometry: row.geometry as unknown as Parcelle['geometry'],
      centroid: {
        lat: row.centroid_lat,
        lng: row.centroid_lng,
      },
      surface_hectares: Number(row.surface_hectares),
      certifications: (row.certifications || []) as Parcelle['certifications'],
      conformity_status: row.conformity_status as Parcelle['conformity_status'],
      risk_flags: (row.risk_flags as unknown as Parcelle['risk_flags']) || {},
      source: row.source as Parcelle['source'],
      import_file_id: row.import_file_id,
      feature_hash: row.feature_hash,
      is_active: row.is_active,
      created_by: row.created_by,
      created_by_name: null, // Not fetched in this query
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  },

  /**
   * Get orphan parcelles
   * 
   * Returns all active parcelles without a planteur assigned.
   * Used when expanding the orphan group in the UI.
   * 
   * @returns Array of Parcelle objects
   */
  async getOrphanParcelles(): Promise<Parcelle[]> {
    const supabase = getTypedClient();

    const { data, error } = await supabase
      .from('parcelles')
      .select('*')
      .is('planteur_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch orphan parcelles: ${error.message}`);
    }

    // Transform to Parcelle type
    return (data || []).map(row => ({
      id: row.id,
      planteur_id: row.planteur_id,
      code: row.code,
      label: row.label,
      village: row.village,
      geometry: row.geometry as unknown as Parcelle['geometry'],
      centroid: {
        lat: row.centroid_lat,
        lng: row.centroid_lng,
      },
      surface_hectares: Number(row.surface_hectares),
      certifications: (row.certifications || []) as Parcelle['certifications'],
      conformity_status: row.conformity_status as Parcelle['conformity_status'],
      risk_flags: (row.risk_flags as unknown as Parcelle['risk_flags']) || {},
      source: row.source as Parcelle['source'],
      import_file_id: row.import_file_id,
      feature_hash: row.feature_hash,
      is_active: row.is_active,
      created_by: row.created_by,
      created_by_name: null, // Not fetched in this query
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  },

  /**
   * Get statistics only (without groups)
   * 
   * Lightweight endpoint to get just the statistics.
   * Useful for dashboard widgets and summary displays.
   * 
   * @returns ParcelleStats object
   * 
   * @see Requirements 6.1, 6.2
   */
  async getStats(): Promise<ParcelleStats> {
    const supabase = getTypedClient();

    // Query for assigned parcelles count and surface
    const { data: assignedData, error: assignedError } = await supabase
      .from('parcelles')
      .select('surface_hectares')
      .eq('is_active', true)
      .not('planteur_id', 'is', null);

    if (assignedError) {
      throw new Error(`Failed to fetch assigned parcelles stats: ${assignedError.message}`);
    }

    // Query for orphan parcelles count and surface
    const { data: orphanData, error: orphanError } = await supabase
      .from('parcelles')
      .select('surface_hectares')
      .eq('is_active', true)
      .is('planteur_id', null);

    if (orphanError) {
      throw new Error(`Failed to fetch orphan parcelles stats: ${orphanError.message}`);
    }

    const assignedCount = (assignedData || []).length;
    const orphanCount = (orphanData || []).length;
    
    const assignedSurface = (assignedData || []).reduce(
      (sum, p) => sum + (Number(p.surface_hectares) || 0),
      0
    );
    const orphanSurface = (orphanData || []).reduce(
      (sum, p) => sum + (Number(p.surface_hectares) || 0),
      0
    );

    return {
      total_parcelles: assignedCount + orphanCount,
      assigned_parcelles: assignedCount,
      orphan_parcelles: orphanCount,
      total_surface_ha: Math.round((assignedSurface + orphanSurface) * 100) / 100,
      assigned_surface_ha: Math.round(assignedSurface * 100) / 100,
      orphan_surface_ha: Math.round(orphanSurface * 100) / 100,
    };
  },
};
