// CocoaTrack V2 - IndexedDB Implementation
// Schema: planteurs, chef_planteurs, warehouses, ops_queue, app_state, error_logs, deliveries_cache
// Requirements: 8.5, REQ-SYNC-006, REQ-SEC-003, REQ-IDB-001, REQ-IDB-002

import { openDB, DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';

import type { SyncOperation, SyncStatus, OperationPriority } from '@/types';

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

/**
 * Current database version
 * Increment this when making schema changes
 * v2: Added user_id, cooperative_id, priority, idempotency_key indexes to ops_queue
 * v3: Added app_state, error_logs, deliveries_cache stores + name_norm, updated_at indexes
 * v4: Force recreation of all stores (fix for corrupted v3 databases)
 */
export const DB_VERSION = 4;

/**
 * Database name
 */
export const DB_NAME = 'cocoatrack-offline';

/**
 * Cached planteur record
 */
export interface CachedPlanteur {
  id: string;
  name: string;
  name_norm: string;  // v3: Normalized name for prefix search
  code: string;
  phone: string | null;
  cni: string | null;
  chef_planteur_id: string;
  cooperative_id: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Sync metadata
  _cached_at: string;
  _synced_at: string | null;
}

/**
 * Cached chef_planteur record
 */
export interface CachedChefPlanteur {
  id: string;
  name: string;
  name_norm: string;  // v3: Normalized name for prefix search
  code: string;
  phone: string | null;
  cni: string | null;
  cooperative_id: string;
  region: string | null;
  departement: string | null;
  localite: string | null;
  latitude: number | null;
  longitude: number | null;
  quantite_max_kg: number;
  validation_status: 'pending' | 'validated' | 'rejected';
  created_at: string;
  updated_at: string;
  // Sync metadata
  _cached_at: string;
  _synced_at: string | null;
}

/**
 * Cached warehouse record
 */
export interface CachedWarehouse {
  id: string;
  name: string;
  name_norm: string;  // v3: Normalized name for prefix search
  code: string;
  cooperative_id: string;
  latitude: number | null;
  longitude: number | null;
  capacity_kg: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Sync metadata
  _cached_at: string;
  _synced_at: string | null;
}

/**
 * Offline operation in the queue
 * Extended with user_id, cooperative_id, priority for cross-user safety and priority queue
 */
export interface QueuedOperation extends SyncOperation {
  // Additional queue metadata
  queued_at: string;
  last_attempt_at: string | null;
  next_retry_at: string | null;
}

/**
 * Sync metadata for tracking last sync times
 */
export interface SyncMetadata {
  key: string;
  last_sync_at: string;
  last_full_sync_at: string | null;
  record_count: number;
}

/**
 * App state record for storing application state
 * REQ-IDB-001: New store for v3
 */
export interface AppStateRecord {
  key: string;
  value: unknown;
  updated_at: string;
}

/**
 * Error log entry for diagnostics
 * REQ-OBS-002: Error tracking
 */
export interface ErrorLog {
  id: string;
  timestamp: string;
  type: 'sync' | 'storage' | 'network' | 'validation' | 'migration';
  code: string;
  message: string;
  context: Record<string, unknown>;
}

/**
 * Cached delivery record with tier classification
 * REQ-OFF-007: Data tier classification
 */
export interface CachedDelivery {
  id: string;
  client_id: string;
  server_id: string | null;
  data: Record<string, unknown>;
  tier: 1 | 2 | 3;
  status: 'synced' | 'pending_sync' | 'conflict';
  cached_at: string;
  delivered_at: string;
  updated_at: string;
}

/**
 * IndexedDB schema definition
 * v3: Added app_state, error_logs, deliveries_cache stores
 */
interface CocoaTrackDB extends DBSchema {
  planteurs: {
    key: string;
    value: CachedPlanteur;
    indexes: {
      'by-chef-planteur': string;
      'by-cooperative': string;
      'by-code': string;
      'by-name': string;
      'by-name_norm': string;      // v3: For prefix search
      'by-updated_at': string;     // v3: For delta sync ordering
    };
  };
  chef_planteurs: {
    key: string;
    value: CachedChefPlanteur;
    indexes: {
      'by-cooperative': string;
      'by-code': string;
      'by-name': string;
      'by-validation-status': string;
      'by-name_norm': string;      // v3: For prefix search
      'by-updated_at': string;     // v3: For delta sync ordering
    };
  };
  warehouses: {
    key: string;
    value: CachedWarehouse;
    indexes: {
      'by-cooperative': string;
      'by-code': string;
      'by-name_norm': string;      // v3: For prefix search
      'by-updated_at': string;     // v3: For delta sync ordering
    };
  };
  ops_queue: {
    key: string;
    value: QueuedOperation;
    indexes: {
      'by-status': SyncStatus;
      'by-table': string;
      'by-created-at': string;
      'by-next-retry': string;
      'by-user_id': string;           // CRITICAL: cross-user isolation
      'by-idempotency_key': string;   // Prevent duplicates
      'by-priority': OperationPriority; // Priority queue ordering
    };
  };
  sync_metadata: {
    key: string;
    value: SyncMetadata;
  };
  // v3: New stores
  app_state: {
    key: string;
    value: AppStateRecord;
  };
  error_logs: {
    key: string;
    value: ErrorLog;
    indexes: {
      'by-timestamp': string;
      'by-type': string;
    };
  };
  deliveries_cache: {
    key: string;
    value: CachedDelivery;
    indexes: {
      'by-date': string;
      'by-tier': number;
      'by-updated_at': string;
      'by-status': string;
    };
  };
}

// ============================================================================
// DATABASE INSTANCE
// ============================================================================

let dbInstance: IDBPDatabase<CocoaTrackDB> | null = null;

/**
 * Flag to prevent infinite recursion during database recreation
 */
let isRecreatingDatabase = false;

/**
 * Backup storage key for ops_queue during migration
 * REQ-IDB-001: Backup ops_queue before migration
 */
const OPS_QUEUE_BACKUP_KEY = 'cocoatrack_ops_queue_backup';

/**
 * Migration error storage key
 * REQ-IDB-002: Log errors with details
 */
const MIGRATION_ERROR_KEY = 'cocoatrack_migration_error';

/**
 * Normalizes a name for prefix search
 * REQ-OFF-005: Offline search optimization
 */
export function normalizeNameClient(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')      // Keep only alphanumeric
    .trim();
}

/**
 * Backs up ops_queue to localStorage before migration
 * REQ-IDB-001: Backup ops_queue before migration
 */
export async function backupOpsQueue(): Promise<QueuedOperation[]> {
  try {
    // Try to open the database at the current version to read ops_queue
    const request = indexedDB.open(DB_NAME);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        
        // Check if ops_queue store exists
        if (!db.objectStoreNames.contains('ops_queue')) {
          db.close();
          resolve([]);
          return;
        }
        
        const tx = db.transaction('ops_queue', 'readonly');
        const store = tx.objectStore('ops_queue');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          const ops = getAllRequest.result as QueuedOperation[];
          db.close();
          
          // Store backup in localStorage
          if (ops.length > 0) {
            try {
              localStorage.setItem(OPS_QUEUE_BACKUP_KEY, JSON.stringify(ops));
              console.log(`[Migration] Backed up ${ops.length} ops_queue operations`);
            } catch (e) {
              console.warn('[Migration] Failed to backup to localStorage:', e);
            }
          }
          
          resolve(ops);
        };
        
        getAllRequest.onerror = () => {
          db.close();
          reject(getAllRequest.error);
        };
      };
    });
  } catch (error) {
    console.warn('[Migration] Failed to backup ops_queue:', error);
    return [];
  }
}

