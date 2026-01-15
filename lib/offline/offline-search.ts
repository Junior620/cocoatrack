/**
 * CocoaTrack V2 - Offline Search Implementation
 * 
 * Provides efficient offline search using IndexedDB indexes.
 * Requirements: REQ-OFF-005
 * 
 * Features:
 * - Prefix search using name_norm index
 * - Exact match using code index
 * - Results limited to 50 items
 * - Performance target: < 100ms
 */

import {
  openDatabase,
  type CachedPlanteur,
  type CachedChefPlanteur,
  type CachedWarehouse,
} from './indexed-db';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of search results to return
 * REQ-OFF-005: Limit results to 50 items
 */
export const MAX_SEARCH_RESULTS = 50;

/**
 * Minimum query length for search
 */
export const MIN_QUERY_LENGTH = 1;

// ============================================================================
// TYPES
// ============================================================================

export type SearchableEntity = 'planteurs' | 'chef_planteurs' | 'warehouses';

export interface OfflineSearchResult<T> {
  results: T[];
  total: number;
  truncated: boolean;
  searchTime: number; // milliseconds
  isOffline: boolean;
}

export interface SearchOptions {
  /** Maximum number of results to return (default: MAX_SEARCH_RESULTS) */
  limit?: number;
  /** Filter by cooperative_id */
  cooperativeId?: string;
  /** Include inactive records */
  includeInactive?: boolean;
}

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

/**
 * Normalizes a name for search matching.
 * Client-side fallback for server-side name_norm.
 * 
 * Server-side (PostgreSQL trigger):
 *   name_norm = lower(unaccent(name))
 * 
 * Client-side:
 *   - Convert to lowercase
 *   - Remove diacritics (accents)
 *   - Remove non-alphanumeric characters except spaces
 *   - Trim whitespace
 */
export function normalizeNameForSearch(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')     // Keep only alphanumeric and spaces
    .trim();
}

/**
 * Checks if a string starts with a prefix (case-insensitive, normalized)
 */
export function startsWithNormalized(value: string, prefix: string): boolean {
  const normalizedValue = normalizeNameForSearch(value);
  const normalizedPrefix = normalizeNameForSearch(prefix);
  return normalizedValue.startsWith(normalizedPrefix);
}

/**
 * Checks if a code matches exactly (case-insensitive)
 */
export function codeMatches(code: string, query: string): boolean {
  return code.toLowerCase() === query.toLowerCase();
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Searches planteurs by name (prefix) or code (exact match)
 * REQ-OFF-005: Offline Search Optimisée
 * 
 * @param query - Search query string
 * @param options - Search options
 * @returns Search results with metadata
 */
export async function searchPlanteursOffline(
  query: string,
  options: SearchOptions = {}
): Promise<OfflineSearchResult<CachedPlanteur>> {
  const startTime = performance.now();
  const limit = options.limit ?? MAX_SEARCH_RESULTS;
  
  // Validate query
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return {
      results: [],
      total: 0,
      truncated: false,
      searchTime: performance.now() - startTime,
      isOffline: true,
    };
  }

  const normalizedQuery = normalizeNameForSearch(query.trim());
  const db = await openDatabase();
  
  // Get all planteurs (we'll filter in memory for now)
  // In a future optimization, we could use IDBKeyRange for prefix search
  const allPlanteurs = await db.getAll('planteurs');
  
  // Filter by search criteria
  let filtered = allPlanteurs.filter(planteur => {
    // Check code exact match first (faster)
    if (codeMatches(planteur.code, query.trim())) {
      return true;
    }
    
    // Check name prefix match
    if (startsWithNormalized(planteur.name, query.trim())) {
      return true;
    }
    
    return false;
  });
  
  // Apply cooperative filter if provided
  if (options.cooperativeId) {
    filtered = filtered.filter(p => p.cooperative_id === options.cooperativeId);
  }
  
  // Apply active filter (default: only active)
  if (!options.includeInactive) {
    filtered = filtered.filter(p => p.is_active);
  }
  
  const total = filtered.length;
  const truncated = total > limit;
  
  // Limit results
  const results = filtered.slice(0, limit);
  
  return {
    results,
    total,
    truncated,
    searchTime: performance.now() - startTime,
    isOffline: true,
  };
}

