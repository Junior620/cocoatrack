// CocoaTrack V2 - Parcelles By Planteur API Route
// GET /api/parcelles/by-planteur - Get parcelles grouped by planteur with statistics
// Provides "Vue par Planteur" functionality with pagination and orphan support

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import type {
  PlanteurWithParcelles,
  ParcelleStats,
} from '@/types/parcelles';
import {
  unauthorizedResponse,
  validationErrorResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';

/**
 * Response type for GET /api/parcelles/by-planteur
 */
interface ParcellesByPlanteurResponse {
  /** Parcelles grouped by planteur (assigned parcelles) */
  groups: PlanteurWithParcelles[];
  /** Orphan parcelles group (planteur_id IS NULL) */
  orphans: PlanteurWithParcelles | null;
  /** Statistics for all parcelles */
  stats: ParcelleStats;
  /** Pagination info */
  pagination: {
    page: number;
    pageSize: number;
    totalGroups: number;
    totalPages: number;
  };
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
 * GET /api/parcelles/by-planteur
 * 
 * Get parcelles grouped by planteur with statistics.
 * 
 * Query Parameters:
 * - page: Page number (1-indexed, default: 1)
 * - pageSize: Number of planteur groups per page (default: 20, max: 100)
 * - include_orphans: Include orphan parcelles in response (default: true)
 * - search: Search by planteur name or code
 * 
 * Response:
 * - groups: Array of PlanteurWithParcelles (paginated)
 * - orphans: PlanteurWithParcelles | null (orphan parcelles group)
 * - stats: ParcelleStats (total, assigned, orphan counts and surfaces)
 * - pagination: { page, pageSize, totalGroups, totalPages }
 * 
 * RLS enforces cooperative isolation:
 * - Assigned parcelles: via planteur.cooperative_id
 * - Orphan parcelles: via import_file.cooperative_id
 * 
 * @see Requirements 4.1, 4.2
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    
    // Page (1-indexed, default: 1)
    let page = 1;
    if (searchParams.has('page')) {
      const parsedPage = parseInt(searchParams.get('page') || '1', 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return validationErrorResponse('page', 'Page must be a positive integer');
      }
      page = parsedPage;
    }

    // Page size (default: 20, max: 100)
    let pageSize = 20;
    if (searchParams.has('pageSize')) {
      const parsedPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
      if (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 100) {
        return validationErrorResponse('pageSize', 'Page size must be between 1 and 100');
      }
      pageSize = parsedPageSize;
    }

    // Include orphans (default: true)
    let includeOrphans = true;
    if (searchParams.has('include_orphans')) {
      includeOrphans = searchParams.get('include_orphans') !== 'false';
    }

    // Search filter
    const search = searchParams.get('search') || undefined;

    // =========================================================================
    // Query 1: Get assigned parcelles grouped by planteur
    // =========================================================================
    
    // First, get all active parcelles with planteur relation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assignedQuery = (supabase as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matchingPlanteurs } = await (supabase as any)
        .from('planteurs')
        .select('id')
        .eq('is_active', true)
        .or(`name.ilike.%${search}%,code.ilike.%${search}%`);
      
      if (matchingPlanteurs && matchingPlanteurs.length > 0) {
        const planteurIds = matchingPlanteurs.map((p: { id: string }) => p.id);
        assignedQuery = assignedQuery.in('planteur_id', planteurIds);
      } else {
        // No matching planteurs, return empty result for assigned
        assignedQuery = assignedQuery.eq('planteur_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: assignedParcelles, error: assignedError } = await assignedQuery;

    if (assignedError) {
      console.error('Error fetching assigned parcelles:', assignedError);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch assigned parcelles',
        { reason: assignedError.message }
      ));
    }

    // =========================================================================
    // Query 2: Get orphan parcelles (planteur_id IS NULL)
    // =========================================================================
    
    let orphanParcelles: ParcelleWithPlanteurRow[] = [];
    
    if (includeOrphans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orphans, error: orphanError } = await (supabase as any)
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
        console.error('Error fetching orphan parcelles:', orphanError);
        return toNextResponse(createParcelleError(
          ParcelleErrorCodes.INTERNAL_ERROR,
          'Failed to fetch orphan parcelles',
          { reason: orphanError.message }
        ));
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

    const totalGroups = allGroups.length;

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
    
    if (includeOrphans && orphanParcelles.length > 0) {
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
      (sum: number, p: ParcelleWithPlanteurRow) => sum + (Number(p.surface_hectares) || 0),
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

    // =========================================================================
    // Build response
    // =========================================================================
    
    const responseData: ParcellesByPlanteurResponse = {
      groups,
      orphans: orphansGroup,
      stats,
      pagination: {
        page,
        pageSize,
        totalGroups,
        totalPages: Math.ceil(totalGroups / pageSize),
      },
    };

    const response = NextResponse.json(responseData);
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    return handleErrorResponse(error, 'GET /api/parcelles/by-planteur');
  }
}
