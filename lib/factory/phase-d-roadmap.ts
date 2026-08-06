/**
 * Phase D — hors MVP (IoT, offline usine, EUDR API, Maintenance/QHSE)
 * Marqueurs / contrats futurs pour ne pas polluer le MVP.
 */

export type DeferredCapability =
  | 'iot_weighbridge'
  | 'thermal_print_auto'
  | 'offline_pwa_factory'
  | 'eudr_dds_api'
  | 'maintenance_module'
  | 'qhse_module'
  | 'finance_costing';

export interface DeferredRoadmapItem {
  id: DeferredCapability;
  title: string;
  rationale: string;
  dependsOn: string[];
}

export const PHASE_D_ROADMAP: DeferredRoadmapItem[] = [
  {
    id: 'iot_weighbridge',
    title: 'Pont-bascule / IoT pesée',
    rationale: 'Automatiser réception ; nécessite matériels + connecteurs stables',
    dependsOn: ['factory_receipts', 'cocoa_lots'],
  },
  {
    id: 'thermal_print_auto',
    title: 'Impression thermique auto (QR sacs)',
    rationale: 'Après packaging_units stable en production',
    dependsOn: ['packaging_units'],
  },
  {
    id: 'offline_pwa_factory',
    title: 'Offline PWA usine',
    rationale: 'Sites à connectivité faible ; après flux online fiables',
    dependsOn: ['cocoa_lots', 'quality_controls', 'stock_movements'],
  },
  {
    id: 'eudr_dds_api',
    title: 'API EUDR / DDS',
    rationale: 'Soumission réglementaire une fois lot_sources + parcelles complets',
    dependsOn: ['lot_sources', 'delivery_parcelle_shares', 'eudr_ready'],
  },
  {
    id: 'maintenance_module',
    title: 'Maintenance équipements',
    rationale: 'Hors cœur traçabilité / mass balance',
    dependsOn: ['production_lines'],
  },
  {
    id: 'qhse_module',
    title: 'QHSE usine',
    rationale: 'Incidents / audits qualité site — après QC paramétrable',
    dependsOn: ['grade_rules', 'quality_controls'],
  },
  {
    id: 'finance_costing',
    title: 'Coûts / valorisation lots',
    rationale: 'Après bilans massiques fiables',
    dependsOn: ['lot_relationships', 'transformation_orders'],
  },
];
