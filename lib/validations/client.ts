// CocoaTrack V2 - Client Validations
// Zod schemas for clients, contracts, and shipments

import { z } from 'zod';

// Client schema
export const clientSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  code: z.string().min(2, 'Le code doit contenir au moins 2 caractères').max(20, 'Le code ne peut pas dépasser 20 caractères'),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Email invalide').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// Contract schema
export const contractSchema = z.object({
  client_id: z.string().uuid('Client requis'),
  cooperative_id: z.string().uuid('Coopérative requise'),
  code: z.string().min(2, 'Le code doit contenir au moins 2 caractères'),
  season: z.string().min(4, 'Saison requise (ex: 2024-2025)'),
  quantity_contracted_kg: z.number().positive('La quantité doit être positive'),
  price_per_kg: z.number().positive('Le prix doit être positif').optional(),
  start_date: z.string().min(1, 'Date de début requise'),
  end_date: z.string().min(1, 'Date de fin requise'),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).default('active'),
  notes: z.string().optional(),
});

export type ContractFormData = z.infer<typeof contractSchema>;

// Shipment schema
export const shipmentSchema = z.object({
  contract_id: z.string().uuid('Contrat requis'),
  client_id: z.string().uuid('Client requis'),
  cooperative_id: z.string().uuid('Coopérative requise'),
  code: z.string().min(2, 'Le code doit contenir au moins 2 caractères'),
  shipped_at: z.string().optional(),
  quantity_kg: z.number().positive('La quantité doit être positive'),
  quality_grade: z.enum(['A', 'B', 'C', 'D']).default('B'),
  transport_mode: z.string().optional(),
  transport_reference: z.string().optional(),
  destination_port: z.string().optional(),
  estimated_arrival: z.string().optional(),
  status: z.enum(['pending', 'in_transit', 'delivered', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});

export type ShipmentFormData = z.infer<typeof shipmentSchema>;

// Status labels
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export const QUALITY_GRADE_LABELS: Record<string, string> = {
  A: 'Grade A - Premium',
  B: 'Grade B - Standard',
  C: 'Grade C - Acceptable',
  D: 'Grade D - Bas',
};

export const TRANSPORT_MODES = [
  { value: 'truck', label: 'Camion' },
  { value: 'ship', label: 'Navire' },
  { value: 'container', label: 'Conteneur' },
  { value: 'rail', label: 'Train' },
  { value: 'air', label: 'Avion' },
];
