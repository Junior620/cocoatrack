// CocoaTrack V2 - Error Message Translations
// Centralized error messages for planteur import operations

/**
 * Error codes for planteur import operations
 */
export const PLANTEUR_IMPORT_ERROR_CODES = {
  // File upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  
  // Parse errors
  EMPTY_FILE: 'EMPTY_FILE',
  MISSING_HEADER: 'MISSING_HEADER',
  MISSING_REQUIRED_COLUMNS: 'MISSING_REQUIRED_COLUMNS',
  
  // Validation errors
  NAME_REQUIRED: 'NAME_REQUIRED',
  INVALID_CNI_FORMAT: 'INVALID_CNI_FORMAT',
  INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',
  INVALID_SUPERFICIE: 'INVALID_SUPERFICIE',
  
  // Duplicate errors
  DUPLICATE_NAME_NORM: 'DUPLICATE_NAME_NORM',
  
  // Authorization errors
  NO_COOPERATIVE: 'NO_COOPERATIVE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Import execution errors
  IMPORT_NOT_FOUND: 'IMPORT_NOT_FOUND',
  IMPORT_ALREADY_EXECUTED: 'IMPORT_ALREADY_EXECUTED',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CREATE_FAILED: 'CREATE_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  MISSING_PLANTEUR_ID: 'MISSING_PLANTEUR_ID',
  INVALID_ACTION: 'INVALID_ACTION',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
} as const;

export type PlanteurImportErrorCode = keyof typeof PLANTEUR_IMPORT_ERROR_CODES;

/**
 * French error messages for all error codes
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export const PLANTEUR_IMPORT_ERROR_MESSAGES: Record<PlanteurImportErrorCode, string> = {
  // File upload errors (Requirement 8.1)
  FILE_TOO_LARGE: 'Le fichier est trop volumineux. Taille maximale : 10 MB',
  INVALID_FILE_TYPE: 'Format de fichier invalide. Seuls les fichiers CSV sont acceptés',
  FILE_READ_ERROR: 'Impossible de lire le fichier. Assurez-vous qu\'il s\'agit d\'un fichier CSV valide',
  
  // Parse errors (Requirement 8.2, 8.3)
  EMPTY_FILE: 'Le fichier CSV est vide',
  MISSING_HEADER: 'Le fichier CSV doit contenir une ligne d\'en-tête avec les noms de champs',
  MISSING_REQUIRED_COLUMNS: 'Colonnes requises manquantes',
  
  // Validation errors
  NAME_REQUIRED: 'Le nom est obligatoire',
  INVALID_CNI_FORMAT: 'Format CNI invalide. Doit contenir uniquement des caractères alphanumériques (1-50 caractères)',
  INVALID_PHONE_FORMAT: 'Format de téléphone invalide',
  INVALID_SUPERFICIE: 'La superficie doit être un nombre positif',
  
  // Duplicate errors
  DUPLICATE_NAME_NORM: 'Un planteur avec ce nom existe déjà',
  
  // Authorization errors
  NO_COOPERATIVE: 'Vous devez appartenir à une coopérative pour importer des planteurs',
  UNAUTHORIZED: 'Non autorisé',
  
  // Import execution errors
  IMPORT_NOT_FOUND: 'Import introuvable',
  IMPORT_ALREADY_EXECUTED: 'Cet import a déjà été exécuté',
  INVALID_STATUS: 'L\'import ne peut pas être exécuté dans son état actuel',
  INVALID_INPUT: 'Données d\'entrée invalides',
  
  // Database errors (Requirement 8.4)
  DATABASE_ERROR: 'Erreur de base de données',
  CREATE_FAILED: 'Erreur lors de la création du planteur',
  UPDATE_FAILED: 'Erreur lors de la mise à jour du planteur',
  MISSING_PLANTEUR_ID: 'ID du planteur manquant pour la mise à jour',
  INVALID_ACTION: 'Action invalide',
  PROCESSING_ERROR: 'Erreur lors du traitement de la ligne',
  
  // Network errors (Requirement 8.5)
  NETWORK_ERROR: 'Erreur réseau. Veuillez vérifier votre connexion et réessayer',
  
  // Generic errors
  INTERNAL_ERROR: 'Une erreur interne s\'est produite',
  FILE_NOT_FOUND: 'Fichier introuvable dans le stockage',
};

/**
 * Get error message for a given error code
 * @param code - Error code
 * @param fallback - Optional fallback message if code not found
 * @returns French error message
 */
export function getPlanteurImportErrorMessage(
  code: string,
  fallback?: string
): string {
  if (code in PLANTEUR_IMPORT_ERROR_MESSAGES) {
    return PLANTEUR_IMPORT_ERROR_MESSAGES[code as PlanteurImportErrorCode];
  }
  return fallback || PLANTEUR_IMPORT_ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * Format error response for display
 * @param error - Error object from API
 * @returns Formatted error message
 */
export function formatPlanteurImportError(error: {
  error_code?: string;
  message?: string;
  details?: Record<string, unknown>;
}): string {
  if (error.message) {
    return error.message;
  }
  
  if (error.error_code) {
    return getPlanteurImportErrorMessage(error.error_code);
  }
  
  return PLANTEUR_IMPORT_ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * Check if an error is a network error
 * @param error - Error object
 * @returns True if network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  if (error && typeof error === 'object' && 'error_code' in error) {
    return (error as { error_code: string }).error_code === 'NETWORK_ERROR';
  }
  
  return false;
}
