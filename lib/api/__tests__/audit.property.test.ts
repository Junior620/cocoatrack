// CocoaTrack V2 - Audit Property Tests
// Property 11: Audit Log Completeness
// Property 14: Authentication Event Logging
// Validates: Requirements 2.10, 12.1-12.3
//
// For any INSERT, UPDATE, or DELETE operation on audited tables,
// an audit_log entry SHALL be created with the correct actor_id,
// table_name, row_id, action, and data snapshots.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// TYPES
// ============================================================================

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_type: 'user' | 'system';
  table_name: string;
  row_id: string;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface DatabaseOperation {
  action: AuditAction;
  table_name: string;
  row_id: string;
  actor_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
}

interface AuthEvent {
  type: 'login_success' | 'login_failure' | 'logout' | 'token_refresh';
  user_id: string | null;
  email: string;
  ip_address: string | null;
  timestamp: string;
}

// ============================================================================
// AUDIT LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Create an audit log entry from a database operation
 * This mirrors the audit_trigger_func() in the database
 */
export function createAuditLogEntry(operation: DatabaseOperation): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    actor_id: operation.actor_id,
    actor_type: operation.actor_id ? 'user' : 'system',
    table_name: operation.table_name,
    row_id: operation.row_id,
    action: operation.action,
    old_data: operation.action === 'INSERT' ? null : operation.old_data,
    new_data: operation.action === 'DELETE' ? null : operation.new_data,
    ip_address: operation.ip_address,
    created_at: new Date().toISOString(),
  };
}

/**
 * Validate that an audit log entry correctly captures an operation
 */
