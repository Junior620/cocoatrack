/**
 * Receipt Import Error Types and Constants
 *
 * Defines all error codes, messages (in French), and the ReceiptImportError class
 * for the receipt import feature.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/** Validation errors (400) */
export const RECEIPT_ERROR_CODES = {
  // Validation
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_WEIGHT: 'INVALID_WEIGHT',
  INVALID_HUMIDITY: 'INVALID_HUMIDITY',
  INVALID_PRICE: 'INVALID_PRICE',
  EMPTY_PRODUCT_LINES: 'EMPTY_PRODUCT_LINES',
  DUPLICATE_RECEIPT_NUMBER: 'DUPLICATE_RECEIPT_NUMBER',

  // Authorization
  UNAUTHORIZED_ROLE: 'UNAUTHORIZED_ROLE',
  COOPERATIVE_ACCESS_DENIED: 'COOPERATIVE_ACCESS_DENIED',

  // Not found
  PLANTEUR_NOT_FOUND: 'PLANTEUR_NOT_FOUND',
  CHEF_PLANTEUR_NOT_FOUND: 'CHEF_PLANTEUR_NOT_FOUND',
  COOPERATIVE_NOT_FOUND: 'COOPERATIVE_NOT_FOUND',
  PDF_NOT_FOUND: 'PDF_NOT_FOUND',

  // Service errors
  OCR_SERVICE_UNAVAILABLE: 'OCR_SERVICE_UNAVAILABLE',
  OCR_TIMEOUT: 'OCR_TIMEOUT',
  STORAGE_SERVICE_ERROR: 'STORAGE_SERVICE_ERROR',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Internal
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_ROLLBACK: 'TRANSACTION_ROLLBACK',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ReceiptErrorCode = (typeof RECEIPT_ERROR_CODES)[keyof typeof RECEIPT_ERROR_CODES];

// ============================================================================
// FRENCH ERROR MESSAGES
// ============================================================================

/**
 * User-facing French error messages mapped by error code.
 * Requirements: 10.1–10.5
 */
export const RECEIPT_ERROR_MESSAGES: Record<ReceiptErrorCode, string> = {
  // Validation
  INVALID_FILE_TYPE: 'Format non supporté. Seuls les fichiers PDF sont acceptés',
  FILE_TOO_LARGE: 'Fichier trop volumineux. Taille maximale: 10MB',
  MISSING_REQUIRED_FIELD: 'Ce champ est obligatoire',
  INVALID_DATE: 'La date ne peut pas être dans le futur',
  INVALID_WEIGHT: 'Le poids brut doit être supérieur à zéro',
  INVALID_HUMIDITY: "L'humidité doit être entre 0% et 100%",
  INVALID_PRICE: 'Le prix doit être supérieur à zéro',
  EMPTY_PRODUCT_LINES: 'Veuillez ajouter au moins une ligne de produit',
  DUPLICATE_RECEIPT_NUMBER: 'Ce numéro de reçu existe déjà',

  // Authorization
  UNAUTHORIZED_ROLE: 'Accès refusé. Rôle insuffisant',
  COOPERATIVE_ACCESS_DENIED: 'Accès refusé à cette coopérative',

  // Not found
  PLANTEUR_NOT_FOUND: 'Planteur introuvable',
  CHEF_PLANTEUR_NOT_FOUND: 'Chef planteur introuvable',
  COOPERATIVE_NOT_FOUND: 'Coopérative introuvable',
  PDF_NOT_FOUND: 'Fichier PDF introuvable',

  // Service errors
  OCR_SERVICE_UNAVAILABLE:
    'Service OCR temporairement indisponible. Veuillez utiliser la saisie manuelle',
  OCR_TIMEOUT: 'Extraction trop longue. Veuillez utiliser la saisie manuelle',
  STORAGE_SERVICE_ERROR: 'Erreur du service de stockage. Veuillez réessayer',

  // Network
  NETWORK_ERROR: 'Erreur réseau. Veuillez réessayer',

  // Internal
  DATABASE_ERROR: 'Erreur de base de données. Veuillez réessayer',
  TRANSACTION_ROLLBACK: "L'opération a été annulée suite à une erreur. Veuillez réessayer",
  UNKNOWN_ERROR: 'Une erreur inattendue est survenue. Veuillez réessayer',
};

// ============================================================================
// ERROR RESPONSE INTERFACE
// ============================================================================

/**
 * Structured error response from the API.
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    /** For validation errors — the field that failed */
    field?: string;
  };
}

// ============================================================================
// RECEIPT IMPORT ERROR CLASS
// ============================================================================

/**
 * Custom error class for receipt import operations.
 *
 * Extends the native Error with a structured code and optional details.
 * Requirements: 10.6
 */
export class ReceiptImportError extends Error {
  readonly code: ReceiptErrorCode;
  readonly details?: Record<string, unknown>;
  readonly field?: string;

  constructor(
    code: ReceiptErrorCode,
    message?: string,
    options?: { details?: Record<string, unknown>; field?: string }
  ) {
    super(message ?? RECEIPT_ERROR_MESSAGES[code]);
    this.name = 'ReceiptImportError';
    this.code = code;
    this.details = options?.details;
    this.field = options?.field;
  }

  /**
   * Convert to a plain ErrorResponse object suitable for JSON serialization.
   */
  toErrorResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        ...(this.field ? { field: this.field } : {}),
      },
    };
  }

  /**
   * Create a ReceiptImportError from an unknown caught value.
   */
  static from(err: unknown): ReceiptImportError {
    if (err instanceof ReceiptImportError) return err;

    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string; message?: string };
      const code = (e.code in RECEIPT_ERROR_MESSAGES
        ? e.code
        : 'UNKNOWN_ERROR') as ReceiptErrorCode;
      return new ReceiptImportError(code, e.message);
    }

    if (err instanceof Error) {
      const isNetwork =
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('fetch') ||
        err.message.toLowerCase().includes('failed to fetch');
      return new ReceiptImportError(
        isNetwork ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
        err.message
      );
    }

    return new ReceiptImportError('UNKNOWN_ERROR');
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get a user-friendly French message for any error code string.
 * Falls back to UNKNOWN_ERROR message if code is not recognized.
 */
export function getReceiptErrorMessage(code: string): string {
  return (
    RECEIPT_ERROR_MESSAGES[code as ReceiptErrorCode] ??
    RECEIPT_ERROR_MESSAGES.UNKNOWN_ERROR
  );
}

/**
 * Determine if an error code represents a network/transient error
 * that should be retried.
 */
export function isRetryableError(code: string): boolean {
  const retryableCodes: string[] = [
    RECEIPT_ERROR_CODES.NETWORK_ERROR,
    RECEIPT_ERROR_CODES.STORAGE_SERVICE_ERROR,
    RECEIPT_ERROR_CODES.DATABASE_ERROR,
  ];
  return retryableCodes.includes(code);
}

/**
 * Determine if an error code represents an OCR service error
 * that should trigger fallback to manual entry.
 */
export function isOcrError(code: string): boolean {
  const ocrErrorCodes: string[] = [
    RECEIPT_ERROR_CODES.OCR_SERVICE_UNAVAILABLE,
    RECEIPT_ERROR_CODES.OCR_TIMEOUT,
  ];
  return ocrErrorCodes.includes(code);
}
