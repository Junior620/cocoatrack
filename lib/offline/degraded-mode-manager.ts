// CocoaTrack V2 - Degraded Mode Manager
// Handles detection and management of degraded application states
// Requirements: REQ-OFF-011

import { getStorageManager, STORAGE_THRESHOLDS } from './storage-manager';
import { getPendingOperationsCount } from './indexed-db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Three distinct degraded modes with different triggers and behaviors
 * 
 * - normal: All features available
 * - queue_pressure: Large queue (>50 ops) → warning only, DON'T block
 * - read_only_storage: Storage critical (>=98%) → block writes
 * - read_only_auth: Auth expired + pending ops → block new ops
 */
export type DegradedMode = 
  | 'normal'
  | 'queue_pressure'
  | 'read_only_storage'
  | 'read_only_auth';

/**
 * Degraded mode state with all relevant information
 */
export interface DegradedModeState {
  mode: DegradedMode;
  blocksCreation: boolean;
  message: string;
  messageFr: string;
  severity: 'info' | 'warning' | 'error';
  details: {
    storagePercent: number;
    opsQueueCount: number;
    isSessionExpired: boolean;
    hasPendingOps: boolean;
  };
}

/**
 * Configuration for each degraded mode
 */
export interface DegradedModeConfig {
  trigger: string;
  behavior: string;
  blocksCreation: boolean;
  message: string;
  messageFr: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Threshold for queue pressure warning (>50 ops)
 */
export const QUEUE_PRESSURE_THRESHOLD = 50;

/**
 * Storage threshold for read-only mode (>=98%)
 */
export const READ_ONLY_STORAGE_THRESHOLD = STORAGE_THRESHOLDS.EMERGENCY; // 98%

/**
 * Configuration for each degraded mode
 */
export const DEGRADED_MODE_CONFIGS: Record<DegradedMode, DegradedModeConfig> = {
  normal: {
    trigger: 'none',
    behavior: 'all_features_available',
    blocksCreation: false,
    message: 'All features available',
    messageFr: 'Toutes les fonctionnalités disponibles',
    severity: 'info',
  },
  queue_pressure: {
    trigger: 'ops_queue.count > 50',
    behavior: 'warning_banner + prominent_sync_button',
    blocksCreation: false, // DON'T block - terrain users need to work
    message: '50+ operations pending - Sync as soon as possible',
    messageFr: '50+ opérations en attente - Synchronisez dès que possible',
    severity: 'warning',
  },
  read_only_storage: {
    trigger: 'storage_percent >= 98%',
    behavior: 'error_banner + block_writes + force_cleanup',
    blocksCreation: true,
    message: 'Critical storage - Sync before continuing',
    messageFr: 'Stockage critique - Synchronisez avant de continuer',
    severity: 'error',
  },
  read_only_auth: {
    trigger: 'session_expired AND ops_queue.count > 0',
    behavior: 'warning_banner + block_new_ops + allow_read',
    blocksCreation: true,
    message: 'Session expired - Log in again to sync',
    messageFr: 'Session expirée - Reconnectez-vous pour synchroniser',
    severity: 'warning',
  },
};

/**
 * Actions that are disabled in read-only mode
 */
export const DISABLED_ACTIONS_IN_READ_ONLY = [
  'create_delivery',
  'create_planteur',
  'edit_delivery',
  'edit_planteur',
  'import_data',
] as const;

/**
 * Actions that are always allowed
 */
export const ALLOWED_ACTIONS_IN_READ_ONLY = [
  'view_list',
  'view_details',
  'search',
  'view_ops_queue',
  'trigger_sync',
  'cleanup_storage',
  'export_logs',
] as const;

export type DisabledAction = typeof DISABLED_ACTIONS_IN_READ_ONLY[number];
export type AllowedAction = typeof ALLOWED_ACTIONS_IN_READ_ONLY[number];

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Determines the degraded mode based on current state
 * 
 * Priority order (highest to lowest):
 * 1. read_only_storage (storage >= 98%)
 * 2. read_only_auth (session expired + pending ops)
 * 3. queue_pressure (>50 ops, warning only)
 * 4. normal
 * 
 * @param storagePercent - Current storage usage percentage (0-100)
 * @param opsQueueCount - Number of operations in the queue
 * @param isSessionExpired - Whether the user session has expired
 * @returns The current degraded mode
 */
export function determineDegradedMode(
  storagePercent: number,
  opsQueueCount: number,
  isSessionExpired: boolean
): DegradedMode {
  // Priority 1: Storage critical (>=98%) → read_only_storage
  if (storagePercent >= READ_ONLY_STORAGE_THRESHOLD) {
    return 'read_only_storage';
  }

  // Priority 2: Session expired with pending ops → read_only_auth
  if (isSessionExpired && opsQueueCount > 0) {
    return 'read_only_auth';
  }

  // Priority 3: Queue pressure (>50 ops) → queue_pressure (warning only)
  if (opsQueueCount > QUEUE_PRESSURE_THRESHOLD) {
    return 'queue_pressure';
  }

  // Default: normal
  return 'normal';
}

/**
 * Checks if creation/write operations are blocked in the given mode
 * 
 * @param mode - The degraded mode to check
 * @returns true if creation is blocked
 */
export function isCreationBlocked(mode: DegradedMode): boolean {
  return DEGRADED_MODE_CONFIGS[mode].blocksCreation;
}

/**
 * Checks if a specific action is allowed in the given mode
 * 
 * @param mode - The degraded mode
 * @param action - The action to check
 * @returns true if the action is allowed
 */
export function isActionAllowed(mode: DegradedMode, action: string): boolean {
  // In normal mode, all actions are allowed
  if (mode === 'normal') {
    return true;
  }

  // In queue_pressure mode, all actions are allowed (warning only)
  if (mode === 'queue_pressure') {
    return true;
  }

  // In read_only modes, check if action is in the allowed list
  return ALLOWED_ACTIONS_IN_READ_ONLY.includes(action as AllowedAction);
}

/**
 * Checks if a specific action is disabled in the given mode
 * 
 * @param mode - The degraded mode
 * @param action - The action to check
 * @returns true if the action is disabled
 */
export function isActionDisabled(mode: DegradedMode, action: string): boolean {
  // In normal mode, no actions are disabled
  if (mode === 'normal') {
    return false;
  }

  // In queue_pressure mode, no actions are disabled (warning only)
  if (mode === 'queue_pressure') {
    return false;
  }

  // In read_only modes, check if action is in the disabled list
  return DISABLED_ACTIONS_IN_READ_ONLY.includes(action as DisabledAction);
}

/**
 * Gets the configuration for a degraded mode
 * 
 * @param mode - The degraded mode
 * @returns The configuration for the mode
 */
export function getDegradedModeConfig(mode: DegradedMode): DegradedModeConfig {
  return DEGRADED_MODE_CONFIGS[mode];
}

/**
 * Gets the tooltip text for disabled buttons
 * 
 * @param mode - The degraded mode
 * @returns The tooltip text in French
 */
export function getDisabledTooltip(mode: DegradedMode): string {
  if (mode === 'read_only_storage') {
    return 'Mode lecture seule - Libérez de l\'espace ou synchronisez d\'abord';
  }
  if (mode === 'read_only_auth') {
    return 'Mode lecture seule - Reconnectez-vous pour continuer';
  }
  return '';
}

// ============================================================================
// DEGRADED MODE MANAGER CLASS
// ============================================================================

export class DegradedModeManager {
  private cachedState: DegradedModeState | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 2000; // 2 seconds

