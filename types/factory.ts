import type { QualityGrade } from '@/types';

export type FactoryReceiptStatus =
  | 'pending_qc'
  | 'accepted'
  | 'accepted_with_reserve'
  | 'rejected'
  | 'stored';

export type QualityDecision =
  | 'conforme'
  | 'non_conforme'
  | 'a_retraiter'
  | 'rejete'
  | 'accepted_with_reserve';

export type StockItemStatus = 'available' | 'blocked' | 'quarantine' | 'depleted';

export type StockMovementType =
  | 'entry'
  | 'exit'
  | 'transfer'
  | 'adjustment'
  | 'transformation'
  | 'loss'
  | 'block'
  | 'unblock';

export type TransformationOrderStatus =
  | 'draft'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'validated'
  | 'cancelled';

export type TransformationType =
  | 'cleaning'
  | 'drying'
  | 'sorting'
  | 'blending'
  | 'packaging'
  | 'roasting'
  | 'shelling'
  | 'grinding'
  | 'pressing'
  | 'cocoa_butter'
  | 'cocoa_powder'
  | 'cocoa_mass'
  | 'chocolate'
  | 'other';

export type LossType =
  | 'waste'
  | 'evaporation'
  | 'rejected_beans'
  | 'breakage'
  | 'unexplained'
  | 'other';

export type YieldIndicator = 'green' | 'orange' | 'red';

export interface FactorySite {
  id: string;
  name: string;
  code: string;
  location: string | null;
  cooperative_id: string | null;
  is_active: boolean;
}

export interface ProductType {
  id: string;
  factory_site_id: string;
  name: string;
  category: string;
  unit: string;
  is_raw_material: boolean;
  is_finished_product: boolean;
}

export interface ProductionLine {
  id: string;
  factory_site_id: string;
  name: string;
  description: string | null;
  capacity_kg_per_day: number | null;
  status: string;
}

export interface FactoryReceipt {
  id: string;
  factory_site_id: string;
  receipt_number: string;
  cooperative_id: string | null;
  waybill_id: string | null;
  delivery_id: string | null;
  upstream_lot_number: string | null;
  supplier_name: string | null;
  transport_document_number: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  received_date: string;
  declared_weight_kg: number | null;
  received_weight_kg: number;
  gross_weight_kg?: number | null;
  tare_kg?: number | null;
  bag_count: number | null;
  warehouse_id: string | null;
  cocoa_lot_id?: string | null;
  status: FactoryReceiptStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  cooperative?: { id: string; name: string; code: string } | null;
  waybill?: { id: string; code: string; lot_number: string | null } | null;
  quality_control?: QualityControl | null;
}

export interface QualityControl {
  id: string;
  factory_site_id: string;
  receipt_id: string;
  control_date: string;
  moisture_rate: number | null;
  impurity_rate: number | null;
  mold_rate: number | null;
  flat_beans_rate: number | null;
  broken_beans_rate: number | null;
  defective_beans_rate: number | null;
  grade: QualityGrade | null;
  oncc_grade?: string | null;
  decision: QualityDecision | null;
  observations: string | null;
  controlled_by: string;
  receipt?: FactoryReceipt;
}

export interface StockItem {
  id: string;
  factory_site_id: string;
  product_type_id: string;
  lot_reference: string;
  quantity_kg: number;
  warehouse_id: string | null;
  source_receipt_id: string | null;
  source_lot_reference: string | null;
  transformation_order_id: string | null;
  status: StockItemStatus;
  product_type?: ProductType;
  warehouse?: { id: string; name: string; code: string } | null;
}

export interface TransformationOrder {
  id: string;
  factory_site_id: string;
  order_number: string;
  transformation_type: TransformationType;
  production_line_id: string | null;
  planned_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  input_quantity_kg: number | null;
  theoretical_yield_rate: number | null;
  actual_yield_rate: number | null;
  loss_rate: number | null;
  status: TransformationOrderStatus;
  operator_id: string | null;
  validated_by: string | null;
  validated_at: string | null;
  notes: string | null;
  production_line?: ProductionLine | null;
  inputs?: TransformationInput[];
  outputs?: TransformationOutput[];
  losses?: TransformationLoss[];
  yield_indicator?: YieldIndicator;
}

export interface TransformationInput {
  id: string;
  transformation_order_id: string;
  stock_item_id: string;
  source_lot_reference: string | null;
  quantity_used_kg: number;
  stock_item?: StockItem;
}

export interface TransformationOutput {
  id: string;
  transformation_order_id: string;
  product_type_id: string;
  product_name: string;
  output_lot_number: string;
  quantity_produced_kg: number;
  warehouse_id: string | null;
  stock_item_id: string | null;
  product_type?: ProductType;
}

export interface TransformationLoss {
  id: string;
  transformation_order_id: string;
  loss_type: LossType;
  quantity_kg: number;
  reason: string | null;
}

