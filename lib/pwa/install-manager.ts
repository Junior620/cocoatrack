// CocoaTrack V2 - PWA Install Manager
// Handles PWA installation prompts and tracking
// Requirements: REQ-PWA-001, REQ-PWA-005, REQ-PWA-006

// ============================================================================
// TYPES
// ============================================================================

/**
 * Platform detection result
 * REQ-PWA-005: Install State Tracking
 */
export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

/**
 * Install state tracked in localStorage
 * REQ-PWA-005: Track visits_count, install_dismissed_until, is_installed
 */
export interface InstallState {
  visits_count: number;
  install_dismissed_until: string | null;
  is_installed: boolean;
  platform: Platform;
  can_prompt: boolean;
}

/**
 * Configuration for InstallManager
 */
export interface InstallManagerConfig {
  /** Minimum visits before showing prompt (default: 3) */
  minVisits?: number;
  /** Days to dismiss prompt for (default: 7) */
  dismissDays?: number;
  /** Callback when install prompt should be shown */
  onShouldShowPrompt?: () => void;
  /** Callback when install is completed */
  onInstallComplete?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  VISITS_COUNT: 'pwa_visits_count',
  DISMISSED_UNTIL: 'pwa_install_dismissed_until',
  FIRST_VISIT: 'pwa_first_visit',
} as const;

const DEFAULT_MIN_VISITS = 3;
const DEFAULT_DISMISS_DAYS = 7;

// ============================================================================
// INSTALL MANAGER CLASS
// ============================================================================

/**
 * Manages PWA installation prompts and state tracking
 * REQ-PWA-001: Install Prompt Intelligent
 * REQ-PWA-005: Install State Tracking
 * REQ-PWA-006: Install Prompt Platform-Specific
 */
export class InstallManager {
  private config: Required<InstallManagerConfig>;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInitialized = false;

  constructor(config: InstallManagerConfig = {}) {
    this.config = {
      minVisits: config.minVisits ?? DEFAULT_MIN_VISITS,
      dismissDays: config.dismissDays ?? DEFAULT_DISMISS_DAYS,
      onShouldShowPrompt: config.onShouldShowPrompt ?? (() => {}),
      onInstallComplete: config.onInstallComplete ?? (() => {}),
    };
  }

  /**
   * Initializes the install manager
   * Sets up event listeners and increments visit count
   */
  initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // Increment visit count
    this.incrementVisit();