  // External session state (set by auth context)
  private isSessionExpired: boolean = false;

  /**
   * Sets the session expiration state
   * Called by auth context when session state changes
   */
  setSessionExpired(expired: boolean): void {
    this.isSessionExpired = expired;
    this.invalidateCache();
  }

  /**
   * Gets the current session expiration state
   */
  getSessionExpired(): boolean {
    return this.isSessionExpired;
  }

  /**
   * Gets the current degraded mode state
   * Caches the result for performance
   */
  async getState(): Promise<DegradedModeState> {
    const now = Date.now();
    
    // Return cached state if still valid
    if (this.cachedState && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedState;
    }

    // Fetch current metrics
    const storageManager = getStorageManager();
    const [metrics, opsQueueCount] = await Promise.all([
      storageManager.getMetrics(),
      getPendingOperationsCount(),
    ]);

    // Determine the degraded mode
    const mode = determineDegradedMode(
      metrics.quota_percent,
      opsQueueCount,
      this.isSessionExpired
    );

    const config = getDegradedModeConfig(mode);

    const state: DegradedModeState = {
      mode,
      blocksCreation: config.blocksCreation,
      message: config.message,
      messageFr: config.messageFr,
      severity: config.severity,
      details: {
        storagePercent: metrics.quota_percent,
        opsQueueCount,
        isSessionExpired: this.isSessionExpired,
        hasPendingOps: opsQueueCount > 0,
      },
    };

    // Cache the state
    this.cachedState = state;
    this.cacheTimestamp = now;

    return state;
  }

