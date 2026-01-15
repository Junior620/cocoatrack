// CocoaTrack V2 - Offline Entity Manager
// Handles offline entity creation with UUID v4 client_id and pending_sync status
// Requirements: REQ-OFF-010, REQ-OFF-012

import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Status of an offline entity
 * - pending_sync: Created offline, waiting to be synced to server
 * - synced: Successfully synced to server
 * - sync_failed: Sync failed, needs retry or manual intervention
 */
export type OfflineEntityStatus = 'pending_sync' | 'synced' | 'sync_failed';

/**
 * Base interface for all offline entities
 */
export interface OfflineEntity {
  /** Client-generated UUID v4 */
  client_id: string;
  /** Server-assigned ID after sync (null until synced) */
  server_id: string | null;
  /** Current sync status */
  status: OfflineEntityStatus;
  /** Timestamp when entity was created offline */
  created_offline_at: string;
  /** Timestamp when entity was synced (null until synced) */
  synced_at: string | null;
  /** Fields that may have validation issues (for offline validation) */
  validation_warnings?: string[];
}

/**
 * Mapping between client_id and server_id
 */
export interface IdMapping {
  client_id: string;
  server_id: string;
  table: string;
  mapped_at: string;
}

/**
 * Result of creating an offline entity
 */
export interface OfflineEntityResult<T> {
  entity: T & OfflineEntity;
  isValid: boolean;
  validationWarnings: string[];
}

/**
 * Validation result for offline entities
 */
export interface OfflineValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error (blocks creation)
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation warning (allows creation but marks for review)
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// UUID GENERATION AND VALIDATION
// ============================================================================

/**
 * Generates a UUID v4 for client-side entity creation
 * REQ-OFF-010: Generate UUID v4 client_id
 * 
 * @returns A valid UUID v4 string
 */
export function generateClientId(): string {
  return uuidv4();
}

/**
 * Validates that a string is a valid UUID v4
 * 
 * @param id - The string to validate
 * @returns true if the string is a valid UUID v4
 */
export function isValidUUIDv4(id: string): boolean {
  if (!uuidValidate(id)) {
    return false;
  }
  return uuidVersion(id) === 4;
}

/**
 * Validates that a string is a valid UUID (any version)
 * 
 * @param id - The string to validate
 * @returns true if the string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  return uuidValidate(id);
}

// ============================================================================
// OFFLINE ENTITY CREATION
// ============================================================================

/**
 * Creates an offline entity with proper metadata
 * REQ-OFF-010: Mark status as 'pending_sync'
 * 
 * @param data - The entity data
 * @param validationWarnings - Optional validation warnings
 * @returns The entity with offline metadata
 */
export function createOfflineEntity<T extends Record<string, unknown>>(
  data: T,
  validationWarnings: string[] = []
): T & OfflineEntity {
  const clientId = generateClientId();
  const now = new Date().toISOString();

  return {
    ...data,
    client_id: clientId,
    server_id: null,
    status: 'pending_sync',
    created_offline_at: now,
    synced_at: null,
    validation_warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
  };
}

/**
 * Marks an offline entity as synced and stores the server_id mapping
 * REQ-OFF-010: Store client_id → server_id mapping after sync
 * 
 * @param entity - The offline entity
 * @param serverId - The server-assigned ID
 * @returns The updated entity with synced status
 */
export function markEntitySynced<T extends OfflineEntity>(
  entity: T,
  serverId: string
): T {
  return {
    ...entity,
    server_id: serverId,
    status: 'synced',
    synced_at: new Date().toISOString(),
  };
}

/**
 * Marks an offline entity as sync failed
 * 
 * @param entity - The offline entity
 * @returns The updated entity with sync_failed status
 */
export function markEntitySyncFailed<T extends OfflineEntity>(
  entity: T
): T {
  return {
    ...entity,
    status: 'sync_failed',
  };
}

// ============================================================================
// ID MAPPING STORAGE
// ============================================================================

const ID_MAPPINGS_KEY = 'cocoatrack_id_mappings';

/**
 * In-memory store for ID mappings (used when localStorage is not available)
 * This allows the module to work in Node.js test environments
 */
let inMemoryMappings: IdMapping[] = [];