    // Listen for beforeinstallprompt event (Chrome/Edge)
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);

    // Listen for appinstalled event
    window.addEventListener('appinstalled', this.handleAppInstalled);

    // Check if we should show prompt after initialization
    if (this.shouldShowPrompt()) {
      this.config.onShouldShowPrompt();
    }
  }

  /**
   * Cleans up event listeners
   */
  destroy(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', this.handleAppInstalled);
    this.isInitialized = false;
  }

  // ============================================================================
  // STATE METHODS
  // ============================================================================

  /**
   * Gets the current install state
   * REQ-PWA-005: Install State Tracking
   */
  getState(): InstallState {
    return {
      visits_count: this.getVisitsCount(),
      install_dismissed_until: this.getDismissedUntil(),
      is_installed: this.isStandalone(),
      platform: this.detectPlatform(),
      can_prompt: this.deferredPrompt !== null,
    };
  }

  /**
   * Gets the current visit count from localStorage
   */
  getVisitsCount(): number {
    if (typeof window === 'undefined') return 0;
    const count = localStorage.getItem(STORAGE_KEYS.VISITS_COUNT);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Gets the dismissed until date from localStorage
   */
  getDismissedUntil(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.DISMISSED_UNTIL);
  }

  // ============================================================================
  // ACTION METHODS
  // ============================================================================

  /**
   * Increments the visit count
   * REQ-PWA-005: Track visits_count
   */
  incrementVisit(): void {
    if (typeof window === 'undefined') return;

    const currentCount = this.getVisitsCount();
    const newCount = currentCount + 1;
    localStorage.setItem(STORAGE_KEYS.VISITS_COUNT, newCount.toString());

    // Track first visit date if not set
    if (!localStorage.getItem(STORAGE_KEYS.FIRST_VISIT)) {
      localStorage.setItem(STORAGE_KEYS.FIRST_VISIT, new Date().toISOString());
    }

    console.log(`[InstallManager] Visit count: ${newCount}`);
  }

  /**
   * Dismisses the install prompt for a specified number of days
   * REQ-PWA-001: Prompt can be closed and won't reappear for 7 days
   */
  dismissPrompt(days: number = this.config.dismissDays): void {
    if (typeof window === 'undefined') return;

    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + days);
    localStorage.setItem(STORAGE_KEYS.DISMISSED_UNTIL, dismissUntil.toISOString());

    console.log(`[InstallManager] Prompt dismissed until ${dismissUntil.toISOString()}`);
  }

  /**
   * Marks the app as installed
   */
  markInstalled(): void {
    console.log('[InstallManager] App marked as installed');
    this.config.onInstallComplete();
  }

  /**
   * Triggers the native install prompt (Chrome/Edge)
   * Returns true if prompt was shown, false otherwise
   */
  async triggerInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('[InstallManager] No deferred prompt available');
      return false;
    }

    try {
      // Show the prompt
      this.deferredPrompt.prompt();

      // Wait for user response
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`[InstallManager] User response: ${outcome}`);

      // Clear the deferred prompt
      this.deferredPrompt = null;

      if (outcome === 'accepted') {
        this.markInstalled();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[InstallManager] Error triggering install prompt:', error);
      return false;
    }
  }

  // ============================================================================
  // CHECK METHODS
  // ============================================================================

  /**
   * Determines if the install prompt should be shown
   * REQ-PWA-001: Install Prompt Intelligent
   * 
   * Returns true only when:
   * - visits_count >= minVisits (default 3)
   * - install_dismissed_until is null or in the past
   * - is_installed is false (not in standalone mode)
   * - platform is 'android' or 'desktop' (not 'ios')
   */
  shouldShowPrompt(): boolean {
    const state = this.getState();

    // Check visit count
    if (state.visits_count < this.config.minVisits) {
      return false;
    }

    // Check if dismissed recently
    if (state.install_dismissed_until) {
      const dismissedUntil = new Date(state.install_dismissed_until);
      if (dismissedUntil > new Date()) {
        return false;
      }
    }

    // Check if already installed
    if (state.is_installed) {
      return false;
    }

    // Check platform (iOS has separate flow)
    if (state.platform === 'ios') {
      return false;
    }

    return true;
  }

  /**
   * Determines if iOS-specific instructions should be shown
   * REQ-PWA-003: Install Instructions iOS
   */
  shouldShowIOSInstructions(): boolean {
    const state = this.getState();

    // Only show on iOS
    if (state.platform !== 'ios') {
      return false;
    }

    // Check visit count
    if (state.visits_count < this.config.minVisits) {
      return false;
    }

    // Check if dismissed recently
    if (state.install_dismissed_until) {
      const dismissedUntil = new Date(state.install_dismissed_until);
      if (dismissedUntil > new Date()) {
        return false;
      }
    }

    // Check if already installed
    if (state.is_installed) {
      return false;
    }

    return true;
  }

  /**
   * Checks if the app is running in standalone mode (installed)
   * REQ-PWA-005: Detect standalone mode via display-mode
   */
  isStandalone(): boolean {
    if (typeof window === 'undefined') return false;

    // Check display-mode media query
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check Safari iOS standalone property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) {
      return true;
    }

    return false;
  }

  /**
   * Detects the current platform
   * REQ-PWA-005: Detect platform (iOS, Android, Desktop)
   */
  detectPlatform(): Platform {
    if (typeof window === 'undefined') return 'unknown';

    const userAgent = window.navigator.userAgent.toLowerCase();

    // iOS detection
    if (/ipad|iphone|ipod/.test(userAgent) && !('MSStream' in window)) {
      return 'ios';
    }

    // Android detection
    if (/android/.test(userAgent)) {
      return 'android';
    }

    // Desktop detection (Windows, Mac, Linux)
    if (/windows|macintosh|linux/.test(userAgent) && !/mobile/.test(userAgent)) {
      return 'desktop';
    }

    return 'unknown';
  }

  /**
   * Checks if the browser can show the native install prompt
   */
  canShowNativePrompt(): boolean {
    return this.deferredPrompt !== null;
  }

  // ============================================================================
  // PRIVATE EVENT HANDLERS
  // ============================================================================

  /**
   * Handles the beforeinstallprompt event
   * Stores the event for later use
   */
  private handleBeforeInstallPrompt = (event: Event): void => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();

    // Store the event for later use
    this.deferredPrompt = event as BeforeInstallPromptEvent;

    console.log('[InstallManager] beforeinstallprompt event captured');

    // Check if we should show our custom prompt
    if (this.shouldShowPrompt()) {
      this.config.onShouldShowPrompt();
    }
  };

  /**
   * Handles the appinstalled event
   */
  private handleAppInstalled = (): void => {
    console.log('[InstallManager] App installed');
    this.deferredPrompt = null;
    this.markInstalled();
  };
}

// ============================================================================
// BEFOREINSTALLPROMPT EVENT TYPE
// ============================================================================

/**
 * BeforeInstallPromptEvent interface
 * Not in standard TypeScript DOM types
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let installManagerInstance: InstallManager | null = null;

/**
 * Gets the singleton InstallManager instance
 */
export function getInstallManager(): InstallManager {
  if (!installManagerInstance) {
    installManagerInstance = new InstallManager();
  }
  return installManagerInstance;
}

/**
 * Creates and initializes a new InstallManager
 */
export function createInstallManager(
  config: InstallManagerConfig = {}
): InstallManager {
  installManagerInstance = new InstallManager(config);
  return installManagerInstance;
}

// ============================================================================
// PURE FUNCTIONS FOR TESTING
// ============================================================================

/**
 * Pure function to determine if prompt should be shown
 * Used for property-based testing
 * 
 * REQ-PWA-001: Install Prompt Intelligent
 * REQ-PWA-005: Install State Tracking
 */
export function shouldShowPromptPure(
  visits_count: number,
  install_dismissed_until: string | null,
  is_installed: boolean,
  platform: Platform,
  minVisits: number = DEFAULT_MIN_VISITS
): boolean {
  // Check visit count
  if (visits_count < minVisits) {
    return false;
  }

  // Check if dismissed recently
  if (install_dismissed_until) {
    const dismissedUntil = new Date(install_dismissed_until);
    if (dismissedUntil > new Date()) {
      return false;
    }
  }

  // Check if already installed
  if (is_installed) {
    return false;
  }

  // Check platform (iOS has separate flow)
  if (platform === 'ios') {
    return false;
  }

  return true;
}

/**
 * Pure function to detect platform from user agent
 * Used for property-based testing
 */
export function detectPlatformFromUserAgent(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();

  // iOS detection
  if (/ipad|iphone|ipod/.test(ua)) {
    return 'ios';
  }

  // Android detection
  if (/android/.test(ua)) {
    return 'android';
  }

  // Desktop detection (Windows, Mac, Linux)
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}
