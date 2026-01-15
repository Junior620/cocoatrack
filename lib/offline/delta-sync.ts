// CocoaTrack V2 - Delta Sync Manager
// Handles incremental synchronization using cursor-based delta sync
// Requirements: REQ-OFF-001, REQ-OFF-002, REQ-OFF-003

import { createClient } from '@/lib/supabase/client';

import {
  getSyncMetadata,
  updateSyncMetadata,
  savePlanteurs,
  saveChefPlanteurs,
  saveWarehouses,
  type CachedPlanteur,
  type CachedChefPlanteur,
  type CachedWarehouse,
  type SyncMetadata,
} from './indexed-db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sync cursor for tracking delta sync position
 * REQ-OFF-003: Incremental Delta Sync
 */
export interface SyncCursor {
  table: string;
  last_updated_at: string;
  last_id: string;            // For same-timestamp ordering
  record_count: number;
}

/**
 * Delta sync result from server
 */
export interface DeltaSyncResult<T> {
  records: T[];
  cursor: SyncCursor;
  has_more: boolean;
}

/**
 * Tables supported for delta sync
 */
export type DeltaSyncTable = 'planteurs' | 'chef_planteurs' | 'warehouses' | 'deliveries';

/**
 * Data tier for sync prioritization
 * REQ-OFF-001, REQ-OFF-002: Tier-based sync
 */
export type DataTier = 1 | 2 | 3;

/**
 * Tier sync configuration
 */
export interface TierSyncConfig {
  tier: DataTier;
  tables: DeltaSyncTable[];
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default batch size for delta sync
 */
export const DEFAULT_BATCH_SIZE = 100;

/**
 * Maximum batch size for delta sync
 */
export const MAX_BATCH_SIZE = 500;

/**
 * Tier configurations
 * REQ-OFF-001, REQ-OFF-002: Tier-based sync
 */
export const TIER_CONFIGS: TierSyncConfig[] = [
  {
    tier: 1,
    tables: ['planteurs', 'chef_planteurs', 'warehouses'],
    description: 'Critical terrain data - planteurs, warehouses, recent deliveries',
  },
  {
    tier: 2,
    tables: ['deliveries'],
    description: 'Historical deliveries (8-30 days)',
  },
  {
    tier: 3,
    tables: [],
    description: 'Exports, dashboards (optional)',
  },
];

/**
 * Initial cursor for first sync (epoch start)
 */
export const INITIAL_CURSOR_DATE = '1970-01-01T00:00:00.000Z';

// ============================================================================
// DELTA SYNC MANAGER CLASS
// ============================================================================

/**
 * DeltaSyncManager handles incremental synchronization using cursor-based delta sync
 * REQ-OFF-003: Incremental Delta Sync
 */
export class DeltaSyncManager {
  private supabase = createClient();
  private isSyncing = false;

  // ==========================================================================
  // CURSOR MANAGEMENT
  // ==========================================================================

  /**
   * Gets the sync cursor for a table
   * REQ-OFF-003: Cursor storage in sync_metadata store
   * 
   * @param table - Table name to get cursor for
   * @returns SyncCursor or null if no cursor exists
   */
  async getCursor(table: DeltaSyncTable): Promise<SyncCursor | null> {
    const metadata = await getSyncMetadata(table);
    
    if (!metadata) {
      return null;
    }

    // Convert SyncMetadata to SyncCursor
    // The last_sync_at field stores the cursor position
    return {
      table,
      last_updated_at: metadata.last_sync_at,
      last_id: '', // Will be stored in a separate field or derived
      record_count: metadata.record_count,
    };
  }

  /**
   * Updates the sync cursor for a table
   * REQ-OFF-003: Cursor storage in sync_metadata store
   * 
   * @param table - Table name to update cursor for
   * @param cursor - New cursor position
   */
  async updateCursor(table: DeltaSyncTable, cursor: SyncCursor): Promise<void> {
    const metadata: SyncMetadata = {
      key: table,
      last_sync_at: cursor.last_updated_at,
      last_full_sync_at: null,
      record_count: cursor.record_count,
    };

    await updateSyncMetadata(metadata);
  }

  /**
   * Resets the cursor for a table (for full sync)
   * 
   * @param table - Table name to reset cursor for
   */
  async resetCursor(table: DeltaSyncTable): Promise<void> {
    const metadata: SyncMetadata = {
      key: table,
      last_sync_at: INITIAL_CURSOR_DATE,
      last_full_sync_at: null,
      record_count: 0,
    };

    await updateSyncMetadata(metadata);
  }

  // ==========================================================================
  // DELTA FETCH
  // ==========================================================================

