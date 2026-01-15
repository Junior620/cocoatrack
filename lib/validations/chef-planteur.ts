// CocoaTrack V2 - Chef Planteur Validation Schemas
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

// Base ChefPlanteur schema (matches database row)
export const chefPlanteurSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  code: codeSchema,
  phone: phoneSchema,
  cni: cniSchema,
  cooperative_id: uuidSchema.nullable().optional(), // Optional - chef_planteur can be independent
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  quantite_max_kg: z.number().min(0).default(0),
  contract_start: z.string().date().nullable().optional(),
  contract_end: z.string().date().nullable().optional(),
  termination_reason: z.string().max(500).nullable().optional(),
  validation_status: validationStatusSchema.default('pending'),
  validated_by: uuidSchema.nullable().optional(),
  validated_at: z.string().datetime().nullable().optional(),
  rejection_reason: z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: uuidSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Schema for creating a new chef_planteur
export const createChefPlanteurSchema = z.object({
  name: nameSchema,
  code: codeSchema,
  phone: phoneSchema,
  cni: cniSchema,
  cooperative_id: uuidSchema.nullable().optional(), // Optional - chef_planteur can be independent
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  quantite_max_kg: z.number().min(0).default(0),
  contract_start: z.string().date().nullable().optional(),
  contract_end: z.string().date().nullable().optional(),
});

// Schema for updating a chef_planteur
export const updateChefPlanteurSchema = z.object({
  name: nameSchema.optional(),
  code: codeSchema.optional(),
  phone: phoneSchema,
  cni: cniSchema,
  cooperative_id: uuidSchema.nullable().optional(), // Optional - chef_planteur can be independent
  region: z.string().max(100).nullable().optional(),
  departement: z.string().max(100).nullable().optional(),
  localite: z.string().max(100).nullable().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  quantite_max_kg: z.number().min(0).optional(),
  contract_start: z.string().date().nullable().optional(),
  contract_end: z.string().date().nullable().optional(),
  termination_reason: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

// Schema for validating a chef_planteur
export const validateChefPlanteurSchema = z.object({
  chef_planteur_id: uuidSchema,
});

// Schema for rejecting a chef_planteur
export const rejectChefPlanteurSchema = z.object({
  chef_planteur_id: uuidSchema,
  rejection_reason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
});

// Schema for chef_planteur list filters
export const chefPlanteurFiltersSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  cooperative_id: uuidSchema.optional(),
  region: z.string().max(100).optional(),
  validation_status: validationStatusSchema.optional(),
  search: z.string().max(100).optional(),
  has_active_contract: z.boolean().optional(),
  is_exploited: z.boolean().optional(), // Filter by exploitation status (has deliveries)
});

// Schema for chef_planteur search
export const chefPlanteurSearchSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(10),
});

// ChefPlanteur with related data (for detail views)
export const chefPlanteurWithRelationsSchema = chefPlanteurSchema.extend({
  cooperative: z.object({
    id: uuidSchema,
    name: z.string(),
    code: z.string(),
  }).optional(),
  validated_by_profile: z.object({
    id: uuidSchema,
    full_name: z.string(),
  }).nullable().optional(),
  created_by_profile: z.object({
    id: uuidSchema,
    full_name: z.string(),
  }).optional(),
  planteurs_count: z.number().int().min(0).optional(),
});

// ChefPlanteur statistics
export const chefPlanteurStatsSchema = z.object({
  total_planteurs: z.number().int().min(0),
  active_planteurs: z.number().int().min(0),
  total_deliveries: z.number().int().min(0),
  total_weight_kg: z.number().min(0),
  total_amount_xaf: z.number().int().min(0),
  quantity_remaining_kg: z.number(), // Can be negative if exceeded
  is_quantity_exceeded: z.boolean(),
  last_delivery_date: z.string().datetime().nullable(),
});

// Validation history entry
export const validationHistoryEntrySchema = z.object({
  id: uuidSchema,
  chef_planteur_id: uuidSchema,
  previous_status: validationStatusSchema.nullable(),
  new_status: validationStatusSchema,
  changed_by: uuidSchema,
  changed_by_name: z.string(),
  reason: z.string().nullable(),
  changed_at: z.string().datetime(),
});

// TypeScript types inferred from schemas
export type ChefPlanteur = z.infer<typeof chefPlanteurSchema>;
export type CreateChefPlanteurInput = z.infer<typeof createChefPlanteurSchema>;
export type UpdateChefPlanteurInput = z.infer<typeof updateChefPlanteurSchema>;
export type ValidateChefPlanteurInput = z.infer<typeof validateChefPlanteurSchema>;
export type RejectChefPlanteurInput = z.infer<typeof rejectChefPlanteurSchema>;
export type ChefPlanteurFilters = z.infer<typeof chefPlanteurFiltersSchema>;
export type ChefPlanteurSearch = z.infer<typeof chefPlanteurSearchSchema>;
export type ChefPlanteurWithRelations = z.infer<typeof chefPlanteurWithRelationsSchema>;
export type ChefPlanteurStats = z.infer<typeof chefPlanteurStatsSchema>;
export type ValidationHistoryEntry = z.infer<typeof validationHistoryEntrySchema>;
