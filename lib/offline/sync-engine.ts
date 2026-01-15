// CocoaTrack V2 - Sync Engine
// Handles offline operation synchronization with exponential backoff
// Requirements: 8.3, 8.6, REQ-SYNC-006, REQ-SYNC-008, REQ-SEC-003

import { v4 as uuidv4 } from 'uuid';

import { createClient } from '@/lib/supabase/client';
import type { SyncOperationType, OperationPriority } from '@/types';

import {
  enqueueOperation,
  getQueuedOperation,
  getPendingOperations,
  getRetryableOperations,
  updateQueuedOperation,
  dequeueOperation,
  getPendingOperationsCount,
  getConflictOperations,
  getOperationByIdempotencyKey,
  getOperationsByUserId,
  markUserOperationsPendingAuth,
  restoreUserOperations,
  getAllQueuedOperations,
  type QueuedOperation,
} from './indexed-db';
import { detectConflict } from './conflict-resolver';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum number of retry attempts before marking as failed
 */
export const MAX_RETRIES = 5;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
export const BASE_RETRY_DELAY = 1000;

/**
 * Maximum delay between retries (in milliseconds)
 */
export const MAX_RETRY_DELAY = 60000;

/**
 * Maximum batch size for sync operations
 * REQ-SYNC-006: Limit batch size to 20 operations
 */
export const MAX_BATCH_SIZE = 20;

/**
 * Minimum battery level for retry (percentage)
 * REQ-SYNC-008: Skip retry if battery < 15%
 */
export const MIN_BATTERY_FOR_RETRY = 15;

/**
 * Priority order for sync operations
 * REQ-SYNC-006: Priority queue ordering
 */
export const PRIORITY_ORDER: OperationPriority[] = ['critical', 'high', 'normal', 'low'];

/**
 * Tables allowed for sync operations
 */
export const ALLOWED_TABLES = ['deliveries', 'planteurs', 'chef_planteurs'] as const;
export type AllowedTable = (typeof ALLOWED_TABLES)[number];

/**
 * Table to priority mapping for automatic priority assignment
 * REQ-SYNC-006: Prioritize operations
 */
export const TABLE_PRIORITY_MAP: Record<AllowedTable, OperationPriority> = {
  deliveries: 'critical',
  planteurs: 'high',
  chef_planteurs: 'high',
};

/**
 * HTTP error codes that should not be retried (client errors)
 * REQ-SYNC-008: Skip retry on 4xx errors
 */
export const NON_RETRYABLE_ERROR_CODES = [400, 401, 403, 404, 409, 422];

// ============================================================================
// BATTERY UTILITY
// ============================================================================

/**
 * Gets the current battery level (0-100)
 * Returns 100 if Battery API is not available
 * REQ-SYNC-008: Skip retry if battery < 15%
 */
export async function getBatteryLevel(): Promise<number> {
  if (!('getBattery' in navigator)) {
    return 100; // Assume full if not supported
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battery = await (navigator as any).getBattery();
    return Math.round(battery.level * 100);
  } catch {
    return 100; // Assume full on error
  }
}

/**
 * Calculates retry delay with exponential backoff and jitter
 * REQ-SYNC-008: Exponential backoff: min(1000 * 2^n, 60000) ms with 10% jitter
 * 
 * @param retryCount - Number of previous retry attempts
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(retryCount: number): number {
  // Base delay with exponential backoff, capped at MAX_RETRY_DELAY
  const baseDelay = Math.min(
    BASE_RETRY_DELAY * Math.pow(2, retryCount),
    MAX_RETRY_DELAY
  );
  
  // Add ±10% jitter to prevent thundering herd
  const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
  
  return Math.round(baseDelay + jitter);
}

/**
 * Determines if an error code is retryable
 * REQ-SYNC-008: Skip retry on 4xx errors
 * 
 * @param errorCode - HTTP status code or error code string
 * @returns true if the error should be retried
 */
