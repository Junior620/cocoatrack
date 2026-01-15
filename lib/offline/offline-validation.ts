// CocoaTrack V2 - Offline Validation
// Minimal local validation for offline entity creation
// Requirements: REQ-OFF-012

import type { 
  OfflineValidationResult, 
  ValidationError, 
  ValidationWarning 
} from './offline-entity';

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Required fields for delivery creation
 */
export const DELIVERY_REQUIRED_FIELDS = [
  'planteur_id',
  'chef_planteur_id', 
  'warehouse_id',
  'weight_kg',
  'price_per_kg',
] as const;

/**
 * Required fields for planteur creation
 */
export const PLANTEUR_REQUIRED_FIELDS = [
  'name',
  'code',
  'chef_planteur_id',
] as const;

/**
 * Required fields for chef_planteur creation
 */
export const CHEF_PLANTEUR_REQUIRED_FIELDS = [
  'name',
  'code',
  'quantite_max_kg',
] as const;

// ============================================================================
// FORMAT VALIDATORS
// ============================================================================

/**
 * UUID format regex (any version)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Phone number format regex (Cameroon format)
 */
const PHONE_REGEX = /^(\+237)?[0-9]{9}$/;

/**
 * CNI format regex (Cameroon national ID)
 */
const CNI_REGEX = /^[0-9]{6,15}$/;

/**
 * Validates UUID format
 */
export function isValidUUIDFormat(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validates phone number format
 */
export function isValidPhoneFormat(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/\s/g, ''));
}

/**
 * Validates CNI format
 */
export function isValidCNIFormat(value: string): boolean {
  return CNI_REGEX.test(value.replace(/\s/g, ''));
}

/**
 * Validates that a value is a positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Validates that a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validates that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

// ============================================================================
// OFFLINE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a delivery for offline creation
 * REQ-OFF-012: Minimal local validation (required fields, formats)
 * 
 * @param data - The delivery data to validate
 * @returns Validation result with errors and warnings
 */
