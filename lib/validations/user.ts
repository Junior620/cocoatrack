// CocoaTrack V2 - User Validation Schemas
import { z } from 'zod';
import { uuidSchema } from './common';

// User roles enum
export const USER_ROLES = ['admin', 'manager', 'agent', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Role descriptions for UI display
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Accès complet à toutes les fonctionnalités et coopératives',
  manager: 'Gestion des opérations et des utilisateurs de sa coopérative',
  agent: 'Saisie des données et opérations quotidiennes',
  viewer: 'Consultation des données uniquement (lecture seule)',
};

// Email validation schema with trim and lowercase
export const emailSchema = z
  .string()
  .min(1, 'L\'email est requis')
  .email('Format email invalide')
  .transform((v) => v.trim().toLowerCase());

// Full name validation schema (min 2 chars after trim)
export const fullNameSchema = z
  .string()
  .min(1, 'Le nom complet est requis')
  .transform((v) => v.trim())
  .refine((v) => v.length >= 2, {
    message: 'Le nom doit contenir au moins 2 caractères',
  });

// Phone validation for users (optional, Cameroon format)
export const userPhoneSchema = z
  .string()
  .regex(/^(\+237)?[26][0-9]{8}$/, 'Format de téléphone invalide')
  .nullable()
  .optional()
  .transform((v) => (v ? v.trim() : null));

// Schema for creating a new user
export const createUserSchema = z.object({
  email: emailSchema,
  full_name: fullNameSchema,
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: 'Rôle invalide' }),
  }),
  cooperative_id: uuidSchema.nullable().optional(),
  phone: userPhoneSchema,
});

// Schema for updating a user
export const updateUserSchema = z.object({
  full_name: fullNameSchema.optional(),
  role: z.enum(USER_ROLES).optional(),
  cooperative_id: uuidSchema.nullable().optional(),
  phone: userPhoneSchema,
  is_active: z.boolean().optional(),
});

// Schema for user filters
export const userFiltersSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  role: z.enum(USER_ROLES).optional(),
  cooperative_id: uuidSchema.optional(),
  is_active: z.boolean().optional(),
  search: z.string().max(100).optional(),
});

// TypeScript types inferred from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFilters = z.infer<typeof userFiltersSchema>;