export function isRetryableError(errorCode: string | number): boolean {
  // Convert string error codes to numbers if possible
  const code = typeof errorCode === 'string' ? parseInt(errorCode, 10) : errorCode;
  
  // 4xx errors are not retryable (client errors)
  if (!isNaN(code) && code >= 400 && code < 500) {
    return false;
  }
  
  // Check specific non-retryable codes
  if (!isNaN(code) && NON_RETRYABLE_ERROR_CODES.includes(code)) {
    return false;
  }
  
  // Network errors and 5xx errors are retryable
  return true;
}

// ============================================================================
// SYNC RESULT TYPES
// ============================================================================

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: SyncError[];
}

export interface SyncError {
  operationId: string;
  code: string;
  message: string;
}

export interface OperationResult {
  status: 'success' | 'error' | 'conflict' | 'already_processed';
  code?: string;
  message?: string;
  result?: Record<string, unknown>;
}

// ============================================================================
// SYNC ENGINE CLASS
// ============================================================================

export class SyncEngine {
  private isRunning = false;
  private supabase = createClient();

  /**
   * Generates a new UUID for client-side record creation
   */
  generateRecordId(): string {
    return uuidv4();
  }

  /**
   * Generates an idempotency key using SHA-256
   * REQ-SYNC-006: Idempotency key prevents duplicate operations during retry
   * 
   * @param params - Operation identity parameters
   * @returns SHA-256 hash as hex string
   */
  async generateIdempotencyKey(params: {
    user_id: string;
    table: string;
    type: SyncOperationType;
    client_id: string;
    created_at: string;
  }): Promise<string> {
    const payload = `${params.user_id}:${params.table}:${params.type}:${params.client_id}:${params.created_at}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Creates and queues a new sync operation
   * REQ-SYNC-006: Integrates idempotency key generation
   */
  async createOperation(params: {
    type: SyncOperationType;
    table: AllowedTable;
    recordId: string;
    data: Record<string, unknown>;
    userId: string;
    cooperativeId: string;
    baseSnapshot?: Record<string, unknown> | null;
    baseUpdatedAt?: string | null;
    rowVersion?: number | null;
    priority?: OperationPriority;
  }): Promise<QueuedOperation> {
    const now = new Date().toISOString();
    const clientId = params.recordId; // Use recordId as client_id for new records

    // Generate idempotency key using SHA-256
    const idempotencyKey = await this.generateIdempotencyKey({
      user_id: params.userId,
      table: params.table,
      type: params.type,
      client_id: clientId,
      created_at: now,
    });

    // Check if operation with same idempotency key already exists
    const existingOp = await getOperationByIdempotencyKey(idempotencyKey);
    if (existingOp) {
      console.warn(`Operation with idempotency key ${idempotencyKey} already exists`);
      return existingOp;
    }

    // Determine priority based on table if not provided
    const priority = params.priority || TABLE_PRIORITY_MAP[params.table] || 'normal';

    const operation: QueuedOperation = {
      id: uuidv4(),
      idempotency_key: idempotencyKey,
      type: params.type,
      table: params.table,
      record_id: params.recordId,
      client_id: clientId,
      server_id: null,
      user_id: params.userId,
      cooperative_id: params.cooperativeId,
      data: params.data,
      base_snapshot: params.baseSnapshot || null,
      base_updated_at: params.baseUpdatedAt || null,
      row_version: params.rowVersion || null,
      priority,
      created_at: now,
      status: 'pending',
      retry_count: 0,
      queued_at: now,
      last_attempt_at: null,
      next_retry_at: null,
    };

    await enqueueOperation(operation);
    return operation;
  }

  /**
   * Gets the count of pending operations
   */
  async getPendingCount(): Promise<number> {
    return getPendingOperationsCount();
  }

  /**
   * Gets all operations that need manual review
   */
  async getConflicts(): Promise<QueuedOperation[]> {
    return getConflictOperations();
  }

  /**
   * Gets pending operations ordered by priority and FIFO
   * REQ-SYNC-006: Priority queue ordering
   * 
   * Order: critical > high > normal > low
   * Within same priority: FIFO by created_at
   * 
   * @param limit - Maximum number of operations to return (default: MAX_BATCH_SIZE)
   * @returns Operations sorted by priority then created_at
   */
  async getPriorityQueue(limit: number = MAX_BATCH_SIZE): Promise<QueuedOperation[]> {
    // Get all pending operations
    const pendingOps = await getPendingOperations();
    
    // Also get retryable failed operations
    const retryableOps = await getRetryableOperations();
    
    // Combine all operations
    const allOps = [...pendingOps, ...retryableOps];
    
    // Sort by priority (critical > high > normal > low) then by created_at (FIFO)
    const sorted = allOps.sort((a, b) => {
      // First compare by priority
      const priorityA = PRIORITY_ORDER.indexOf(a.priority);
      const priorityB = PRIORITY_ORDER.indexOf(b.priority);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower index = higher priority
      }
      
      // Same priority: FIFO by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    // Limit batch size to MAX_BATCH_SIZE (20)
    return sorted.slice(0, limit);
  }

  /**
   * Gets the count of error operations
   */
  async getErrorCount(): Promise<number> {
    const conflicts = await getConflictOperations();
    return conflicts.length;
  }

  /**
   * Checks if sync is currently running
   */
  isSyncing(): boolean {
    return this.isRunning;
  }

  /**
   * Runs the sync process
   * Processes pending operations in priority order (critical > high > normal > low)
   * Within same priority: FIFO by created_at
   * REQ-SYNC-006: Priority queue ordering
   */
  async sync(): Promise<SyncResult> {
    if (this.isRunning) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [
          {
            operationId: '',
            code: 'SYNC_IN_PROGRESS',
            message: 'Sync is already running',
          },
        ],
      };
    }

    this.isRunning = true;
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Get operations in priority order (limited to MAX_BATCH_SIZE)
      const allOps = await this.getPriorityQueue(MAX_BATCH_SIZE);

      for (const op of allOps) {
        const opResult = await this.processOperation(op);

        switch (opResult.status) {
          case 'success':
          case 'already_processed':
            result.synced++;
            await dequeueOperation(op.id);
            break;

          case 'conflict':
            result.conflicts++;
            await this.markAsNeedsReview(op, opResult.message || 'Conflict detected');
            break;

          case 'error':
            if (op.retry_count >= MAX_RETRIES) {
              result.failed++;
              await this.markAsFailed(op, opResult.message || 'Max retries exceeded');
              result.errors.push({
                operationId: op.id,
                code: opResult.code || 'UNKNOWN_ERROR',
                message: opResult.message || 'Unknown error',
              });
            } else {
              // Pass error code to scheduleRetry for intelligent retry decision
              const retryScheduled = await this.scheduleRetry(op, opResult.code);
              if (!retryScheduled) {
                // Non-retryable error or low battery
                result.failed++;
                result.errors.push({
                  operationId: op.id,
                  code: opResult.code || 'NON_RETRYABLE',
                  message: opResult.message || 'Non-retryable error',
                });
              }
            }
            break;
        }
      }

      result.success = result.failed === 0 && result.conflicts === 0;
    } catch (error) {
      result.success = false;
      result.errors.push({
        operationId: '',
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown sync error',
      });
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Processes a single operation
   */
  private async processOperation(op: QueuedOperation): Promise<OperationResult> {
    // Update last attempt time
    op.last_attempt_at = new Date().toISOString();
    op.status = 'syncing';
    await updateQueuedOperation(op);

    try {
      // For UPDATE operations, check for conflicts first
      if (op.type === 'UPDATE' && op.base_snapshot) {
        const conflictResult = await this.checkForConflict(op);
        if (conflictResult.hasConflict) {
          return {
            status: 'conflict',
            code: 'CONFLICT',
            message: conflictResult.message,
          };
        }
      }

      // Call the sync_operation RPC
      // Note: Using type assertion because sync_operation is defined in migrations
      // but not yet in generated Supabase types
      const { data, error } = await (this.supabase.rpc as Function)('sync_operation', {
        p_idempotency_key: op.idempotency_key,
        p_table: op.table,
        p_operation: op.type,
        p_record_id: op.record_id,
        p_data: op.data,
      });

      if (error) {
        return {
          status: 'error',
          code: 'RPC_ERROR',
          message: error.message,
        };
      }

      const result = data as { status: string; code?: string; message?: string };

      if (result.status === 'success' || result.status === 'already_processed') {
        return {
          status: result.status === 'success' ? 'success' : 'already_processed',
          result: result,
        };
      }

      // Handle specific error codes
      if (result.code === 'FORBIDDEN') {
        return {
          status: 'error',
          code: 'FORBIDDEN',
          message: result.message || 'Access denied',
        };
      }

      return {
        status: 'error',
        code: result.code || 'UNKNOWN',
        message: result.message || 'Unknown error from server',
      };
    } catch (error) {
      return {
        status: 'error',
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Checks for conflicts before applying an UPDATE operation
   */
  private async checkForConflict(
    op: QueuedOperation
  ): Promise<{ hasConflict: boolean; message?: string }> {
    if (!op.base_snapshot) {
      return { hasConflict: false };
    }

    try {
      // Fetch current state from server
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentRecord, error } = await this.supabase
        .from(op.table as any)
        .select('*')
        .eq('id', op.record_id)
        .single();

      if (error) {
        // Record might have been deleted
        if (error.code === 'PGRST116') {
          return {
            hasConflict: true,
            message: 'Record has been deleted on the server',
          };
        }
        // Other errors - proceed with sync
        return { hasConflict: false };
      }

      // Detect conflict type
      const conflictType = detectConflict(op, currentRecord);

      if (conflictType === 'critical') {
        return {
          hasConflict: true,
          message: 'Critical field conflict detected',
        };
      }

      // Non-critical conflicts use LWW (last-write-wins)
      return { hasConflict: false };
    } catch {
      // On error, proceed with sync
      return { hasConflict: false };
    }
  }

  /**
   * Schedules a retry with exponential backoff
   * REQ-SYNC-008: Intelligent retry strategy
   * - Exponential backoff: min(1000 * 2^n, 60000) ms with 10% jitter
   * - Skip retry on 4xx errors
   * - Skip retry if battery < 15%
   * 
   * @param op - The operation to retry
   * @param errorCode - Optional error code to check if retryable
   * @returns true if retry was scheduled, false if skipped
   */
  private async scheduleRetry(op: QueuedOperation, errorCode?: string | number): Promise<boolean> {
    // Check if error is retryable (skip 4xx errors)
    if (errorCode !== undefined && !isRetryableError(errorCode)) {
      console.log(`[SyncEngine] Skipping retry for non-retryable error: ${errorCode}`);
      await this.markAsFailed(op, `Non-retryable error: ${errorCode}`);
      return false;
    }
    
    // Check battery level (skip if < 15%)
    const batteryLevel = await getBatteryLevel();
    if (batteryLevel < MIN_BATTERY_FOR_RETRY) {
      console.log(`[SyncEngine] Skipping retry due to low battery: ${batteryLevel}%`);
      // Don't mark as failed, just don't schedule retry yet
      op.status = 'failed';
      op.error = `Retry paused: low battery (${batteryLevel}%)`;
      op.next_retry_at = null; // Will be retried when battery is sufficient
      await updateQueuedOperation(op);
      return false;
    }
    
    op.retry_count++;
    op.status = 'failed';

    // Calculate delay with exponential backoff and jitter
    const delay = calculateRetryDelay(op.retry_count - 1);
    op.next_retry_at = new Date(Date.now() + delay).toISOString();

    await updateQueuedOperation(op);
    console.log(`[SyncEngine] Scheduled retry #${op.retry_count} in ${delay}ms`);
    return true;
  }

