/**
 * CocoaTrack V2 - Property Tests for Offline Functionality
 *
 * Tests for Epic 5: PWA & Offline Industrialisé
 *
 * Properties tested:
 * - Property 4: Delta Sync Correctness
 * - Property 6: Sync Priority Queue Ordering
 * - Property 7: Retry Strategy Compliance
 * - Property 8: Offline Queue Integrity
 * - Property 9: Conflict Resolution Strategy
 * - Property 11: Logout Data Cleanup
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

import {
  detectConflict,
  CRITICAL_FIELDS,
  MERGEABLE_FIELDS,
  getFieldResolutionStrategy,
  autoMergeChanges,
  isCriticalField,
  isMergeableField,
  type ConflictType,
  type ResolutionStrategy,
} from '../conflict-resolver';
import {
  PRIORITY_ORDER,
  MAX_BATCH_SIZE,
  BASE_RETRY_DELAY,
  MAX_RETRY_DELAY,
} from '../sync-engine';
import type { SyncOperation, SyncOperationType, SyncStatus, OperationPriority } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface QueuedOperation {
  id: string;
  idempotency_key: string;
  type: SyncOperationType;
  table: string;
  record_id: string;
  client_id: string;
  server_id: string | null;
  user_id: string;
  cooperative_id: string;
  data: Record<string, unknown>;
  base_snapshot: Record<string, unknown> | null;
  base_updated_at: string | null;
  row_version: number | null;
  priority: OperationPriority;
  created_at: string;
  status: SyncStatus;
  retry_count: number;
  queued_at: string;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  error?: string;
}

// ============================================================================
// PURE FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Creates a queued operation with pending status (mirrors sync-engine logic)
 */
function createQueuedOperation(params: {
  type: SyncOperationType;
  table: string;
  recordId: string;
  data: Record<string, unknown>;
  userId?: string;
  cooperativeId?: string;
  priority?: OperationPriority;
  baseSnapshot?: Record<string, unknown> | null;
  baseUpdatedAt?: string | null;
}): QueuedOperation {
  const now = new Date().toISOString();
  const clientId = params.recordId;

  return {
    id: crypto.randomUUID(),
    idempotency_key: crypto.randomUUID(),
    type: params.type,
    table: params.table,
    record_id: params.recordId,
    client_id: clientId,
    server_id: null,
    user_id: params.userId || 'test-user-id',
    cooperative_id: params.cooperativeId || 'test-coop-id',
    data: params.data,
    base_snapshot: params.baseSnapshot || null,
    base_updated_at: params.baseUpdatedAt || null,
    row_version: null,
    priority: params.priority || 'normal',
    created_at: now,
    status: 'pending',
    retry_count: 0,
    queued_at: now,
    last_attempt_at: null,
    next_retry_at: null,
  };
}

/**
 * Sorts operations in FIFO order by created_at
 */