export interface CreateQualityControlInput {
  receipt_id: string;
  control_date?: string;
  moisture_rate?: number | null;
  impurity_rate?: number | null;
  mold_rate?: number | null;
  flat_beans_rate?: number | null;
  broken_beans_rate?: number | null;
  defective_beans_rate?: number | null;
  slate_rate?: number | null;
  insect_rate?: number | null;
  foreign_matter_rate?: number | null;
  smoke_odor?: boolean | null;
  mold_odor?: boolean | null;
  chemical_odor?: boolean | null;
  sample_id?: string | null;
  seal_number?: string | null;
  oncc_grade?: string | null;
  grade?: QualityGrade | null;
  decision: QualityDecision;
  observations?: string | null;
}

export interface CreateFactoryReceiptInput {
  factory_site_id?: string;
  cooperative_id?: string | null;
  waybill_id?: string | null;
  delivery_id?: string | null;
  upstream_lot_number?: string | null;
  supplier_name?: string | null;
  transport_document_number?: string | null;
  vehicle_number?: string | null;
  driver_name?: string | null;
  received_date: string;
  declared_weight_kg?: number | null;
  received_weight_kg: number;
  bag_count?: number | null;
  warehouse_id?: string | null;
  notes?: string | null;
  campaign_year?: number | null;
  tare_kg?: number | null;
  gross_weight_kg?: number | null;
  photo_urls?: string[];
}

export interface CreateTransformationOrderInput {
  factory_site_id?: string;
  transformation_type: TransformationType;
  production_line_id?: string | null;
  planned_date?: string | null;
  input_quantity_kg?: number | null;
  theoretical_yield_rate?: number | null;
  operator_id?: string | null;
  notes?: string | null;
  stock_item_ids?: string[];
}

export interface ProductionEntryInput {
  inputs: Array<{ stock_item_id: string; quantity_used_kg: number }>;
  outputs: Array<{
    product_type_id: string;
    product_name: string;
    output_lot_number: string;
    quantity_produced_kg: number;
    warehouse_id?: string | null;
  }>;
  losses: Array<{ loss_type: LossType; quantity_kg: number; reason?: string | null }>;
}

export interface FactoryDashboardMetrics {
  beans_received_kg: number;
  beans_stock_kg: number;
  beans_transformed_kg: number;
  finished_stock_kg: number;
  avg_yield_pct: number;
  avg_loss_pct: number;
  pending_qc_count: number;
  orders_in_progress: number;
  yield_alerts: number;
  low_stock_alerts: number;
}

export interface TraceabilityResult {
  direction: 'upstream' | 'downstream';
  receipt?: FactoryReceipt | null;
  quality_control?: QualityControl | null;
  stock_items?: StockItem[];
  orders?: TransformationOrder[];
  outputs?: TransformationOutput[];
  cooperatives?: Array<{ id: string; name: string }>;
  /** Parcelles amont (via delivery_parcelle_shares / lot_sources) */
  parcelles?: Array<{
    id: string;
    code: string;
    label: string | null;
    weight_kg?: number;
    planteur_id?: string | null;
  }>;
  /** Généalogie lots cacao */
  cocoa_lot?: {
    id: string;
    lot_number: string;
    status: string;
    oncc_grade: string | null;
    eudr_ready: boolean;
  } | null;
  parents?: Array<{ lot_number: string; weight_kg: number }>;
  children?: Array<{ lot_number: string; weight_kg: number }>;
  packaging?: Array<{ unit_number: string; net_weight_kg: number; qr_code: string | null }>;
  dispatches?: Array<{ dispatch_number: string; status: string }>;
}

export const TRANSFORMATION_TYPE_LABELS: Record<TransformationType, string> = {
  cleaning: 'Nettoyage',
  drying: 'Séchage',
  sorting: 'Tri / calibrage',
  blending: 'Mélange',
  packaging: 'Conditionnement',
  roasting: 'Torréfaction',
  shelling: 'Décorticage',
  grinding: 'Broyage',
  pressing: 'Pressage',
  cocoa_butter: 'Beurre de cacao',
  cocoa_powder: 'Poudre de cacao',
  cocoa_mass: 'Masse de cacao',
  chocolate: 'Chocolat',
  other: 'Autre',
};

/** Types d'OT prioritaires usinage primaire (MVP) */
export const PRIMARY_PROCESSING_TYPES: TransformationType[] = [
  'cleaning',
  'drying',
  'sorting',
  'blending',
  'packaging',
];

export const RECEIPT_STATUS_LABELS: Record<FactoryReceiptStatus, string> = {
  pending_qc: 'En attente QC',
  accepted: 'Accepté',
  accepted_with_reserve: 'Accepté sous réserve',
  rejected: 'Rejeté',
  stored: 'Stocké',
};

export const ORDER_STATUS_LABELS: Record<TransformationOrderStatus, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
  cancelled: 'Annulé',
};

export const DEMO_FACTORY_SITE_ID = 'a0000000-0000-4000-8000-000000000001';