  /**
   * Marks an operation as failed (no more retries)
   */
  private async markAsFailed(op: QueuedOperation, error: string): Promise<void> {
    op.status = 'failed';
    op.error = error;
    op.next_retry_at = null;
    await updateQueuedOperation(op);
  }

  /**
   * Marks an operation as needing manual review
   */
  private async markAsNeedsReview(
    op: QueuedOperation,
    reason: string
  ): Promise<void> {
    op.status = 'needs_review';
    op.error = reason;
    op.next_retry_at = null;
    await updateQueuedOperation(op);
  }

  /**
   * Resolves a conflict by choosing local or remote version
   */
  async resolveConflict(
    operationId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: Record<string, unknown>
  ): Promise<boolean> {
    const op = await getQueuedOperation(operationId);
    if (!op || op.status !== 'needs_review') {
      return false;
    }

    switch (resolution) {
      case 'local':
        // Force local changes - clear base snapshot to skip conflict check
        op.base_snapshot = null;
        op.status = 'pending';
        op.error = undefined;
        await updateQueuedOperation(op);
        break;

      case 'remote':
        // Discard local changes
        await dequeueOperation(operationId);
        break;

      case 'merge':
        if (!mergedData) {
          return false;
        }
        // Apply merged data
        op.data = mergedData;
        op.base_snapshot = null;
        op.status = 'pending';
        op.error = undefined;
        await updateQueuedOperation(op);
        break;
    }

    return true;
  }

