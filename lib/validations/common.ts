// CocoaTrack V2 - Common Validation Schemas
import { z } from 'zod';

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Phone number validation (Cameroon format)
export const phoneSchema = z
  .string()
  .regex(/^(\+237)?[26][0-9]{8}$/, 'Invalid phone number format')
  .nullable()
  .optional();

// CNI (National ID) validation
export const cniSchema = z
  .string()
  .min(5, 'CNI must be at least 5 characters')
  .max(20, 'CNI must be at most 20 characters')
  .nullable()
  .optional();

// Coordinates validation
export const latitudeSchema = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90')
  .nullable()
  .optional();

export const longitudeSchema = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180')
  .nullable()
  .optional();

export const coordinatesSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

// Pagination params schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Search params schema
export const searchSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  ...paginationSchema.shape,
});

// Filter params for cooperative-scoped queries
export const cooperativeFilterSchema = z.object({
  cooperative_id: uuidSchema.optional(),
  region_id: uuidSchema.optional(),
});

// Date range filter
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// Validation status enum
export const validationStatusSchema = z.enum(['pending', 'validated', 'rejected']);

// Code generation helper (for unique codes)
export const codeSchema = z
  .string()
  .min(3, 'Code must be at least 3 characters')
  .max(20, 'Code must be at most 20 characters')
  .regex(/^[A-Z0-9-]+$/, 'Code must contain only uppercase letters, numbers, and hyphens');

// Name validation
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .trim();
