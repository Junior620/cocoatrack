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
    return factoryFetch<{ waybills: unknown[]; deliveries?: unknown[] }>(
      `/api/factory/upstream/search?q=${encodeURIComponent(q)}`
    );
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

  listLots(params?: { status?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    return factoryFetch<{ data: unknown[] }>(`/api/factory/lots?${qs}`);
  },

  getLotPassport(lot: string) {
    return factoryFetch(`/api/factory/lots/passport?lot=${encodeURIComponent(lot)}`);
  },

  getLotPassportById(id: string) {
    return factoryFetch(`/api/factory/lots/passport?id=${encodeURIComponent(id)}`);
  },

  listDispatches() {
    return factoryFetch<{ data: unknown[] }>('/api/factory/dispatches');
  },

  listWms(resource: 'zones' | 'locations' | 'packaging' = 'locations', lotId?: string) {
    const qs = new URLSearchParams({ resource });
    if (lotId) qs.set('lot_id', lotId);
    return factoryFetch(`/api/factory/wms?${qs}`);
  },

  setDeliveryParcelleShares(
    deliveryId: string,
    shares: Array<{ parcelle_id: string; weight_kg: number; notes?: string }>
  ) {
    return factoryFetch('/api/factory/delivery-parcelle-shares', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_id: deliveryId, shares }),
    });
  },

  // --- MES ---
  listRecipes() {
    return factoryFetch<{ data: unknown[] }>('/api/factory/recipes');
  },

  getRecipe(id: string) {
    return factoryFetch(`/api/factory/recipes?id=${encodeURIComponent(id)}`);
  },

  createRecipe(input: Record<string, unknown>) {
    return factoryFetch('/api/factory/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...input }),
    });
  },

  activateRecipeVersion(recipeId: string, versionId: string) {
    return factoryFetch('/api/factory/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', recipe_id: recipeId, version_id: versionId }),
    });
  },

  listProductionOrders(params?: Record<string, string>) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return factoryFetch<{ data: unknown[]; total: number }>(`/api/factory/production-orders${qs}`);
  },

  getProductionOrder(id: string) {
    return factoryFetch(`/api/factory/production-orders?id=${encodeURIComponent(id)}`);
  },

  createProductionOrder(input: Record<string, unknown>) {
    return factoryFetch('/api/factory/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...input }),
    });
  },

  proposeMaterials(orderId: string, quantityKg?: number) {
    return factoryFetch('/api/factory/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'propose_materials',
        order_id: orderId,
        quantity_kg: quantityKg,
      }),
    });
  },

  reserveMaterials(
    orderId: string,
    materials: Array<{ cocoa_lot_id: string; planned_qty_kg: number }>
  ) {
    return factoryFetch('/api/factory/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reserve_materials', order_id: orderId, materials }),
    });
  },

  startProductionOrder(orderId: string) {
    return factoryFetch('/api/factory/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', order_id: orderId }),
    });
  },

  closeProductionOrder(orderId: string, varianceJustification?: string) {
    return factoryFetch('/api/factory/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'close',
        order_id: orderId,
        variance_justification: varianceJustification,
      }),
    });
  },

  getOperationRun(id: string) {
    return factoryFetch(`/api/factory/operation-runs?id=${encodeURIComponent(id)}`);
  },

  startOperationRun(runId: string) {
    return factoryFetch('/api/factory/operation-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', run_id: runId }),
    });
  },

  completeOperationRun(runId: string, entry: Record<string, unknown>) {
    return factoryFetch('/api/factory/operation-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', run_id: runId, ...entry }),
    });
  },

  listTanks() {
    return factoryFetch<{ data: unknown[] }>('/api/factory/tanks');
  },

  createTank(input: Record<string, unknown>) {
    return factoryFetch('/api/factory/tanks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...input }),
    });
  },

  tankAction(action: string, body: Record<string, unknown>) {
    return factoryFetch('/api/factory/tanks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  },

  listProductReleases(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return factoryFetch<{ data: unknown[] }>(`/api/factory/product-releases${qs}`);
  },

  decideProductRelease(releaseId: string, status: string, decisionNotes?: string) {
    return factoryFetch('/api/factory/product-releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'decide',
        release_id: releaseId,
        status,
        decision_notes: decisionNotes,
      }),
    });
  },
};