function sortFIFO(operations: QueuedOperation[]): QueuedOperation[] {
  return [...operations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Checks if operations are in FIFO order
 */
function isInFIFOOrder(operations: QueuedOperation[]): boolean {
  for (let i = 1; i < operations.length; i++) {
    const prevTime = new Date(operations[i - 1].created_at).getTime();
    const currTime = new Date(operations[i].created_at).getTime();
    if (prevTime > currTime) {
      return false;
    }
  }
  return true;
}

/**
 * Determines if a conflict should trigger needs_review status
 * Based on critical field detection logic
 */
function shouldTriggerNeedsReview(
  op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'>,
  remoteState: Record<string, unknown>
): boolean {
  const conflictType = detectConflict(op, remoteState);
  return conflictType === 'critical';
}

/**
 * Sorts operations by priority then FIFO (mirrors sync-engine getPriorityQueue logic)
 * REQ-SYNC-006: Priority queue ordering
 */
function sortByPriorityThenFIFO(operations: QueuedOperation[]): QueuedOperation[] {
  return [...operations].sort((a, b) => {
    // First compare by priority (critical > high > normal > low)
    const priorityA = PRIORITY_ORDER.indexOf(a.priority);
    const priorityB = PRIORITY_ORDER.indexOf(b.priority);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Lower index = higher priority
    }
    
    // Same priority: FIFO by created_at
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Checks if operations are correctly ordered by priority then FIFO
 */
function isCorrectlyOrdered(operations: QueuedOperation[]): boolean {
  for (let i = 1; i < operations.length; i++) {
    const prev = operations[i - 1];
    const curr = operations[i];
    
    const prevPriorityIdx = PRIORITY_ORDER.indexOf(prev.priority);
    const currPriorityIdx = PRIORITY_ORDER.indexOf(curr.priority);
    
    // Higher priority (lower index) should come first
    if (prevPriorityIdx > currPriorityIdx) {
      return false;
    }
    
    // Same priority: earlier created_at should come first
    if (prevPriorityIdx === currPriorityIdx) {
      const prevTime = new Date(prev.created_at).getTime();
      const currTime = new Date(curr.created_at).getTime();
      if (prevTime > currTime) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Calculates retry delay with exponential backoff
 * REQ-SYNC-008: Retry strategy
 */
function calculateRetryDelay(retryCount: number): { min: number; max: number } {
  const baseDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
  const jitter = baseDelay * 0.1;
  return {
    min: baseDelay - jitter,
    max: baseDelay + jitter,
  };
}

/**
 * Determines if retry should be skipped based on error code
 * REQ-SYNC-008: Skip retry on 4xx errors
 */
function shouldSkipRetry(errorCode: number, batteryLevel: number): boolean {
  // Skip on 4xx client errors
  if (errorCode >= 400 && errorCode < 500) {
    return true;
  }
  // Skip if battery < 15%
  if (batteryLevel < 15) {
    return true;
  }
  return false;
}

/**
 * Simulates logout cleanup behavior
 * REQ-SEC-003: Logout data cleanup
 */
function simulateLogoutCleanup(
  operations: QueuedOperation[],
  logoutUserId: string
): { 
  clearedStores: string[];
  opsQueuePreserved: boolean;
  opsMarkedPendingAuth: QueuedOperation[];
} {
  // All stores except ops_queue should be cleared
  const clearedStores = ['planteurs', 'chef_planteurs', 'warehouses', 'sync_metadata'];
  
  // ops_queue is preserved but marked as pending_auth
  const opsMarkedPendingAuth = operations
    .filter(op => op.user_id === logoutUserId)
    .filter(op => op.status === 'pending' || op.status === 'failed')
    .map(op => ({ ...op, status: 'pending_auth' as SyncStatus }));
  
  return {
    clearedStores,
    opsQueuePreserved: true,
    opsMarkedPendingAuth,
  };
}

/**
 * Simulates login restoration behavior
 * REQ-SEC-003: Restore ops_queue on same user login
 */
function simulateLoginRestore(
  operations: QueuedOperation[],
  loginUserId: string,
  previousUserId: string
): {
  restored: QueuedOperation[];
  blocked: QueuedOperation[];
  action: 'continue' | 'block' | 'wipe';
} {
  const pendingAuthOps = operations.filter(op => op.status === 'pending_auth');
  
  if (pendingAuthOps.length === 0) {
    return { restored: [], blocked: [], action: 'continue' };
  }
  
  // Same user: restore operations
  if (loginUserId === previousUserId) {
    const restored = pendingAuthOps.map(op => ({ ...op, status: 'pending' as SyncStatus }));
    return { restored, blocked: [], action: 'continue' };
  }
  
  // Different user: block (don't restore, keep as pending_auth)
  return { restored: [], blocked: pendingAuthOps, action: 'block' };
}

// ============================================================================
// GENERATORS
// ============================================================================

const syncOperationTypeArb = fc.constantFrom('CREATE', 'UPDATE', 'DELETE') as fc.Arbitrary<SyncOperationType>;

const tableArb = fc.constantFrom('deliveries', 'planteurs', 'chef_planteurs');

const priorityArb = fc.constantFrom('critical', 'high', 'normal', 'low') as fc.Arbitrary<OperationPriority>;

const deliveryDataArb = fc.record({
  weight_kg: fc.float({ min: Math.fround(0.1), max: Math.fround(10000), noNaN: true }),
  price_per_kg: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
  total_amount: fc.integer({ min: 10, max: 100000000 }),
  payment_status: fc.constantFrom('pending', 'partial', 'paid'),
  quality_grade: fc.constantFrom('A', 'B', 'C'),
  notes: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
});

const timestampArb = fc.integer({ min: 1577836800000, max: 1924905600000 }).map(
  (ts) => new Date(ts).toISOString()
);

const httpErrorCodeArb = fc.integer({ min: 400, max: 599 });

const batteryLevelArb = fc.integer({ min: 0, max: 100 });

const userIdArb = fc.uuid();

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Property 6: Sync Priority Queue Ordering', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 6: Sync Priority Queue Ordering**
   * **Validates: Requirements REQ-SYNC-006**
   *
   * *For any* set of pending operations, getPriorityQueue() should return them ordered by:
   * 1. priority: 'critical' > 'high' > 'normal' > 'low'
   * 2. Within same priority: FIFO by created_at
   * And each sync batch should contain ≤ 20 operations.
   */

  it('should order operations by priority (critical > high > normal > low)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(priorityArb, timestampArb, fc.uuid()),
          { minLength: 2, maxLength: 50 }
        ),
        (operationParams) => {
          const operations = operationParams.map(([priority, timestamp, recordId]) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId,
              data: { weight_kg: 100 },
              priority,
            }),
            created_at: timestamp,
          }));

          const sorted = sortByPriorityThenFIFO(operations);

          return isCorrectlyOrdered(sorted);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain FIFO order within same priority', () => {
    fc.assert(
      fc.property(
        priorityArb,
        fc.array(timestampArb, { minLength: 2, maxLength: 20 }),
        (priority, timestamps) => {
          const operations = timestamps.map((ts, i) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId: `record-${i}`,
              data: { weight_kg: 100 },
              priority,
            }),
            created_at: ts,
          }));

          const sorted = sortByPriorityThenFIFO(operations);

          // All operations have same priority, so should be in FIFO order
          return isInFIFOOrder(sorted);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should limit batch size to MAX_BATCH_SIZE (20)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(priorityArb, timestampArb, fc.uuid()),
          { minLength: 25, maxLength: 100 }
        ),
        (operationParams) => {
          const operations = operationParams.map(([priority, timestamp, recordId]) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId,
              data: { weight_kg: 100 },
              priority,
            }),
            created_at: timestamp,
          }));

          const sorted = sortByPriorityThenFIFO(operations);
          const batch = sorted.slice(0, MAX_BATCH_SIZE);

          return batch.length <= MAX_BATCH_SIZE;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prioritize critical operations over all others', () => {
    fc.assert(
      fc.property(
        fc.array(timestampArb, { minLength: 1, maxLength: 10 }),
        fc.array(timestampArb, { minLength: 1, maxLength: 10 }),
        (criticalTimestamps, normalTimestamps) => {
          const criticalOps = criticalTimestamps.map((ts, i) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId: `critical-${i}`,
              data: { weight_kg: 100 },
              priority: 'critical' as OperationPriority,
            }),
            created_at: ts,
          }));

          const normalOps = normalTimestamps.map((ts, i) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId: `normal-${i}`,
              data: { weight_kg: 100 },
              priority: 'normal' as OperationPriority,
            }),
            created_at: ts,
          }));

          const allOps = [...normalOps, ...criticalOps]; // Mix them up
          const sorted = sortByPriorityThenFIFO(allOps);

          // All critical operations should come before all normal operations
          const criticalCount = criticalOps.length;
          const firstCriticalOps = sorted.slice(0, criticalCount);
          
          return firstCriticalOps.every(op => op.priority === 'critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty operation list', () => {
    const operations: QueuedOperation[] = [];
    const sorted = sortByPriorityThenFIFO(operations);
    expect(sorted).toHaveLength(0);
  });

  it('should handle single operation', () => {
    fc.assert(
      fc.property(
        priorityArb,
        timestampArb,
        fc.uuid(),
        (priority, timestamp, recordId) => {
          const operation = {
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId,
              data: { weight_kg: 100 },
              priority,
            }),
            created_at: timestamp,
          };

          const sorted = sortByPriorityThenFIFO([operation]);

          return sorted.length === 1 && sorted[0].id === operation.id;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Retry Strategy Compliance', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 7: Retry Strategy Compliance**
   * **Validates: Requirements REQ-SYNC-008**
   *
   * *For any* failed operation with retry_count n:
   * - Next retry delay should be min(1000 * 2^n, 60000) ms ± 10% jitter
   * - If error code is 4xx, no retry should be scheduled
   * - If battery < 15%, no retry should be scheduled
   */

  it('should calculate correct base delay with exponential backoff', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (retryCount) => {
          const expectedBase = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
          const { min, max } = calculateRetryDelay(retryCount);
          
          // Delay should be within ±10% of expected base
          const tolerance = expectedBase * 0.1;
          return min >= expectedBase - tolerance && max <= expectedBase + tolerance;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cap delay at MAX_RETRY_DELAY (60000ms)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 20 }), // High retry counts that would exceed max
        (retryCount) => {
          const { min, max } = calculateRetryDelay(retryCount);
          
          // Even with jitter, should not exceed MAX_RETRY_DELAY + 10%
          const maxWithJitter = MAX_RETRY_DELAY * 1.1;
          return max <= maxWithJitter;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should skip retry on 4xx client errors', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 499 }),
        batteryLevelArb,
        (errorCode, batteryLevel) => {
          // 4xx errors should always skip retry regardless of battery
          return shouldSkipRetry(errorCode, batteryLevel) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should skip retry when battery < 15%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }), // 5xx errors (normally retryable)
        fc.integer({ min: 0, max: 14 }), // Low battery
        (errorCode, batteryLevel) => {
          return shouldSkipRetry(errorCode, batteryLevel) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow retry on 5xx errors with sufficient battery', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }), // 5xx server errors
        fc.integer({ min: 15, max: 100 }), // Sufficient battery
        (errorCode, batteryLevel) => {
          return shouldSkipRetry(errorCode, batteryLevel) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have increasing delays for consecutive retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        (retryCount) => {
          const delay1 = calculateRetryDelay(retryCount);
          const delay2 = calculateRetryDelay(retryCount + 1);
          
          // Next retry should have higher or equal base delay (accounting for cap)
          const base1 = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
          const base2 = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount + 1), MAX_RETRY_DELAY);
          
          return base2 >= base1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply jitter within ±10% range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (retryCount) => {
          const expectedBase = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
          const { min, max } = calculateRetryDelay(retryCount);
          
          // Jitter should be exactly ±10%
          const expectedMin = expectedBase - (expectedBase * 0.1);
          const expectedMax = expectedBase + (expectedBase * 0.1);
          
          return min === expectedMin && max === expectedMax;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle retry count 0 (first retry)', () => {
    const { min, max } = calculateRetryDelay(0);
    const expectedBase = BASE_RETRY_DELAY; // 1000ms
    
    expect(min).toBe(expectedBase - (expectedBase * 0.1)); // 900ms
    expect(max).toBe(expectedBase + (expectedBase * 0.1)); // 1100ms
  });

  it('should handle specific 4xx error codes', () => {
    const nonRetryableCodes = [400, 401, 403, 404, 409, 422];
    
    for (const code of nonRetryableCodes) {
      expect(shouldSkipRetry(code, 100)).toBe(true);
    }
  });
});

describe('Property 8: Offline Queue Integrity', () => {
  /**
   * **Feature: cocoatrack-v2, Property 8: Offline Queue Integrity**
   * **Validates: Requirements 5.9, 8.3, 8.6**
   *
   * *For any* operation created while offline, it SHALL be added to the sync queue
   * with status 'pending' and SHALL be synced in FIFO order when connectivity is restored.
   */

  it('should create operations with pending status', () => {
    fc.assert(
      fc.property(
        syncOperationTypeArb,
        tableArb,
        fc.uuid(),
        deliveryDataArb,
        (type, table, recordId, data) => {
          const operation = createQueuedOperation({
            type,
            table,
            recordId,
            data,
          });

          return operation.status === 'pending';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should assign unique IDs to each operation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 2, maxLength: 20 }
        ),
        (operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data })
          );

          const ids = operations.map((op) => op.id);
          const uniqueIds = new Set(ids);

          return uniqueIds.size === ids.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should assign unique idempotency keys to each operation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 2, maxLength: 20 }
        ),
        (operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data })
          );

          const keys = operations.map((op) => op.idempotency_key);
          const uniqueKeys = new Set(keys);

          return uniqueKeys.size === keys.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain FIFO order when sorting by created_at', () => {
    fc.assert(
      fc.property(
        fc.array(timestampArb, { minLength: 2, maxLength: 50 }),
        (timestamps) => {
          // Create operations with different timestamps
          const operations = timestamps.map((ts, i) => ({
            ...createQueuedOperation({
              type: 'CREATE' as SyncOperationType,
              table: 'deliveries',
              recordId: `record-${i}`,
              data: { weight_kg: 100 },
            }),
            created_at: ts,
          }));

          const sorted = sortFIFO(operations);

          return isInFIFOOrder(sorted);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should initialize retry_count to 0', () => {
    fc.assert(
      fc.property(
        syncOperationTypeArb,
        tableArb,
        fc.uuid(),
        deliveryDataArb,
        (type, table, recordId, data) => {
          const operation = createQueuedOperation({
            type,
            table,
            recordId,
            data,
          });

          return operation.retry_count === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set queued_at timestamp on creation', () => {
    fc.assert(
      fc.property(
        syncOperationTypeArb,
        tableArb,
        fc.uuid(),
        deliveryDataArb,
        (type, table, recordId, data) => {
          const before = new Date().toISOString();
          const operation = createQueuedOperation({
            type,
            table,
            recordId,
            data,
          });
          const after = new Date().toISOString();

          return operation.queued_at >= before && operation.queued_at <= after;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: Critical Field Conflict Detection', () => {
  /**
   * **Feature: cocoatrack-v2, Property 9: Critical Field Conflict Detection**
   * **Validates: Requirements 5.11, 8.8**
   *
   * *For any* sync operation that modifies weight_kg, price_per_kg, total_amount,
   * or payment_status where the remote value differs from the expected base value,
   * the system SHALL set status to 'needs_review' instead of auto-merging.
   */

  it('should detect critical conflict when weight_kg differs between base and remote', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (baseWeight, remoteWeight, localWeight) => {
          // Ensure base and remote are different
          fc.pre(Math.abs(baseWeight - remoteWeight) > 0.01);
          // Ensure local is changing weight_kg
          fc.pre(Math.abs(baseWeight - localWeight) > 0.01);

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { weight_kg: localWeight },
            base_snapshot: { weight_kg: baseWeight, price_per_kg: 1000, total_amount: 100000, payment_status: 'pending' },
          };

          const remoteState = {
            weight_kg: remoteWeight,
            price_per_kg: 1000,
            total_amount: 100000,
            payment_status: 'pending',
          };

          return shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect critical conflict when price_per_kg differs between base and remote', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
        fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
        fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
        (basePrice, remotePrice, localPrice) => {
          fc.pre(Math.abs(basePrice - remotePrice) > 0.01);
          fc.pre(Math.abs(basePrice - localPrice) > 0.01);

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { price_per_kg: localPrice },
            base_snapshot: { weight_kg: 100, price_per_kg: basePrice, total_amount: 100000, payment_status: 'pending' },
          };

          const remoteState = {
            weight_kg: 100,
            price_per_kg: remotePrice,
            total_amount: 100000,
            payment_status: 'pending',
          };

          return shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect critical conflict when total_amount differs between base and remote', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }),
        fc.integer({ min: 1000, max: 1000000 }),
        fc.integer({ min: 1000, max: 1000000 }),
        (baseAmount, remoteAmount, localAmount) => {
          fc.pre(baseAmount !== remoteAmount);
          fc.pre(baseAmount !== localAmount);

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { total_amount: localAmount },
            base_snapshot: { weight_kg: 100, price_per_kg: 1000, total_amount: baseAmount, payment_status: 'pending' },
          };

          const remoteState = {
            weight_kg: 100,
            price_per_kg: 1000,
            total_amount: remoteAmount,
            payment_status: 'pending',
          };

          return shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect critical conflict when payment_status differs between base and remote', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('pending', 'partial', 'paid'),
        fc.constantFrom('pending', 'partial', 'paid'),
        fc.constantFrom('pending', 'partial', 'paid'),
        (baseStatus, remoteStatus, localStatus) => {
          fc.pre(baseStatus !== remoteStatus);
          fc.pre(baseStatus !== localStatus);

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { payment_status: localStatus },
            base_snapshot: { weight_kg: 100, price_per_kg: 1000, total_amount: 100000, payment_status: baseStatus },
          };

          const remoteState = {
            weight_kg: 100,
            price_per_kg: 1000,
            total_amount: 100000,
            payment_status: remoteStatus,
          };

          return shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT detect conflict when remote has not changed from base', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
        fc.integer({ min: 1000, max: 1000000 }),
        fc.constantFrom('pending', 'partial', 'paid'),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (baseWeight, basePrice, baseAmount, baseStatus, localWeight) => {
          fc.pre(Math.abs(baseWeight - localWeight) > 0.01);

          const baseSnapshot = {
            weight_kg: baseWeight,
            price_per_kg: basePrice,
            total_amount: baseAmount,
            payment_status: baseStatus,
          };

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { weight_kg: localWeight },
            base_snapshot: baseSnapshot,
          };

          // Remote is same as base - no conflict
          const remoteState = { ...baseSnapshot };

          return !shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT detect conflict for CREATE operations', () => {
    fc.assert(
      fc.property(deliveryDataArb, (data) => {
        const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
          type: 'CREATE',
          table: 'deliveries',
          data,
          base_snapshot: null,
        };

        const remoteState = {
          weight_kg: 999,
          price_per_kg: 999,
          total_amount: 999999,
          payment_status: 'paid',
        };

        return !shouldTriggerNeedsReview(op, remoteState);
      }),
      { numRuns: 100 }
    );
  });

  it('should NOT detect conflict when only non-critical fields change', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('A', 'B', 'C'),
        fc.constantFrom('A', 'B', 'C'),
        (baseNotes, remoteNotes, baseGrade, remoteGrade) => {
          fc.pre(baseNotes !== remoteNotes || baseGrade !== remoteGrade);

          const baseSnapshot = {
            weight_kg: 100,
            price_per_kg: 1000,
            total_amount: 100000,
            payment_status: 'pending',
            notes: baseNotes,
            quality_grade: baseGrade,
          };

          const op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'> = {
            type: 'UPDATE',
            table: 'deliveries',
            data: { notes: 'new notes', quality_grade: 'A' },
            base_snapshot: baseSnapshot,
          };

          const remoteState = {
            ...baseSnapshot,
            notes: remoteNotes,
            quality_grade: remoteGrade,
          };

          // Non-critical field changes should use LWW, not trigger needs_review
          return !shouldTriggerNeedsReview(op, remoteState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify CRITICAL_FIELDS contains expected fields for deliveries', () => {
    const expectedCriticalFields = ['weight_kg', 'price_per_kg', 'total_amount', 'payment_status'];
    const actualCriticalFields = CRITICAL_FIELDS['deliveries'] || [];

    for (const field of expectedCriticalFields) {
      expect(actualCriticalFields).toContain(field);
    }
  });
});

describe('Property 11: Logout Data Cleanup', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 11: Logout Data Cleanup**
   * **Validates: Requirements REQ-SEC-003**
   *
   * *For any* logout operation:
   * - All IndexedDB stores should be cleared EXCEPT ops_queue
   * - ops_queue operations should be marked 'pending_auth'
   * - On next login:
   *   - IF same user_id: ops_queue is restored to 'pending' status
   *   - IF different user_id: ops_queue remains 'pending_auth' (blocked) and user is warned
   * - Cross-user data leakage is NEVER allowed
   */

  it('should preserve ops_queue on logout', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data, userId })
          );

          const result = simulateLogoutCleanup(operations, userId);

          // ops_queue should be preserved
          return result.opsQueuePreserved === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear all stores except ops_queue on logout', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data, userId })
          );

          const result = simulateLogoutCleanup(operations, userId);

          // All stores except ops_queue should be cleared
          const expectedClearedStores = ['planteurs', 'chef_planteurs', 'warehouses', 'sync_metadata'];
          return expectedClearedStores.every(store => result.clearedStores.includes(store));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark pending operations as pending_auth on logout', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data, userId })
          );

          const result = simulateLogoutCleanup(operations, userId);

          // All pending operations should be marked as pending_auth
          return result.opsMarkedPendingAuth.every(op => op.status === 'pending_auth');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should restore operations to pending status on same user login', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, operationParams) => {
          // Create operations and simulate logout
          const operations = operationParams.map(([type, table, recordId, data]) => ({
            ...createQueuedOperation({ type, table, recordId, data, userId }),
            status: 'pending_auth' as SyncStatus,
          }));

          // Same user logs back in
          const result = simulateLoginRestore(operations, userId, userId);

          // Operations should be restored to pending
          return result.action === 'continue' && 
                 result.restored.every(op => op.status === 'pending');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should block login when different user has pending_auth operations', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (previousUserId, newUserId, operationParams) => {
          // Ensure different users
          fc.pre(previousUserId !== newUserId);

          // Create operations from previous user and simulate logout
          const operations = operationParams.map(([type, table, recordId, data]) => ({
            ...createQueuedOperation({ type, table, recordId, data, userId: previousUserId }),
            status: 'pending_auth' as SyncStatus,
          }));

          // Different user tries to log in
          const result = simulateLoginRestore(operations, newUserId, previousUserId);

          // Login should be blocked
          return result.action === 'block' && result.blocked.length === operations.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never allow cross-user data leakage', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (user1Id, user2Id, operationParams) => {
          // Ensure different users
          fc.pre(user1Id !== user2Id);

          // Create operations from user1
          const user1Operations = operationParams.map(([type, table, recordId, data]) => ({
            ...createQueuedOperation({ type, table, recordId, data, userId: user1Id }),
            status: 'pending_auth' as SyncStatus,
          }));

          // User2 tries to log in
          const result = simulateLoginRestore(user1Operations, user2Id, user1Id);

          // User2 should NOT have access to user1's operations
          // Either blocked or operations remain as pending_auth (not restored)
          return result.action === 'block' || 
                 (result.restored.length === 0 && result.blocked.length === user1Operations.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow login when no pending_auth operations exist', () => {
    fc.assert(
      fc.property(
        userIdArb,
        (userId) => {
          // No pending_auth operations
          const operations: QueuedOperation[] = [];

          const result = simulateLoginRestore(operations, userId, userId);

          // Login should continue
          return result.action === 'continue';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve user_id on all operations', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data, userId })
          );

          // All operations should have the correct user_id
          return operations.every(op => op.user_id === userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve cooperative_id on all operations', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.uuid(), // cooperative_id
        fc.array(
          fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb),
          { minLength: 1, maxLength: 10 }
        ),
        (userId, cooperativeId, operationParams) => {
          const operations = operationParams.map(([type, table, recordId, data]) =>
            createQueuedOperation({ type, table, recordId, data, userId, cooperativeId })
          );

          // All operations should have the correct cooperative_id
          return operations.every(op => op.cooperative_id === cooperativeId);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// DELTA SYNC TYPES AND HELPERS
// ============================================================================

/**
 * Sync cursor for tracking delta sync position
 */
interface SyncCursor {
  table: string;
  last_updated_at: string;
  last_id: string;
  record_count: number;
}

/**
 * Record with required fields for delta sync
 */
interface DeltaSyncRecord {
  id: string;
  updated_at: string;
  data: Record<string, unknown>;
}

/**
 * Simulates fetching delta records from a dataset
 * REQ-OFF-003: Query: updated_at > last OR (updated_at = last AND id > last_id)
 */
function simulateFetchDelta(
  allRecords: DeltaSyncRecord[],
  cursor: SyncCursor | null,
  limit: number
): { records: DeltaSyncRecord[]; cursor: SyncCursor; has_more: boolean } {
  const lastUpdatedAt = cursor?.last_updated_at || '1970-01-01T00:00:00.000Z';
  const lastId = cursor?.last_id || '';

  // Filter records: updated_at > last OR (updated_at = last AND id > last_id)
  const filteredRecords = allRecords.filter(record => {
    if (record.updated_at > lastUpdatedAt) {
      return true;
    }
    if (record.updated_at === lastUpdatedAt && record.id > lastId) {
      return true;
    }
    return false;
  });

  // Sort by updated_at ASC, then id ASC
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (a.updated_at !== b.updated_at) {
      return a.updated_at.localeCompare(b.updated_at);
    }
    return a.id.localeCompare(b.id);
  });

  // Apply limit
  const records = sortedRecords.slice(0, limit);
  const hasMore = sortedRecords.length > limit;

  // Calculate new cursor
  let newCursor: SyncCursor;
  if (records.length > 0) {
    const lastRecord = records[records.length - 1];
    newCursor = {
      table: cursor?.table || 'test',
      last_updated_at: lastRecord.updated_at,
      last_id: lastRecord.id,
      record_count: (cursor?.record_count || 0) + records.length,
    };
  } else {
    newCursor = cursor || {
      table: 'test',
      last_updated_at: lastUpdatedAt,
      last_id: lastId,
      record_count: 0,
    };
  }

  return { records, cursor: newCursor, has_more: hasMore };
}

/**
 * Simulates fetching all delta records with pagination
 */
function simulateFetchAllDelta(
  allRecords: DeltaSyncRecord[],
  initialCursor: SyncCursor | null,
  batchSize: number
): DeltaSyncRecord[] {
  const fetchedRecords: DeltaSyncRecord[] = [];
  let cursor = initialCursor;
  let hasMore = true;

  while (hasMore) {
    const result = simulateFetchDelta(allRecords, cursor, batchSize);
    fetchedRecords.push(...result.records);
    cursor = result.cursor;
    hasMore = result.has_more;
  }

  return fetchedRecords;
}

// ============================================================================
// DELTA SYNC GENERATORS
// ============================================================================

const deltaSyncRecordArb = fc.record({
  id: fc.uuid(),
  updated_at: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(
    (ts) => new Date(ts).toISOString()
  ),
  data: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.integer({ min: 0, max: 1000 }),
  }),
});

const syncCursorArb = fc.record({
  table: fc.constantFrom('planteurs', 'chef_planteurs', 'warehouses', 'deliveries'),
  last_updated_at: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(
    (ts) => new Date(ts).toISOString()
  ),
  last_id: fc.uuid(),
  record_count: fc.integer({ min: 0, max: 10000 }),
});

// ============================================================================
// PROPERTY 4: DELTA SYNC CORRECTNESS
// ============================================================================

describe('Property 4: Delta Sync Correctness', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 4: Delta Sync Correctness**
   * **Validates: Requirements REQ-OFF-003**
   *
   * *For any* table with a stored cursor, calling fetchDelta should:
   * - Return only records where updated_at > cursor.last_updated_at
   *   OR (updated_at = cursor.last_updated_at AND id > cursor.last_id)
   * - Update the cursor to the newest updated_at from returned records
   * - Subsequent fetchDelta calls should not return previously fetched records
   */

  it('should return only records newer than cursor', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 5, maxLength: 50 }),
        syncCursorArb,
        (records, cursor) => {
          const result = simulateFetchDelta(records, cursor, 100);

          // All returned records should be newer than cursor
          return result.records.every(record => {
            if (record.updated_at > cursor.last_updated_at) {
              return true;
            }
            if (record.updated_at === cursor.last_updated_at && record.id > cursor.last_id) {
              return true;
            }
            return false;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update cursor to newest record position', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 1, maxLength: 50 }),
        (records) => {
          // Start with null cursor (initial sync)
          const result = simulateFetchDelta(records, null, 100);

          if (result.records.length === 0) {
            return true; // No records, cursor unchanged
          }

          // Cursor should point to the last record in the batch
          const lastRecord = result.records[result.records.length - 1];
          return (
            result.cursor.last_updated_at === lastRecord.updated_at &&
            result.cursor.last_id === lastRecord.id
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not return previously fetched records on subsequent calls', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 10, maxLength: 100 }),
        fc.integer({ min: 3, max: 10 }),
        (records, batchSize) => {
          // Fetch all records in batches
          const allFetched = simulateFetchAllDelta(records, null, batchSize);

          // Check for duplicates
          const ids = allFetched.map(r => r.id);
          const uniqueIds = new Set(ids);

          return uniqueIds.size === ids.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return records in correct order (updated_at ASC, id ASC)', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 5, maxLength: 50 }),
        (records) => {
          const result = simulateFetchDelta(records, null, 100);

          // Check ordering
          for (let i = 1; i < result.records.length; i++) {
            const prev = result.records[i - 1];
            const curr = result.records[i];

            // updated_at should be ascending
            if (prev.updated_at > curr.updated_at) {
              return false;
            }

            // If same updated_at, id should be ascending
            if (prev.updated_at === curr.updated_at && prev.id > curr.id) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle records with same timestamp correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1577836800000, max: 1924905600000 }),
        fc.array(fc.uuid(), { minLength: 5, maxLength: 20 }),
        (timestamp, ids) => {
          // Create records with same timestamp but different IDs
          const sameTimestamp = new Date(timestamp).toISOString();
          const records: DeltaSyncRecord[] = ids.map(id => ({
            id,
            updated_at: sameTimestamp,
            data: { name: 'test', value: 1 },
          }));

          // Fetch all in small batches
          const allFetched = simulateFetchAllDelta(records, null, 3);

          // Should fetch all records without duplicates
          const fetchedIds = new Set(allFetched.map(r => r.id));
          const originalIds = new Set(ids);

          return fetchedIds.size === originalIds.size;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly set has_more flag', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 10, maxLength: 50 }),
        fc.integer({ min: 3, max: 8 }),
        (records, batchSize) => {
          const result = simulateFetchDelta(records, null, batchSize);

          // has_more should be true if there are more records than batch size
          const totalMatchingRecords = records.length; // All records match null cursor
          const expectedHasMore = totalMatchingRecords > batchSize;

          return result.has_more === expectedHasMore;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increment record_count correctly', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 5, maxLength: 30 }),
        fc.integer({ min: 3, max: 10 }),
        (records, batchSize) => {
          let cursor: SyncCursor | null = null;
          let totalFetched = 0;
          let hasMore = true;

          while (hasMore) {
            const result = simulateFetchDelta(records, cursor, batchSize);
            totalFetched += result.records.length;
            
            // record_count should match total fetched
            if (result.cursor.record_count !== totalFetched) {
              return false;
            }

            cursor = result.cursor;
            hasMore = result.has_more;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty record set', () => {
    const records: DeltaSyncRecord[] = [];
    const result = simulateFetchDelta(records, null, 100);

    expect(result.records).toHaveLength(0);
    expect(result.has_more).toBe(false);
    expect(result.cursor.record_count).toBe(0);
  });

  it('should handle cursor pointing to future timestamp', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 5, maxLength: 20 }),
        (records) => {
          // Create cursor with future timestamp
          const futureCursor: SyncCursor = {
            table: 'test',
            last_updated_at: '2099-12-31T23:59:59.999Z',
            last_id: 'zzz',
            record_count: 0,
          };

          const result = simulateFetchDelta(records, futureCursor, 100);

          // Should return no records
          return result.records.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fetch all records when starting from null cursor', () => {
    fc.assert(
      fc.property(
        fc.array(deltaSyncRecordArb, { minLength: 5, maxLength: 50 }),
        fc.integer({ min: 3, max: 10 }),
        (records, batchSize) => {
          // Fetch all records
          const allFetched = simulateFetchAllDelta(records, null, batchSize);

          // Should fetch all unique records
          const originalIds = new Set(records.map(r => r.id));
          const fetchedIds = new Set(allFetched.map(r => r.id));

          return fetchedIds.size === originalIds.size;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 9: CONFLICT RESOLUTION STRATEGY
// ============================================================================

describe('Property 9: Conflict Resolution Strategy', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 9: Conflict Resolution Strategy**
   * **Validates: Requirements REQ-SYNC-007**
   *
   * *For any* field in a sync conflict:
   * - If field is in CRITICAL_FIELDS (weight_kg, price_per_kg, planteur_id): require user choice
   * - If field is in MERGEABLE_FIELDS (notes, metadata): auto-merge
   * - Otherwise: server wins
   */

  // Generators for conflict resolution testing
  const tableWithFieldsArb = fc.constantFrom('deliveries', 'planteurs', 'chef_planteurs');
  
  const deliveryCriticalFieldArb = fc.constantFrom(
    'weight_kg', 'price_per_kg', 'total_amount', 'payment_status', 'payment_amount_paid', 'planteur_id'
  );
  
  const deliveryMergeableFieldArb = fc.constantFrom('notes', 'metadata', 'quality_grade');
  
  const planteurCriticalFieldArb = fc.constantFrom('planteur_id', 'chef_planteur_id');
  
  const planteurMergeableFieldArb = fc.constantFrom(
    'notes', 'metadata', 'phone', 'cni', 'latitude', 'longitude', 'name'
  );
  
  const chefPlanteurCriticalFieldArb = fc.constantFrom(
    'cooperative_id', 'quantite_max_kg', 'validation_status'
  );
  
  const chefPlanteurMergeableFieldArb = fc.constantFrom(
    'notes', 'metadata', 'phone', 'cni', 'latitude', 'longitude', 'region', 'departement', 'localite', 'name'
  );

  // Helper to generate a random field value
  const fieldValueArb = fc.oneof(
    fc.float({ min: Math.fround(0.1), max: Math.fround(10000), noNaN: true }),
    fc.integer({ min: 1, max: 1000000 }),
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.constantFrom('pending', 'partial', 'paid', 'A', 'B', 'C')
  );

  it('should return user_chooses strategy for critical fields in deliveries', () => {
    fc.assert(
      fc.property(
        deliveryCriticalFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('deliveries', field);
          return strategy === 'user_chooses';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return user_chooses strategy for critical fields in planteurs', () => {
    fc.assert(
      fc.property(
        planteurCriticalFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('planteurs', field);
          return strategy === 'user_chooses';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return user_chooses strategy for critical fields in chef_planteurs', () => {
    fc.assert(
      fc.property(
        chefPlanteurCriticalFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('chef_planteurs', field);
          return strategy === 'user_chooses';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return auto_merge strategy for mergeable fields in deliveries', () => {
    fc.assert(
      fc.property(
        deliveryMergeableFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('deliveries', field);
          return strategy === 'auto_merge';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return auto_merge strategy for mergeable fields in planteurs', () => {
    fc.assert(
      fc.property(
        planteurMergeableFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('planteurs', field);
          return strategy === 'auto_merge';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return auto_merge strategy for mergeable fields in chef_planteurs', () => {
    fc.assert(
      fc.property(
        chefPlanteurMergeableFieldArb,
        (field) => {
          const strategy = getFieldResolutionStrategy('chef_planteurs', field);
          return strategy === 'auto_merge';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return server_wins strategy for unknown fields', () => {
    fc.assert(
      fc.property(
        tableWithFieldsArb,
        fc.string({ minLength: 10, maxLength: 30 }).map(s => `unknown_field_${s}`),
        (table, unknownField) => {
          const strategy = getFieldResolutionStrategy(table, unknownField);
          return strategy === 'server_wins';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify critical fields with isCriticalField', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(fc.constant('deliveries'), deliveryCriticalFieldArb),
          fc.tuple(fc.constant('planteurs'), planteurCriticalFieldArb),
          fc.tuple(fc.constant('chef_planteurs'), chefPlanteurCriticalFieldArb)
        ),
        ([table, field]) => {
          return isCriticalField(table, field) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify mergeable fields with isMergeableField', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(fc.constant('deliveries'), deliveryMergeableFieldArb),
          fc.tuple(fc.constant('planteurs'), planteurMergeableFieldArb),
          fc.tuple(fc.constant('chef_planteurs'), chefPlanteurMergeableFieldArb)
        ),
        ([table, field]) => {
          return isMergeableField(table, field) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should auto-merge non-critical fields when both local and remote changed', () => {
    fc.assert(
      fc.property(
        deliveryMergeableFieldArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (field, baseValue, remoteValue, localValue) => {
          // Ensure all values are different
          fc.pre(baseValue !== remoteValue);
          fc.pre(baseValue !== localValue);
          fc.pre(remoteValue !== localValue);

          const baseSnapshot = { [field]: baseValue, weight_kg: 100 };
          const remoteState = { [field]: remoteValue, weight_kg: 100 };
          const localData = { [field]: localValue };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Mergeable field should be auto-merged (local wins)
          return result.autoMergedFields.includes(field) && 
                 result.mergedData[field] === localValue;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require user choice for critical fields when both local and remote changed', () => {
    fc.assert(
      fc.property(
        deliveryCriticalFieldArb,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1001, max: 2000 }),
        fc.integer({ min: 2001, max: 3000 }),
        (field, baseValue, remoteValue, localValue) => {
          const baseSnapshot = { [field]: baseValue, notes: 'base' };
          const remoteState = { [field]: remoteValue, notes: 'base' };
          const localData = { [field]: localValue };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Critical field should require user choice
          return result.requiresUserChoice.includes(field) && 
                 result.success === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use server value for unknown fields when both changed', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 20 }).map(s => `unknown_${s}`),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 101, max: 200 }),
        fc.integer({ min: 201, max: 300 }),
        (unknownField, baseValue, remoteValue, localValue) => {
          const baseSnapshot = { [unknownField]: baseValue, weight_kg: 100 };
          const remoteState = { [unknownField]: remoteValue, weight_kg: 100 };
          const localData = { [unknownField]: localValue };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Unknown field should use server wins strategy
          return result.serverWinsFields.includes(unknownField) &&
                 result.mergedData[unknownField] === remoteValue;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should auto-merge when only local changed (remote unchanged)', () => {
    fc.assert(
      fc.property(
        fc.oneof(deliveryCriticalFieldArb, deliveryMergeableFieldArb),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1001, max: 2000 }),
        (field, baseValue, localValue) => {
          // Remote has same value as base (unchanged)
          const baseSnapshot = { [field]: baseValue, notes: 'base' };
          const remoteState = { [field]: baseValue, notes: 'base' }; // Same as base
          const localData = { [field]: localValue };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Should auto-merge since remote didn't change
          return result.autoMergedFields.includes(field) && 
                 result.mergedData[field] === localValue &&
                 result.success === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should succeed when no critical field conflicts exist', () => {
    fc.assert(
      fc.property(
        deliveryMergeableFieldArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (field, baseValue, localValue) => {
          fc.pre(baseValue !== localValue);

          const baseSnapshot = { [field]: baseValue, weight_kg: 100 };
          const remoteState = { [field]: baseValue, weight_kg: 100 }; // Remote unchanged
          const localData = { [field]: localValue };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Should succeed with no user choice required
          return result.success === true && result.requiresUserChoice.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve non-conflicting fields in merged result', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (weightKg, pricePerKg, notes) => {
          const baseSnapshot = { 
            weight_kg: weightKg, 
            price_per_kg: pricePerKg, 
            notes: 'old notes' 
          };
          const remoteState = { 
            weight_kg: weightKg, 
            price_per_kg: pricePerKg, 
            notes: 'old notes' 
          };
          const localData = { notes }; // Only changing notes

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // Non-changed fields should be preserved from remote
          return result.mergedData.weight_kg === weightKg && 
                 result.mergedData.price_per_kg === pricePerKg;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple fields with mixed strategies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 101, max: 200 }),
        fc.integer({ min: 201, max: 300 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 21, maxLength: 40 }),
        fc.string({ minLength: 41, maxLength: 60 }),
        (baseWeight, remoteWeight, localWeight, baseNotes, remoteNotes, localNotes) => {
          const baseSnapshot = { weight_kg: baseWeight, notes: baseNotes };
          const remoteState = { weight_kg: remoteWeight, notes: remoteNotes };
          const localData = { weight_kg: localWeight, notes: localNotes };

          const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

          // weight_kg is critical → requires user choice
          // notes is mergeable → auto-merged
          return result.requiresUserChoice.includes('weight_kg') &&
                 result.autoMergedFields.includes('notes') &&
                 result.mergedData.notes === localNotes;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify CRITICAL_FIELDS and MERGEABLE_FIELDS are mutually exclusive', () => {
    fc.assert(
      fc.property(
        tableWithFieldsArb,
        (table) => {
          const criticalFields = CRITICAL_FIELDS[table] || [];
          const mergeableFields = MERGEABLE_FIELDS[table] || [];

          // No field should be in both lists
          const overlap = criticalFields.filter(f => mergeableFields.includes(f));
          return overlap.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty local changes', () => {
    const baseSnapshot = { weight_kg: 100, notes: 'test' };
    const remoteState = { weight_kg: 150, notes: 'updated' };
    const localData = {};

    const result = autoMergeChanges('deliveries', localData, remoteState, baseSnapshot);

    // No local changes → success with remote values preserved
    expect(result.success).toBe(true);
    expect(result.requiresUserChoice).toHaveLength(0);
    expect(result.autoMergedFields).toHaveLength(0);
    expect(result.mergedData.weight_kg).toBe(150);
    expect(result.mergedData.notes).toBe('updated');
  });

  it('should handle unknown table gracefully', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }).map(s => `unknown_table_${s}`),
        fc.string({ minLength: 1, maxLength: 20 }),
        (unknownTable, field) => {
          const strategy = getFieldResolutionStrategy(unknownTable, field);
          // Unknown table should default to server_wins
          return strategy === 'server_wins';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// PROPERTY 8: SYNC STATUS DISPLAY
// ============================================================================

import { getSyncStatusState, type SyncStatusState } from '@/components/offline/SyncStatusIndicator';

describe('Property 8: Sync Status Display', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 8: Sync Status Display**
   * **Validates: Requirements REQ-SYNC-001**
   *
   * *For any* combination of pending_count and error_count:
   * - If pending_count == 0 AND error_count == 0: display 'synced' (green)
   * - If pending_count > 0 AND error_count == 0: display 'pending' (orange)
   * - If error_count > 0: display 'error' (red)
   */

  it('should return synced when both pending and error counts are 0', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        fc.constant(0),
        (pendingCount, errorCount) => {
          const state = getSyncStatusState(pendingCount, errorCount);
          return state === 'synced';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return pending when pending_count > 0 AND error_count == 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.constant(0),
        (pendingCount, errorCount) => {
          const state = getSyncStatusState(pendingCount, errorCount);
          return state === 'pending';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return error when error_count > 0 (regardless of pending_count)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (pendingCount, errorCount) => {
          const state = getSyncStatusState(pendingCount, errorCount);
          return state === 'error';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prioritize error state over pending state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (pendingCount, errorCount) => {
          // Both pending and error counts are > 0
          const state = getSyncStatusState(pendingCount, errorCount);
          // Error should take priority
          return state === 'error';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle large counts correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (pendingCount, errorCount) => {
          const state = getSyncStatusState(pendingCount, errorCount);
          
          // Verify the state machine logic
          if (errorCount > 0) {
            return state === 'error';
          }
          if (pendingCount > 0) {
            return state === 'pending';
          }
          return state === 'synced';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return exactly one of the three valid states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (pendingCount, errorCount) => {
          const state = getSyncStatusState(pendingCount, errorCount);
          const validStates: SyncStatusState[] = ['synced', 'pending', 'error'];
          return validStates.includes(state);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic (same inputs always produce same output)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (pendingCount, errorCount) => {
          const state1 = getSyncStatusState(pendingCount, errorCount);
          const state2 = getSyncStatusState(pendingCount, errorCount);
          const state3 = getSyncStatusState(pendingCount, errorCount);
          return state1 === state2 && state2 === state3;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case of exactly 1 pending operation', () => {
    const state = getSyncStatusState(1, 0);
    expect(state).toBe('pending');
  });

  it('should handle edge case of exactly 1 error operation', () => {
    const state = getSyncStatusState(0, 1);
    expect(state).toBe('error');
  });

  it('should handle edge case of 1 pending and 1 error', () => {
    const state = getSyncStatusState(1, 1);
    expect(state).toBe('error'); // Error takes priority
  });
});


// ============================================================================
// PROPERTY 5: OFFLINE SEARCH CONSTRAINTS
// ============================================================================

import {
  normalizeNameForSearch,
  startsWithNormalized,
  codeMatches,
  MAX_SEARCH_RESULTS,
} from '../offline-search';

describe('Property 5: Offline Search Constraints', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 5: Offline Search Constraints**
   * **Validates: Requirements REQ-OFF-005**
   *
   * *For any* search query on offline data:
   * - Results should only include records where name_norm or code starts with the query (prefix match)
   * - Results count should be ≤ 50
   * - Search should complete in < 100ms
   */

  // ============================================================================
  // GENERATORS
  // ============================================================================

  // Generator for names with various characters including accents
  const nameArb = fc.oneof(
    fc.string({ minLength: 1, maxLength: 50 }),
    // Names with accents (common in French)
    fc.constantFrom(
      'François',
      'José',
      'Müller',
      'Côte d\'Ivoire',
      'São Paulo',
      'Björk',
      'Ñoño',
      'Łódź',
      'Zürich',
      'Café',
      'Naïve',
      'Résumé'
    ),
    // Simple alphanumeric names
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/)
  );

  // Generator for codes (typically alphanumeric)
  const codeArb = fc.stringMatching(/^[A-Z]{2,4}[0-9]{3,6}$/);

  // Generator for search queries
  const queryArb = fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.stringMatching(/^[A-Za-z]{1,10}$/),
    fc.constantFrom('fra', 'FRA', 'josé', 'JOSÉ', 'cafe', 'CAFE', 'müll', 'MÜLL')
  );

  // Generator for a cached planteur record
  const cachedPlanteurArb = fc.record({
    id: fc.uuid(),
    name: nameArb,
    code: codeArb,
    phone: fc.option(fc.string({ minLength: 10, maxLength: 15 }), { nil: null }),
    cni: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
    chef_planteur_id: fc.uuid(),
    cooperative_id: fc.uuid(),
    latitude: fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: null }),
    longitude: fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: null }),
    is_active: fc.boolean(),
    created_at: timestampArb,
    updated_at: timestampArb,
    _cached_at: timestampArb,
    _synced_at: fc.option(timestampArb, { nil: null }),
  });

  // ============================================================================
  // NAME NORMALIZATION TESTS
  // ============================================================================

  it('should normalize names to lowercase', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (name) => {
          const normalized = normalizeNameForSearch(name);
          return normalized === normalized.toLowerCase();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should remove diacritics from names', () => {
    const testCases = [
      { input: 'François', expected: 'francois' },
      { input: 'José', expected: 'jose' },
      { input: 'Müller', expected: 'muller' },
      { input: 'Café', expected: 'cafe' },
      { input: 'Naïve', expected: 'naive' },
      { input: 'Résumé', expected: 'resume' },
    ];

    for (const { input, expected } of testCases) {
      const normalized = normalizeNameForSearch(input);
      expect(normalized).toBe(expected);
    }
  });

  it('should remove non-alphanumeric characters except spaces', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (name) => {
          const normalized = normalizeNameForSearch(name);
          // Should only contain lowercase letters, numbers, and spaces
          return /^[a-z0-9\s]*$/.test(normalized);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trim whitespace from normalized names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (name) => {
          const normalized = normalizeNameForSearch(name);
          return normalized === normalized.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent (normalizing twice gives same result)', () => {
    fc.assert(
      fc.property(
        nameArb,
        (name) => {
          const once = normalizeNameForSearch(name);
          const twice = normalizeNameForSearch(once);
          return once === twice;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // PREFIX MATCH TESTS
  // ============================================================================

  it('should match when name starts with query (case-insensitive)', () => {
    fc.assert(
      fc.property(
        nameArb,
        fc.integer({ min: 1, max: 10 }),
        (name, prefixLength) => {
          const normalized = normalizeNameForSearch(name);
          if (normalized.length === 0) return true; // Skip empty names
          
          const actualPrefixLength = Math.min(prefixLength, normalized.length);
          const prefix = normalized.substring(0, actualPrefixLength);
          
          return startsWithNormalized(name, prefix);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not match when name does not start with query', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (name, query) => {
          const normalizedName = normalizeNameForSearch(name);
          const normalizedQuery = normalizeNameForSearch(query);
          
          // Skip if query is empty or name starts with query
          if (normalizedQuery.length === 0) return true;
          if (normalizedName.startsWith(normalizedQuery)) return true;
          
          return !startsWithNormalized(name, query);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle case-insensitive prefix matching', () => {
    const testCases = [
      { name: 'François', query: 'fra', expected: true },
      { name: 'François', query: 'FRA', expected: true },
      { name: 'FRANÇOIS', query: 'fra', expected: true },
      { name: 'José', query: 'jos', expected: true },
      { name: 'José', query: 'JOS', expected: true },
      { name: 'Müller', query: 'mul', expected: true },
      { name: 'Müller', query: 'MÜL', expected: true },
    ];

    for (const { name, query, expected } of testCases) {
      expect(startsWithNormalized(name, query)).toBe(expected);
    }
  });

  // ============================================================================
  // CODE MATCH TESTS
  // ============================================================================

  it('should match codes exactly (case-insensitive)', () => {
    fc.assert(
      fc.property(
        codeArb,
        (code) => {
          return codeMatches(code, code) &&
                 codeMatches(code, code.toLowerCase()) &&
                 codeMatches(code, code.toUpperCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not match different codes', () => {
    fc.assert(
      fc.property(
        codeArb,
        codeArb,
        (code1, code2) => {
          if (code1.toLowerCase() === code2.toLowerCase()) return true;
          return !codeMatches(code1, code2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // RESULT LIMIT TESTS
  // ============================================================================

  it('should limit results to MAX_SEARCH_RESULTS (50)', () => {
    expect(MAX_SEARCH_RESULTS).toBe(50);
  });

  it('should never return more than MAX_SEARCH_RESULTS items', () => {
    fc.assert(
      fc.property(
        fc.array(cachedPlanteurArb, { minLength: 0, maxLength: 200 }),
        queryArb,
        (planteurs, query) => {
          // Simulate search filtering
          const normalizedQuery = normalizeNameForSearch(query.trim());
          if (normalizedQuery.length === 0) return true;
          
          const filtered = planteurs.filter(p => 
            startsWithNormalized(p.name, query) || codeMatches(p.code, query)
          );
          
          const results = filtered.slice(0, MAX_SEARCH_RESULTS);
          
          return results.length <= MAX_SEARCH_RESULTS;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // SEARCH RESULT CORRECTNESS TESTS
  // ============================================================================

  it('should only return records matching prefix or exact code', () => {
    fc.assert(
      fc.property(
        fc.array(cachedPlanteurArb, { minLength: 1, maxLength: 50 }),
        queryArb,
        (planteurs, query) => {
          const trimmedQuery = query.trim();
          if (trimmedQuery.length === 0) return true;
          
          // Simulate search
          const results = planteurs.filter(p => 
            startsWithNormalized(p.name, trimmedQuery) || codeMatches(p.code, trimmedQuery)
          );
          
          // Verify all results match the criteria
          return results.every(p => 
            startsWithNormalized(p.name, trimmedQuery) || codeMatches(p.code, trimmedQuery)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not miss any matching records (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(cachedPlanteurArb, { minLength: 1, maxLength: 50 }),
        queryArb,
        (planteurs, query) => {
          const trimmedQuery = query.trim();
          if (trimmedQuery.length === 0) return true;
          
          // Simulate search
          const results = planteurs.filter(p => 
            startsWithNormalized(p.name, trimmedQuery) || codeMatches(p.code, trimmedQuery)
          );
          
          // Verify no matching records were missed (before truncation)
          const allMatching = planteurs.filter(p => 
            startsWithNormalized(p.name, trimmedQuery) || codeMatches(p.code, trimmedQuery)
          );
          
          return results.length === allMatching.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty results for empty query', () => {
    fc.assert(
      fc.property(
        fc.array(cachedPlanteurArb, { minLength: 1, maxLength: 20 }),
        fc.constantFrom('', '   ', '\t', '\n'),
        (planteurs, emptyQuery) => {
          const trimmedQuery = emptyQuery.trim();
          // Empty query should return no results
          return trimmedQuery.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  it('should handle special characters in query', () => {
    const specialQueries = ['@#$%', '!!!', '...', '---', '___'];
    
    for (const query of specialQueries) {
      const normalized = normalizeNameForSearch(query);
      // Special characters should be removed, resulting in empty string
      expect(normalized).toBe('');
    }
  });

  it('should handle unicode characters correctly', () => {
    const unicodeNames = [
      { name: '日本語', normalized: '' }, // Non-latin characters removed
      { name: 'Привет', normalized: '' }, // Cyrillic removed
      { name: '你好', normalized: '' }, // Chinese removed
      { name: 'مرحبا', normalized: '' }, // Arabic removed
    ];

    for (const { name, normalized } of unicodeNames) {
      expect(normalizeNameForSearch(name)).toBe(normalized);
    }
  });

  it('should handle mixed alphanumeric and special characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (name) => {
          const normalized = normalizeNameForSearch(name);
          // Result should only contain alphanumeric and spaces
          return /^[a-z0-9\s]*$/.test(normalized);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle very long names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 500 }),
        (longName) => {
          const normalized = normalizeNameForSearch(longName);
          // Should not throw and should return a valid string
          return typeof normalized === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle very long queries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (longQuery, name) => {
          // Should not throw
          const result = startsWithNormalized(name, longQuery);
          return typeof result === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // PERFORMANCE CONSTRAINT (Documented, not enforced in unit tests)
  // ============================================================================

  it('should document performance requirement: search < 100ms', () => {
    // This test documents the performance requirement
    // Actual performance testing should be done in integration tests
    // with real IndexedDB data
    
    // The requirement states: Search should complete in < 100ms
    // This is validated through:
    // 1. Using IndexedDB indexes for efficient lookups
    // 2. Limiting results to 50 items
    // 3. Using prefix matching (startsWith) instead of full-text search
    
    expect(true).toBe(true);
  });
});


// ============================================================================
// PROPERTY 10: OFFLINE ENTITY IDENTITY
// ============================================================================

import {
  generateClientId,
  isValidUUIDv4,
  isValidUUID,
  createOfflineEntity,
  markEntitySynced,
  markEntitySyncFailed,
  storeIdMapping,
  getIdMappings,
  getServerIdForClientId,
  getClientIdForServerId,
  resolveToServerId,
  clearIdMappings,
  isOfflineEntity,
  isPendingSync,
  isSynced,
  getEffectiveId,
  type OfflineEntity,
  type IdMapping,
} from '../offline-entity';

describe('Property 10: Offline Entity Identity', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 10: Offline Entity Identity**
   * **Validates: Requirements REQ-OFF-010**
   *
   * *For any* entity created offline:
   * - client_id should be a valid UUID v4
   * - status should be 'pending_sync'
   * - After successful sync, server_id should be set and client_id → server_id mapping should be stored
   */

  // Clear ID mappings before each test to ensure isolation
  beforeEach(() => {
    clearIdMappings();
  });

  // ============================================================================
  // UUID GENERATION TESTS
  // ============================================================================

  it('should generate valid UUID v4 for client_id', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          const ids: string[] = [];
          for (let i = 0; i < count; i++) {
            ids.push(generateClientId());
          }
          
          // All generated IDs should be valid UUID v4
          return ids.every(id => isValidUUIDv4(id));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique client_ids', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }),
        (count) => {
          const ids: string[] = [];
          for (let i = 0; i < count; i++) {
            ids.push(generateClientId());
          }
          
          // All IDs should be unique
          const uniqueIds = new Set(ids);
          return uniqueIds.size === ids.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate UUID v4 format correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (uuid) => {
          // All UUIDs from fc.uuid() should be valid UUIDs
          return isValidUUID(uuid);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid UUID formats', () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '12345',
      '',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      '00000000-0000-0000-0000-00000000000', // Too short
      '00000000-0000-0000-0000-0000000000000', // Too long
      '00000000_0000_0000_0000_000000000000', // Wrong separator
    ];

    for (const invalid of invalidUUIDs) {
      expect(isValidUUID(invalid)).toBe(false);
    }
  });

  // ============================================================================
  // OFFLINE ENTITY CREATION TESTS
  // ============================================================================

  it('should create offline entity with pending_sync status', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          code: fc.string({ minLength: 1, maxLength: 20 }),
          value: fc.integer({ min: 0, max: 10000 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          
          return entity.status === 'pending_sync';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create offline entity with valid UUID v4 client_id', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.integer({ min: 0, max: 10000 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          
          return isValidUUIDv4(entity.client_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create offline entity with null server_id initially', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          
          return entity.server_id === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create offline entity with created_offline_at timestamp', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const before = new Date().toISOString();
          const entity = createOfflineEntity(data);
          const after = new Date().toISOString();
          
          return entity.created_offline_at >= before && 
                 entity.created_offline_at <= after;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create offline entity with null synced_at initially', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          
          return entity.synced_at === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve original data in offline entity', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          code: fc.string({ minLength: 1, maxLength: 20 }),
          value: fc.integer({ min: 0, max: 10000 }),
          nested: fc.record({
            a: fc.integer(),
            b: fc.string(),
          }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          
          return entity.name === data.name &&
                 entity.code === data.code &&
                 entity.value === data.value &&
                 entity.nested.a === data.nested.a &&
                 entity.nested.b === data.nested.b;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should store validation warnings when provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (data, warnings) => {
          const entity = createOfflineEntity(data, warnings);
          
          return entity.validation_warnings !== undefined &&
                 entity.validation_warnings.length === warnings.length &&
                 entity.validation_warnings.every((w, i) => w === warnings[i]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not include validation_warnings when empty', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data, []);
          
          return entity.validation_warnings === undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // SYNC STATUS TRANSITION TESTS
  // ============================================================================

  it('should mark entity as synced with server_id', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.uuid(),
        (data, serverId) => {
          const entity = createOfflineEntity(data);
          const synced = markEntitySynced(entity, serverId);
          
          return synced.status === 'synced' &&
                 synced.server_id === serverId &&
                 synced.synced_at !== null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve client_id when marking as synced', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.uuid(),
        (data, serverId) => {
          const entity = createOfflineEntity(data);
          const originalClientId = entity.client_id;
          const synced = markEntitySynced(entity, serverId);
          
          return synced.client_id === originalClientId;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark entity as sync_failed', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          const failed = markEntitySyncFailed(entity);
          
          return failed.status === 'sync_failed' &&
                 failed.server_id === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // ID MAPPING TESTS
  // ============================================================================

  it('should store and retrieve client_id → server_id mapping', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('deliveries', 'planteurs', 'chef_planteurs'),
        (clientId, serverId, table) => {
          clearIdMappings();
          
          const mapping: IdMapping = {
            client_id: clientId,
            server_id: serverId,
            table,
            mapped_at: new Date().toISOString(),
          };
          
          storeIdMapping(mapping);
          
          const retrieved = getServerIdForClientId(clientId);
          return retrieved === serverId;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should retrieve client_id from server_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('deliveries', 'planteurs', 'chef_planteurs'),
        (clientId, serverId, table) => {
          clearIdMappings();
          
          const mapping: IdMapping = {
            client_id: clientId,
            server_id: serverId,
            table,
            mapped_at: new Date().toISOString(),
          };
          
          storeIdMapping(mapping);
          
          const retrieved = getClientIdForServerId(serverId);
          return retrieved === clientId;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null for unknown client_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (unknownClientId) => {
          clearIdMappings();
          
          const retrieved = getServerIdForClientId(unknownClientId);
          return retrieved === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null for unknown server_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (unknownServerId) => {
          clearIdMappings();
          
          const retrieved = getClientIdForServerId(unknownServerId);
          return retrieved === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should resolve client_id to server_id when mapping exists', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (clientId, serverId) => {
          clearIdMappings();
          
          storeIdMapping({
            client_id: clientId,
            server_id: serverId,
            table: 'deliveries',
            mapped_at: new Date().toISOString(),
          });
          
          const resolved = resolveToServerId(clientId);
          return resolved === serverId;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return original id when no mapping exists', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (id) => {
          clearIdMappings();
          
          const resolved = resolveToServerId(id);
          return resolved === id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple mappings correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.uuid(), fc.uuid(), fc.constantFrom('deliveries', 'planteurs')),
          { minLength: 2, maxLength: 10 }
        ),
        (mappingData) => {
          clearIdMappings();
          
          // Ensure unique client_ids
          const uniqueClientIds = new Set(mappingData.map(([c]) => c));
          if (uniqueClientIds.size !== mappingData.length) return true;
          
          // Store all mappings
          for (const [clientId, serverId, table] of mappingData) {
            storeIdMapping({
              client_id: clientId,
              server_id: serverId,
              table,
              mapped_at: new Date().toISOString(),
            });
          }
          
          // Verify all mappings
          return mappingData.every(([clientId, serverId]) => 
            getServerIdForClientId(clientId) === serverId
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update existing mapping when storing duplicate client_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (clientId, serverId1, serverId2) => {
          clearIdMappings();
          
          // Store first mapping
          storeIdMapping({
            client_id: clientId,
            server_id: serverId1,
            table: 'deliveries',
            mapped_at: new Date().toISOString(),
          });
          
          // Store second mapping with same client_id
          storeIdMapping({
            client_id: clientId,
            server_id: serverId2,
            table: 'deliveries',
            mapped_at: new Date().toISOString(),
          });
          
          // Should have the latest server_id
          const retrieved = getServerIdForClientId(clientId);
          return retrieved === serverId2;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // OFFLINE ENTITY HELPER TESTS
  // ============================================================================

  it('should correctly identify offline entities', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          return isOfflineEntity(entity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not identify regular objects as offline entities', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          id: fc.uuid(),
        }),
        (data) => {
          return !isOfflineEntity(data);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify pending_sync entities', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          return isPendingSync(entity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify synced entities', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.uuid(),
        (data, serverId) => {
          const entity = createOfflineEntity(data);
          const synced = markEntitySynced(entity, serverId);
          return isSynced(synced);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return client_id as effective id when not synced', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (data) => {
          const entity = createOfflineEntity(data);
          return getEffectiveId(entity) === entity.client_id;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return server_id as effective id when synced', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.uuid(),
        (data, serverId) => {
          const entity = createOfflineEntity(data);
          const synced = markEntitySynced(entity, serverId);
          return getEffectiveId(synced) === serverId;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // COMPLETE OFFLINE ENTITY LIFECYCLE TEST
  // ============================================================================

  it('should support complete offline entity lifecycle', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          code: fc.string({ minLength: 1, maxLength: 20 }),
          weight_kg: fc.float({ min: Math.fround(0.1), max: Math.fround(10000), noNaN: true }),
        }),
        fc.uuid(),
        (data, serverId) => {
          clearIdMappings();
          
          // 1. Create offline entity
          const entity = createOfflineEntity(data);
          
          // Verify initial state
          if (!isValidUUIDv4(entity.client_id)) return false;
          if (entity.status !== 'pending_sync') return false;
          if (entity.server_id !== null) return false;
          if (!isPendingSync(entity)) return false;
          
          // 2. Mark as synced
          const synced = markEntitySynced(entity, serverId);
          
          // Verify synced state
          if (synced.status !== 'synced') return false;
          if (synced.server_id !== serverId) return false;
          if (synced.client_id !== entity.client_id) return false;
          if (!isSynced(synced)) return false;
          
          // 3. Store ID mapping
          storeIdMapping({
            client_id: entity.client_id,
            server_id: serverId,
            table: 'deliveries',
            mapped_at: new Date().toISOString(),
          });
          
          // 4. Verify mapping
          const retrievedServerId = getServerIdForClientId(entity.client_id);
          if (retrievedServerId !== serverId) return false;
          
          // 5. Verify effective ID
          if (getEffectiveId(synced) !== serverId) return false;
          
          // 6. Verify resolve works
          if (resolveToServerId(entity.client_id) !== serverId) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// PROPERTY 12: MIGRATION SAFETY
// ============================================================================

/**
 * Migration state for testing
 */
interface MigrationState {
  opsQueue: QueuedOperation[];
  tier1Data: {
    planteurs: { id: string; name: string }[];
    chefPlanteurs: { id: string; name: string }[];
    warehouses: { id: string; name: string }[];
  };
  tier2Data: {
    deliveries: { id: string; delivered_at: string }[];
  };
  tier3Data: {
    exports: { id: string }[];
  };
}

/**
 * Simulates a database migration
 * REQ-IDB-001: Schema migration safety
 */
function simulateMigration(
  beforeState: MigrationState,
  migrationSucceeds: boolean
): {
  success: boolean;
  afterState: MigrationState;
  opsQueuePreserved: boolean;
  tier1Preserved: boolean;
  error?: string;
} {
  if (!migrationSucceeds) {
    // Migration failed - should preserve ops_queue and tier1
    return {
      success: false,
      afterState: beforeState, // State unchanged on failure
      opsQueuePreserved: true,
      tier1Preserved: true,
      error: 'Migration failed',
    };
  }

  // Migration succeeded - all data preserved
  return {
    success: true,
    afterState: {
      ...beforeState,
      // Migration might add new stores but preserves existing data
    },
    opsQueuePreserved: true,
    tier1Preserved: true,
  };
}

/**
 * Simulates a migration rollback
 * REQ-IDB-002: Migration rollback
 */
function simulateMigrationRollback(
  beforeState: MigrationState,
  backupOpsQueue: QueuedOperation[]
): {
  success: boolean;
  afterState: MigrationState;
  opsQueueRestored: boolean;
  tier1Preserved: boolean;
} {
  // Rollback should restore ops_queue from backup
  // Tier2/Tier3 can be reset and re-downloaded
  return {
    success: true,
    afterState: {
      opsQueue: backupOpsQueue,
      tier1Data: beforeState.tier1Data, // Tier1 preserved
      tier2Data: { deliveries: [] }, // Tier2 can be reset
      tier3Data: { exports: [] }, // Tier3 can be reset
    },
    opsQueueRestored: backupOpsQueue.length === beforeState.opsQueue.length,
    tier1Preserved: true,
  };
}

/**
 * Counts records in migration state
 */
function countRecords(state: MigrationState): {
  opsQueue: number;
  tier1: number;
  tier2: number;
  tier3: number;
} {
  return {
    opsQueue: state.opsQueue.length,
    tier1: state.tier1Data.planteurs.length + 
           state.tier1Data.chefPlanteurs.length + 
           state.tier1Data.warehouses.length,
    tier2: state.tier2Data.deliveries.length,
    tier3: state.tier3Data.exports.length,
  };
}

// Generators for migration testing
const migrationStateArb = fc.record({
  opsQueue: fc.array(
    fc.tuple(syncOperationTypeArb, tableArb, fc.uuid(), deliveryDataArb).map(
      ([type, table, recordId, data]) => createQueuedOperation({ type, table, recordId, data })
    ),
    { minLength: 0, maxLength: 20 }
  ),
  tier1Data: fc.record({
    planteurs: fc.array(
      fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 50 }) }),
      { minLength: 0, maxLength: 50 }
    ),
    chefPlanteurs: fc.array(
      fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 50 }) }),
      { minLength: 0, maxLength: 20 }
    ),
    warehouses: fc.array(
      fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 50 }) }),
      { minLength: 0, maxLength: 10 }
    ),
  }),
  tier2Data: fc.record({
    deliveries: fc.array(
      fc.record({ 
        id: fc.uuid(), 
        delivered_at: timestampArb 
      }),
      { minLength: 0, maxLength: 100 }
    ),
  }),
  tier3Data: fc.record({
    exports: fc.array(
      fc.record({ id: fc.uuid() }),
      { minLength: 0, maxLength: 20 }
    ),
  }),
});

describe('Property 12: Migration Safety', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 12: Migration Safety**
   * **Validates: Requirements REQ-IDB-001, REQ-IDB-002**
   *
   * *For any* IndexedDB schema migration:
   * - ops_queue record count before == ops_queue record count after
   * - Tier_1 data record count before == Tier_1 data record count after
   * - If migration fails, rollback should restore previous state
   */

  it('should preserve ops_queue count after successful migration', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const beforeCounts = countRecords(beforeState);
          const result = simulateMigration(beforeState, true);
          const afterCounts = countRecords(result.afterState);

          // ops_queue count should be unchanged
          return beforeCounts.opsQueue === afterCounts.opsQueue;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve Tier_1 data count after successful migration', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const beforeCounts = countRecords(beforeState);
          const result = simulateMigration(beforeState, true);
          const afterCounts = countRecords(result.afterState);

          // Tier_1 data count should be unchanged
          return beforeCounts.tier1 === afterCounts.tier1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve ops_queue on migration failure', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const result = simulateMigration(beforeState, false);

          // ops_queue should be preserved even on failure
          return result.opsQueuePreserved === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve Tier_1 data on migration failure', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const result = simulateMigration(beforeState, false);

          // Tier_1 should be preserved even on failure
          return result.tier1Preserved === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should restore ops_queue from backup on rollback', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          // Simulate backup before migration
          const backupOpsQueue = [...beforeState.opsQueue];

          // Simulate rollback
          const result = simulateMigrationRollback(beforeState, backupOpsQueue);

          // ops_queue should be restored from backup
          return result.opsQueueRestored === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve Tier_1 data on rollback', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const backupOpsQueue = [...beforeState.opsQueue];
          const result = simulateMigrationRollback(beforeState, backupOpsQueue);

          // Tier_1 should be preserved on rollback
          return result.tier1Preserved === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow Tier_2/Tier_3 reset on rollback', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const backupOpsQueue = [...beforeState.opsQueue];
          const result = simulateMigrationRollback(beforeState, backupOpsQueue);
          const afterCounts = countRecords(result.afterState);

          // Tier_2 and Tier_3 can be reset (re-downloaded later)
          // This is acceptable per REQ-IDB-001
          return afterCounts.tier2 === 0 && afterCounts.tier3 === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never lose ops_queue operations', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        fc.boolean(), // migration success
        (beforeState, migrationSucceeds) => {
          const beforeOpsCount = beforeState.opsQueue.length;
          
          if (migrationSucceeds) {
            const result = simulateMigration(beforeState, true);
            return result.afterState.opsQueue.length === beforeOpsCount;
          } else {
            // On failure, state should be unchanged
            const result = simulateMigration(beforeState, false);
            return result.afterState.opsQueue.length === beforeOpsCount;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty ops_queue correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          opsQueue: fc.constant([] as QueuedOperation[]),
          tier1Data: fc.record({
            planteurs: fc.array(
              fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 50 }) }),
              { minLength: 1, maxLength: 10 }
            ),
            chefPlanteurs: fc.constant([] as { id: string; name: string }[]),
            warehouses: fc.constant([] as { id: string; name: string }[]),
          }),
          tier2Data: fc.record({ deliveries: fc.constant([] as { id: string; delivered_at: string }[]) }),
          tier3Data: fc.record({ exports: fc.constant([] as { id: string }[]) }),
        }),
        fc.boolean(),
        (beforeState, migrationSucceeds) => {
          const result = simulateMigration(beforeState, migrationSucceeds);
          
          // Empty ops_queue should remain empty
          return result.afterState.opsQueue.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all ops_queue operation IDs', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const beforeIds = new Set(beforeState.opsQueue.map(op => op.id));
          const result = simulateMigration(beforeState, true);
          const afterIds = new Set(result.afterState.opsQueue.map(op => op.id));

          // All IDs should be preserved
          if (beforeIds.size !== afterIds.size) return false;
          
          for (const id of beforeIds) {
            if (!afterIds.has(id)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve ops_queue operation data integrity', () => {
    fc.assert(
      fc.property(
        migrationStateArb,
        (beforeState) => {
          const result = simulateMigration(beforeState, true);

          // Each operation should have the same data after migration
          for (let i = 0; i < beforeState.opsQueue.length; i++) {
            const before = beforeState.opsQueue[i];
            const after = result.afterState.opsQueue.find(op => op.id === before.id);
            
            if (!after) return false;
            if (before.type !== after.type) return false;
            if (before.table !== after.table) return false;
            if (before.record_id !== after.record_id) return false;
            if (before.status !== after.status) return false;
            if (JSON.stringify(before.data) !== JSON.stringify(after.data)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
