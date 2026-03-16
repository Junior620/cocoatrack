// CocoaTrack V2 - Planteur Import Validation
// Zod schemas and validation functions for CSV import
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7

import { z } from 'zod';
import { PlanteurCSVData, ValidationError } from '@/types/planteur-import';

/**
 * Phone number validation regex
 * Accepts international format with +, digits, spaces, hyphens, and parentheses
 * Examples: +2250701234567, 07 01 23 45 67, (225) 07-01-23-45-67
 * 
 * Requirements: 2.4
 */
const PHONE_REGEX = /^[\d\s\+\-\(\)]+$/;

/**
 * CNI (National ID) validation regex
 * Accepts alphanumeric characters only (letters and digits)
 * 
 * Requirements: 2.3
 */
const CNI_REGEX = /^[a-zA-Z0-9]+$/;

/**
 * Zod schema for PlanteurCSVData with field validations
 * 
 * Field specifications:
 * - nom: Required, non-empty string, max 200 chars
 * - prénoms: Optional string, max 200 chars
 * - CNI: Optional alphanumeric string, 1-50 chars
 * - téléphone: Optional phone number pattern
 * - superficie: Optional positive number
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export const planteurCSVSchema = z.object({
  /**
   * Planteur last name (required)
   * Requirements: 2.1, 2.7
   */
  nom: z
    .string({
      required_error: 'Le nom est obligatoire',
      invalid_type_error: 'Le nom doit être une chaîne de caractères',
    })
    .min(1, 'Le nom est obligatoire')
    .max(200, 'Le nom ne peut pas dépasser 200 caractères')
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: 'Le nom est obligatoire',
    }),

  /**
   * Planteur first name(s) (optional)
   * Requirements: 2.2
   */
  prénoms: z
    .string()
    .max(200, 'Les prénoms ne peuvent pas dépasser 200 caractères')
    .transform((val) => val.trim())
    .optional()
    .or(z.literal('')),

  /**
   * National ID number (optional)
   * Requirements: 2.3
   */
  CNI: z
    .string()
    .transform((val) => val.trim())
    .refine(
      (val) => val === '' || (val.length >= 1 && val.length <= 50),
      { message: 'Le CNI ne peut pas dépasser 50 caractères' }
    )
    .refine(
      (val) => val === '' || CNI_REGEX.test(val),
      { message: 'Format CNI invalide. Doit contenir uniquement des caractères alphanumériques (1-50 caractères)' }
    )
    .optional()
    .or(z.literal('')),

  /**
   * Phone number (optional)
   * Requirements: 2.4
   */
  téléphone: z
    .string()
    .regex(PHONE_REGEX, 'Format de téléphone invalide')
    .transform((val) => val.trim())
    .optional()
    .or(z.literal('')),

  /**
   * Total land area in hectares (optional)
   * Requirements: 2.5
   */
  superficie: z
    .union([
      z.number().positive('La superficie doit être un nombre positif'),
      z
        .string()
        .transform((val, ctx) => {
          const trimmed = val.trim();
          if (trimmed === '') return undefined;
          const num = parseFloat(trimmed);
          if (isNaN(num)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'La superficie doit être un nombre positif',
            });
            return z.NEVER;
          }
          if (num <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'La superficie doit être un nombre positif',
            });
            return z.NEVER;
          }
          return num;
        }),
    ])
    .optional(),

  /**
   * Age of the planteur in years (optional, positive integer)
   */
  age: z
    .union([
      z.number().int('L\'âge doit être un nombre entier').positive('L\'âge doit être un nombre positif'),
      z
        .string()
        .transform((val, ctx) => {
          const trimmed = val.trim();
          if (trimmed === '') return undefined;
          const num = parseInt(trimmed, 10);
          if (isNaN(num) || String(num) !== trimmed) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'L\'âge doit être un nombre entier positif',
            });
            return z.NEVER;
          }
          if (num <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'L\'âge doit être un nombre positif',
            });
            return z.NEVER;
          }
          return num;
        }),
    ])
    .optional(),

  /**
   * Gender of the planteur: F (Féminin) or M (Masculin) (optional)
   */
  genre: z
    .string()
    .transform((val, ctx) => {
      const trimmed = val.trim().toUpperCase();
      if (trimmed === '') return undefined;
      if (trimmed !== 'F' && trimmed !== 'M') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le genre doit être F (Féminin) ou M (Masculin)',
        });
        return z.NEVER;
      }
      return trimmed as 'F' | 'M';
    })
    .optional(),
});

