// CocoaTrack V2 - Offline Toast Notifications
// Simple toast system for offline operation feedback
// Requirements: REQ-OFF-006

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  icon?: string;
}

export interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
}

// ============================================================================
// TOAST MANAGER (SINGLETON)
// ============================================================================

type ToastListener = (toasts: Toast[]) => void;

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private counter = 0;

  /**
   * Shows a toast notification
   */
  show(options: ToastOptions): string {
    const id = `toast-${++this.counter}-${Date.now()}`;
    const toast: Toast = {
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration ?? 4000,
      icon: options.icon,
      createdAt: Date.now(),
    };

    this.toasts = [...this.toasts, toast];
    this.notifyListeners();

    // Auto-dismiss after duration
    if (toast.duration !== undefined && toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
    }

    return id;
  }

  /**
   * Dismisses a toast by ID
   */
  dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notifyListeners();
  }

  /**
   * Dismisses all toasts
   */
  dismissAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  /**
   * Gets all current toasts
   */
  getToasts(): Toast[] {
    return [...this.toasts];
  }

  /**
   * Subscribes to toast changes
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const toasts = this.getToasts();
    this.listeners.forEach((listener) => listener(toasts));
  }
}

// Singleton instance
let toastManagerInstance: ToastManager | null = null;

export function getToastManager(): ToastManager {
  if (!toastManagerInstance) {
    toastManagerInstance = new ToastManager();
  }
  return toastManagerInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Shows a success toast
 */
export function showSuccessToast(message: string, duration?: number): string {
  return getToastManager().show({
    message,
    type: 'success',
    duration,
    icon: '✓',
  });
}

/**
 * Shows an error toast
 */
export function showErrorToast(message: string, duration?: number): string {
  return getToastManager().show({
    message,
    type: 'error',
    duration: duration ?? 6000, // Errors stay longer
    icon: '✕',
  });
}

/**
 * Shows a warning toast
 */
export function showWarningToast(message: string, duration?: number): string {
  return getToastManager().show({
    message,
    type: 'warning',
    duration,
    icon: '⚠',
  });
}

/**
 * Shows an info toast
 */
export function showInfoToast(message: string, duration?: number): string {
  return getToastManager().show({
    message,
    type: 'info',
    duration,
    icon: 'ℹ',
  });
}

/**
 * Shows the "Enregistré hors ligne" toast for offline operations
 * REQ-OFF-006: Add toast notification "Enregistré hors ligne"
 */
export function showOfflineQueuedToast(): string {
  return getToastManager().show({
    message: 'Enregistré hors ligne',
    type: 'info',
    duration: 4000,
    icon: '📴',
  });
}

/**
 * Shows a sync success toast
 */
export function showSyncSuccessToast(count: number): string {
  return getToastManager().show({
    message: `${count} opération${count > 1 ? 's' : ''} synchronisée${count > 1 ? 's' : ''}`,
    type: 'success',
    duration: 3000,
    icon: '☁️',
  });
}

/**
 * Shows a sync error toast
 */
export function showSyncErrorToast(errorCount: number): string {
  return getToastManager().show({
    message: `${errorCount} erreur${errorCount > 1 ? 's' : ''} de synchronisation`,
    type: 'error',
    duration: 5000,
    icon: '⚠',
  });
}