export function validateOfflineDelivery(
  data: Record<string, unknown>
): OfflineValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check required fields
  for (const field of DELIVERY_REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
      });
    }
  }

  // Validate UUID formats for ID fields
  const uuidFields = ['planteur_id', 'chef_planteur_id', 'warehouse_id'];
  for (const field of uuidFields) {
    const value = data[field];
    if (value !== undefined && value !== null && typeof value === 'string') {
      if (!isValidUUIDFormat(value)) {
        warnings.push({
          field,
          message: `${field} may not be a valid UUID format`,
          code: 'INVALID_UUID_FORMAT',
        });
      }
    }
  }

  // Validate weight_kg
  if (data.weight_kg !== undefined && data.weight_kg !== null) {
    if (!isPositiveNumber(data.weight_kg)) {
      errors.push({
        field: 'weight_kg',
        message: 'weight_kg must be a positive number',
        code: 'INVALID_NUMBER',
      });
    } else if ((data.weight_kg as number) > 100000) {
      warnings.push({
        field: 'weight_kg',
        message: 'weight_kg exceeds typical maximum (100,000 kg)',
        code: 'VALUE_TOO_HIGH',
      });
    }
  }

  // Validate price_per_kg
  if (data.price_per_kg !== undefined && data.price_per_kg !== null) {
    if (!isPositiveNumber(data.price_per_kg)) {
      errors.push({
        field: 'price_per_kg',
        message: 'price_per_kg must be a positive number',
        code: 'INVALID_NUMBER',
      });
    } else if ((data.price_per_kg as number) > 1000000) {
      warnings.push({
        field: 'price_per_kg',
        message: 'price_per_kg exceeds typical maximum (1,000,000 XAF/kg)',
        code: 'VALUE_TOO_HIGH',
      });
    }
  }

  // Validate quality_grade if provided
  if (data.quality_grade !== undefined && data.quality_grade !== null) {
    const validGrades = ['A', 'B', 'C'];
    if (!validGrades.includes(data.quality_grade as string)) {
      warnings.push({
        field: 'quality_grade',
        message: 'quality_grade should be A, B, or C',
        code: 'INVALID_ENUM',
      });
    }
  }

  // Validate delivered_at if provided
  if (data.delivered_at !== undefined && data.delivered_at !== null) {
    const date = new Date(data.delivered_at as string);
    if (isNaN(date.getTime())) {
      warnings.push({
        field: 'delivered_at',
        message: 'delivered_at is not a valid date',
        code: 'INVALID_DATE',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a planteur for offline creation
 * REQ-OFF-012: Minimal local validation (required fields, formats)
 * 
 * @param data - The planteur data to validate
 * @returns Validation result with errors and warnings
 */
export function validateOfflinePlanteur(
  data: Record<string, unknown>
): OfflineValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check required fields
  for (const field of PLANTEUR_REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
      });
    }
  }

  // Validate name
  if (data.name !== undefined && data.name !== null) {
    if (!isNonEmptyString(data.name)) {
      errors.push({
        field: 'name',
        message: 'name must be a non-empty string',
        code: 'INVALID_STRING',
      });
    }
  }

  // Validate code
  if (data.code !== undefined && data.code !== null) {
    if (!isNonEmptyString(data.code)) {
      errors.push({
        field: 'code',
        message: 'code must be a non-empty string',
        code: 'INVALID_STRING',
      });
    }
  }

  // Validate chef_planteur_id format
  if (data.chef_planteur_id !== undefined && data.chef_planteur_id !== null) {
    if (typeof data.chef_planteur_id === 'string' && !isValidUUIDFormat(data.chef_planteur_id)) {
      warnings.push({
        field: 'chef_planteur_id',
        message: 'chef_planteur_id may not be a valid UUID format',
        code: 'INVALID_UUID_FORMAT',
      });
    }
  }

  // Validate phone if provided
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    if (typeof data.phone === 'string' && !isValidPhoneFormat(data.phone)) {
      warnings.push({
        field: 'phone',
        message: 'phone may not be in valid format',
        code: 'INVALID_PHONE_FORMAT',
      });
    }
  }

  // Validate CNI if provided
  if (data.cni !== undefined && data.cni !== null && data.cni !== '') {
    if (typeof data.cni === 'string' && !isValidCNIFormat(data.cni)) {
      warnings.push({
        field: 'cni',
        message: 'cni may not be in valid format',
        code: 'INVALID_CNI_FORMAT',
      });
    }
  }

  // Validate coordinates if provided
  if (data.latitude !== undefined && data.latitude !== null) {
    const lat = data.latitude as number;
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      warnings.push({
        field: 'latitude',
        message: 'latitude should be between -90 and 90',
        code: 'INVALID_COORDINATE',
      });
    }
  }

  if (data.longitude !== undefined && data.longitude !== null) {
    const lng = data.longitude as number;
    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
      warnings.push({
        field: 'longitude',
        message: 'longitude should be between -180 and 180',
        code: 'INVALID_COORDINATE',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a chef_planteur for offline creation
 * REQ-OFF-012: Minimal local validation (required fields, formats)
 * 
 * @param data - The chef_planteur data to validate
 * @returns Validation result with errors and warnings
 */
export function validateOfflineChefPlanteur(
  data: Record<string, unknown>
): OfflineValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check required fields
  for (const field of CHEF_PLANTEUR_REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
      });
    }
  }

  // Validate name
  if (data.name !== undefined && data.name !== null) {
    if (!isNonEmptyString(data.name)) {
      errors.push({
        field: 'name',
        message: 'name must be a non-empty string',
        code: 'INVALID_STRING',
      });
    }
  }

  // Validate code
  if (data.code !== undefined && data.code !== null) {
    if (!isNonEmptyString(data.code)) {
      errors.push({
        field: 'code',
        message: 'code must be a non-empty string',
        code: 'INVALID_STRING',
      });
    }
  }

  // Validate quantite_max_kg
  if (data.quantite_max_kg !== undefined && data.quantite_max_kg !== null) {
    if (!isPositiveNumber(data.quantite_max_kg)) {
      errors.push({
        field: 'quantite_max_kg',
        message: 'quantite_max_kg must be a positive number',
        code: 'INVALID_NUMBER',
      });
    }
  }

  // Validate phone if provided
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    if (typeof data.phone === 'string' && !isValidPhoneFormat(data.phone)) {
      warnings.push({
        field: 'phone',
        message: 'phone may not be in valid format',
        code: 'INVALID_PHONE_FORMAT',
      });
    }
  }

  // Validate CNI if provided
  if (data.cni !== undefined && data.cni !== null && data.cni !== '') {
    if (typeof data.cni === 'string' && !isValidCNIFormat(data.cni)) {
      warnings.push({
        field: 'cni',
        message: 'cni may not be in valid format',
        code: 'INVALID_CNI_FORMAT',
      });
    }
  }

  // Validate coordinates if provided
  if (data.latitude !== undefined && data.latitude !== null) {
    const lat = data.latitude as number;
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      warnings.push({
        field: 'latitude',
        message: 'latitude should be between -90 and 90',
        code: 'INVALID_COORDINATE',
      });
    }
  }

  if (data.longitude !== undefined && data.longitude !== null) {
    const lng = data.longitude as number;
    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
      warnings.push({
        field: 'longitude',
        message: 'longitude should be between -180 and 180',
        code: 'INVALID_COORDINATE',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generic validation function that routes to the appropriate validator
 * REQ-OFF-012: Store even with partial validation
 * 
 * @param table - The table name
 * @param data - The entity data to validate
 * @returns Validation result with errors and warnings
 */
export function validateOfflineEntity(
  table: string,
  data: Record<string, unknown>
): OfflineValidationResult {
  switch (table) {
    case 'deliveries':
      return validateOfflineDelivery(data);
    case 'planteurs':
      return validateOfflinePlanteur(data);
    case 'chef_planteurs':
      return validateOfflineChefPlanteur(data);
    default:
      // For unknown tables, just check that data is not empty
      return {
        isValid: Object.keys(data).length > 0,
        errors: Object.keys(data).length === 0 
          ? [{ field: 'data', message: 'Entity data cannot be empty', code: 'EMPTY_DATA' }]
          : [],
        warnings: [],
      };
  }
}

/**
 * Extracts validation warning messages as strings
 * Useful for storing in the entity's validation_warnings field
 * 
 * @param result - The validation result
 * @returns Array of warning message strings
 */
export function extractWarningMessages(result: OfflineValidationResult): string[] {
  return result.warnings.map(w => `${w.field}: ${w.message}`);
}
