/**
 * Types pour la traçabilité agrégée planteur (Planteur 360).
 */

export type TraceabilityEventType =
  | 'planteur_created'
  | 'parcelle'
  | 'delivery'
  | 'receipt'
  | 'waybill'
  | 'ndvi'
  | 'deforestation'
  | 'audit';

export interface TraceabilityTimelineEvent {
  id: string;
  type: TraceabilityEventType;
  date: string;
  title: string;
  subtitle?: string;
  volumeKg?: number;
  amountXaf?: number;
  contractNumber?: string;
  status?: string;
  source?: string;
  actorName?: string;
  link?: string;
  meta?: Record<string, unknown>;
}

export interface TraceabilityChainNode {
  id: string;
  label: string;
  type: 'planteur' | 'parcelle' | 'delivery' | 'receipt';
  count?: number;
}

export interface TraceabilityChainEdge {
  from: string;
  to: string;
  label?: string;
}

export interface PlanteurTraceabilitySummary {
  planteur: {
    id: string;
    name: string;
    code: string;
    created_at: string;
    created_by_name: string | null;
    updated_at: string;
  };
  stats: {
    parcelles: number;
    deliveries: number;
    receipts: number;
    totalWeightKg: number;
    totalAmountXaf: number;
    ndviAnalyzed: number;
    deforestationAlerts: number;
  };
  timeline: TraceabilityTimelineEvent[];
  chain: {
    nodes: TraceabilityChainNode[];
    edges: TraceabilityChainEdge[];
  };
  ndviSummary: Array<{
    parcelleId: string;
    parcelleCode: string;
    meanNDVI: number;
    healthStatus: string;
    lastCalculationDate: string;
    trendDirection?: string;
  }>;
  deforestationSummary: Array<{
    parcelleId: string;
    parcelleCode: string;
    status: string;
    detectionDate: string;
    affectedPercent: number;
  }>;
}