/**
 * Restores ops_queue from localStorage backup
 * REQ-IDB-002: Preserve ops_queue in backup
 */
export function getOpsQueueBackup(): QueuedOperation[] {
  try {
    const backup = localStorage.getItem(OPS_QUEUE_BACKUP_KEY);
    if (backup) {
      return JSON.parse(backup) as QueuedOperation[];
    }
  } catch (e) {
    console.warn('[Migration] Failed to read ops_queue backup:', e);
  }
  return [];
}

/**
 * Clears the ops_queue backup from localStorage
 */
export function clearOpsQueueBackup(): void {
  try {
    localStorage.removeItem(OPS_QUEUE_BACKUP_KEY);
  } catch (e) {
    console.warn('[Migration] Failed to clear ops_queue backup:', e);
  }
}

/**
 * Logs a migration error
 * REQ-IDB-002: Log errors with details
 */
export function logMigrationError(error: Error, context: Record<string, unknown>): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    context,
  };
  
  try {
    localStorage.setItem(MIGRATION_ERROR_KEY, JSON.stringify(errorInfo));
    console.error('[Migration] Error logged:', errorInfo);
  } catch (e) {
    console.error('[Migration] Failed to log error:', e);
  }
}

/**
 * Gets the last migration error
 */
export function getMigrationError(): { timestamp: string; message: string; stack?: string; context: Record<string, unknown> } | null {
  try {
    const error = localStorage.getItem(MIGRATION_ERROR_KEY);
    if (error) {
      return JSON.parse(error);
    }
  } catch (e) {
    console.warn('[Migration] Failed to read migration error:', e);
  }
  return null;
}

/**
 * Clears the migration error
 */
export function clearMigrationError(): void {
  try {
    localStorage.removeItem(MIGRATION_ERROR_KEY);
  } catch (e) {
    console.warn('[Migration] Failed to clear migration error:', e);
  }
}

/**
 * Opens or creates the IndexedDB database
 * Handles schema migrations automatically
 * REQ-IDB-001: Schema migration safety
 */