export function validateAuditLogEntry(
  entry: AuditLogEntry,
  operation: DatabaseOperation
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 11.1: actor_id matches
  if (entry.actor_id !== operation.actor_id) {
    errors.push(`actor_id mismatch: expected ${operation.actor_id}, got ${entry.actor_id}`);
  }

  // Property 11.2: table_name matches
  if (entry.table_name !== operation.table_name) {
    errors.push(`table_name mismatch: expected ${operation.table_name}, got ${entry.table_name}`);
  }

  // Property 11.3: row_id matches
  if (entry.row_id !== operation.row_id) {
    errors.push(`row_id mismatch: expected ${operation.row_id}, got ${entry.row_id}`);
  }

  // Property 11.4: action matches
  if (entry.action !== operation.action) {
    errors.push(`action mismatch: expected ${operation.action}, got ${entry.action}`);
  }

  // Property 11.5: old_data is null for INSERT
  if (operation.action === 'INSERT' && entry.old_data !== null) {
    errors.push('old_data should be null for INSERT');
  }

  // Property 11.6: new_data is null for DELETE
  if (operation.action === 'DELETE' && entry.new_data !== null) {
    errors.push('new_data should be null for DELETE');
  }

  // Property 11.7: old_data and new_data present for UPDATE
  if (operation.action === 'UPDATE') {
    if (entry.old_data === null) {
      errors.push('old_data should not be null for UPDATE');
    }
    if (entry.new_data === null) {
      errors.push('new_data should not be null for UPDATE');
    }
  }

  // Property 11.8: actor_type is correct
  const expectedActorType = operation.actor_id ? 'user' : 'system';
  if (entry.actor_type !== expectedActorType) {
    errors.push(`actor_type mismatch: expected ${expectedActorType}, got ${entry.actor_type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a table is audited
 */
export function isAuditedTable(tableName: string): boolean {
  const auditedTables = [
    'deliveries',
    'planteurs',
    'chef_planteurs',
    'invoices',
    'profiles',
    'warehouses',
    'cooperatives',
  ];
  return auditedTables.includes(tableName);
}

/**
 * Create an auth event log entry
 */
export function createAuthEventLog(event: AuthEvent): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    actor_id: event.user_id,
    actor_type: event.user_id ? 'user' : 'system',
    table_name: 'auth_events',
    row_id: crypto.randomUUID(),
    action: 'INSERT',
    old_data: null,
    new_data: {
      type: event.type,
      email: event.email,
      ip_address: event.ip_address,
      timestamp: event.timestamp,
    },
    ip_address: event.ip_address,
    created_at: event.timestamp,
  };
}

/**
 * Validate auth event logging
 */
export function validateAuthEventLog(
  entry: AuditLogEntry,
  event: AuthEvent
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 14.1: Event type is captured
  if ((entry.new_data as Record<string, unknown>)?.type !== event.type) {
    errors.push(`Event type mismatch`);
  }

  // Property 14.2: Email is captured
  if ((entry.new_data as Record<string, unknown>)?.email !== event.email) {
    errors.push(`Email mismatch`);
  }

  // Property 14.3: Timestamp is captured
  if ((entry.new_data as Record<string, unknown>)?.timestamp !== event.timestamp) {
    errors.push(`Timestamp mismatch`);
  }

  // Property 14.4: IP address is captured
  if (entry.ip_address !== event.ip_address) {
    errors.push(`IP address mismatch`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GENERATORS
// ============================================================================

const auditedTables = [
  'deliveries',
  'planteurs',
  'chef_planteurs',
  'invoices',
  'profiles',
  'warehouses',
  'cooperatives',
];

const auditActions: AuditAction[] = ['INSERT', 'UPDATE', 'DELETE'];

const authEventTypes: AuthEvent['type'][] = [
  'login_success',
  'login_failure',
  'logout',
  'token_refresh',
];

/**
 * Generate a random database operation
 */
function generateOperation(
  action: AuditAction,
  tableName: string,
  rowId: string,
  actorId: string | null,
  seed: number
): DatabaseOperation {
  const generateData = () => ({
    id: rowId,
    name: `Name_${seed}`,
    value: seed * 100,
    updated_at: new Date().toISOString(),
  });

  return {
    action,
    table_name: tableName,
    row_id: rowId,
    actor_id: actorId,
    old_data: action === 'INSERT' ? null : generateData(),
    new_data: action === 'DELETE' ? null : generateData(),
    ip_address: `192.168.${(seed % 256)}.${((seed * 7) % 256)}`,
  };
}

/**
 * Generate a random auth event
 */
function generateAuthEvent(
  type: AuthEvent['type'],
  userId: string | null,
  email: string,
  seed: number
): AuthEvent {
  return {
    type,
    user_id: userId,
    email,
    ip_address: `10.0.${(seed % 256)}.${((seed * 3) % 256)}`,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 11: Audit Log Completeness', () => {
  it('should create audit entry with correct actor_id for any operation', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.1
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.actor_id).toBe(operation.actor_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create audit entry with correct table_name for any operation', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.1
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.table_name).toBe(operation.table_name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create audit entry with correct row_id for any operation', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.1
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.row_id).toBe(operation.row_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create audit entry with correct action for any operation', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.1
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.action).toBe(operation.action);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have null old_data for INSERT operations', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.2
    fc.assert(
      fc.property(
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (tableName, rowId, actorId, seed) => {
          const operation = generateOperation('INSERT', tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.old_data).toBeNull();
          expect(entry.new_data).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have null new_data for DELETE operations', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.2
    fc.assert(
      fc.property(
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (tableName, rowId, actorId, seed) => {
          const operation = generateOperation('DELETE', tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.old_data).not.toBeNull();
          expect(entry.new_data).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have both old_data and new_data for UPDATE operations', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.2
    fc.assert(
      fc.property(
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (tableName, rowId, actorId, seed) => {
          const operation = generateOperation('UPDATE', tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          expect(entry.old_data).not.toBeNull();
          expect(entry.new_data).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set actor_type correctly based on actor_id presence', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.3
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);

          const expectedActorType = operation.actor_id ? 'user' : 'system';
          expect(entry.actor_type).toBe(expectedActorType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should pass full validation for any generated audit entry', () => {
    // Feature: cocoatrack-v2, Property 11: Audit Log Completeness
    // Validates: Requirements 12.1-12.3
    fc.assert(
      fc.property(
        fc.constantFrom(...auditActions),
        fc.constantFrom(...auditedTables),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.integer({ min: 1, max: 1000000 }),
        (action, tableName, rowId, actorId, seed) => {
          const operation = generateOperation(action, tableName, rowId, actorId ?? null, seed);
          const entry = createAuditLogEntry(operation);
          const validation = validateAuditLogEntry(entry, operation);

          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Authentication Event Logging', () => {
  it('should capture event type correctly for any auth event', () => {
    // Feature: cocoatrack-v2, Property 14: Authentication Event Logging
    // Validates: Requirements 2.10
    fc.assert(
      fc.property(
        fc.constantFrom(...authEventTypes),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 1000000 }),
        (eventType, userId, email, seed) => {
          const event = generateAuthEvent(eventType, userId ?? null, email, seed);
          const entry = createAuthEventLog(event);

          expect((entry.new_data as Record<string, unknown>)?.type).toBe(event.type);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should capture email correctly for any auth event', () => {
    // Feature: cocoatrack-v2, Property 14: Authentication Event Logging
    // Validates: Requirements 2.10
    fc.assert(
      fc.property(
        fc.constantFrom(...authEventTypes),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 1000000 }),
        (eventType, userId, email, seed) => {
          const event = generateAuthEvent(eventType, userId ?? null, email, seed);
          const entry = createAuthEventLog(event);

          expect((entry.new_data as Record<string, unknown>)?.email).toBe(event.email);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should capture timestamp correctly for any auth event', () => {
    // Feature: cocoatrack-v2, Property 14: Authentication Event Logging
    // Validates: Requirements 2.10
    fc.assert(
      fc.property(
        fc.constantFrom(...authEventTypes),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 1000000 }),
        (eventType, userId, email, seed) => {
          const event = generateAuthEvent(eventType, userId ?? null, email, seed);
          const entry = createAuthEventLog(event);

          expect((entry.new_data as Record<string, unknown>)?.timestamp).toBe(event.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should pass full validation for any auth event log', () => {
    // Feature: cocoatrack-v2, Property 14: Authentication Event Logging
    // Validates: Requirements 2.10
    fc.assert(
      fc.property(
        fc.constantFrom(...authEventTypes),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.emailAddress(),
        fc.integer({ min: 1, max: 1000000 }),
        (eventType, userId, email, seed) => {
          const event = generateAuthEvent(eventType, userId ?? null, email, seed);
          const entry = createAuthEventLog(event);
          const validation = validateAuthEventLog(entry, event);

          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
