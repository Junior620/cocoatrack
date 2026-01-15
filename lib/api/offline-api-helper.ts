// CocoaTrack V2 - Offline API Helper
// Provides offline-aware API utilities for Supabase operations
// Requirements: REQ-OFF-006

import { createClient } from '@/lib/supabase/client';
import { getSyncEngine, type AllowedTable, TABLE_PRIORITY_MAP } from '@/lib/offline/sync-engine';
import { isOnline } from '@/lib/offline/offline-fetch';
import { showOfflineQueuedToast } from '@/lib/offline/offline-toast';
import type { SyncOperationType, OperationPriority } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineOperationResult<T> {
  /** The data returned (null if queued offline) */
  data: T | null;
  /** Whether the operation was queued for offline sync */
  wasQueued: boolean;
  /** The queued operation ID (if queued) */
  queuedOperationId?: string;
  /** Error if any */
  error?: Error;
}

export interface OfflineCreateOptions {
  /** User ID for operation ownership */
  userId: string;
  /** Cooperative ID for data isolation */
  cooperativeId: string;
  /** Whether to show toast notification (default: true) */
  showToast?: boolean;
  /** Custom priority (default: based on table) */
  priority?: OperationPriority;
}

// ============================================================================
// OFFLINE-AWARE CREATE OPERATION
// ============================================================================

/**
 * Creates a record with offline support
 * 
 * When online: Creates directly via Supabase
 * When offline: Queues the operation for later sync
 * 
 * @param table - The table to create the record in
 * @param data - The data to insert
 * @param options - Offline operation options
 * @returns Result with data or queued operation info
 */
export async function offlineCreate<T extends Record<string, unknown>>(
  table: AllowedTable,
  data: T,
  options: OfflineCreateOptions
): Promise<OfflineOperationResult<T>> {
  const { userId, cooperativeId, showToast = true, priority } = options;

  // If online, try direct creation
  if (isOnline()) {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase.from(table) as any)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: result as T,
        wasQueued: false,
      };
    } catch (error) {
      // If it's a network error, fall through to offline handling
      if (error instanceof Error && error.message.includes('network')) {
        // Fall through to offline queue
      } else {
        // Re-throw non-network errors
        return {
          data: null,
          wasQueued: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  }

  // Offline: Queue the operation
  const syncEngine = getSyncEngine();
  const recordId = (data.id as string) || syncEngine.generateRecordId();
  
  const queuedOp = await syncEngine.createOperation({
    type: 'CREATE',
    table,
    recordId,
    data: { ...data, id: recordId },
    userId,
    cooperativeId,
    priority: priority || TABLE_PRIORITY_MAP[table] || 'normal',
  });

  // Show toast notification
  if (showToast) {
    showOfflineQueuedToast();
  }

  // Return the data with the generated ID (for optimistic UI)
  return {
    data: { ...data, id: recordId } as T,
    wasQueued: true,
    queuedOperationId: queuedOp.id,
  };
}

/**
 * Updates a record with offline support
 * 
 * When online: Updates directly via Supabase
 * When offline: Queues the operation for later sync
 * 
 * @param table - The table to update the record in
 * @param recordId - The ID of the record to update
 * @param data - The data to update
 * @param options - Offline operation options
 * @returns Result with data or queued operation info
 */
export async function offlineUpdate<T extends Record<string, unknown>>(
  table: AllowedTable,
  recordId: string,
  data: T,
  options: OfflineCreateOptions & { baseSnapshot?: Record<string, unknown> }
): Promise<OfflineOperationResult<T>> {
  const { userId, cooperativeId, showToast = true, priority, baseSnapshot } = options;

  // If online, try direct update
  if (isOnline()) {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase.from(table) as any)
        .update(data)
        .eq('id', recordId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: result as T,
        wasQueued: false,
      };
    } catch (error) {
      // If it's a network error, fall through to offline handling
      if (error instanceof Error && error.message.includes('network')) {
        // Fall through to offline queue
      } else {
        // Re-throw non-network errors
        return {
          data: null,
          wasQueued: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  }

  // Offline: Queue the operation
  const syncEngine = getSyncEngine();
  
  const queuedOp = await syncEngine.createOperation({
    type: 'UPDATE',
    table,
    recordId,
    data,
    userId,
    cooperativeId,
    priority: priority || TABLE_PRIORITY_MAP[table] || 'normal',
    baseSnapshot: baseSnapshot || null,
  });

  // Show toast notification
  if (showToast) {
    showOfflineQueuedToast();
  }

  // Return the merged data (for optimistic UI)
  return {
    data: { ...baseSnapshot, ...data, id: recordId } as T,
    wasQueued: true,
    queuedOperationId: queuedOp.id,
  };
}

/**
 * Deletes a record with offline support
 * 
 * When online: Deletes directly via Supabase
 * When offline: Queues the operation for later sync
 * 
 * @param table - The table to delete the record from
 * @param recordId - The ID of the record to delete
 * @param options - Offline operation options
 * @returns Result indicating success or queued status
 */
export async function offlineDelete(
  table: AllowedTable,
  recordId: string,
  options: OfflineCreateOptions
): Promise<OfflineOperationResult<{ id: string }>> {
  const { userId, cooperativeId, showToast = true, priority } = options;

  // If online, try direct delete
  if (isOnline()) {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any)
        .delete()
        .eq('id', recordId);

      if (error) {
        throw new Error(error.message);
      }

      return {
        data: { id: recordId },
        wasQueued: false,
      };
    } catch (error) {
      // If it's a network error, fall through to offline handling
      if (error instanceof Error && error.message.includes('network')) {
        // Fall through to offline queue
      } else {
        // Re-throw non-network errors
        return {
          data: null,
          wasQueued: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  }

  // Offline: Queue the operation
  const syncEngine = getSyncEngine();
  
  const queuedOp = await syncEngine.createOperation({
    type: 'DELETE',
    table,
    recordId,
    data: { id: recordId },
    userId,
    cooperativeId,
    priority: priority || TABLE_PRIORITY_MAP[table] || 'normal',
  });

  // Show toast notification
  if (showToast) {
    showOfflineQueuedToast();
  }

  return {
    data: { id: recordId },
    wasQueued: true,
    queuedOperationId: queuedOp.id,
  };
}

// ============================================================================
// HELPER TO CHECK OFFLINE STATUS
// ============================================================================

/**
 * Re-export isOnline for convenience
 */
export { isOnline };
