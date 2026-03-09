// CocoaTrack V2 - Planteur Import Type Definitions
// Types for CSV import workflow: upload → parse → validate → execute

/**
 * Import file status enum
 * Tracks the lifecycle of a CSV import operation
 */
export type ImportStatus = 
  | 'uploaded'   // File uploaded to storage
  | 'parsed'     // CSV parsed and validated
  | 'executing'  // Import in progress
  | 'completed'  // Import finished successfully
  | 'failed';    // Import failed with errors

/**
 * User action for handling duplicate planteurs
 */
export type DuplicateAction = 
  | 'pending'  // No decision made yet
  | 'ignore'   // Skip this row
  | 'update'   // Update existing planteur
  | 'create';  // Create new planteur despite duplicate

/**
 * CSV data structure matching expected columns
 * Requirements: 1.4, 2.1-2.5, 7.1
 */
export interface PlanteurCSVData {
  nom: string;
  prénoms?: string;
  CNI?: string;
  téléphone?: string;
  superficie?: number;
}

/**
 * Validation error for a specific field
 * Requirements: 2.6
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Information about a potential duplicate planteur
 * Requirements: 3.2
 */
export interface DuplicateInfo {
  existing_planteur_id: string;
  existing_planteur_name: string;
  existing_planteur_code: string;
  match_type: 'exact' | 'normalized';
}

/**
 * Individual parsed CSV row with validation results
 * Requirements: 1.4, 2.6, 3.2
 */
export interface ParsedRow {
  row_number: number;
  data: PlanteurCSVData;
  validation_errors: ValidationError[];
  duplicate_info: DuplicateInfo | null;
  user_action: DuplicateAction;
}

/**
 * Complete parsing result for a CSV file
 * Requirements: 1.4, 2.6, 3.2
 */
export interface ParseResult {
  rows: ParsedRow[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  errors: ParseError[];
}

/**
 * Parse-level error (file structure issues)
 */
export interface ParseError {
  message: string;
  code: string;
  line?: number;
}

/**
 * Import file record stored in database
 * Requirements: 5.5, 8.6
 */
export interface PlanteurImportFile {
  id: string;
  cooperative_id: string;
  filename: string;
  file_size: number;
  file_path: string;
  import_status: ImportStatus;
  parse_result: ParseResult | null;
  import_summary: ImportSummary | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * User's action decision for a specific row
 * Requirements: 3.4, 3.5, 3.6
 */
export interface RowAction {
  row_number: number;
  action: 'ignore' | 'update' | 'create';
  planteur_id?: string; // Required for 'update' action
}

/**
 * Input for executing an import with user decisions
 * Requirements: 3.4, 3.5, 3.6, 5.1
 */
export interface ExecuteImportInput {
  import_id: string;
  row_actions: RowAction[];
}

/**
 * Error that occurred during import execution
 * Requirements: 5.4, 5.5
 */
export interface ImportError {
  row_number: number;
  error_message: string;
  error_code: string;
}

/**
 * Summary report after import execution
 * Requirements: 5.5
 */
export interface ImportSummary {
  total_processed: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  errors: ImportError[];
}
