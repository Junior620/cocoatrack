// CocoaTrack V2 - iOS Data Integrity Check
// Checks IndexedDB integrity after periods of inactivity on iOS
// Requirements: REQ-IOS-002

import {
  openDatabase,
  getAllPlanteurs,
  getAllChefPlanteurs,
  getAllWarehouses,
  getAllQueuedOperations,
  getAllSyncMetadata,
} from '@/lib/offline/indexed-db';
import {
  detectIOS,
  getLastActivity,
  recordActivity,
  markIntegrityChecked,
  needsDataIntegrityCheck,
  INACTIVITY_THRESHOLD_DAYS,
  type DataIntegrityResult,
} from './ios-manager';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Storage key for tracking integrity check results
 */
export const INTEGRITY_CHECK_KEY = 'ios_last_integrity_check';

/**
 * Minimum expected records for Tier 1 data
 * If counts are below this after a sync, data may have been purged
 */
export const MINIMUM_EXPECTED_RECORDS = {
  planteurs: 1,
  chef_planteurs: 1,
  warehouses: 1,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Detailed integrity check result
 */
export interface DetailedIntegrityResult extends DataIntegrityResult {
  syncMetadataCount: number;
  lastSyncDates: Record<string, string | null>;
  checkTimestamp: string;
  daysSinceActivity: number;
}

/**
 * Integrity check callback
 */
export type IntegrityCheckCallback = (result: DetailedIntegrityResult) => void;

// ============================================================================
// INTEGRITY CHECK FUNCTIONS
// ============================================================================

/**
 * Performs a comprehensive data integrity check
 * REQ-IOS-002: Check IndexedDB on app start after 7 days inactivity
 * 
 * @returns Detailed integrity check result
 */
export async function checkDataIntegrity(): Promise<DetailedIntegrityResult> {
  const checkTimestamp = new Date().toISOString();
  const lastActivity = getLastActivity();
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  try {
    // Open database to ensure it exists
    await openDatabase();

    // Get counts from all Tier 1 stores
    const [planteurs, chefPlanteurs, warehouses, opsQueue, syncMetadata] = await Promise.all([
      getAllPlanteurs().catch(() => []),
      getAllChefPlanteurs().catch(() => []),
      getAllWarehouses().catch(() => []),
      getAllQueuedOperations().catch(() => []),
      getAllSyncMetadata().catch(() => []),
    ]);

    const planteursCount = planteurs.length;
    const chefPlanteursCount = chefPlanteurs.length;
    const warehousesCount = warehouses.length;
    const opsQueueCount = opsQueue.length;
    const syncMetadataCount = syncMetadata.length;

    // Build last sync dates map
    const lastSyncDates: Record<string, string | null> = {};
    for (const meta of syncMetadata) {
      lastSyncDates[meta.key] = meta.last_sync_at || null;
    }

    // Determine if data is intact
    // Data is considered purged if:
    // 1. We had sync metadata (meaning we synced before)
    // 2. But now have no Tier 1 data
    const hadPreviousSync = syncMetadataCount > 0 || 
      Object.values(lastSyncDates).some(date => date !== null);
    
    const hasTier1Data = planteursCount > 0 || 
      chefPlanteursCount > 0 || 
      warehousesCount > 0;

    // Tier 1 is missing if we had a previous sync but now have no data
    const tier1Missing = hadPreviousSync && !hasTier1Data;
    
    // Data is intact if we have Tier 1 data OR we never synced before
    const isIntact = !tier1Missing;

    // Generate appropriate message
    let message: string;
    if (isIntact) {
      if (!hadPreviousSync) {
        message = 'Première utilisation - aucune donnée synchronisée';
      } else {
        message = 'Données intactes';
      }
    } else {
      message = 'Les données ont été supprimées par iOS. Veuillez re-télécharger les données.';
    }

    const result: DetailedIntegrityResult = {
      isIntact,
      tier1Missing,
      planteursCount,
      chefPlanteursCount,
      warehousesCount,
      opsQueueCount,
      expectedMinimum: MINIMUM_EXPECTED_RECORDS.planteurs,
      message,
      syncMetadataCount,
      lastSyncDates,
      checkTimestamp,
      daysSinceActivity,
    };

    // Store the check result
    storeIntegrityCheckResult(result);

    return result;
  } catch (error) {
    // Database might be completely unavailable
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const result: DetailedIntegrityResult = {
      isIntact: false,
      tier1Missing: true,
      planteursCount: 0,
      chefPlanteursCount: 0,
      warehousesCount: 0,
      opsQueueCount: 0,
      expectedMinimum: MINIMUM_EXPECTED_RECORDS.planteurs,
      message: `Erreur lors de la vérification: ${errorMessage}`,
      syncMetadataCount: 0,
      lastSyncDates: {},
      checkTimestamp,
      daysSinceActivity,
    };

    storeIntegrityCheckResult(result);
    return result;
  }
}

/**
 * Checks if integrity check should be performed
 * REQ-IOS-002: Check after 7 days inactivity
 * 
 * @returns true if check should be performed
 */
export function shouldCheckIntegrity(): boolean {
  const detection = detectIOS();
  
  // Only check on iOS
  if (!detection.isIOS) {
    return false;
  }

  return needsDataIntegrityCheck();
}

/**
 * Performs integrity check if needed and returns result
 * REQ-IOS-002: Detect if iOS purged data
 * 
 * @param onDataPurged - Callback when data is detected as purged
 * @returns Integrity result or null if check not needed
 */
export async function checkIntegrityIfNeeded(
  onDataPurged?: IntegrityCheckCallback
): Promise<DetailedIntegrityResult | null> {
  if (!shouldCheckIntegrity()) {
    // Record activity even if we don't check
    recordActivity();
    return null;
  }

  const result = await checkDataIntegrity();

  // Mark as checked
  markIntegrityChecked();

  // Record activity
  recordActivity();

  // Call callback if data was purged
  if (!result.isIntact && onDataPurged) {
    onDataPurged(result);
  }

  return result;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Stores the integrity check result in localStorage
 */
function storeIntegrityCheckResult(result: DetailedIntegrityResult): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(INTEGRITY_CHECK_KEY, JSON.stringify(result));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Gets the last integrity check result
 */
export function getLastIntegrityCheckResult(): DetailedIntegrityResult | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem(INTEGRITY_CHECK_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Clears the stored integrity check result
 */
export function clearIntegrityCheckResult(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(INTEGRITY_CHECK_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * Hook state for iOS data integrity
 */
export interface UseIOSDataIntegrityState {
  isChecking: boolean;
  result: DetailedIntegrityResult | null;
  needsRedownload: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseIOSDataIntegrityReturn extends UseIOSDataIntegrityState {
  checkNow: () => Promise<DetailedIntegrityResult>;
  dismissWarning: () => void;
}
