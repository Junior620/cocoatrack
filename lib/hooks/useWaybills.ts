'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { waybillsApi } from '@/lib/api/waybills';
import type { WaybillFilters, WaybillWithDeliveries } from '@/types/waybills';

export const waybillKeys = {
  all: ['waybills'] as const,
  list: (filters?: WaybillFilters) => [...waybillKeys.all, 'list', filters] as const,
  detail: (id: string) => [...waybillKeys.all, 'detail', id] as const,
  forDelivery: (deliveryId: string) => [...waybillKeys.all, 'forDelivery', deliveryId] as const,
  linkedIds: () => [...waybillKeys.all, 'linkedIds'] as const,
};

export function useWaybillsList(filters?: WaybillFilters) {
  return useQuery({
    queryKey: waybillKeys.list(filters),
    queryFn: () => waybillsApi.list(filters),
    staleTime: 60 * 1000,
  });
}

export function useWaybillDetail(id: string) {
  return useQuery<WaybillWithDeliveries | null>({
    queryKey: waybillKeys.detail(id),
    queryFn: () => waybillsApi.get(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useWaybillForDelivery(deliveryId: string) {
  return useQuery<WaybillWithDeliveries | null>({
    queryKey: waybillKeys.forDelivery(deliveryId),
    queryFn: () => waybillsApi.getForDelivery(deliveryId),
    enabled: !!deliveryId,
    staleTime: 30 * 1000,
  });
}

export function useLinkedDeliveryIds() {
  return useQuery({
    queryKey: waybillKeys.linkedIds(),
    queryFn: () => waybillsApi.getLinkedDeliveryIds(),
    staleTime: 30 * 1000,
  });
}

export function useInvalidateWaybills() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: waybillKeys.all });
}
