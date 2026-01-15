// CocoaTrack V2 - Conflict Detector
// Parses 409 responses from server and manages conflict state in ops_queue
// Requirements: REQ-SYNC-003, REQ-SYNC-007

import type { SyncConflictInfo, SyncFieldConflict } from '@/types';

import { updateQueuedOperation, getQueuedOperation, type QueuedOperation } from './indexed-db';
import { CRITICAL_FIELDS } from './conflict-resolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Server response structure for HTTP 409 Conflict
 * Based on design document: Server Conflict Protocol (HTTP 409)
 */
export interface ConflictResponse {
  error: 'CONFLICT';
  conflict: {
    server_version: number;      // Current row_version on server
    client_version: number;      // row_version client sent
    server_data: Record<string, unknown>;  // Current server state
    server_updated_at: string;   // When server was last modified
    server_updated_by: string;   // Who modified it
    fields_changed: string[];    // Which fields differ
  };
}

// Re-export types from @/types for convenience
export type { SyncConflictInfo as ConflictInfo, SyncFieldConflict as FieldConflict };

/**
 * Result of parsing a 409 response
 */
export interface ParseResult {
  success: boolean;
  conflictInfo?: SyncConflictInfo;
  error?: string;
}

/**
 * Result of storing conflict in ops_queue
 */
export interface StoreResult {
  success: boolean;
  operationId?: string;
  error?: string;
}

// ============================================================================
// CONFLICT DETECTOR CLASS
// ============================================================================

/**
 * ConflictDetector handles parsing 409 responses from the server,
 * storing conflict details in ops_queue, and marking operations as 'needs_review'.
 * 
 * REQ-SYNC-003: Conflict Preview (Diff View)
 * REQ-SYNC-007: Conflict Resolution Strategy
 */
export class ConflictDetector {
  /**
   * Parses a 409 Conflict response from the server
   * 
   * @param response - The HTTP response object
   * @param operation - The operation that caused the conflict
   * @returns ParseResult with conflict info or error
   */
  async parseConflictResponse(
    response: Response,
    operation: QueuedOperation
  ): Promise<ParseResult> {
    // Validate response status
    if (response.status !== 409) {
      return {
        success: false,
        error: `Expected 409 status, got ${response.status}`,
      };
    }

    try {
      const body = await response.json() as ConflictResponse;

      // Validate response structure
      if (!this.isValidConflictResponse(body)) {
        return {
          success: false,
          error: 'Invalid conflict response structure',
        };
      }

      // Build field conflicts with critical field detection
      const fieldsChanged = this.buildFieldConflicts(
        operation.table,
        operation.data,
        body.conflict.server_data,
        body.conflict.fields_changed
      );

      const conflictInfo: SyncConflictInfo = {
        operation_id: operation.id,
        table: operation.table,
        record_id: operation.record_id,
        local_version: operation.row_version,
        server_version: body.conflict.server_version,
        server_updated_at: body.conflict.server_updated_at,
        server_updated_by: body.conflict.server_updated_by,
        fields_changed: fieldsChanged,
        detected_at: new Date().toISOString(),
      };

      return {
        success: true,
        conflictInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse conflict response',
      };
    }
  }

  /**
   * Parses a 409 Conflict response from a JSON body (for cases where response is already parsed)
   * 
   * @param body - The parsed JSON body
   * @param operation - The operation that caused the conflict
   * @returns ParseResult with conflict info or error
   */
  parseConflictFromBody(
    body: unknown,
    operation: QueuedOperation
  ): ParseResult {
    try {
      // Validate response structure
      if (!this.isValidConflictResponse(body)) {
        return {
          success: false,
          error: 'Invalid conflict response structure',
        };
      }

      const conflictBody = body as ConflictResponse;

      // Build field conflicts with critical field detection
      const fieldsChanged = this.buildFieldConflicts(
        operation.table,
        operation.data,
        conflictBody.conflict.server_data,
        conflictBody.conflict.fields_changed
      );

      const conflictInfo: SyncConflictInfo = {
        operation_id: operation.id,
        table: operation.table,
        record_id: operation.record_id,
        local_version: operation.row_version,
        server_version: conflictBody.conflict.server_version,
        server_updated_at: conflictBody.conflict.server_updated_at,
        server_updated_by: conflictBody.conflict.server_updated_by,
        fields_changed: fieldsChanged,
        detected_at: new Date().toISOString(),
      };

      return {
        success: true,
        conflictInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse conflict body',
      };
    }
  }

  /**
   * Stores conflict details in ops_queue and marks operation as 'needs_review'
   * 
   * @param operationId - The ID of the operation to update
   * @param conflictInfo - The conflict information to store
   * @returns StoreResult indicating success or failure
   */
  async storeConflict(
    operationId: string,
    conflictInfo: SyncConflictInfo
  ): Promise<StoreResult> {
    try {
      const operation = await getQueuedOperation(operationId);
      
      if (!operation) {
        return {
          success: false,
          error: `Operation ${operationId} not found in queue`,
        };
      }

      // Update operation with conflict info and mark as needs_review
      const updatedOperation: QueuedOperation = {
        ...operation,
        status: 'needs_review',
        error: `Conflict detected: ${conflictInfo.fields_changed.length} field(s) changed on server`,
        conflict_info: conflictInfo,
      };

      await updateQueuedOperation(updatedOperation);

      return {
        success: true,
        operationId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store conflict',
      };
    }
  }