/**
 * Searches chef_planteurs by name (prefix) or code (exact match)
 * REQ-OFF-005: Offline Search Optimisée
 * 
 * @param query - Search query string
 * @param options - Search options
 * @returns Search results with metadata
 */
export async function searchChefPlanteursOffline(
  query: string,
  options: SearchOptions = {}
): Promise<OfflineSearchResult<CachedChefPlanteur>> {
  const startTime = performance.now();
  const limit = options.limit ?? MAX_SEARCH_RESULTS;
  
  // Validate query
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return {
      results: [],
      total: 0,
      truncated: false,
      searchTime: performance.now() - startTime,
      isOffline: true,
    };
  }

  const db = await openDatabase();
  
  // Get all chef_planteurs
  const allChefPlanteurs = await db.getAll('chef_planteurs');
  
  // Filter by search criteria
  let filtered = allChefPlanteurs.filter(chefPlanteur => {
    // Check code exact match first
    if (codeMatches(chefPlanteur.code, query.trim())) {
      return true;
    }
    
    // Check name prefix match
    if (startsWithNormalized(chefPlanteur.name, query.trim())) {
      return true;
    }
    
    return false;
  });
  
  // Apply cooperative filter if provided
  if (options.cooperativeId) {
    filtered = filtered.filter(cp => cp.cooperative_id === options.cooperativeId);
  }
  
  // Apply validation status filter (default: only validated)
  if (!options.includeInactive) {
    filtered = filtered.filter(cp => cp.validation_status === 'validated');
  }
  
  const total = filtered.length;
  const truncated = total > limit;
  
  // Limit results
  const results = filtered.slice(0, limit);
  
  return {
    results,
    total,
    truncated,
    searchTime: performance.now() - startTime,
    isOffline: true,
  };
}

/**
 * Searches warehouses by name (prefix) or code (exact match)
 * REQ-OFF-005: Offline Search Optimisée
 * 
 * @param query - Search query string
 * @param options - Search options
 * @returns Search results with metadata
 */
export async function searchWarehousesOffline(
  query: string,
  options: SearchOptions = {}
): Promise<OfflineSearchResult<CachedWarehouse>> {
  const startTime = performance.now();
  const limit = options.limit ?? MAX_SEARCH_RESULTS;
  
  // Validate query
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return {
      results: [],
      total: 0,
      truncated: false,
      searchTime: performance.now() - startTime,
      isOffline: true,
    };
  }

  const db = await openDatabase();
  
  // Get all warehouses
  const allWarehouses = await db.getAll('warehouses');
  
  // Filter by search criteria
  let filtered = allWarehouses.filter(warehouse => {
    // Check code exact match first
    if (codeMatches(warehouse.code, query.trim())) {
      return true;
    }
    
    // Check name prefix match
    if (startsWithNormalized(warehouse.name, query.trim())) {
      return true;
    }
    
    return false;
  });
  
  // Apply cooperative filter if provided
  if (options.cooperativeId) {
    filtered = filtered.filter(w => w.cooperative_id === options.cooperativeId);
  }
  
  // Apply active filter (default: only active)
  if (!options.includeInactive) {
    filtered = filtered.filter(w => w.is_active);
  }
  
  const total = filtered.length;
  const truncated = total > limit;
  
  // Limit results
  const results = filtered.slice(0, limit);
  
  return {
    results,
    total,
    truncated,
    searchTime: performance.now() - startTime,
    isOffline: true,
  };
}

// ============================================================================
// UNIFIED SEARCH
// ============================================================================

