'use client';

/**
 * useReceiptFormCache hook
 *
 * Caches cooperative/planteur/chef planteur lists to avoid repeated API requests
 * during receipt form filling.
 *
 * Requirements: 18.3, 18.4
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface CachedPlanteur {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  cooperative_id: string;
}

export interface CachedChefPlanteur {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  cooperative_id: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================================
// MODULE-LEVEL CACHE (persists across component mounts)
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const planteurCache = new Map<string, CacheEntry<CachedPlanteur[]>>();
const chefPlanteurCache = new Map<string, CacheEntry<CachedChefPlanteur[]>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseReceiptFormCacheResult {
  planteurs: CachedPlanteur[];
  chefPlanteurs: CachedChefPlanteur[];
  isLoading: boolean;
  /** Force a cache refresh */
  refresh: () => void;
}

/**
 * Hook that pre-fetches and caches planteur and chef planteur lists
 * for a given cooperative to avoid repeated API calls during form filling.
 *
 * Requirements: 18.3, 18.4
 */
export function useReceiptFormCache(cooperativeId: string): UseReceiptFormCacheResult {
  const [planteurs, setPlanteurs] = useState<CachedPlanteur[]>(() => {
    return getCached(planteurCache, cooperativeId) ?? [];
  });
  const [chefPlanteurs, setChefPlanteurs] = useState<CachedChefPlanteur[]>(() => {
    return getCached(chefPlanteurCache, cooperativeId) ?? [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    // Bust cache entries for this cooperative
    planteurCache.delete(cooperativeId);
    chefPlanteurCache.delete(cooperativeId);
    setRefreshKey((k) => k + 1);
  }, [cooperativeId]);

  useEffect(() => {
    if (!cooperativeId) return;

    const cachedPlanteurs = getCached(planteurCache, cooperativeId);
    const cachedChefs = getCached(chefPlanteurCache, cooperativeId);

    // Both already cached — no fetch needed
    if (cachedPlanteurs && cachedChefs) {
      setPlanteurs(cachedPlanteurs);
      setChefPlanteurs(cachedChefs);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchAll = async () => {
      try {
        const [planteursRes, chefsRes] = await Promise.all([
          cachedPlanteurs
            ? Promise.resolve(cachedPlanteurs)
            : fetch(`/api/planteurs?cooperativeId=${encodeURIComponent(cooperativeId)}&limit=500`)
                .then((r) => (r.ok ? r.json() : []))
                .then((data) => (Array.isArray(data) ? data : data?.planteurs ?? [])),
          cachedChefs
            ? Promise.resolve(cachedChefs)
            : fetch(`/api/chef-planteurs?cooperativeId=${encodeURIComponent(cooperativeId)}&limit=500`)
                .then((r) => (r.ok ? r.json() : []))
                .then((data) => (Array.isArray(data) ? data : data?.chefPlanteurs ?? [])),
        ]);

        if (cancelled) return;

        const normalizedPlanteurs: CachedPlanteur[] = planteursRes.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          phone: p.phone ?? null,
          cooperative_id: p.cooperative_id,
        }));

        const normalizedChefs: CachedChefPlanteur[] = chefsRes.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          phone: c.phone ?? null,
          cooperative_id: c.cooperative_id,
        }));

        setCached(planteurCache, cooperativeId, normalizedPlanteurs);
        setCached(chefPlanteurCache, cooperativeId, normalizedChefs);

        setPlanteurs(normalizedPlanteurs);
        setChefPlanteurs(normalizedChefs);
      } catch (err) {
        console.warn('[useReceiptFormCache] Failed to pre-fetch lists:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [cooperativeId, refreshKey]);

  return { planteurs, chefPlanteurs, isLoading, refresh };
}
