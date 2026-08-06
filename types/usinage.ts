/** Types Usinage primaire (extension module factory / CDC) */

export type CocoaLotStatus =
  | 'draft'
  | 'received'
  | 'quarantine'
  | 'qc_in_progress'
  | 'accepted'
  | 'to_clean'
  | 'to_dry'
  | 'in_processing'
  | 'packaged'
  | 'stored'
  | 'reserved'
  | 'dispatched'
  | 'blocked'
  | 'downgraded'
  | 'rejected'
  | 'under_investigation'
  | 'released';

export type OnccGrade = 'grade_i' | 'grade_ii' | 'hors_standard' | 'rebut';

export type FactoryDepartment =
  | 'direction'
  | 'approvisionnement'
  | 'reception'
  | 'qualite'
  | 'tracabilite'
  | 'usinage'
  | 'magasin'
  | 'logistique'
  | 'maintenance'
  | 'qhse'
  | 'commercial'
  | 'finance'
  | 'informatique'
  | 'audit';

/** Départements MVP (Phase C) */
export const MVP_FACTORY_DEPARTMENTS: FactoryDepartment[] = [
  'direction',
  'reception',
  'qualite',
  'tracabilite',
  'usinage',
  'magasin',
  'logistique',
];

export type PackagingUnitType = 'bag' | 'big_bag' | 'pallet' | 'bulk';

export type DispatchStatus =
  | 'draft'
  | 'preparing'
  | 'ready'
  | 'loading'
  | 'shipped'
  | 'cancelled';

export const COCOA_LOT_STATUS_LABELS: Record<CocoaLotStatus, string> = {
  draft: 'Brouillon',
  received: 'Reçu',
  quarantine: 'En quarantaine',
  qc_in_progress: 'QC en cours',
  accepted: 'Accepté',
  to_clean: 'À nettoyer',
  to_dry: 'À sécher',
  in_processing: 'En usinage',
  packaged: 'Conditionné',
  stored: 'En stock',
  reserved: 'Réservé',
  dispatched: 'Expédié',
  blocked: 'Bloqué',
  downgraded: 'Déclassé',
  rejected: 'Rejeté',
  under_investigation: 'Sous enquête',
  released: 'Libéré qualité',
};

export const ONCC_GRADE_LABELS: Record<OnccGrade, string> = {
  grade_i: 'Grade I',
  grade_ii: 'Grade II',
  hors_standard: 'Hors standard',
  rebut: 'Rebut',
};

export const FACTORY_DEPARTMENT_LABELS: Record<FactoryDepartment, string> = {
  direction: 'Direction',
  approvisionnement: 'Approvisionnement',
  reception: 'Réception',
  qualite: 'Qualité',
  tracabilite: 'Traçabilité',
  usinage: 'Usinage',
  magasin: 'Magasin',
  logistique: 'Logistique',
  maintenance: 'Maintenance',
  qhse: 'QHSE',
  commercial: 'Commercial',
  finance: 'Finance',
  informatique: 'Informatique',
  audit: 'Audit',
};

/** Statuts qui bloquent mélange / usinage / expédition */
export const NON_OPERABLE_LOT_STATUSES: CocoaLotStatus[] = [
  'draft',
  'blocked',
  'rejected',
  'under_investigation',
];

export interface CocoaLot {
  id: string;
  factory_site_id: string;
  lot_number: string;
  status: CocoaLotStatus;
  oncc_grade: OnccGrade | null;
  campaign_year: number | null;
  net_weight_kg: number;
  gross_weight_kg: number | null;
  tare_kg: number | null;
  bag_count: number | null;
  moisture_pct: number | null;
  source_receipt_id: string | null;
  source_stock_item_id: string | null;
  source_output_id: string | null;
  warehouse_id: string | null;
  storage_location_id: string | null;
  blocked_reason: string | null;
  eudr_ready: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LotRelationship {
  id: string;
  parent_lot_id: string;
  child_lot_id: string;
  transformation_order_id: string | null;
  weight_kg: number;
  contribution_percent: number | null;
  created_at: string;
  parent_lot?: CocoaLot;
  child_lot?: CocoaLot;
}

export interface LotSource {
  id: string;
  lot_id: string;
  delivery_id: string | null;
  planteur_id: string | null;
  parcelle_id: string | null;
  weight_kg: number;
  contribution_percent: number | null;
  parcelle?: { id: string; code: string; label: string | null } | null;
  planteur?: { id: string; name: string; code: string } | null;
  delivery?: { id: string; code: string } | null;
}

export interface DeliveryParcelleShare {
  id: string;
  delivery_id: string;
  parcelle_id: string;
  weight_kg: number;
  share_percent: number | null;
  notes: string | null;
  parcelle?: { id: string; code: string; label: string | null };
}

export interface GradeRule {
  id: string;
  factory_site_id: string;
  name: string;
  campaign_year: number | null;
  version: number;
  is_active: boolean;
  moisture_target_max: number;
  moisture_alert_max: number;
  moisture_block_above: number;
  mold_max_pct: number;
  slate_max_pct: number;
  insect_max_pct: number;
  foreign_matter_max_pct: number;
  mass_balance_tolerance_pct: number;
  rules_json: Record<string, unknown>;
}

export interface StorageZone {
  id: string;
  factory_site_id: string;
  warehouse_id: string | null;
  code: string;
  name: string;
  zone_type: string;
  is_active: boolean;
}

export interface StorageLocation {
  id: string;
  factory_site_id: string;
  zone_id: string;
  code: string;
  aisle: string | null;
  row_label: string | null;
  bin: string | null;
  qr_code: string | null;
  capacity_kg: number | null;
  is_active: boolean;
  zone?: StorageZone;
}

export interface PackagingUnit {
  id: string;
  factory_site_id: string;
  lot_id: string;
  unit_type: PackagingUnitType;
  unit_number: string;
  qr_code: string | null;
  parent_unit_id: string | null;
  gross_weight_kg: number | null;
  tare_kg: number | null;
  net_weight_kg: number;
  oncc_grade: OnccGrade | null;
  campaign_year: number | null;
  storage_location_id: string | null;
  status: string;
  packaged_at: string;
}

export interface FactoryDispatch {
  id: string;
  factory_site_id: string;
  dispatch_number: string;
  client_id: string | null;
  status: DispatchStatus;
  destination: string | null;
  product_label: string | null;
  requested_grade: OnccGrade | null;
  requested_weight_kg: number | null;
  container_number: string | null;
  seal_number: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  port: string | null;
  departure_date: string | null;
  checklist: Record<string, unknown>;
  final_moisture_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface LotPassport {
  lot: CocoaLot;
  status_history: Array<{
    from_status: CocoaLotStatus | null;
    to_status: CocoaLotStatus;
    reason: string | null;
    changed_at: string;
    changed_by?: string;
  }>;
  sources: LotSource[];
  parents: LotRelationship[];
  children: LotRelationship[];
  packaging: PackagingUnit[];
  quality?: Record<string, unknown> | null;
  receipt?: Record<string, unknown> | null;
  dispatches?: Array<{ dispatch_number: string; status: string; weight_kg: number }>;
  eudr: {
    ready: boolean;
    parcelle_count: number;
    missing: string[];
  };
}

export interface GenealogyNode {
  lot_id: string;
  lot_number: string;
  status: CocoaLotStatus;
  weight_kg: number;
  depth: number;
  children?: GenealogyNode[];
  parents?: GenealogyNode[];
}
