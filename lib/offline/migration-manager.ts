/**
 * CocoaTrack V2 - Migration Manager
 * 
 * Handles IndexedDB schema migrations with safety guarantees:
 * - Backup ops_queue before migration
 * - Log errors with details
 * - Offer "Réinitialiser les données" option
 * - Preserve ops_queue in backup
 * 
 * Requirements: REQ-IDB-001, REQ-IDB-002
 */

import {
  DB_NAME,
  DB_VERSION,
  QueuedOperation,
  ErrorLog,
  backupOpsQueue,
  getOpsQueueBackup,
  clearOpsQueueBackup,
  logMigrationError,
  getMigrationError,
  clearMigrationError,
  openDatabase,
  closeDatabase,
  logError,
} from './indexed-db';

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  status: 'idle' | 'migrating' | 'success' | 'failed' | 'rollback_needed';
  error?: string;
  opsQueueBackupCount: number;
  lastMigrationAt?: string;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  opsQueuePreserved: boolean;
  opsQueueCount: number;
  error?: string;
  rollbackAvailable: boolean;
}

export interface RollbackResult {
  success: boolean;
  opsQueueRestored: boolean;
  opsQueueCount: number;
  error?: string;
}

export interface ResetResult {
  success: boolean;
  opsQueuePreserved: boolean;
  opsQueueCount: number;
  error?: string;
}

// ============================================================================
// MIGRATION STATUS
// ============================================================================

const MIGRATION_STATUS_KEY = 'cocoatrack_migration_status';

/**
 * Gets the current migration status
 */
export function getMigrationStatus(): MigrationStatus {
  try {
    const stored = localStorage.getItem(MIGRATION_STATUS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[MigrationManager] Failed to read migration status:', e);
  }
  
  return {
    currentVersion: 0,
    targetVersion: DB_VERSION,
    status: 'idle',
    opsQueueBackupCount: 0,
  };
}

/**
 * Updates the migration status
 */
function setMigrationStatus(status: Partial<MigrationStatus>): void {
  try {
    const current = getMigrationStatus();
    const updated = { ...current, ...status };
    localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[MigrationManager] Failed to save migration status:', e);
  }
}

/**
 * Clears the migration status
 */
export function clearMigrationStatus(): void {
  try {
    localStorage.removeItem(MIGRATION_STATUS_KEY);
  } catch (e) {
    console.warn('[MigrationManager] Failed to clear migration status:', e);
  }
}

// ============================================================================
// MIGRATION OPERATIONS
// ============================================================================

/**
 * Checks if a migration is needed
 */
export async function isMigrationNeeded(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onerror = () => {
      // Database doesn't exist, migration will create it
      resolve(true);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const currentVersion = db.version;
      db.close();
      resolve(currentVersion < DB_VERSION);
    };
    
    request.onupgradeneeded = () => {
      // Migration is needed
      resolve(true);
    };
  });
}

/**
 * Gets the current database version
 */
export async function getCurrentDatabaseVersion(): Promise<number> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onerror = () => {
      resolve(0);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const version = db.version;
      db.close();
      resolve(version);
    };
  });
}

/**
 * Performs the database migration with safety guarantees
 * REQ-IDB-001: Schema migration safety
 */