  /**
   * Retries a failed operation immediately
   */
  async retryOperation(operationId: string): Promise<boolean> {
    const op = await getQueuedOperation(operationId);
    if (!op || op.status !== 'failed') {
      return false;
    }

    op.status = 'pending';
    op.next_retry_at = null;
    await updateQueuedOperation(op);
    return true;
  }

  /**
   * Cancels a pending or failed operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const op = await getQueuedOperation(operationId);
    if (!op) {
      return false;
    }

    await dequeueOperation(operationId);
    return true;
  }

  // ============================================================================
  // CROSS-USER SAFETY METHODS
  // REQ-SEC-003: Cross-user isolation and logout data cleanup
  // ============================================================================

  /**
   * Validates that all operations in the queue belong to the specified user
   * REQ-SEC-003: Cross-user isolation
   * 
   * @param userId - The user ID to validate against
   * @returns Validation result with orphan count
   */
  async validateUserOwnership(userId: string): Promise<{ valid: boolean; orphanCount: number }> {
    const allOps = await getAllQueuedOperations();
    const orphanOps = allOps.filter(op => op.user_id !== userId && op.status !== 'pending_auth');
    
    return {
      valid: orphanOps.length === 0,
      orphanCount: orphanOps.length,
    };
  }

  /**
   * Handles user switch scenarios
   * REQ-SEC-003: Wipe/block/continue logic on user switch
   * 
   * @param newUserId - The new user ID logging in
   * @returns Action taken: 'wipe' | 'block' | 'continue'
   */
  async handleUserSwitch(newUserId: string): Promise<'wipe' | 'block' | 'continue'> {
    const allOps = await getAllQueuedOperations();
    
    // Check for pending_auth operations from a different user
    const pendingAuthOps = allOps.filter(op => op.status === 'pending_auth');
    
    if (pendingAuthOps.length === 0) {
      // No pending operations, safe to continue
      return 'continue';
    }
    
    // Check if pending_auth operations belong to the new user
    const sameUserOps = pendingAuthOps.filter(op => op.user_id === newUserId);
    const differentUserOps = pendingAuthOps.filter(op => op.user_id !== newUserId);
    
    if (differentUserOps.length > 0) {
      // There are operations from a different user - block login
      // User must sync those operations first or explicitly wipe them
      console.warn(`[SyncEngine] Blocking login: ${differentUserOps.length} operations from different user`);
      return 'block';
    }
    
    if (sameUserOps.length > 0) {
      // Restore operations for the same user
      const restoredCount = await restoreUserOperations(newUserId);
      console.log(`[SyncEngine] Restored ${restoredCount} operations for user ${newUserId}`);
      return 'continue';
    }
    
    return 'continue';
  }

