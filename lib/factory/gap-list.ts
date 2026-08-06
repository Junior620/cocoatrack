/**
 * Gap list /factory existant vs CDC Usinage primaire
 * Phase 0 — cadrage technique (référence produit / QA)
 */

export type GapStatus = 'done' | 'partial' | 'todo' | 'later';

export interface FactoryGapItem {
  cdc: string;
  existing: string;
  status: GapStatus;
  notes?: string;
}

/** Cartographie écrans / tables vs CDC */
export const FACTORY_CDC_GAP_LIST: FactoryGapItem[] = [
  {
    cdc: 'Réception / pesée',
    existing: 'factory_receipts + UI /factory/receipts + cocoa_lots',
    status: 'partial',
    notes: 'Lot auto en quarantaine; tare/photos encore optionnels',
  },
  {
    cdc: 'Qualité paramétrable (grades ONCC)',
    existing: 'quality_controls + grade_rules + /factory/quality',
    status: 'partial',
    notes: 'Règles versionnées + cut-test étendu + audit décisions',
  },
  {
    cdc: 'Usinage primaire (nettoyage / séchage / tri)',
    existing: 'transformation_orders + bilan massique',
    status: 'done',
    notes: 'Types drying/sorting/blending/packaging + tolérance grade_rules',
  },
  {
    cdc: 'Stock + emplacements WMS',
    existing: 'stock_items + storage_zones/locations + /factory/wms',
    status: 'done',
  },
  {
    cdc: 'Sacs / palettes QR',
    existing: 'packaging_units + /factory/wms',
    status: 'done',
  },
  {
    cdc: 'Expédition',
    existing: 'factory_dispatches + /factory/dispatches',
    status: 'partial',
    notes: 'Checklist + garde-fous; PDF docs à enrichir',
  },
  {
    cdc: 'Généalogie lot parent→enfant',
    existing: 'lot_relationships + cocoa_lots + passeport',
    status: 'done',
  },
  {
    cdc: 'Lien parcelle → livraison → lot',
    existing: 'delivery_parcelle_shares + lot_sources',
    status: 'done',
  },
  {
    cdc: 'Statuts CDC (quarantaine, bloqué…)',
    existing: 'cocoa_lot_status + lot-guards',
    status: 'done',
  },
  {
    cdc: 'Passeport lot PDF',
    existing: '/factory/lots/passport (print)',
    status: 'done',
  },
  {
    cdc: 'Départements + séparation des devoirs',
    existing: 'factory_department + can_solo_validate_lot',
    status: 'done',
  },
  {
    cdc: 'IoT / pont-bascule / offline usine / EUDR API',
    existing: 'Phase D roadmap (settings)',
    status: 'later',
  },
];

export function summarizeGaps() {
  const counts = { done: 0, partial: 0, todo: 0, later: 0 };
  for (const item of FACTORY_CDC_GAP_LIST) counts[item.status] += 1;
  return counts;
}