export async function performMigration(): Promise<MigrationResult> {
  const fromVersion = await getCurrentDatabaseVersion();
  
  setMigrationStatus({
    currentVersion: fromVersion,
    targetVersion: DB_VERSION,
    status: 'migrating',
  });
  
  try {
    // Step 1: Backup ops_queue
    console.log('[MigrationManager] Backing up ops_queue...');
    const opsBackup = await backupOpsQueue();
    
    setMigrationStatus({
      opsQueueBackupCount: opsBackup.length,
    });
    
    console.log(`[MigrationManager] Backed up ${opsBackup.length} operations`);
    
    // Step 2: Perform migration by opening the database
    console.log(`[MigrationManager] Migrating from v${fromVersion} to v${DB_VERSION}...`);
    await openDatabase();
    
    // Step 3: Verify ops_queue was preserved
    const db = await openDatabase();
    const tx = db.transaction('ops_queue', 'readonly');
    const opsCount = await tx.store.count();
    await tx.done;
    
    const opsQueuePreserved = opsCount >= opsBackup.length;
    
    if (!opsQueuePreserved) {
      console.warn(`[MigrationManager] ops_queue count mismatch: expected ${opsBackup.length}, got ${opsCount}`);
    }
    
    // Step 4: Clear backup on success
    clearOpsQueueBackup();
    clearMigrationError();
    
    setMigrationStatus({
      currentVersion: DB_VERSION,
      status: 'success',
      lastMigrationAt: new Date().toISOString(),
    });
    
    console.log('[MigrationManager] Migration completed successfully');
    
    // Log success to error_logs for diagnostics
    await logError({
      type: 'migration',
      code: 'MIGRATION_SUCCESS',
      message: `Successfully migrated from v${fromVersion} to v${DB_VERSION}`,
      context: {
        fromVersion,
        toVersion: DB_VERSION,
        opsQueueCount: opsCount,
      },
    });
    
    return {
      success: true,
      fromVersion,
      toVersion: DB_VERSION,
      opsQueuePreserved,
      opsQueueCount: opsCount,
      rollbackAvailable: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[MigrationManager] Migration failed:', error);
    
    // Log the error
    logMigrationError(error as Error, {
      fromVersion,
      toVersion: DB_VERSION,
      operation: 'performMigration',
    });
    
    setMigrationStatus({
      status: 'failed',
      error: errorMessage,
    });
    
    return {
      success: false,
      fromVersion,
      toVersion: DB_VERSION,
      opsQueuePreserved: true, // Backup is still available
      opsQueueCount: getOpsQueueBackup().length,
      error: errorMessage,
      rollbackAvailable: true,
    };
  }
}

/**
 * Performs a rollback after a failed migration
 * REQ-IDB-002: Migration rollback
 */
export async function performRollback(): Promise<RollbackResult> {
  try {
    console.log('[MigrationManager] Starting rollback...');
    
    // Step 1: Get the backup
    const opsBackup = getOpsQueueBackup();
    console.log(`[MigrationManager] Found ${opsBackup.length} operations in backup`);
    
    // Step 2: Close and delete the database
    await closeDatabase();
    await indexedDB.deleteDatabase(DB_NAME);
    console.log('[MigrationManager] Database deleted');
    
    // Step 3: Reopen the database (will create fresh schema)
    const db = await openDatabase();
    
    // Step 4: Restore ops_queue from backup
    if (opsBackup.length > 0) {
      const tx = db.transaction('ops_queue', 'readwrite');
      for (const op of opsBackup) {
        await tx.store.put(op);
      }
      await tx.done;
      console.log(`[MigrationManager] Restored ${opsBackup.length} operations`);
    }
    
    // Step 5: Clear backup and error
    clearOpsQueueBackup();
    clearMigrationError();
    
    setMigrationStatus({
      currentVersion: DB_VERSION,
      status: 'success',
      lastMigrationAt: new Date().toISOString(),
    });
    
    // Log rollback success
    await logError({
      type: 'migration',
      code: 'ROLLBACK_SUCCESS',
      message: `Successfully rolled back and restored ${opsBackup.length} operations`,
      context: {
        opsQueueCount: opsBackup.length,
      },
    });
    
    return {
      success: true,
      opsQueueRestored: true,
      opsQueueCount: opsBackup.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[MigrationManager] Rollback failed:', error);
    
    logMigrationError(error as Error, {
      operation: 'performRollback',
    });
    
    return {
      success: false,
      opsQueueRestored: false,
      opsQueueCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Resets the database while preserving ops_queue
 * REQ-IDB-002: Offer "Réinitialiser les données" option
 */
export async function resetDatabase(): Promise<ResetResult> {
  try {
    console.log('[MigrationManager] Starting database reset...');
    
    // Step 1: Backup ops_queue
    const opsBackup = await backupOpsQueue();
    console.log(`[MigrationManager] Backed up ${opsBackup.length} operations`);
    
    // Step 2: Close and delete the database
    await closeDatabase();
    await indexedDB.deleteDatabase(DB_NAME);
    console.log('[MigrationManager] Database deleted');
    
    // Step 3: Reopen the database (will create fresh schema)
    const db = await openDatabase();
    
    // Step 4: Restore ops_queue from backup
    if (opsBackup.length > 0) {
      const tx = db.transaction('ops_queue', 'readwrite');
      for (const op of opsBackup) {
        await tx.store.put(op);
      }
      await tx.done;
      console.log(`[MigrationManager] Restored ${opsBackup.length} operations`);
    }
    
    // Step 5: Clear backup
    clearOpsQueueBackup();
    clearMigrationError();
    clearMigrationStatus();
    
    // Log reset success
    await logError({
      type: 'migration',
      code: 'RESET_SUCCESS',
      message: `Successfully reset database and preserved ${opsBackup.length} operations`,
      context: {
        opsQueueCount: opsBackup.length,
      },
    });
    
    return {
      success: true,
      opsQueuePreserved: true,
      opsQueueCount: opsBackup.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[MigrationManager] Reset failed:', error);
    
    logMigrationError(error as Error, {
      operation: 'resetDatabase',
    });
    
    return {
      success: false,
      opsQueuePreserved: false,
      opsQueueCount: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Gets migration diagnostics for the diagnostics screen
 * REQ-OBS-001: Diagnostics screen
 */
export async function getMigrationDiagnostics(): Promise<{
  currentVersion: number;
  targetVersion: number;
  migrationNeeded: boolean;
  lastError: ReturnType<typeof getMigrationError>;
  backupAvailable: boolean;
  backupCount: number;
  status: MigrationStatus;
}> {
  const currentVersion = await getCurrentDatabaseVersion();
  const migrationNeeded = await isMigrationNeeded();
  const lastError = getMigrationError();
  const backup = getOpsQueueBackup();
  const status = getMigrationStatus();
  
  return {
    currentVersion,
    targetVersion: DB_VERSION,
    migrationNeeded,
    lastError,
    backupAvailable: backup.length > 0,
    backupCount: backup.length,
    status,
  };
}

/**
 * Checks if a rollback is available
 */
export function isRollbackAvailable(): boolean {
  const backup = getOpsQueueBackup();
  const error = getMigrationError();
  return backup.length > 0 || error !== null;
}

/**
 * Gets the last migration error for display
 */
export function getLastMigrationError(): {
  message: string;
  timestamp: string;
  context: Record<string, unknown>;
} | null {
  const error = getMigrationError();
  if (!error) return null;
  
  return {
    message: error.message,
    timestamp: error.timestamp,
    context: error.context,
  };
}
