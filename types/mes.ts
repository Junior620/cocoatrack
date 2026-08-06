/** Types MES — Transformation industrielle (MVP) */

export type FactorySiteMode = 'primary' | 'industrial' | 'both';

export type ProductionOrderStatus =
  | 'draft'
  | 'planned'
  | 'validated'
  | 'materials_reserved'
  | 'ready'
  | 'in_progress'
  | 'suspended'
  | 'completed'
  | 'awaiting_quality'
  | 'released'
  | 'closed'
  | 'cancelled';

export type OperationRunStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'awaiting_quality'
  | 'validated'
  | 'cancelled';

export type RecipeStepType =
  | 'cleaning'
  | 'pretreatment'
  | 'shelling'
  | 'winnowing'
  | 'roasting'
  | 'cooling'
  | 'grinding'
  | 'alkalizing'
  | 'pressing'
  | 'filtration'
  | 'cake_milling'
  | 'sieving'
  | 'packaging'
  | 'transfer'
  | 'other';

export type TankStatus = 'empty' | 'in_use' | 'quarantine' | 'blocked' | 'cleaning' | 'maintenance';

export type TankMovementType =
  | 'fill'
  | 'empty'
  | 'transfer'
  | 'blend'
  | 'return'
  | 'purge'
  | 'clean'
  | 'sample'
  | 'adjust';

export type ProductReleaseStatus =
  | 'pending'
  | 'released'
  | 'released_with_reserve'
  | 'blocked'
  | 'rejected';

export type RecipeVersionStatus = 'draft' | 'active' | 'archived';

export type MaterialReservationStatus =
  | 'proposed'
  | 'reserved'
  | 'consumed'
  | 'released'
  | 'cancelled';

export type OutputKind = 'main' | 'coproduct' | 'byproduct' | 'rework' | 'sample' | 'waste';

export const PRODUCTION_ORDER_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  validated: 'Validé',
  materials_reserved: 'Matières réservées',
  ready: 'Prêt',
  in_progress: 'En cours',
  suspended: 'Suspendu',
  completed: 'Terminé',
  awaiting_quality: 'Attente qualité',
  released: 'Libéré',
  closed: 'Clôturé',
  cancelled: 'Annulé',
};

export const RECIPE_STEP_TYPE_LABELS: Record<RecipeStepType, string> = {
  cleaning: 'Nettoyage',
  pretreatment: 'Prétraitement',
  shelling: 'Décorticage',
  winnowing: 'Vannage',
  roasting: 'Torréfaction',
  cooling: 'Refroidissement',
  grinding: 'Broyage / masse',
  alkalizing: 'Alcalinisation',
  pressing: 'Pressage',
  filtration: 'Filtration',
  cake_milling: 'Broyage tourteau',
  sieving: 'Tamisage',
  packaging: 'Conditionnement',
  transfer: 'Transfert',
  other: 'Autre',
};

export const TANK_STATUS_LABELS: Record<TankStatus, string> = {
  empty: 'Vide',
  in_use: 'En service',
  quarantine: 'Quarantaine',
  blocked: 'Bloquée',
  cleaning: 'Nettoyage',
  maintenance: 'Maintenance',
};

export const PRODUCT_RELEASE_STATUS_LABELS: Record<ProductReleaseStatus, string> = {
  pending: 'En attente',
  released: 'Libéré',
  released_with_reserve: 'Libéré avec réserve',
  blocked: 'Bloqué',
  rejected: 'Rejeté',
};

/** Chaîne pilote fèves → masse (§32.1) */
export const PILOT_RECIPE_STEPS: Array<{
  step_order: number;
  step_type: RecipeStepType;
  name: string;
  expected_yield_pct: number;
  parameters_json: Record<string, number>;
  tolerances_json: Record<string, number>;
}> = [
  {
    step_order: 1,
    step_type: 'cleaning',
    name: 'Nettoyage / tri',
    expected_yield_pct: 98,
    parameters_json: {},
    tolerances_json: {},
  },
  {
    step_order: 2,
    step_type: 'winnowing',
    name: 'Vannage / décorticage',
    expected_yield_pct: 82,
    parameters_json: {},
    tolerances_json: {},
  },
  {
    step_order: 3,
    step_type: 'roasting',
    name: 'Torréfaction',
    expected_yield_pct: 95,
    parameters_json: { temperature_c: 140, duration_min: 25 },
    tolerances_json: { temperature_c: 10, duration_min: 5 },
  },
  {
    step_order: 4,
    step_type: 'grinding',
    name: 'Broyage → masse',
    expected_yield_pct: 98,
    parameters_json: { fineness_um: 20 },
    tolerances_json: { fineness_um: 5 },
  },
];

export interface ProductionRecipe {
  id: string;
  factory_site_id: string;
  code: string;
  name: string;
  product_type_id: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  versions?: RecipeVersion[];
}

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version: number;
  status: RecipeVersionStatus;
  expected_yield_pct: number | null;
  mass_balance_tolerance_pct: number;
  notes: string | null;
  activated_at: string | null;
  created_by: string | null;
  created_at: string;
  steps?: RecipeStep[];
}