  /**
   * Handles logout by marking operations as pending_auth
   * REQ-SEC-003: Mark ops_queue as 'pending_auth' on logout
   * 
   * @param userId - The user ID logging out
   * @returns Number of operations marked as pending_auth
   */
  async handleLogout(userId: string): Promise<number> {
    const markedCount = await markUserOperationsPendingAuth(userId);
    console.log(`[SyncEngine] Marked ${markedCount} operations as pending_auth for user ${userId}`);
    return markedCount;
  }

  /**
   * Gets operations for a specific user
   * REQ-SEC-003: Cross-user isolation
   * 
   * @param userId - The user ID to filter by
   * @returns Operations belonging to the user
   */
  async getOperationsForUser(userId: string): Promise<QueuedOperation[]> {
    return getOperationsByUserId(userId);
  }

  /**
   * Checks if there are pending operations from a different user
   * REQ-SEC-003: Cross-user data leakage prevention
   * 
   * @param currentUserId - The current user ID
   * @returns true if there are operations from a different user
   */
  async hasOrphanedOperations(currentUserId: string): Promise<boolean> {
    const allOps = await getAllQueuedOperations();
    return allOps.some(op => 
      op.user_id !== currentUserId && 
      (op.status === 'pending' || op.status === 'failed' || op.status === 'pending_auth')
    );
  }