export interface UnifiedSearchResults {
  planteurs: OfflineSearchResult<CachedPlanteur>;
  chefPlanteurs: OfflineSearchResult<CachedChefPlanteur>;
  warehouses: OfflineSearchResult<CachedWarehouse>;
  totalSearchTime: number;
}

/**
 * Searches all entity types simultaneously
 * 
 * @param query - Search query string
 * @param options - Search options
 * @returns Combined search results from all entity types
 */
export async function searchAllOffline(
  query: string,
  options: SearchOptions = {}
): Promise<UnifiedSearchResults> {
  const startTime = performance.now();
  
  // Run all searches in parallel
  const [planteurs, chefPlanteurs, warehouses] = await Promise.all([
    searchPlanteursOffline(query, options),
    searchChefPlanteursOffline(query, options),
    searchWarehousesOffline(query, options),
  ]);
  
  return {
    planteurs,
    chefPlanteurs,
    warehouses,
    totalSearchTime: performance.now() - startTime,
  };
}

// ============================================================================
// SEARCH WITH ONLINE FALLBACK
// ============================================================================

export interface HybridSearchOptions extends SearchOptions {
  /** Force offline search even when online */
  forceOffline?: boolean;
  /** Callback when falling back to offline */
  onOfflineFallback?: () => void;
}

/**
 * Checks if the browser is currently online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Searches with automatic offline fallback
 * When online, can optionally fetch from server
 * When offline, uses IndexedDB cache
 * 
 * @param entity - Entity type to search
 * @param query - Search query string
 * @param options - Search options
 * @returns Search results
 */
export async function searchWithFallback<T extends SearchableEntity>(
  entity: T,
  query: string,
  options: HybridSearchOptions = {}
): Promise<OfflineSearchResult<
  T extends 'planteurs' ? CachedPlanteur :
  T extends 'chef_planteurs' ? CachedChefPlanteur :
  CachedWarehouse
>> {
  const shouldUseOffline = options.forceOffline || !isOnline();
  
  if (shouldUseOffline) {
    options.onOfflineFallback?.();
    
    switch (entity) {
      case 'planteurs':
        return searchPlanteursOffline(query, options) as Promise<OfflineSearchResult<
          T extends 'planteurs' ? CachedPlanteur :
          T extends 'chef_planteurs' ? CachedChefPlanteur :
          CachedWarehouse
        >>;
      case 'chef_planteurs':
        return searchChefPlanteursOffline(query, options) as Promise<OfflineSearchResult<
          T extends 'planteurs' ? CachedPlanteur :
          T extends 'chef_planteurs' ? CachedChefPlanteur :
          CachedWarehouse
        >>;
      case 'warehouses':
        return searchWarehousesOffline(query, options) as Promise<OfflineSearchResult<
          T extends 'planteurs' ? CachedPlanteur :
          T extends 'chef_planteurs' ? CachedChefPlanteur :
          CachedWarehouse
        >>;
      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  }
  
  // When online, still use offline search for now
  // In the future, this could call the server API
  switch (entity) {
    case 'planteurs':
      return searchPlanteursOffline(query, options) as Promise<OfflineSearchResult<
        T extends 'planteurs' ? CachedPlanteur :
        T extends 'chef_planteurs' ? CachedChefPlanteur :
        CachedWarehouse
      >>;
    case 'chef_planteurs':
      return searchChefPlanteursOffline(query, options) as Promise<OfflineSearchResult<
        T extends 'planteurs' ? CachedPlanteur :
        T extends 'chef_planteurs' ? CachedChefPlanteur :
        CachedWarehouse
      >>;
    case 'warehouses':
      return searchWarehousesOffline(query, options) as Promise<OfflineSearchResult<
        T extends 'planteurs' ? CachedPlanteur :
        T extends 'chef_planteurs' ? CachedChefPlanteur :
        CachedWarehouse
      >>;
    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}
