'use client';

import { useQuery } from '@tanstack/react-query';
import {
  cooperativesApi,
  type CooperativeDetail,
  type CooperativeOperationalSummary,
  type CooperativeStats,
  type CooperativeGlobalStats,
  type RegionOption,
} from '@/lib/api/cooperatives';

export const cooperativeKeys = {
  all: ['cooperatives'] as const,
  list: (cooperativeId?: string) => [...cooperativeKeys.all, 'list', cooperativeId] as const,
  detail: (id: string) => [...cooperativeKeys.all, 'detail', id] as const,
  globalStats: (cooperativeId?: string) =>
    [...cooperativeKeys.all, 'globalStats', cooperativeId] as const,
  operational: (id: string) => [...cooperativeKeys.all, 'operational', id] as const,
  regions: () => [...cooperativeKeys.all, 'regions'] as const,
};

export function useCooperativesList(cooperativeId?: string) {
  return useQuery<CooperativeStats[]>({
    queryKey: cooperativeKeys.list(cooperativeId),
    queryFn: () => cooperativesApi.listWithStats(cooperativeId),
    staleTime: 60 * 1000,
  });
}

export function useCooperativeGlobalStats(cooperativeId?: string) {
  return useQuery<CooperativeGlobalStats>({
    queryKey: cooperativeKeys.globalStats(cooperativeId),
    queryFn: () => cooperativesApi.getGlobalStats(cooperativeId),
    staleTime: 60 * 1000,
  });
}

export function useCooperativeDetail(id: string) {
  return useQuery<CooperativeDetail | null>({
    queryKey: cooperativeKeys.detail(id),
    queryFn: () => cooperativesApi.getDetail(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useCooperativeOperationalSummary(id: string) {
  return useQuery<CooperativeOperationalSummary>({
    queryKey: cooperativeKeys.operational(id),
    queryFn: () => cooperativesApi.getOperationalSummary(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

export function useRegions() {
  return useQuery<RegionOption[]>({
    queryKey: cooperativeKeys.regions(),
    queryFn: () => cooperativesApi.listRegions(),
    staleTime: 5 * 60 * 1000,
  });
}