  /**
   * Forces wipe of all operations (use with caution)
   * Should only be called after user confirmation
   * 
   * @returns Number of operations wiped
   */
  async forceWipeAllOperations(): Promise<number> {
    const allOps = await getAllQueuedOperations();
    const count = allOps.length;
    
    for (const op of allOps) {
      await dequeueOperation(op.id);
    }
    
    console.warn(`[SyncEngine] Force wiped ${count} operations`);
    return count;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let syncEngineInstance: SyncEngine | null = null;

/**
 * Gets the singleton sync engine instance
 */
export function getSyncEngine(): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine();
  }
  return syncEngineInstance;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a delivery operation for offline sync
 */
export async function createOfflineDelivery(data: {
  planteur_id: string;
  chef_planteur_id: string;
  warehouse_id: string;
  weight_kg: number;
  price_per_kg: number;
  quality_grade: 'A' | 'B' | 'C';
  notes?: string;
  delivered_at?: string;
}, userId: string, cooperativeId: string): Promise<QueuedOperation> {
  const engine = getSyncEngine();
  const recordId = engine.generateRecordId();

  return engine.createOperation({
    type: 'CREATE',
    table: 'deliveries',
    recordId,
    data: {
      ...data,
      id: recordId,
      delivered_at: data.delivered_at || new Date().toISOString(),
    },
    userId,
    cooperativeId,
    priority: 'critical',
  });
}

/**
 * Updates a delivery operation for offline sync
 */
export async function updateOfflineDelivery(
  recordId: string,
  data: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
  userId: string,
  cooperativeId: string,
  rowVersion?: number
): Promise<QueuedOperation> {
  const engine = getSyncEngine();

  return engine.createOperation({
    type: 'UPDATE',
    table: 'deliveries',
    recordId,
    data,
    baseSnapshot,
    baseUpdatedAt: baseSnapshot.updated_at as string,
    userId,
    cooperativeId,
    rowVersion: rowVersion || null,
    priority: 'critical',
  });
}

/**
 * Creates a planteur operation for offline sync
 */
export async function createOfflinePlanteur(data: {
  name: string;
  code: string;
  chef_planteur_id: string;
  phone?: string;
  cni?: string;
  latitude?: number;
  longitude?: number;
}, userId: string, cooperativeId: string): Promise<QueuedOperation> {
  const engine = getSyncEngine();
  const recordId = engine.generateRecordId();

  return engine.createOperation({
    type: 'CREATE',
    table: 'planteurs',
    recordId,
    data: {
      ...data,
      id: recordId,
    },
    userId,
    cooperativeId,
    priority: 'high',
  });
}

/**
 * Creates a chef_planteur operation for offline sync
 */
export async function createOfflineChefPlanteur(data: {
  name: string;
  code: string;
  cooperative_id: string;
  quantite_max_kg: number;
  phone?: string;
  cni?: string;
  region?: string;
  departement?: string;
  localite?: string;
  latitude?: number;
  longitude?: number;
}, userId: string, cooperativeId: string): Promise<QueuedOperation> {
  const engine = getSyncEngine();
  const recordId = engine.generateRecordId();

  return engine.createOperation({
    type: 'CREATE',
    table: 'chef_planteurs',
    recordId,
    data: {
      ...data,
      id: recordId,
      validation_status: 'pending',
    },
    userId,
    cooperativeId,
    priority: 'high',
  });
}
