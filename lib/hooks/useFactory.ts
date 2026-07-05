'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { createClient } from '@/lib/supabase/client';

export const factoryKeys = {
  all: ['factory'] as const,
  dashboard: () => [...factoryKeys.all, 'dashboard'] as const,
  receipts: (params?: Record<string, string>) => [...factoryKeys.all, 'receipts', params] as const,
  receipt: (id: string) => [...factoryKeys.all, 'receipt', id] as const,
  pendingQc: () => [...factoryKeys.all, 'pendingQc'] as const,
  stocks: (params?: { raw?: boolean; finished?: boolean }) =>
    [...factoryKeys.all, 'stocks', params] as const,
  orders: (params?: Record<string, string>) => [...factoryKeys.all, 'orders', params] as const,
  order: (id: string) => [...factoryKeys.all, 'order', id] as const,
  traceability: (params: Record<string, string>) =>
    [...factoryKeys.all, 'traceability', params] as const,
  productTypes: () => [...factoryKeys.all, 'productTypes'] as const,
  productionLines: () => [...factoryKeys.all, 'productionLines'] as const,
  reports: (type: string) => [...factoryKeys.all, 'reports', type] as const,
};

export function useFactoryDashboard() {
  return useQuery({
    queryKey: factoryKeys.dashboard(),
    queryFn: () => factoryApi.dashboard(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useFactoryReceipts(params?: Record<string, string>) {
  return useQuery({
    queryKey: factoryKeys.receipts(params),
    queryFn: () => factoryApi.listReceipts(params),
    staleTime: 30_000,
  });
}

export function useFactoryReceipt(id: string) {
  return useQuery({
    queryKey: factoryKeys.receipt(id),
    queryFn: () => factoryApi.getReceipt(id),
    enabled: !!id,
  });
}

export function usePendingQuality() {
  return useQuery({
    queryKey: factoryKeys.pendingQc(),
    queryFn: () => factoryApi.listPendingQuality(),
    staleTime: 15_000,
  });
}

export function useFactoryStocks(params?: { raw?: boolean; finished?: boolean }) {
  return useQuery({
    queryKey: factoryKeys.stocks(params),
    queryFn: () => factoryApi.listStock(params),
    staleTime: 30_000,
  });
}

export function useFactoryOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: factoryKeys.orders(params),
    queryFn: () => factoryApi.listOrders(params),
    staleTime: 30_000,
  });
}

export function useFactoryOrder(id: string) {
  return useQuery({
    queryKey: factoryKeys.order(id),
    queryFn: () => factoryApi.getOrder(id),
    enabled: !!id,
  });
}

export function useFactoryTraceability(params: Record<string, string>) {
  return useQuery({
    queryKey: factoryKeys.traceability(params),
    queryFn: () => factoryApi.traceability(params),
    enabled: !!(params.lot || params.output),
  });
}

export function useFactoryProductTypes() {
  return useQuery({
    queryKey: factoryKeys.productTypes(),
    queryFn: () => factoryApi.listProductTypes(),
    staleTime: 60_000,
  });
}

export function useFactoryProductionLines() {
  return useQuery({
    queryKey: factoryKeys.productionLines(),
    queryFn: () => factoryApi.listProductionLines(),
    staleTime: 60_000,
  });
}

export function useInvalidateFactory() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: factoryKeys.all });
}

const FACTORY_REALTIME_TABLES = [
  'factory_receipts',
  'transformation_orders',
  'stock_movements',
  'quality_controls',
] as const;

/**
 * Invalide le cache usine à chaque changement Supabase (réceptions, ordres, stock, QC).
 */
export function useFactoryRealtime() {
  const queryClient = useQueryClient();
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const invalidate = () => {
      setLastSyncAt(new Date());
      queryClient.invalidateQueries({ queryKey: factoryKeys.all });
    };

    const channel = supabase.channel('factory-realtime');

    for (const table of FACTORY_REALTIME_TABLES) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, invalidate);
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, invalidate);
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, invalidate);
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { lastSyncAt };
}

export function useRefreshFactory() {
  const queryClient = useQueryClient();
  return {
    refresh: () => queryClient.invalidateQueries({ queryKey: factoryKeys.all }),
    refreshDashboard: () => queryClient.invalidateQueries({ queryKey: factoryKeys.dashboard() }),
  };
}