/**
 * Type for validated planteur CSV data
 */
export type ValidatedPlanteurCSVData = z.infer<typeof planteurCSVSchema>;

/**
 * Validate a single CSV row using Zod schema
 * Collects all validation errors (not just first error)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 * 
 * @param row - Raw CSV row data
 * @returns Object with validation result and errors
 */
export function validatePlanteurRow(row: Record<string, string>): {
  isValid: boolean;
  data: PlanteurCSVData | null;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  try {
    // Parse with Zod schema
    const result = planteurCSVSchema.safeParse(row);

    if (result.success) {
      // Convert validated data to PlanteurCSVData format
      const data: PlanteurCSVData = {
        nom: result.data.nom,
        prénoms: result.data.prénoms || undefined,
        CNI: result.data.CNI || undefined,
        téléphone: result.data.téléphone || undefined,
        superficie: result.data.superficie,
        age: result.data.age,
        genre: result.data.genre,
      };

      return {
        isValid: true,
        data,
        errors: [],
      };
    } else {
      // Collect all validation errors
      for (const issue of result.error.issues) {
        const field = issue.path.join('.');
        errors.push({
          field,
          message: issue.message,
          code: getErrorCode(field, issue.code),
        });
      }

      return {
        isValid: false,
        data: null,
        errors,
      };
    }
  } catch (error) {
    // Catch any unexpected errors
    errors.push({
      field: 'unknown',
      message: error instanceof Error ? error.message : 'Erreur de validation inconnue',
      code: 'VALIDATION_ERROR',
    });

    return {
      isValid: false,
      data: null,
      errors,
    };
  }
}

/**
 * Map Zod error codes to application error codes
 * 
 * @param field - Field name
 * @param zodCode - Zod error code
 * @returns Application error code
 */
function getErrorCode(field: string, zodCode: string): string {
  // Map field-specific error codes
  switch (field) {
    case 'nom':
      return 'NAME_REQUIRED';
    case 'CNI':
      return 'INVALID_CNI_FORMAT';
    case 'téléphone':
      return 'INVALID_PHONE_FORMAT';
    case 'superficie':
      return 'INVALID_SUPERFICIE';
    case 'age':
      return 'INVALID_AGE';
    case 'genre':
      return 'INVALID_GENRE';
    default:
      return 'VALIDATION_ERROR';
  }
}

/**
 * Validate multiple CSV rows
 * Returns validation results for all rows
 * 
 * Requirements: 2.6
 * 
 * @param rows - Array of raw CSV row data
 * @returns Array of validation results
 */
export function validatePlanteurRows(
  rows: Record<string, string>[]
): Array<{
  rowNumber: number;
  isValid: boolean;
  data: PlanteurCSVData | null;
  errors: ValidationError[];
}> {
  return rows.map((row, index) => {
    const result = validatePlanteurRow(row);
    return {
      rowNumber: index + 1, // 1-indexed for user display
      ...result,
    };
  });
}

/**
 * Check if a row has any validation errors
 * 
 * @param errors - Array of validation errors
 * @returns true if row has errors
 */
export function hasValidationErrors(errors: ValidationError[]): boolean {
  return errors.length > 0;
}

/**
 * Get error messages for a specific field
 * 
 * @param errors - Array of validation errors
 * @param field - Field name
 * @returns Array of error messages for the field
 */
export function getFieldErrors(errors: ValidationError[], field: string): string[] {
  return errors.filter((e) => e.field === field).map((e) => e.message);
}

/**
 * Format validation errors for display
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ');
}