export interface RecipeStep {
  id: string;
  recipe_version_id: string;
  step_order: number;
  step_type: RecipeStepType;
  name: string;
  description: string | null;
  parameters_json: Record<string, unknown>;
  tolerances_json: Record<string, unknown>;
  expected_yield_pct: number | null;
  requires_quality_check: boolean;
  equipment_hint: string | null;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  factory_site_id: string;
  order_number: string;
  status: ProductionOrderStatus;
  product_type_id: string | null;
  product_label: string | null;
  planned_quantity_kg: number;
  actual_quantity_kg: number | null;
  recipe_id: string | null;
  recipe_version_id: string;
  production_line_id: string | null;
  client_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  priority: number;
  quality_requirements: string | null;
  variance_justification: string | null;
  notes: string | null;
  created_by: string;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
  recipe?: ProductionRecipe | null;
  recipe_version?: RecipeVersion | null;
  materials?: ProductionOrderMaterial[];
  operation_runs?: OperationRun[];
}

export interface ProductionOrderMaterial {
  id: string;
  production_order_id: string;
  cocoa_lot_id: string | null;
  stock_item_id: string | null;
  planned_qty_kg: number;
  reserved_qty_kg: number | null;
  consumed_qty_kg: number | null;
  status: MaterialReservationStatus;
  created_at: string;
  cocoa_lot?: { id: string; lot_number: string; status: string; net_weight_kg: number; eudr_ready: boolean } | null;
}

export interface OperationRun {
  id: string;
  factory_site_id: string;
  production_order_id: string;
  recipe_step_id: string | null;
  step_order: number;
  step_type: RecipeStepType;
  name: string;
  status: OperationRunStatus;
  equipment_hint: string | null;
  tank_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  operator_id: string | null;
  input_qty_kg: number | null;
  output_qty_kg: number | null;
  loss_qty_kg: number | null;
  mass_balance_ok: boolean | null;
  variance_justification: string | null;
  parameters_json: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  inputs?: OperationInput[];
  outputs?: OperationOutput[];
  parameters?: OperationParameter[];
  losses?: OperationLoss[];
}

export interface OperationInput {
  id: string;
  operation_run_id: string;
  cocoa_lot_id: string | null;
  stock_item_id: string | null;
  quantity_kg: number;
  created_at: string;
}

export interface OperationOutput {
  id: string;
  operation_run_id: string;
  product_label: string;
  output_kind: OutputKind;
  quantity_kg: number;
  cocoa_lot_id: string | null;
  product_type_id: string | null;
  tank_id: string | null;
  created_at: string;
}

export interface OperationParameter {
  id: string;
  operation_run_id: string;
  param_key: string;
  target_value: number | null;
  actual_value: number | null;
  unit: string | null;
  within_tolerance: boolean | null;
  notes: string | null;
  recorded_at: string;
}

export interface OperationLoss {
  id: string;
  operation_run_id: string;
  loss_kind: string;
  quantity_kg: number;
  reason: string | null;
  created_at: string;
}

export interface Tank {
  id: string;
  factory_site_id: string;
  code: string;
  name: string;
  capacity_kg: number;
  current_qty_kg: number;
  allowed_product_label: string | null;
  status: TankStatus;
  temperature_c: number | null;
  last_cleaned_at: string | null;
  quality_status: 'ok' | 'quarantine' | 'blocked';
  notes: string | null;
  created_at: string;
  updated_at: string;
  contents?: TankContent[];
}

export interface TankContent {
  id: string;
  tank_id: string;
  cocoa_lot_id: string;
  quantity_kg: number;
  contribution_percent: number | null;
  created_at: string;
  cocoa_lot?: { id: string; lot_number: string; status: string } | null;
}

export interface TankMovement {
  id: string;
  factory_site_id: string;
  tank_id: string;
  movement_type: TankMovementType;
  quantity_kg: number;
  cocoa_lot_id: string | null;
  from_tank_id: string | null;
  to_tank_id: string | null;
  operation_run_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProductRelease {
  id: string;
  factory_site_id: string;
  cocoa_lot_id: string;
  production_order_id: string | null;
  status: ProductReleaseStatus;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  cocoa_lot?: { id: string; lot_number: string; status: string; net_weight_kg: number } | null;
}

export interface CreateRecipeInput {
  code: string;
  name: string;
  description?: string | null;
  product_type_id?: string | null;
  seed_pilot?: boolean;
  expected_yield_pct?: number | null;
  mass_balance_tolerance_pct?: number;
  steps?: Array<{
    step_order: number;
    step_type: RecipeStepType;
    name: string;
    description?: string | null;
    parameters_json?: Record<string, unknown>;
    tolerances_json?: Record<string, unknown>;
    expected_yield_pct?: number | null;
    requires_quality_check?: boolean;
    equipment_hint?: string | null;
  }>;
}

export interface CreateProductionOrderInput {
  recipe_version_id: string;
  planned_quantity_kg: number;
  product_label?: string | null;
  product_type_id?: string | null;
  production_line_id?: string | null;
  client_id?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  priority?: number;
  quality_requirements?: string | null;
  notes?: string | null;
  materials?: Array<{
    cocoa_lot_id?: string | null;
    stock_item_id?: string | null;
    planned_qty_kg: number;
  }>;
}

export interface CompleteOperationInput {
  inputs: Array<{ cocoa_lot_id?: string | null; stock_item_id?: string | null; quantity_kg: number }>;
  outputs: Array<{
    product_label: string;
    output_kind?: OutputKind;
    quantity_kg: number;
    tank_id?: string | null;
  }>;
  losses?: Array<{ loss_kind?: string; quantity_kg: number; reason?: string | null }>;
  parameters?: Array<{
    param_key: string;
    target_value?: number | null;
    actual_value?: number | null;
    unit?: string | null;
  }>;
  variance_justification?: string | null;
  notes?: string | null;
  tank_id?: string | null;
}
