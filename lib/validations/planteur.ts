// CocoaTrack V2 - Planteur Validation Schemas
import { z } from 'zod';
import {
  uuidSchema,
  phoneSchema,
  cniSchema,
  latitudeSchema,
  longitudeSchema,
  nameSchema,
  codeSchema,
  paginationSchema,
  validationStatusSchema,
} from './common';

// Statut plantation enum values
export const STATUT_PLANTATION_OPTIONS = [
  'Propriétaire',
  'Locataire',
  'Métayer',
  'Gérant',
  'Autre',
] as const;

export type StatutPlantation = typeof STATUT_PLANTATION_OPTIONS[number];

// Base Planteur schema (matches database row)
export const planteurSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  code: codeSchema,
  phone: phoneSchema,
  cni: cniSchema,
  chef_planteur_id: uuidSchema,
  cooperative_id: uuidSchema,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  // V1 fields
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  statut_plantation: z.string().nullable().optional(),
  superficie_hectares: z.number().min(0.01).nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: uuidSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Schema for creating a new planteur
export const createPlanteurSchema = z.object({
  name: nameSchema,
  code: codeSchema.optional(), // Auto-generated if not provided
  phone: phoneSchema,
  cni: cniSchema,
  chef_planteur_id: uuidSchema.optional().or(z.literal('')), // Optional in V1
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  // V1 fields
  cooperative: z.string().max(200).nullable().optional(), // Manual cooperative name entry
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  statut_plantation: z.string().nullable().optional(),
  superficie_hectares: z.number().min(0.01).nullable().optional(),
});

// Schema for updating a planteur
export const updatePlanteurSchema = z.object({
  name: nameSchema.optional(),
  code: codeSchema.optional(),
  phone: phoneSchema,
  cni: cniSchema,
  chef_planteur_id: uuidSchema.optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  is_active: z.boolean().optional(),
  // V1 fields
  cooperative: z.string().max(200).nullable().optional(), // Manual cooperative name entry
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  statut_plantation: z.string().nullable().optional(),
  superficie_hectares: z.number().min(0.01).nullable().optional(),
});

// Schema for planteur list filters
export const planteurFiltersSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  chef_planteur_id: uuidSchema.optional(),
  cooperative_id: uuidSchema.optional(),
  is_active: z.boolean().optional(),
  search: z.string().max(100).optional(),
});

// Schema for planteur search
export const planteurSearchSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(10),
});

// Planteur with related data (for detail views)
export const planteurWithRelationsSchema = planteurSchema.extend({
  chef_planteur: z.object({
    id: uuidSchema,
    name: nameSchema,
    code: codeSchema,
    cooperative_id: uuidSchema,
  }).optional(),
  cooperative: z.object({
    id: uuidSchema,
    name: z.string(),
    code: z.string(),
  }).optional(),
  created_by_profile: z.object({
    id: uuidSchema,
    full_name: z.string(),
  }).optional(),
  // Computed stats from view
  limite_production_kg: z.number().nullable().optional(),
  total_charge_kg: z.number().nullable().optional(),
  total_decharge_kg: z.number().nullable().optional(),
  pertes_kg: z.number().nullable().optional(),
  pourcentage_pertes: z.number().nullable().optional(),
  restant_kg: z.number().nullable().optional(),
  pourcentage_utilise: z.number().nullable().optional(),
});

// Planteur statistics (extended with V1 fields)
export const planteurStatsSchema = z.object({
  total_deliveries: z.number().int().min(0),
  total_weight_kg: z.number().min(0),
  total_amount_xaf: z.number().int().min(0),
  average_price_per_kg: z.number().min(0),
  last_delivery_date: z.string().datetime().nullable(),
  // V1 stats
  total_loaded_kg: z.number().min(0).optional(),
  total_losses_kg: z.number().min(0).optional(),
  loss_percentage: z.number().min(0).optional(),
  production_limit_kg: z.number().nullable().optional(),
  remaining_kg: z.number().nullable().optional(),
  usage_percentage: z.number().nullable().optional(),
});

// Alert levels for visual indicators
export type AlertLevel = 'success' | 'warning' | 'danger' | 'info';

export interface PlanteurAlert {
  type: 'usage' | 'losses' | 'remaining';
  level: AlertLevel;
  message: string;
  value: number;
}

// Helper function to calculate alerts
export function getPlanteurAlerts(stats: PlanteurStats): PlanteurAlert[] {
  const alerts: PlanteurAlert[] = [];
  
  // Usage alerts
  if (stats.usage_percentage !== undefined && stats.usage_percentage !== null) {
    if (stats.usage_percentage >= 90) {
      alerts.push({
        type: 'usage',
        level: 'danger',
        message: 'Limite de production presque atteinte',
        value: stats.usage_percentage,
      });
    } else if (stats.usage_percentage >= 70) {
      alerts.push({
        type: 'usage',
        level: 'warning',
        message: 'Attention: 70% de la limite atteinte',
        value: stats.usage_percentage,
      });
    }
  }
  
  // Loss alerts
  if (stats.loss_percentage !== undefined && stats.loss_percentage !== null) {
    if (stats.loss_percentage > 10) {
      alerts.push({
        type: 'losses',
        level: 'danger',
        message: 'Pertes élevées (>10%)',
        value: stats.loss_percentage,
      });
    } else if (stats.loss_percentage > 5) {
      alerts.push({
        type: 'losses',
        level: 'warning',
        message: 'Pertes modérées (>5%)',
        value: stats.loss_percentage,
      });
    }
  }
  
  // Remaining stock alerts
  if (stats.remaining_kg !== undefined && stats.remaining_kg !== null) {
    if (stats.remaining_kg < 200) {
      alerts.push({
        type: 'remaining',
        level: 'danger',
        message: 'Stock critique (<200 kg)',
        value: stats.remaining_kg,
      });
    } else if (stats.remaining_kg < 500) {
      alerts.push({
        type: 'remaining',
        level: 'warning',
        message: 'Stock faible (<500 kg)',
        value: stats.remaining_kg,
      });
    }
  }
  
  return alerts;
}

// TypeScript types inferred from schemas
export type Planteur = z.infer<typeof planteurSchema>;
export type CreatePlanteurInput = z.infer<typeof createPlanteurSchema>;
export type UpdatePlanteurInput = z.infer<typeof updatePlanteurSchema>;
export type PlanteurFilters = z.infer<typeof planteurFiltersSchema>;
export type PlanteurSearch = z.infer<typeof planteurSearchSchema>;
export type PlanteurWithRelations = z.infer<typeof planteurWithRelationsSchema>;
export type PlanteurStats = z.infer<typeof planteurStatsSchema>;