  /**
   * Gets the current degraded mode (convenience method)
   */
  async getMode(): Promise<DegradedMode> {
    const state = await this.getState();
    return state.mode;
  }

  /**
   * Checks if creation/write operations are currently blocked
   */
  async isCreationBlocked(): Promise<boolean> {
    const state = await this.getState();
    return state.blocksCreation;
  }

  /**
   * Checks if a specific action is currently allowed
   */
  async isActionAllowed(action: string): Promise<boolean> {
    const mode = await this.getMode();
    return isActionAllowed(mode, action);
  }

  /**
   * Checks if a specific action is currently disabled
   */
  async isActionDisabled(action: string): Promise<boolean> {
    const mode = await this.getMode();
    return isActionDisabled(mode, action);
  }

  /**
   * Gets the tooltip for disabled buttons
   */
  async getDisabledTooltip(): Promise<string> {
    const mode = await this.getMode();
    return getDisabledTooltip(mode);
  }

  /**
   * Invalidates the cached state
   */
  invalidateCache(): void {
    this.cachedState = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Subscribes to degraded mode changes
   * Returns an unsubscribe function
   */
  subscribe(callback: (state: DegradedModeState) => void): () => void {
    let isSubscribed = true;
    let lastMode: DegradedMode | null = null;

    const checkState = async () => {
      if (!isSubscribed) return;

      const state = await this.getState();
      
      // Only call callback if mode changed
      if (state.mode !== lastMode) {
        lastMode = state.mode;
        callback(state);
      }
    };

    // Check immediately
    checkState();

    // Check periodically
    const intervalId = setInterval(checkState, 3000);

    // Return unsubscribe function
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let degradedModeManagerInstance: DegradedModeManager | null = null;

/**
 * Gets the singleton DegradedModeManager instance
 */
export function getDegradedModeManager(): DegradedModeManager {
  if (!degradedModeManagerInstance) {
    degradedModeManagerInstance = new DegradedModeManager();
  }
  return degradedModeManagerInstance;
}

// ============================================================================
// REACT HOOK HELPERS
// ============================================================================

/**
 * Initial state for the useDegradedMode hook
 */
export const INITIAL_DEGRADED_MODE_STATE: DegradedModeState = {
  mode: 'normal',
  blocksCreation: false,
  message: 'All features available',
  messageFr: 'Toutes les fonctionnalités disponibles',
  severity: 'info',
  details: {
    storagePercent: 0,
    opsQueueCount: 0,
    isSessionExpired: false,
    hasPendingOps: false,
  },
};
