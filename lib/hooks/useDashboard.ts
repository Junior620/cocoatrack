'use client';

// CocoaTrack V2 - Dashboard Hooks
// TanStack Query hooks for dashboard data
// Requirements: 6.8, 6.9

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { dashboardApi, type DashboardFilters, type DashboardData } from '@/lib/api/dashboard';
import { createClient } from '@/lib/supabase/client';

// Query keys for cache management
export const dashboardKeys = {
  all: ['dashboard'] as const,
  metrics: (filters: DashboardFilters) => [...dashboardKeys.all, 'metrics', filters] as const,
  metricsWithComparison: (period: string, filters: DashboardFilters) =>
    [...dashboardKeys.all, 'metricsWithComparison', period, filters] as const,
  dailyTrend: (filters: DashboardFilters) => [...dashboardKeys.all, 'dailyTrend', filters] as const,
  topPlanteurs: (filters: DashboardFilters) => [...dashboardKeys.all, 'topPlanteurs', filters] as const,
  topChefPlanteurs: (filters: DashboardFilters) =>
    [...dashboardKeys.all, 'topChefPlanteurs', filters] as const,
  fullData: (period: string, filters: DashboardFilters) =>
    [...dashboardKeys.all, 'fullData', period, filters] as const,
  entityCounts: (cooperativeId?: string) =>
    [...dashboardKeys.all, 'entityCounts', cooperativeId] as const,
};

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

/**
 * Hook to fetch dashboard metrics
 */
export function useDashboardMetrics(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.metrics(filters),
    queryFn: () => dashboardApi.getMetrics(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch dashboard metrics with period comparison
 */
export function useDashboardMetricsWithComparison(
  period: Period = 'month',
  filters: DashboardFilters = {}
) {
  return useQuery({
    queryKey: dashboardKeys.metricsWithComparison(period, filters),
    queryFn: () => dashboardApi.getMetricsWithComparison(period, filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch daily trend data
 */
export function useDailyTrend(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.dailyTrend(filters),
    queryFn: () => dashboardApi.getDailyTrend(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes (heavy query)
  });
}

/**
 * Hook to fetch top planteurs
 */
export function useTopPlanteurs(filters: DashboardFilters = {}, limit: number = 10) {
  return useQuery({
    queryKey: dashboardKeys.topPlanteurs(filters),
    queryFn: () => dashboardApi.getTopPlanteurs(filters, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes (heavy query)
  });
}

/**
 * Hook to fetch top chef planteurs
 */
export function useTopChefPlanteurs(filters: DashboardFilters = {}, limit: number = 10) {
  return useQuery({
    queryKey: dashboardKeys.topChefPlanteurs(filters),
    queryFn: () => dashboardApi.getTopChefPlanteurs(filters, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes (heavy query)
  });
}

/**
 * Hook to fetch complete dashboard data
 */
export function useDashboardData(period: Period = 'month', filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: dashboardKeys.fullData(period, filters),
    queryFn: () => dashboardApi.getDashboardData(period, filters),
    staleTime: 30 * 1000, // 30 seconds for metrics
  });
}

/**
 * Hook to subscribe to realtime delivery updates
 * Invalidates dashboard queries when new deliveries are created/updated
 */
export function useDashboardRealtime(cooperativeId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    // Build filter based on cooperative
    const filter = cooperativeId ? `cooperative_id=eq.${cooperativeId}` : undefined;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliveries',
          filter,
        },
        () => {
          // Invalidate metrics queries (lightweight, update immediately)
          queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter,
        },
        () => {
          // Invalidate all dashboard queries
          queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'deliveries',
          filter,
        },
        () => {
          // Invalidate all dashboard queries
          queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cooperativeId, queryClient]);
}

/**
 * Hook to manually refresh dashboard data
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return {
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    refreshMetrics: () => {
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'metrics'] });
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'metricsWithComparison'] });
    },
    refreshCharts: () => {
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'dailyTrend'] });
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'topPlanteurs'] });
      queryClient.invalidateQueries({ queryKey: [...dashboardKeys.all, 'topChefPlanteurs'] });
    },
  };
}


/**
 * Hook to fetch delivery locations for heatmap
 */
export function useDeliveryLocations(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: [...dashboardKeys.all, 'locations', filters] as const,
    queryFn: () => dashboardApi.getDeliveryLocations(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch entity counts (planteurs, chef planteurs, today's deliveries)
 */
export function useEntityCounts(cooperativeId?: string) {
  return useQuery({
    queryKey: dashboardKeys.entityCounts(cooperativeId),
    queryFn: () => dashboardApi.getEntityCounts(cooperativeId),
    staleTime: 60 * 1000, // 1 minute
  });
}