export async function openDatabase(): Promise<IDBPDatabase<CocoaTrackDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  // Backup ops_queue before migration
  await backupOpsQueue();

  console.log(`[IndexedDB] Opening database ${DB_NAME} version ${DB_VERSION}`);

  try {
    dbInstance = await openDB<CocoaTrackDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[IndexedDB] Upgrade callback triggered: v${oldVersion} → v${newVersion}`);
        console.log(`[IndexedDB] Existing stores: ${Array.from(db.objectStoreNames).join(', ') || 'none'}`);

        // Version 1: Initial schema
        if (oldVersion < 1) {
          console.log('[IndexedDB] Creating v1 schema...');
          // Planteurs store
          const planteursStore = db.createObjectStore('planteurs', {
            keyPath: 'id',
          });
          planteursStore.createIndex('by-chef-planteur', 'chef_planteur_id');
          planteursStore.createIndex('by-cooperative', 'cooperative_id');
          planteursStore.createIndex('by-code', 'code', { unique: true });
          planteursStore.createIndex('by-name', 'name');

          // Chef planteurs store
          const chefPlanteursStore = db.createObjectStore('chef_planteurs', {
            keyPath: 'id',
          });
          chefPlanteursStore.createIndex('by-cooperative', 'cooperative_id');
          chefPlanteursStore.createIndex('by-code', 'code', { unique: true });
          chefPlanteursStore.createIndex('by-name', 'name');
          chefPlanteursStore.createIndex(
            'by-validation-status',
            'validation_status'
          );

          // Warehouses store
          const warehousesStore = db.createObjectStore('warehouses', {
            keyPath: 'id',
          });
          warehousesStore.createIndex('by-cooperative', 'cooperative_id');
          warehousesStore.createIndex('by-code', 'code', { unique: true });

          // Operations queue store
          const opsQueueStore = db.createObjectStore('ops_queue', {
            keyPath: 'id',
          });
          opsQueueStore.createIndex('by-status', 'status');
          opsQueueStore.createIndex('by-table', 'table');
          opsQueueStore.createIndex('by-created-at', 'created_at');
          opsQueueStore.createIndex('by-next-retry', 'next_retry_at');

          // Sync metadata store
          db.createObjectStore('sync_metadata', {
            keyPath: 'key',
          });

          console.log(`[IndexedDB] Database schema v1 created. Stores: ${Array.from(db.objectStoreNames).join(', ')}`);
        }

        // Version 2: Add new indexes for cross-user safety and priority queue
        if (oldVersion < 2) {
          // Only add indexes if upgrading from v1 (store already exists)
          // When upgrading from v0 to v3, the v1 block creates the store with basic indexes,
          // and we need to add the v2 indexes here. Check if store exists first.
          if (db.objectStoreNames.contains('ops_queue')) {
            const opsQueueStore = transaction.objectStore('ops_queue');
            
            // Add new indexes for enhanced sync engine
            // These indexes support REQ-SYNC-006 (priority queue) and REQ-SEC-003 (cross-user safety)
            // Only create indexes if they don't already exist
            if (!opsQueueStore.indexNames.contains('by-user_id')) {
              opsQueueStore.createIndex('by-user_id', 'user_id');
            }
            if (!opsQueueStore.indexNames.contains('by-idempotency_key')) {
              opsQueueStore.createIndex('by-idempotency_key', 'idempotency_key', { unique: true });
            }
            if (!opsQueueStore.indexNames.contains('by-priority')) {
              opsQueueStore.createIndex('by-priority', 'priority');
            }

            console.log('Database schema v2 created - added user_id, idempotency_key, priority indexes');
          }
        }

        // Version 3: Add new stores and indexes for PWA offline improvements
        // REQ-IDB-001: Add new stores (app_state, error_logs, deliveries_cache)
        if (oldVersion < 3) {
          // Create app_state store if it doesn't exist
          if (!db.objectStoreNames.contains('app_state')) {
            db.createObjectStore('app_state', {
              keyPath: 'key',
            });
          }

          // Create error_logs store with indexes if it doesn't exist
          if (!db.objectStoreNames.contains('error_logs')) {
            const errorLogsStore = db.createObjectStore('error_logs', {
              keyPath: 'id',
            });
            errorLogsStore.createIndex('by-timestamp', 'timestamp');
            errorLogsStore.createIndex('by-type', 'type');
          }

          // Create deliveries_cache store with indexes if it doesn't exist
          if (!db.objectStoreNames.contains('deliveries_cache')) {
            const deliveriesCacheStore = db.createObjectStore('deliveries_cache', {
              keyPath: 'id',
            });
            deliveriesCacheStore.createIndex('by-date', 'delivered_at');
            deliveriesCacheStore.createIndex('by-tier', 'tier');
            deliveriesCacheStore.createIndex('by-updated_at', 'updated_at');
            deliveriesCacheStore.createIndex('by-status', 'status');
          }

          // Add new indexes to existing stores for delta sync and search
          // REQ-OFF-003: Delta sync ordering
          // REQ-OFF-005: Offline search optimization
          
          if (db.objectStoreNames.contains('planteurs')) {
            const planteursStore = transaction.objectStore('planteurs');
            if (!planteursStore.indexNames.contains('by-name_norm')) {
              planteursStore.createIndex('by-name_norm', 'name_norm');
            }
            if (!planteursStore.indexNames.contains('by-updated_at')) {
              planteursStore.createIndex('by-updated_at', 'updated_at');
            }
          }

          if (db.objectStoreNames.contains('chef_planteurs')) {
            const chefPlanteursStore = transaction.objectStore('chef_planteurs');
            if (!chefPlanteursStore.indexNames.contains('by-name_norm')) {
              chefPlanteursStore.createIndex('by-name_norm', 'name_norm');
            }
            if (!chefPlanteursStore.indexNames.contains('by-updated_at')) {
              chefPlanteursStore.createIndex('by-updated_at', 'updated_at');
            }
          }

          if (db.objectStoreNames.contains('warehouses')) {
            const warehousesStore = transaction.objectStore('warehouses');
            if (!warehousesStore.indexNames.contains('by-name_norm')) {
              warehousesStore.createIndex('by-name_norm', 'name_norm');
            }
            if (!warehousesStore.indexNames.contains('by-updated_at')) {
              warehousesStore.createIndex('by-updated_at', 'updated_at');
            }
          }

          console.log('Database schema v3 created - added app_state, error_logs, deliveries_cache stores and name_norm, updated_at indexes');
        }

        // Version 4: Force recreation of missing stores (fix for corrupted v3 databases)
        if (oldVersion < 4) {
          console.log('[IndexedDB] Running v4 migration - ensuring all stores exist...');
          
          // Recreate any missing v1 stores
          if (!db.objectStoreNames.contains('planteurs')) {
            console.log('[IndexedDB] Creating missing planteurs store');
            const planteursStore = db.createObjectStore('planteurs', { keyPath: 'id' });
            planteursStore.createIndex('by-chef-planteur', 'chef_planteur_id');
            planteursStore.createIndex('by-cooperative', 'cooperative_id');
            planteursStore.createIndex('by-code', 'code', { unique: true });
            planteursStore.createIndex('by-name', 'name');
            planteursStore.createIndex('by-name_norm', 'name_norm');
            planteursStore.createIndex('by-updated_at', 'updated_at');
          }
          
          if (!db.objectStoreNames.contains('chef_planteurs')) {
            console.log('[IndexedDB] Creating missing chef_planteurs store');
            const chefPlanteursStore = db.createObjectStore('chef_planteurs', { keyPath: 'id' });
            chefPlanteursStore.createIndex('by-cooperative', 'cooperative_id');
            chefPlanteursStore.createIndex('by-code', 'code', { unique: true });
            chefPlanteursStore.createIndex('by-name', 'name');
            chefPlanteursStore.createIndex('by-validation-status', 'validation_status');
            chefPlanteursStore.createIndex('by-name_norm', 'name_norm');
            chefPlanteursStore.createIndex('by-updated_at', 'updated_at');
          }
          
          if (!db.objectStoreNames.contains('warehouses')) {
            console.log('[IndexedDB] Creating missing warehouses store');
            const warehousesStore = db.createObjectStore('warehouses', { keyPath: 'id' });
            warehousesStore.createIndex('by-cooperative', 'cooperative_id');
            warehousesStore.createIndex('by-code', 'code', { unique: true });
            warehousesStore.createIndex('by-name_norm', 'name_norm');
            warehousesStore.createIndex('by-updated_at', 'updated_at');
          }
          
          if (!db.objectStoreNames.contains('ops_queue')) {
            console.log('[IndexedDB] Creating missing ops_queue store');
            const opsQueueStore = db.createObjectStore('ops_queue', { keyPath: 'id' });
            opsQueueStore.createIndex('by-status', 'status');
            opsQueueStore.createIndex('by-table', 'table');
            opsQueueStore.createIndex('by-created-at', 'created_at');
            opsQueueStore.createIndex('by-next-retry', 'next_retry_at');
            opsQueueStore.createIndex('by-user_id', 'user_id');
            opsQueueStore.createIndex('by-idempotency_key', 'idempotency_key', { unique: true });
            opsQueueStore.createIndex('by-priority', 'priority');
          }
          
          if (!db.objectStoreNames.contains('sync_metadata')) {
            console.log('[IndexedDB] Creating missing sync_metadata store');
            db.createObjectStore('sync_metadata', { keyPath: 'key' });
          }
          
          if (!db.objectStoreNames.contains('app_state')) {
            console.log('[IndexedDB] Creating missing app_state store');
            db.createObjectStore('app_state', { keyPath: 'key' });
          }
          
          if (!db.objectStoreNames.contains('error_logs')) {
            console.log('[IndexedDB] Creating missing error_logs store');
            const errorLogsStore = db.createObjectStore('error_logs', { keyPath: 'id' });
            errorLogsStore.createIndex('by-timestamp', 'timestamp');
            errorLogsStore.createIndex('by-type', 'type');
          }
          
          if (!db.objectStoreNames.contains('deliveries_cache')) {
            console.log('[IndexedDB] Creating missing deliveries_cache store');
            const deliveriesCacheStore = db.createObjectStore('deliveries_cache', { keyPath: 'id' });
            deliveriesCacheStore.createIndex('by-date', 'delivered_at');
            deliveriesCacheStore.createIndex('by-tier', 'tier');
            deliveriesCacheStore.createIndex('by-updated_at', 'updated_at');
            deliveriesCacheStore.createIndex('by-status', 'status');
          }
          
          console.log(`[IndexedDB] v4 migration complete. Stores: ${Array.from(db.objectStoreNames).join(', ')}`);
        }

        // Future migrations go here:
        // if (oldVersion < 5) { ... }
      },
      blocked() {
        console.warn('Database upgrade blocked by another tab');
      },
      blocking() {
        console.warn('This tab is blocking a database upgrade');
        // Close the database to allow upgrade
        dbInstance?.close();
        dbInstance = null;
      },
      terminated() {
        console.error('Database connection terminated unexpectedly');
        dbInstance = null;
      },
    });

    // Log database state after opening
    console.log(`[IndexedDB] Database opened. Version: ${dbInstance.version}, Stores: ${Array.from(dbInstance.objectStoreNames).join(', ') || 'none'}`);

    // Verify all required stores exist after migration
    const requiredStores = ['planteurs', 'chef_planteurs', 'warehouses', 'ops_queue', 'sync_metadata', 'app_state', 'error_logs', 'deliveries_cache'] as const;
    const missingStores = requiredStores.filter(store => !dbInstance!.objectStoreNames.contains(store));
    
    if (missingStores.length > 0) {
      console.error(`[Migration] Missing stores after migration: ${missingStores.join(', ')}`);
      
      // Prevent infinite recursion
      if (isRecreatingDatabase) {
        console.error('[Migration] Database recreation failed - stores still missing after recreation');
        throw new Error(`IndexedDB migration failed: missing stores ${missingStores.join(', ')}`);
      }
      
      console.log('[Migration] Deleting corrupted database and recreating...');
      isRecreatingDatabase = true;
      
      // Close and delete the corrupted database
      dbInstance.close();
      dbInstance = null;
      
      // Wait for database deletion to complete
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => {
          console.log('[Migration] Database deleted successfully');
          resolve();
        };
        deleteRequest.onerror = () => {
          console.error('[Migration] Failed to delete database:', deleteRequest.error);
          reject(deleteRequest.error);
        };
        deleteRequest.onblocked = () => {
          console.warn('[Migration] Database deletion blocked by another connection');
          // Still resolve after a timeout
          setTimeout(resolve, 1000);
        };
      });
      
      // Small delay to ensure deletion is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Recursively call openDatabase to create fresh schema
      const result = await openDatabase();
      isRecreatingDatabase = false;
      return result;
    }

    // Clear backup after successful migration
    clearOpsQueueBackup();
    clearMigrationError();

    return dbInstance;
  } catch (error) {
    // Log migration error
    logMigrationError(error as Error, { 
      dbName: DB_NAME, 
      targetVersion: DB_VERSION 
    });
    throw error;
  }
}

/**
 * Closes the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Deletes the entire database (for testing/reset)
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  await indexedDB.deleteDatabase(DB_NAME);
}

// ============================================================================
// PLANTEURS OPERATIONS
// ============================================================================

/**
 * Gets all cached planteurs
 */
export async function getAllPlanteurs(): Promise<CachedPlanteur[]> {
  const db = await openDatabase();
  return db.getAll('planteurs');
}

/**
 * Gets a planteur by ID
 */
export async function getPlanteur(id: string): Promise<CachedPlanteur | undefined> {
  const db = await openDatabase();
  return db.get('planteurs', id);
}

/**
 * Gets planteurs by chef_planteur_id
 */
export async function getPlanteursByChef(
  chefPlanteurId: string
): Promise<CachedPlanteur[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('planteurs', 'by-chef-planteur', chefPlanteurId);
}

/**
 * Gets planteurs by cooperative_id
 */
export async function getPlanteursByCooperative(
  cooperativeId: string
): Promise<CachedPlanteur[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('planteurs', 'by-cooperative', cooperativeId);
}

/**
 * Saves a planteur to the cache
 */
export async function savePlanteur(planteur: CachedPlanteur): Promise<void> {
  const db = await openDatabase();
  await db.put('planteurs', planteur);
}

/**
 * Saves multiple planteurs to the cache
 */
export async function savePlanteurs(planteurs: CachedPlanteur[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('planteurs', 'readwrite');
  await Promise.all([
    ...planteurs.map((p) => tx.store.put(p)),
    tx.done,
  ]);
}

/**
 * Deletes a planteur from the cache
 */
export async function deletePlanteur(id: string): Promise<void> {
  const db = await openDatabase();
  await db.delete('planteurs', id);
}

/**
 * Clears all planteurs from the cache
 */
export async function clearPlanteurs(): Promise<void> {
  const db = await openDatabase();
  await db.clear('planteurs');
}

// ============================================================================
// CHEF PLANTEURS OPERATIONS
// ============================================================================

/**
 * Gets all cached chef_planteurs
 */
export async function getAllChefPlanteurs(): Promise<CachedChefPlanteur[]> {
  const db = await openDatabase();
  return db.getAll('chef_planteurs');
}

/**
 * Gets a chef_planteur by ID
 */
export async function getChefPlanteur(
  id: string
): Promise<CachedChefPlanteur | undefined> {
  const db = await openDatabase();
  return db.get('chef_planteurs', id);
}

/**
 * Gets chef_planteurs by cooperative_id
 */
export async function getChefPlanteursByCooperative(
  cooperativeId: string
): Promise<CachedChefPlanteur[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('chef_planteurs', 'by-cooperative', cooperativeId);
}

/**
 * Saves a chef_planteur to the cache
 */
export async function saveChefPlanteur(
  chefPlanteur: CachedChefPlanteur
): Promise<void> {
  const db = await openDatabase();
  await db.put('chef_planteurs', chefPlanteur);
}

/**
 * Saves multiple chef_planteurs to the cache
 */
export async function saveChefPlanteurs(
  chefPlanteurs: CachedChefPlanteur[]
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('chef_planteurs', 'readwrite');
  await Promise.all([
    ...chefPlanteurs.map((cp) => tx.store.put(cp)),
    tx.done,
  ]);
}

/**
 * Deletes a chef_planteur from the cache
 */
export async function deleteChefPlanteur(id: string): Promise<void> {
  const db = await openDatabase();
  await db.delete('chef_planteurs', id);
}

/**
 * Clears all chef_planteurs from the cache
 */
export async function clearChefPlanteurs(): Promise<void> {
  const db = await openDatabase();
  await db.clear('chef_planteurs');
}

// ============================================================================
// WAREHOUSES OPERATIONS
// ============================================================================

/**
 * Gets all cached warehouses
 */
export async function getAllWarehouses(): Promise<CachedWarehouse[]> {
  const db = await openDatabase();
  return db.getAll('warehouses');
}

/**
 * Gets a warehouse by ID
 */
export async function getWarehouse(
  id: string
): Promise<CachedWarehouse | undefined> {
  const db = await openDatabase();
  return db.get('warehouses', id);
}

/**
 * Gets warehouses by cooperative_id
 */
export async function getWarehousesByCooperative(
  cooperativeId: string
): Promise<CachedWarehouse[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('warehouses', 'by-cooperative', cooperativeId);
}

/**
 * Saves a warehouse to the cache
 */
export async function saveWarehouse(warehouse: CachedWarehouse): Promise<void> {
  const db = await openDatabase();
  await db.put('warehouses', warehouse);
}

/**
 * Saves multiple warehouses to the cache
 */
export async function saveWarehouses(warehouses: CachedWarehouse[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('warehouses', 'readwrite');
  await Promise.all([
    ...warehouses.map((w) => tx.store.put(w)),
    tx.done,
  ]);
}

/**
 * Clears all warehouses from the cache
 */
export async function clearWarehouses(): Promise<void> {
  const db = await openDatabase();
  await db.clear('warehouses');
}

// ============================================================================
// OPERATIONS QUEUE
// ============================================================================

/**
 * Gets all queued operations
 */
export async function getAllQueuedOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAll('ops_queue');
}

/**
 * Gets queued operations by status
 */
export async function getQueuedOperationsByStatus(
  status: SyncStatus
): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('ops_queue', 'by-status', status);
}

/**
 * Gets pending operations in FIFO order
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  const all = await db.getAllFromIndex('ops_queue', 'by-status', 'pending');
  // Sort by created_at for FIFO
  return all.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Gets operations ready for retry
 */
export async function getRetryableOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  const failed = await db.getAllFromIndex('ops_queue', 'by-status', 'failed');
  const now = new Date().toISOString();
  return failed.filter(
    (op) => op.next_retry_at && op.next_retry_at <= now
  );
}

/**
 * Gets a queued operation by ID
 */
export async function getQueuedOperation(
  id: string
): Promise<QueuedOperation | undefined> {
  const db = await openDatabase();
  return db.get('ops_queue', id);
}

/**
 * Adds an operation to the queue
 */
export async function enqueueOperation(
  operation: QueuedOperation
): Promise<void> {
  const db = await openDatabase();
  await db.put('ops_queue', operation);
}

/**
 * Updates an operation in the queue
 */
export async function updateQueuedOperation(
  operation: QueuedOperation
): Promise<void> {
  const db = await openDatabase();
  await db.put('ops_queue', operation);
}

/**
 * Removes an operation from the queue
 */
export async function dequeueOperation(id: string): Promise<void> {
  const db = await openDatabase();
  await db.delete('ops_queue', id);
}

/**
 * Clears all operations from the queue
 */
export async function clearOperationsQueue(): Promise<void> {
  const db = await openDatabase();
  await db.clear('ops_queue');
}

/**
 * Gets the count of pending operations
 */
export async function getPendingOperationsCount(): Promise<number> {
  const db = await openDatabase();
  return db.countFromIndex('ops_queue', 'by-status', 'pending');
}

/**
 * Gets operations that need review (conflicts)
 */
export async function getConflictOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('ops_queue', 'by-status', 'needs_review');
}

/**
 * Gets operations by user_id (for cross-user safety)
 * REQ-SEC-003: Cross-user isolation
 */
export async function getOperationsByUserId(userId: string): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('ops_queue', 'by-user_id', userId);
}

/**
 * Gets an operation by idempotency key (for duplicate prevention)
 * REQ-SYNC-006: Idempotency
 */
export async function getOperationByIdempotencyKey(
  idempotencyKey: string
): Promise<QueuedOperation | undefined> {
  const db = await openDatabase();
  return db.getFromIndex('ops_queue', 'by-idempotency_key', idempotencyKey);
}

/**
 * Gets operations by priority (for priority queue)
 * REQ-SYNC-006: Priority queue ordering
 */
export async function getOperationsByPriority(
  priority: OperationPriority
): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('ops_queue', 'by-priority', priority);
}

/**
 * Gets operations with pending_auth status (for logout handling)
 * REQ-SEC-003: Logout data cleanup
 */
export async function getPendingAuthOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('ops_queue', 'by-status', 'pending_auth');
}

/**
 * Updates all operations for a user to pending_auth status
 * REQ-SEC-003: Mark ops_queue as 'pending_auth' on logout
 */
export async function markUserOperationsPendingAuth(userId: string): Promise<number> {
  const db = await openDatabase();
  const ops = await db.getAllFromIndex('ops_queue', 'by-user_id', userId);
  
  const tx = db.transaction('ops_queue', 'readwrite');
  let count = 0;
  
  for (const op of ops) {
    if (op.status === 'pending' || op.status === 'failed') {
      op.status = 'pending_auth';
      await tx.store.put(op);
      count++;
    }
  }
  
  await tx.done;
  return count;
}

/**
 * Restores pending_auth operations to pending status for a user
 * REQ-SEC-003: Restore ops_queue on same user login
 */
export async function restoreUserOperations(userId: string): Promise<number> {
  const db = await openDatabase();
  const ops = await db.getAllFromIndex('ops_queue', 'by-user_id', userId);
  
  const tx = db.transaction('ops_queue', 'readwrite');
  let count = 0;
  
  for (const op of ops) {
    if (op.status === 'pending_auth') {
      op.status = 'pending';
      await tx.store.put(op);
      count++;
    }
  }
  
  await tx.done;
  return count;
}

// ============================================================================
// SYNC METADATA
// ============================================================================

/**
 * Gets sync metadata for a table
 */
export async function getSyncMetadata(
  table: string
): Promise<SyncMetadata | undefined> {
  const db = await openDatabase();
  return db.get('sync_metadata', table);
}

/**
 * Updates sync metadata for a table
 */
export async function updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
  const db = await openDatabase();
  await db.put('sync_metadata', metadata);
}

/**
 * Gets all sync metadata
 */
export async function getAllSyncMetadata(): Promise<SyncMetadata[]> {
  const db = await openDatabase();
  return db.getAll('sync_metadata');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the total size of the database (approximate)
 */
export async function getDatabaseSize(): Promise<number> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return 0;
  }
  const estimate = await navigator.storage.estimate();
  return estimate.usage || 0;
}

/**
 * Checks if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Searches planteurs by name or code
 */
export async function searchPlanteurs(query: string): Promise<CachedPlanteur[]> {
  const db = await openDatabase();
  const all = await db.getAll('planteurs');
  const lowerQuery = query.toLowerCase();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.code.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Searches chef_planteurs by name or code
 */
export async function searchChefPlanteurs(
  query: string
): Promise<CachedChefPlanteur[]> {
  const db = await openDatabase();
  const all = await db.getAll('chef_planteurs');
  const lowerQuery = query.toLowerCase();
  return all.filter(
    (cp) =>
      cp.name.toLowerCase().includes(lowerQuery) ||
      cp.code.toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// APP STATE OPERATIONS (v3)
// ============================================================================

/**
 * Gets an app state value by key
 */
export async function getAppState<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  const record = await db.get('app_state', key);
  return record?.value as T | undefined;
}

/**
 * Sets an app state value
 */
export async function setAppState<T = unknown>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  await db.put('app_state', {
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Deletes an app state value
 */
export async function deleteAppState(key: string): Promise<void> {
  const db = await openDatabase();
  await db.delete('app_state', key);
}

/**
 * Gets all app state records
 */
export async function getAllAppState(): Promise<AppStateRecord[]> {
  const db = await openDatabase();
  return db.getAll('app_state');
}

/**
 * Clears all app state
 */
export async function clearAppState(): Promise<void> {
  const db = await openDatabase();
  await db.clear('app_state');
}

// ============================================================================
// ERROR LOGS OPERATIONS (v3)
// REQ-OBS-002: Error tracking
// ============================================================================

/**
 * Maximum number of error logs to keep
 */
const MAX_ERROR_LOGS = 100;

/**
 * Logs an error to IndexedDB
 */
export async function logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<string> {
  const db = await openDatabase();
  
  const errorLog: ErrorLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...error,
  };
  
  await db.put('error_logs', errorLog);
  
  // Cleanup old logs if we exceed the limit
  const allLogs = await db.getAllFromIndex('error_logs', 'by-timestamp');
  if (allLogs.length > MAX_ERROR_LOGS) {
    const logsToDelete = allLogs.slice(0, allLogs.length - MAX_ERROR_LOGS);
    const tx = db.transaction('error_logs', 'readwrite');
    await Promise.all([
      ...logsToDelete.map((log) => tx.store.delete(log.id)),
      tx.done,
    ]);
  }
  
  return errorLog.id;
}

/**
 * Gets all error logs
 */
export async function getAllErrorLogs(): Promise<ErrorLog[]> {
  const db = await openDatabase();
  return db.getAll('error_logs');
}

/**
 * Gets recent error logs (last N)
 */
export async function getRecentErrorLogs(count: number = 10): Promise<ErrorLog[]> {
  const db = await openDatabase();
  const allLogs = await db.getAllFromIndex('error_logs', 'by-timestamp');
  // Return the most recent logs (sorted by timestamp descending)
  return allLogs.slice(-count).reverse();
}

/**
 * Gets error logs by type
 */
export async function getErrorLogsByType(type: ErrorLog['type']): Promise<ErrorLog[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('error_logs', 'by-type', type);
}

/**
 * Clears all error logs
 */
export async function clearErrorLogs(): Promise<void> {
  const db = await openDatabase();
  await db.clear('error_logs');
}

/**
 * Gets error log count
 */
export async function getErrorLogCount(): Promise<number> {
  const db = await openDatabase();
  return db.count('error_logs');
}

// ============================================================================
// DELIVERIES CACHE OPERATIONS (v3)
// REQ-OFF-007: Data tier classification
// ============================================================================

/**
 * Assigns a tier to a delivery based on delivered_at date
 * REQ-OFF-007: Tier assignment
 */
export function assignDeliveryTier(delivered_at: string): 1 | 2 | 3 {
  const daysAgo = (Date.now() - new Date(delivered_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return 1;
  if (daysAgo <= 30) return 2;
  return 3;
}

/**
 * Gets all cached deliveries
 */
export async function getAllCachedDeliveries(): Promise<CachedDelivery[]> {
  const db = await openDatabase();
  return db.getAll('deliveries_cache');
}

/**
 * Gets a cached delivery by ID
 */
export async function getCachedDelivery(id: string): Promise<CachedDelivery | undefined> {
  const db = await openDatabase();
  return db.get('deliveries_cache', id);
}

/**
 * Gets cached deliveries by tier
 */
export async function getCachedDeliveriesByTier(tier: 1 | 2 | 3): Promise<CachedDelivery[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('deliveries_cache', 'by-tier', tier);
}

/**
 * Gets cached deliveries by status
 */
export async function getCachedDeliveriesByStatus(
  status: CachedDelivery['status']
): Promise<CachedDelivery[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('deliveries_cache', 'by-status', status);
}

/**
 * Saves a delivery to the cache with automatic tier assignment
 */
export async function saveCachedDelivery(
  delivery: Omit<CachedDelivery, 'tier' | 'cached_at'>
): Promise<void> {
  const db = await openDatabase();
  const cachedDelivery: CachedDelivery = {
    ...delivery,
    tier: assignDeliveryTier(delivery.delivered_at),
    cached_at: new Date().toISOString(),
  };
  await db.put('deliveries_cache', cachedDelivery);
}

/**
 * Saves multiple deliveries to the cache
 */
export async function saveCachedDeliveries(
  deliveries: Omit<CachedDelivery, 'tier' | 'cached_at'>[]
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('deliveries_cache', 'readwrite');
  const now = new Date().toISOString();
  
  await Promise.all([
    ...deliveries.map((d) => {
      const cachedDelivery: CachedDelivery = {
        ...d,
        tier: assignDeliveryTier(d.delivered_at),
        cached_at: now,
      };
      return tx.store.put(cachedDelivery);
    }),
    tx.done,
  ]);
}

/**
 * Deletes a cached delivery
 */
export async function deleteCachedDelivery(id: string): Promise<void> {
  const db = await openDatabase();
  await db.delete('deliveries_cache', id);
}

/**
 * Clears all cached deliveries
 */
export async function clearCachedDeliveries(): Promise<void> {
  const db = await openDatabase();
  await db.clear('deliveries_cache');
}

/**
 * Clears cached deliveries by tier
 * REQ-OFF-007: Eviction policy
 */
export async function clearCachedDeliveriesByTier(tier: 1 | 2 | 3): Promise<number> {
  const db = await openDatabase();
  const deliveries = await db.getAllFromIndex('deliveries_cache', 'by-tier', tier);
  
  const tx = db.transaction('deliveries_cache', 'readwrite');
  await Promise.all([
    ...deliveries.map((d) => tx.store.delete(d.id)),
    tx.done,
  ]);
  
  return deliveries.length;
}

/**
 * Gets delivery count by tier
 */
export async function getDeliveryCountByTier(): Promise<Record<1 | 2 | 3, number>> {
  const db = await openDatabase();
  const tier1 = await db.countFromIndex('deliveries_cache', 'by-tier', 1);
  const tier2 = await db.countFromIndex('deliveries_cache', 'by-tier', 2);
  const tier3 = await db.countFromIndex('deliveries_cache', 'by-tier', 3);
  
  return { 1: tier1, 2: tier2, 3: tier3 };
}

/**
 * Updates delivery tiers based on current date
 * Should be called periodically to move deliveries between tiers
 */
export async function updateDeliveryTiers(): Promise<{ updated: number }> {
  const db = await openDatabase();
  const allDeliveries = await db.getAll('deliveries_cache');
  
  const tx = db.transaction('deliveries_cache', 'readwrite');
  let updated = 0;
  
  for (const delivery of allDeliveries) {
    const newTier = assignDeliveryTier(delivery.delivered_at);
    if (newTier !== delivery.tier) {
      delivery.tier = newTier;
      await tx.store.put(delivery);
      updated++;
    }
  }
  
  await tx.done;
  return { updated };
}

// ============================================================================
// MIGRATION UTILITIES (v3)
// REQ-IDB-001, REQ-IDB-002: Migration safety and rollback
// ============================================================================

/**
 * Resets the database while preserving ops_queue
 * REQ-IDB-002: Offer "Réinitialiser les données" option
 */
export async function resetDatabasePreservingOpsQueue(): Promise<{
  success: boolean;
  opsQueueCount: number;
  error?: string;
}> {
  try {
    // First, backup ops_queue
    const opsBackup = await backupOpsQueue();
    
    // Close and delete the database
    await closeDatabase();
    await indexedDB.deleteDatabase(DB_NAME);
    
    // Reopen the database (will create fresh schema)
    const db = await openDatabase();
    
    // Restore ops_queue from backup
    if (opsBackup.length > 0) {
      const tx = db.transaction('ops_queue', 'readwrite');
      await Promise.all([
        ...opsBackup.map((op) => tx.store.put(op)),
        tx.done,
      ]);
    }
    
    // Clear the backup
    clearOpsQueueBackup();
    
    return {
      success: true,
      opsQueueCount: opsBackup.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logMigrationError(error as Error, { operation: 'resetDatabasePreservingOpsQueue' });
    
    return {
      success: false,
      opsQueueCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Gets database statistics for diagnostics
 * REQ-OBS-001: Diagnostics screen
 */
export async function getDatabaseStats(): Promise<{
  version: number;
  stores: Record<string, number>;
  totalRecords: number;
}> {
  const db = await openDatabase();
  
  const stores: Record<string, number> = {};
  let totalRecords = 0;
  
  // Count records in each store
  const storeNames = ['planteurs', 'chef_planteurs', 'warehouses', 'ops_queue', 'sync_metadata', 'app_state', 'error_logs', 'deliveries_cache'] as const;
  
  for (const storeName of storeNames) {
    try {
      const count = await db.count(storeName);
      stores[storeName] = count;
      totalRecords += count;
    } catch {
      stores[storeName] = 0;
    }
  }
  
  return {
    version: DB_VERSION,
    stores,
    totalRecords,
  };
}

/**
 * Searches planteurs by normalized name (prefix search)
 * REQ-OFF-005: Offline search optimization
 */
export async function searchPlanteursByNameNorm(query: string, limit: number = 50): Promise<CachedPlanteur[]> {
  const db = await openDatabase();
  const normalizedQuery = normalizeNameClient(query);
  
  // Use IDBKeyRange for prefix search
  const range = IDBKeyRange.bound(normalizedQuery, normalizedQuery + '\uffff');
  
  const results: CachedPlanteur[] = [];
  const tx = db.transaction('planteurs', 'readonly');
  const index = tx.store.index('by-name_norm');
  
  let cursor = await index.openCursor(range);
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return results;
}

/**
 * Searches chef_planteurs by normalized name (prefix search)
 * REQ-OFF-005: Offline search optimization
 */
export async function searchChefPlanteursByNameNorm(query: string, limit: number = 50): Promise<CachedChefPlanteur[]> {
  const db = await openDatabase();
  const normalizedQuery = normalizeNameClient(query);
  
  const range = IDBKeyRange.bound(normalizedQuery, normalizedQuery + '\uffff');
  
  const results: CachedChefPlanteur[] = [];
  const tx = db.transaction('chef_planteurs', 'readonly');
  const index = tx.store.index('by-name_norm');
  
  let cursor = await index.openCursor(range);
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return results;
}

/**
 * Searches warehouses by normalized name (prefix search)
 * REQ-OFF-005: Offline search optimization
 */
export async function searchWarehousesByNameNorm(query: string, limit: number = 50): Promise<CachedWarehouse[]> {
  const db = await openDatabase();
  const normalizedQuery = normalizeNameClient(query);
  
  const range = IDBKeyRange.bound(normalizedQuery, normalizedQuery + '\uffff');
  
  const results: CachedWarehouse[] = [];
  const tx = db.transaction('warehouses', 'readonly');
  const index = tx.store.index('by-name_norm');
  
  let cursor = await index.openCursor(range);
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  
  return results;
}
