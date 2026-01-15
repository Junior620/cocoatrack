// CocoaTrack V2 - Service Worker Update Manager
// Handles safe SW updates with sync protection
// Requirements: REQ-SW-001, REQ-SW-002

import { Workbox } from 'workbox-window';

import { getSyncEngine } from '@/lib/offline/sync-engine';
import { getPendingOperationsCount } from '@/lib/offline/indexed-db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Service Worker update state machine
 * REQ-SW-002: Track SW update state
 */
export type SWUpdateState =
  | 'idle'           // No update activity
  | 'checking'       // Checking for updates
  | 'update_available' // New SW waiting to activate
  | 'downloading'    // Downloading new SW (not commonly used with Workbox)
  | 'ready'          // Ready to activate (user confirmed)
  | 'activating';    // Activating new SW

/**
 * Update safety check result
 */
export interface SafetyCheckResult {
  canUpdate: boolean;
  reason?: string;
  pendingOpsCount: number;
  isSyncing: boolean;
}

/**
 * SW Update Manager configuration
 */
export interface SWUpdateManagerConfig {
  /** Callback when update is available */
  onUpdateAvailable?: () => void;
  /** Callback when update is applied */
  onUpdateApplied?: () => void;
  /** Callback when state changes */
  onStateChange?: (state: SWUpdateState) => void;
  /** Auto-check interval in ms (0 = disabled) */
  autoCheckInterval?: number;
}

// ============================================================================
// SW UPDATE MANAGER CLASS
// ============================================================================

/**
 * Manages Service Worker updates with safety checks
 * REQ-SW-001: Safe Service Worker Update
 * REQ-SW-002: SW Version Tracking
 */
export class SWUpdateManager {
  private state: SWUpdateState = 'idle';
  private wb: Workbox | null = null;
  private waitingVersion: string | null = null;
  private currentVersion: string | null = null;
  private config: SWUpdateManagerConfig;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private updateDismissedUntil: number | null = null;

  constructor(config: SWUpdateManagerConfig = {}) {
    this.config = config;
  }

  /**
   * Initializes the update manager with a Workbox instance
   */
  async initialize(wb: Workbox): Promise<void> {
    this.wb = wb;

    // Get current SW version
    await this.fetchCurrentVersion();

    // Listen for waiting service worker
    wb.addEventListener('waiting', () => {
      console.log('[SWUpdateManager] New service worker waiting');
      this.setState('update_available');
      this.config.onUpdateAvailable?.();
    });

    // Listen for controlling service worker
    wb.addEventListener('controlling', () => {
      console.log('[SWUpdateManager] Service worker now controlling');
      this.setState('idle');
      this.config.onUpdateApplied?.();
    });

    // Listen for activation
    wb.addEventListener('activated', async (event) => {
      if (event.isUpdate) {
        console.log('[SWUpdateManager] Service worker updated');
        await this.fetchCurrentVersion();
      }
      this.setState('idle');
    });

    // Set up auto-check interval if configured
    if (this.config.autoCheckInterval && this.config.autoCheckInterval > 0) {
      this.startAutoCheck(this.config.autoCheckInterval);
    }

    // Check for dismissed state in localStorage
    const dismissedUntil = localStorage.getItem('sw_update_dismissed_until');
    if (dismissedUntil) {
      this.updateDismissedUntil = parseInt(dismissedUntil, 10);
    }
  }

  /**
   * Gets the current update state
   */
  getState(): SWUpdateState {
    return this.state;
  }

  /**
   * Gets the version of the waiting service worker
   */
  getWaitingVersion(): string | null {
    return this.waitingVersion;
  }

  /**
   * Gets the current service worker version
   */
  getCurrentVersion(): string | null {
    return this.currentVersion;
  }

  /**
   * Checks for service worker updates
   * @returns true if an update is available
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.wb) {
      console.warn('[SWUpdateManager] Workbox not initialized');
      return false;
    }

    this.setState('checking');

    try {
      // Force update check
      await this.wb.update();

      // Check if there's a waiting worker
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        this.setState('update_available');
        return true;
      }

      this.setState('idle');
      return false;
    } catch (error) {
      console.error('[SWUpdateManager] Update check failed:', error);
      this.setState('idle');
      return false;
    }
  }

  /**
   * Applies the waiting update (skipWaiting + reload)
   * REQ-SW-001: Safety check before applying
   */
  async applyUpdate(): Promise<void> {
    if (!this.wb) {
      console.warn('[SWUpdateManager] Workbox not initialized');
      return;
    }

    // Perform safety check
    const safetyCheck = await this.canSafelyUpdate();
    if (!safetyCheck.canUpdate) {
      console.warn('[SWUpdateManager] Cannot safely update:', safetyCheck.reason);
      throw new Error(safetyCheck.reason || 'Cannot safely update');
    }

    this.setState('activating');

    // Tell the waiting service worker to skip waiting
    this.wb.messageSkipWaiting();

    // The page will reload when the new SW takes control
    // (handled by the 'controlling' event listener)
  }