  /**
   * Handles a 409 conflict response end-to-end:
   * 1. Parses the response
   * 2. Stores conflict details
   * 3. Marks operation as 'needs_review'
   * 
   * @param response - The HTTP response object
   * @param operation - The operation that caused the conflict
   * @returns StoreResult indicating success or failure
   */
  async handleConflictResponse(
    response: Response,
    operation: QueuedOperation
  ): Promise<StoreResult> {
    // Parse the conflict response
    const parseResult = await this.parseConflictResponse(response, operation);
    
    if (!parseResult.success || !parseResult.conflictInfo) {
      return {
        success: false,
        error: parseResult.error || 'Failed to parse conflict response',
      };
    }

    // Store the conflict and mark as needs_review
    return this.storeConflict(operation.id, parseResult.conflictInfo);
  }

  /**
   * Handles a 409 conflict from a pre-parsed body:
   * 1. Parses the body
   * 2. Stores conflict details
   * 3. Marks operation as 'needs_review'
   * 
   * @param body - The parsed JSON body
   * @param operation - The operation that caused the conflict
   * @returns StoreResult indicating success or failure
   */
  async handleConflictBody(
    body: unknown,
    operation: QueuedOperation
  ): Promise<StoreResult> {
    // Parse the conflict body
    const parseResult = this.parseConflictFromBody(body, operation);
    
    if (!parseResult.success || !parseResult.conflictInfo) {
      return {
        success: false,
        error: parseResult.error || 'Failed to parse conflict body',
      };
    }

    // Store the conflict and mark as needs_review
    return this.storeConflict(operation.id, parseResult.conflictInfo);
  }

  /**
   * Checks if a field is critical for a given table
   * Critical fields require user choice for resolution
   * 
   * REQ-SYNC-007: CRITICAL_FIELDS (weight_kg, price_per_kg, planteur_id)
   * 
   * @param table - The table name
   * @param field - The field name
   * @returns true if the field is critical
   */
  isCriticalField(table: string, field: string): boolean {
    const criticalFields = CRITICAL_FIELDS[table] || [];
    return criticalFields.includes(field);
  }

  /**
   * Checks if a conflict has any critical fields
   * 
   * @param conflictInfo - The conflict information
   * @returns true if any field in the conflict is critical
   */
  hasCriticalFields(conflictInfo: SyncConflictInfo): boolean {
    return conflictInfo.fields_changed.some(field => field.is_critical);
  }

  /**
   * Gets only the critical field conflicts from a conflict info
   * 
   * @param conflictInfo - The conflict information
   * @returns Array of critical field conflicts
   */
  getCriticalFieldConflicts(conflictInfo: SyncConflictInfo): SyncFieldConflict[] {
    return conflictInfo.fields_changed.filter(field => field.is_critical);
  }

  /**
   * Gets only the non-critical (mergeable) field conflicts from a conflict info
   * 
   * @param conflictInfo - The conflict information
   * @returns Array of non-critical field conflicts
   */
  getMergeableFieldConflicts(conflictInfo: SyncConflictInfo): SyncFieldConflict[] {
    return conflictInfo.fields_changed.filter(field => !field.is_critical);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Validates that a response body matches the expected ConflictResponse structure
   */
  private isValidConflictResponse(body: unknown): body is ConflictResponse {
    if (!body || typeof body !== 'object') {
      return false;
    }

    const response = body as Record<string, unknown>;

    if (response.error !== 'CONFLICT') {
      return false;
    }

    if (!response.conflict || typeof response.conflict !== 'object') {
      return false;
    }

    const conflict = response.conflict as Record<string, unknown>;

    // Check required fields
    if (typeof conflict.server_version !== 'number') {
      return false;
    }
    if (typeof conflict.client_version !== 'number') {
      return false;
    }
    if (!conflict.server_data || typeof conflict.server_data !== 'object') {
      return false;
    }
    if (typeof conflict.server_updated_at !== 'string') {
      return false;
    }
    if (typeof conflict.server_updated_by !== 'string') {
      return false;
    }
    if (!Array.isArray(conflict.fields_changed)) {
      return false;
    }

    return true;
  }

  /**
   * Builds field conflict details with critical field detection
   */
  private buildFieldConflicts(
    table: string,
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    fieldsChanged: string[]
  ): SyncFieldConflict[] {
    return fieldsChanged.map(field => ({
      field,
      local_value: localData[field],
      server_value: serverData[field],
      is_critical: this.isCriticalField(table, field),
    }));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let conflictDetectorInstance: ConflictDetector | null = null;

/**
 * Gets the singleton ConflictDetector instance
 */
export function getConflictDetector(): ConflictDetector {
  if (!conflictDetectorInstance) {
    conflictDetectorInstance = new ConflictDetector();
  }
  return conflictDetectorInstance;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a response is a 409 Conflict
 */
export function isConflictResponse(response: Response): boolean {
  return response.status === 409;
}

/**
 * Checks if a parsed body represents a conflict
 */
export function isConflictBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }
  return (body as Record<string, unknown>).error === 'CONFLICT';
}