  /**
   * Fetches delta records from server using cursor-based pagination
   * REQ-OFF-003: Query: updated_at > last OR (updated_at = last AND id > last_id)
   * 
   * @param table - Table to fetch delta for
   * @param limit - Maximum records to fetch (default: DEFAULT_BATCH_SIZE)
   * @returns Delta sync result with records and new cursor
   */
  async fetchDelta<T extends { id: string; updated_at: string }>(
    table: DeltaSyncTable,
    limit: number = DEFAULT_BATCH_SIZE
  ): Promise<DeltaSyncResult<T>> {
    // Get current cursor
    const cursor = await this.getCursor(table);
    const lastUpdatedAt = cursor?.last_updated_at || INITIAL_CURSOR_DATE;
    const lastId = cursor?.last_id || '';

    // Build query with proper ordering
    // Query: updated_at > last OR (updated_at = last AND id > last_id)
    // This ensures we don't miss records with the same timestamp
    let query = this.supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(Math.min(limit, MAX_BATCH_SIZE));

    // Apply cursor filter
    if (lastId) {
      // Complex filter: (updated_at > last) OR (updated_at = last AND id > last_id)
      query = query.or(
        `updated_at.gt.${lastUpdatedAt},and(updated_at.eq.${lastUpdatedAt},id.gt.${lastId})`
      );
    } else {
      // Simple filter: updated_at > last
      query = query.gt('updated_at', lastUpdatedAt);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Delta sync failed for ${table}: ${error.message}`);
    }

    const records = (data || []) as T[];
    const hasMore = records.length === limit;

    // Calculate new cursor from last record
    let newCursor: SyncCursor;
    if (records.length > 0) {
      const lastRecord = records[records.length - 1];
      newCursor = {
        table,
        last_updated_at: lastRecord.updated_at,
        last_id: lastRecord.id,
        record_count: (cursor?.record_count || 0) + records.length,
      };
    } else {
      newCursor = cursor || {
        table,
        last_updated_at: lastUpdatedAt,
        last_id: lastId,
        record_count: 0,
      };
    }

    // Update cursor after successful fetch
    await this.updateCursor(table, newCursor);

    return {
      records,
      cursor: newCursor,
      has_more: hasMore,
    };
  }

  /**
   * Fetches all delta records for a table (handles pagination)
   * 
   * @param table - Table to fetch delta for
   * @param onProgress - Optional callback for progress updates
   * @returns All delta records
   */
  async fetchAllDelta<T extends { id: string; updated_at: string }>(
    table: DeltaSyncTable,
    onProgress?: (fetched: number, hasMore: boolean) => void
  ): Promise<T[]> {
    const allRecords: T[] = [];
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchDelta<T>(table);
      allRecords.push(...result.records);
      hasMore = result.has_more;

      if (onProgress) {
        onProgress(allRecords.length, hasMore);
      }
    }

    return allRecords;
  }

  // ==========================================================================
  // FULL SYNC
  // ==========================================================================

  /**
   * Performs a full sync for a table (resets cursor and fetches all)
   * 
   * @param table - Table to full sync
   * @param onProgress - Optional callback for progress updates
   */
  async fullSync(
    table: DeltaSyncTable,
    onProgress?: (fetched: number, hasMore: boolean) => void
  ): Promise<void> {
    // Reset cursor to start from beginning
    await this.resetCursor(table);

    // Fetch all records
    const records = await this.fetchAllDelta(table, onProgress);

    // Store records based on table type
    await this.storeRecords(table, records);

    // Update last_full_sync_at
    const cursor = await this.getCursor(table);
    if (cursor) {
      const metadata: SyncMetadata = {
        key: table,
        last_sync_at: cursor.last_updated_at,
        last_full_sync_at: new Date().toISOString(),
        record_count: cursor.record_count,
      };
      await updateSyncMetadata(metadata);
    }
  }

  // ==========================================================================
  // TIER-SPECIFIC SYNC METHODS
  // ==========================================================================

  /**
   * Syncs Tier 1 data: planteurs, warehouses, recent deliveries
   * REQ-OFF-001: Pre-fetch Intelligent
   * 
   * @param onProgress - Optional callback for progress updates
   */
  async syncTier1(
    onProgress?: (table: string, fetched: number, total: number) => void
  ): Promise<void> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;

    try {
      const tier1Config = TIER_CONFIGS.find(c => c.tier === 1);
      if (!tier1Config) return;

      for (const table of tier1Config.tables) {
        const records = await this.fetchAllDelta(table, (fetched, hasMore) => {
          if (onProgress) {
            onProgress(table, fetched, hasMore ? fetched + 100 : fetched);
          }
        });

        await this.storeRecords(table, records);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Syncs Tier 2 data: historical deliveries (8-30 days)
   * REQ-OFF-002: Selective Sync
   * 
   * @param onProgress - Optional callback for progress updates
   */
  async syncTier2(
    onProgress?: (table: string, fetched: number, total: number) => void
  ): Promise<void> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;

    try {
      // Tier 2 focuses on historical deliveries
      // Filter deliveries between 8-30 days old
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const { data, error } = await this.supabase
        .from('deliveries')
        .select('*')
        .gte('delivered_at', thirtyDaysAgo.toISOString())
        .lt('delivered_at', eightDaysAgo.toISOString())
        .order('delivered_at', { ascending: false });

      if (error) {
        throw new Error(`Tier 2 sync failed: ${error.message}`);
      }

      if (onProgress) {
        onProgress('deliveries', data?.length || 0, data?.length || 0);
      }

      // Store deliveries with tier 2 marker
      // Note: Delivery caching will be implemented in a separate store
      console.log(`[DeltaSyncManager] Tier 2 sync: ${data?.length || 0} historical deliveries`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Syncs Tier 3 data: exports, dashboards (optional)
   * REQ-OFF-002: Selective Sync
   * 
   * @param onProgress - Optional callback for progress updates
   */
  async syncTier3(
    onProgress?: (table: string, fetched: number, total: number) => void
  ): Promise<void> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;

    try {
      // Tier 3 is optional and includes exports, dashboards
      // This is a placeholder for future implementation
      console.log('[DeltaSyncManager] Tier 3 sync: optional data (not implemented)');
      
      if (onProgress) {
        onProgress('exports', 0, 0);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // ==========================================================================
  // STORAGE HELPERS
  // ==========================================================================

  /**
   * Stores records in IndexedDB based on table type
   * 
   * @param table - Table name
   * @param records - Records to store
   */
  private async storeRecords(
    table: DeltaSyncTable,
    records: unknown[]
  ): Promise<void> {
    const now = new Date().toISOString();

    switch (table) {
      case 'planteurs': {
        const planteurs = records.map(r => ({
          ...(r as CachedPlanteur),
          _cached_at: now,
          _synced_at: now,
        }));
        await savePlanteurs(planteurs);
        break;
      }
      case 'chef_planteurs': {
        const chefPlanteurs = records.map(r => ({
          ...(r as CachedChefPlanteur),
          _cached_at: now,
          _synced_at: now,
        }));
        await saveChefPlanteurs(chefPlanteurs);
        break;
      }
      case 'warehouses': {
        const warehouses = records.map(r => ({
          ...(r as CachedWarehouse),
          _cached_at: now,
          _synced_at: now,
        }));
        await saveWarehouses(warehouses);
        break;
      }
      case 'deliveries': {
        // Deliveries will be stored in a separate cache store
        // This will be implemented with the deliveries_cache store
        console.log(`[DeltaSyncManager] Storing ${records.length} deliveries (cache store TBD)`);
        break;
      }
    }
  }

  // ==========================================================================
  // STATUS METHODS
  // ==========================================================================

  /**
   * Checks if sync is currently running
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Gets sync status for all tables
   */
  async getSyncStatus(): Promise<Map<DeltaSyncTable, SyncCursor | null>> {
    const status = new Map<DeltaSyncTable, SyncCursor | null>();
    const tables: DeltaSyncTable[] = ['planteurs', 'chef_planteurs', 'warehouses', 'deliveries'];

    for (const table of tables) {
      const cursor = await this.getCursor(table);
      status.set(table, cursor);
    }

    return status;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let deltaSyncManagerInstance: DeltaSyncManager | null = null;

/**
 * Gets the singleton DeltaSyncManager instance
 */
export function getDeltaSyncManager(): DeltaSyncManager {
  if (!deltaSyncManagerInstance) {
    deltaSyncManagerInstance = new DeltaSyncManager();
  }
  return deltaSyncManagerInstance;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a cursor is stale (older than specified hours)
 * 
 * @param cursor - Cursor to check
 * @param maxAgeHours - Maximum age in hours (default: 24)
 * @returns true if cursor is stale
 */
export function isCursorStale(cursor: SyncCursor | null, maxAgeHours: number = 24): boolean {
  if (!cursor) return true;

  const cursorDate = new Date(cursor.last_updated_at);
  const now = new Date();
  const ageMs = now.getTime() - cursorDate.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}

/**
 * Formats cursor for display
 * 
 * @param cursor - Cursor to format
 * @returns Formatted string
 */
export function formatCursor(cursor: SyncCursor | null): string {
  if (!cursor) return 'Never synced';

  const date = new Date(cursor.last_updated_at);
  return `Last sync: ${date.toLocaleString()} (${cursor.record_count} records)`;
}
