// CocoaTrack V2 - Delivery Validation Schemas
// Zod schemas for delivery data validation

import { z } from 'zod';
import type { Database } from '@/types/database.gen';

type Delivery = Database['public']['Tables']['deliveries']['Row'];
type DeliveryPhoto = Database['public']['Tables']['delivery_photos']['Row'];

// ============================================================================
// ENUMS
// ============================================================================

export const qualityGradeSchema = z.enum(['A', 'B', 'C']);
export const paymentStatusSchema = z.enum(['pending', 'partial', 'paid']);

// ============================================================================
// CREATE DELIVERY SCHEMA
// ============================================================================

export const createDeliverySchema = z.object({
  planteur_id: z.string().uuid('Invalid planteur ID'),
  chef_planteur_id: z.string().uuid('Invalid chef planteur ID'),
  warehouse_id: z.string().uuid('Invalid warehouse ID'),
  weight_kg: z
    .number()
    .positive('Weight must be positive')
    .max(100000, 'Weight cannot exceed 100,000 kg'),
  price_per_kg: z
    .number()
    .positive('Price must be positive')
    .max(1000000, 'Price cannot exceed 1,000,000 XAF/kg'),
  quality_grade: qualityGradeSchema.optional().default('B'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  delivered_at: z.string().datetime().optional(),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;

// ============================================================================
// UPDATE DELIVERY SCHEMA
// ============================================================================

export const updateDeliverySchema = z.object({
  weight_kg: z
    .number()
    .positive('Weight must be positive')
    .max(100000, 'Weight cannot exceed 100,000 kg')
    .optional(),
  price_per_kg: z
    .number()
    .positive('Price must be positive')
    .max(1000000, 'Price cannot exceed 1,000,000 XAF/kg')
    .optional(),
  quality_grade: qualityGradeSchema.optional(),
  payment_status: paymentStatusSchema.optional(),
  payment_amount_paid: z
    .number()
    .nonnegative('Payment amount cannot be negative')
    .optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  delivered_at: z.string().datetime().optional(),
});

export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;

// ============================================================================
// BATCH DELIVERY SCHEMA
// ============================================================================

export const batchDeliverySchema = z.object({
  deliveries: z
    .array(createDeliverySchema)
    .min(1, 'At least one delivery is required')
    .max(100, 'Cannot create more than 100 deliveries at once'),
});

export type BatchDeliveryInput = z.infer<typeof batchDeliverySchema>;

// ============================================================================
// DELIVERY FILTERS SCHEMA
// ============================================================================

export const deliveryFiltersSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional().default('delivered_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  planteur_id: z.string().uuid().optional(),
  chef_planteur_id: z.string().uuid().optional(),
  cooperative_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  quality_grade: qualityGradeSchema.optional(),
  payment_status: paymentStatusSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
});

export type DeliveryFilters = z.infer<typeof deliveryFiltersSchema>;

// ============================================================================
// DELIVERY WITH RELATIONS TYPE
// ============================================================================

export interface DeliveryWithRelations extends Delivery {
  planteur?: {
    id: string;
    name: string;
    code: string;
  };
  chef_planteur?: {
    id: string;
    name: string;
    code: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  cooperative?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
  };
  photos?: DeliveryPhoto[];
}

// ============================================================================
// DELIVERY STATS TYPE
// ============================================================================

export interface DeliveryStats {
  total_deliveries: number;
  total_weight_kg: number;
  total_amount_xaf: number;
  average_price_per_kg: number;
  pending_count: number;
  paid_count: number;
}

// ============================================================================
// PHOTO UPLOAD SCHEMA
// ============================================================================

export const photoUploadSchema = z.object({
  delivery_id: z.string().uuid('Invalid delivery ID'),
  file: z.instanceof(File).refine(
    (file) => {
      const validTypes = ['image/jpeg', 'image/png'];
      return validTypes.includes(file.type);
    },
    { message: 'File must be JPEG or PNG' }
  ).refine(
    (file) => file.size <= 5 * 1024 * 1024, // 5MB
    { message: 'File size must be less than 5MB' }
  ),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

// ============================================================================
// CSV IMPORT SCHEMA
// ============================================================================

export const csvDeliveryRowSchema = z.object({
  planteur_code: z.string().min(1, 'Planteur code is required'),
  warehouse_code: z.string().min(1, 'Warehouse code is required'),
  weight_kg: z.coerce.number().positive('Weight must be positive'),
  price_per_kg: z.coerce.number().positive('Price must be positive'),
  quality_grade: qualityGradeSchema.optional().default('B'),
  notes: z.string().optional(),
  delivered_at: z.string().optional(),
});

export type CsvDeliveryRow = z.infer<typeof csvDeliveryRowSchema>;
