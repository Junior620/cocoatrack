// Factory API client

import type {
  CreateFactoryReceiptInput,
  CreateQualityControlInput,
  CreateTransformationOrderInput,
  FactoryDashboardMetrics,
  FactoryReceipt,
  ProductionEntryInput,
  TraceabilityResult,
  TransformationOrder,
} from '@/types/factory';

async function factoryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erreur API factory: ${response.status}`);
  }
  return response.json();
}

export const factoryApi = {
  dashboard(): Promise<FactoryDashboardMetrics> {
    return factoryFetch('/api/factory/dashboard');
  },

  listReceipts(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return factoryFetch<{ data: FactoryReceipt[]; total: number }>(`/api/factory/receipts${qs}`);
  },

  getReceipt(id: string) {
    return factoryFetch<FactoryReceipt>(`/api/factory/receipts/${id}`);
  },

  createReceipt(input: CreateFactoryReceiptInput) {
    return factoryFetch<FactoryReceipt>('/api/factory/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  searchUpstream(q: string) {
    return factoryFetch<{ waybills: unknown[] }>(`/api/factory/upstream/search?q=${encodeURIComponent(q)}`);
  },

  listPendingQuality() {
    return factoryFetch<FactoryReceipt[]>('/api/factory/quality-controls?pending=1');
  },

  createQualityControl(input: CreateQualityControlInput) {
    return factoryFetch('/api/factory/quality-controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  listStock(params?: { raw?: boolean; finished?: boolean }) {
    const qs = new URLSearchParams();
    if (params?.raw) qs.set('raw', '1');
    if (params?.finished) qs.set('finished', '1');
    return factoryFetch(`/api/factory/stocks?${qs}`);
  },

  listOrders(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return factoryFetch<{ data: TransformationOrder[]; total: number }>(`/api/factory/transformation-orders${qs}`);
  },

  getOrder(id: string) {
    return factoryFetch<TransformationOrder>(`/api/factory/transformation-orders/${id}`);
  },

  createOrder(input: CreateTransformationOrderInput) {
    return factoryFetch<TransformationOrder>('/api/factory/transformation-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  updateOrderStatus(id: string, status: string) {
    return factoryFetch(`/api/factory/transformation-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },

  saveProduction(id: string, entry: ProductionEntryInput) {
    return factoryFetch(`/api/factory/transformation-orders/${id}/production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  },

  validateOrder(id: string) {
    return factoryFetch(`/api/factory/transformation-orders/${id}/validate`, { method: 'POST' });
  },

  traceability(params: { lot?: string; output?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>);
    return factoryFetch<TraceabilityResult>(`/api/factory/traceability?${qs}`);
  },

  listProductTypes() {
    return factoryFetch('/api/factory/product-types');
  },

  listProductionLines() {
    return factoryFetch('/api/factory/production-lines');
  },

  reports(type: 'production' | 'yields' | 'stocks') {
    return factoryFetch(`/api/factory/reports/${type}`);
  },

  exportReportCsv(type: string) {
    return `/api/factory/reports/${type}?format=csv`;
  },
};