  /**
   * Dismisses the update notification
   * @param days Number of days to dismiss for (default: 1)
   */
  dismissUpdate(days: number = 1): void {
    const dismissUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    this.updateDismissedUntil = dismissUntil;
    localStorage.setItem('sw_update_dismissed_until', dismissUntil.toString());
    console.log(`[SWUpdateManager] Update dismissed until ${new Date(dismissUntil).toISOString()}`);
  }

  /**
   * Checks if the update notification should be shown
   */
  shouldShowUpdateNotification(): boolean {
    if (this.state !== 'update_available') {
      return false;
    }

    if (this.updateDismissedUntil && Date.now() < this.updateDismissedUntil) {
      return false;
    }

    return true;
  }

  /**
   * Performs safety checks before allowing update
   * REQ-SW-001: Don't reload during sync or with pending ops
   */
  async canSafelyUpdate(): Promise<SafetyCheckResult> {
    const syncEngine = getSyncEngine();
    const isSyncing = syncEngine.isSyncing();
    const pendingOpsCount = await getPendingOperationsCount();

    // Don't update during active sync
    if (isSyncing) {
      return {
        canUpdate: false,
        reason: 'Synchronisation en cours. Veuillez attendre la fin.',
        pendingOpsCount,
        isSyncing,
      };
    }

    // Warn if there are pending operations (but allow with confirmation)
    if (pendingOpsCount > 0) {
      return {
        canUpdate: false,
        reason: `${pendingOpsCount} opération(s) en attente. Synchronisez d'abord pour éviter toute perte.`,
        pendingOpsCount,
        isSyncing,
      };
    }

    return {
      canUpdate: true,
      pendingOpsCount,
      isSyncing,
    };
  }

  /**
   * Forces update even with pending operations (use with caution)
   * Should only be called after user confirmation
   */
  async forceUpdate(): Promise<void> {
    if (!this.wb) {
      console.warn('[SWUpdateManager] Workbox not initialized');
      return;
    }

    console.warn('[SWUpdateManager] Force updating despite safety checks');
    this.setState('activating');
    this.wb.messageSkipWaiting();
  }

  /**
   * Starts automatic update checking
   */
  startAutoCheck(intervalMs: number): void {
    this.stopAutoCheck();
    this.checkIntervalId = setInterval(() => {
      this.checkForUpdate();
    }, intervalMs);
  }

  /**
   * Stops automatic update checking
   */
  stopAutoCheck(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    this.stopAutoCheck();
    this.wb = null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setState(newState: SWUpdateState): void {
    if (this.state !== newState) {
      console.log(`[SWUpdateManager] State: ${this.state} -> ${newState}`);
      this.state = newState;
      this.config.onStateChange?.(newState);
    }
  }

  private async fetchCurrentVersion(): Promise<void> {
    try {
      if (!this.wb) return;

      // Get the active service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      const sw = registration?.active;
      
      if (!sw) {
        this.currentVersion = 'unknown';
        return;
      }

      // Use MessageChannel to get version from SW
      const messageChannel = new MessageChannel();
      
      const versionPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout getting SW version'));
        }, 5000);

        messageChannel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          resolve(event.data?.version || 'unknown');
        };
      });

      // Post message directly to the service worker with the port
      sw.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
      this.currentVersion = await versionPromise;
      console.log(`[SWUpdateManager] Current SW version: ${this.currentVersion}`);
    } catch (error) {
      console.warn('[SWUpdateManager] Could not get SW version:', error);
      this.currentVersion = 'unknown';
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let swUpdateManagerInstance: SWUpdateManager | null = null;

/**
 * Gets the singleton SWUpdateManager instance
 */
export function getSWUpdateManager(): SWUpdateManager {
  if (!swUpdateManagerInstance) {
    swUpdateManagerInstance = new SWUpdateManager();
  }
  return swUpdateManagerInstance;
}

/**
 * Creates and initializes a new SWUpdateManager
 */
export function createSWUpdateManager(
  config: SWUpdateManagerConfig = {}
): SWUpdateManager {
  swUpdateManagerInstance = new SWUpdateManager(config);
  return swUpdateManagerInstance;
}