/**
 * Checks if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stores a client_id → server_id mapping in localStorage (or in-memory fallback)
 * REQ-OFF-010: Store client_id → server_id mapping after sync
 * 
 * @param mapping - The ID mapping to store
 */
export function storeIdMapping(mapping: IdMapping): void {
  const mappings = getIdMappings();
  // Avoid duplicates - update existing or add new
  const existingIndex = mappings.findIndex(m => m.client_id === mapping.client_id);
  if (existingIndex >= 0) {
    mappings[existingIndex] = mapping;
  } else {
    mappings.push(mapping);
  }
  
  if (isLocalStorageAvailable()) {
    localStorage.setItem(ID_MAPPINGS_KEY, JSON.stringify(mappings));
  } else {
    // Use in-memory store for Node.js/test environments
    inMemoryMappings = mappings;
  }
}

/**
 * Gets all stored ID mappings
 * 
 * @returns Array of ID mappings
 */
export function getIdMappings(): IdMapping[] {
  if (isLocalStorageAvailable()) {
    const stored = localStorage.getItem(ID_MAPPINGS_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored) as IdMapping[];
    } catch {
      return [];
    }
  }
  
  // Return in-memory store for Node.js/test environments
  return [...inMemoryMappings];
}

/**
 * Gets the server_id for a given client_id
 * 
 * @param clientId - The client-generated ID
 * @returns The server ID if found, null otherwise
 */
export function getServerIdForClientId(clientId: string): string | null {
  const mappings = getIdMappings();
  const mapping = mappings.find(m => m.client_id === clientId);
  return mapping?.server_id ?? null;
}

/**
 * Gets the client_id for a given server_id
 * 
 * @param serverId - The server-assigned ID
 * @returns The client ID if found, null otherwise
 */
export function getClientIdForServerId(serverId: string): string | null {
  const mappings = getIdMappings();
  const mapping = mappings.find(m => m.server_id === serverId);
  return mapping?.client_id ?? null;
}

/**
 * Resolves an ID to its server_id if it's a client_id, or returns it as-is
 * Useful for resolving references in offline entities
 * 
 * @param id - Either a client_id or server_id
 * @returns The server_id if the input was a client_id with a mapping, otherwise the input
 */
export function resolveToServerId(id: string): string {
  const serverId = getServerIdForClientId(id);
  return serverId ?? id;
}

/**
 * Clears all ID mappings (used on logout)
 */
export function clearIdMappings(): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(ID_MAPPINGS_KEY);
  }
  // Always clear in-memory store
  inMemoryMappings = [];
}

/**
 * Gets ID mappings for a specific table
 * 
 * @param table - The table name
 * @returns Array of ID mappings for the table
 */
export function getIdMappingsForTable(table: string): IdMapping[] {
  return getIdMappings().filter(m => m.table === table);
}

// ============================================================================
// OFFLINE ENTITY HELPERS
// ============================================================================

/**
 * Checks if an entity is an offline entity (has offline metadata)
 * 
 * @param entity - The entity to check
 * @returns true if the entity has offline metadata
 */
export function isOfflineEntity(entity: unknown): entity is OfflineEntity {
  if (!entity || typeof entity !== 'object') return false;
  const obj = entity as Record<string, unknown>;
  return (
    typeof obj.client_id === 'string' &&
    (obj.server_id === null || typeof obj.server_id === 'string') &&
    typeof obj.status === 'string' &&
    ['pending_sync', 'synced', 'sync_failed'].includes(obj.status as string)
  );
}

/**
 * Checks if an entity is pending sync
 * 
 * @param entity - The entity to check
 * @returns true if the entity is pending sync
 */
export function isPendingSync(entity: OfflineEntity): boolean {
  return entity.status === 'pending_sync';
}

/**
 * Checks if an entity has been synced
 * 
 * @param entity - The entity to check
 * @returns true if the entity has been synced
 */
export function isSynced(entity: OfflineEntity): boolean {
  return entity.status === 'synced' && entity.server_id !== null;
}

/**
 * Gets the effective ID for an entity (server_id if synced, client_id otherwise)
 * 
 * @param entity - The offline entity
 * @returns The effective ID to use
 */
export function getEffectiveId(entity: OfflineEntity): string {
  return entity.server_id ?? entity.client_id;
}
