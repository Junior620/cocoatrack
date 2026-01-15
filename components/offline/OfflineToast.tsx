// CocoaTrack V2 - Offline Toast Component
// Displays toast notifications for offline operations
// Requirements: REQ-OFF-006

'use client';

import { useEffect, useState } from 'react';
import { X, Cloud, CloudOff, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';

import {
  getToastManager,
  type Toast,
  type ToastType,
} from '@/lib/offline/offline-toast';

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  const getTypeStyles = (type: ToastType): string => {
    switch (type) {
      case 'success':
        return 'bg-emerald-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-amber-500 text-white';
      case 'info':
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const getIcon = (type: ToastType) => {
    const iconClass = 'h-5 w-5 flex-shrink-0';
    switch (type) {
      case 'success':
        return <Check className={iconClass} />;
      case 'error':
        return <AlertCircle className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
      case 'info':
      default:
        // Check if it's an offline toast
        if (toast.icon === '📴') {
          return <CloudOff className={iconClass} />;
        }
        if (toast.icon === '☁️') {
          return <Cloud className={iconClass} />;
        }
        return <Info className={iconClass} />;
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
        transition-all duration-200 ease-out
        ${getTypeStyles(toast.type || 'info')}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      {getIcon(toast.type || 'info')}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

interface OfflineToastContainerProps {
  /** Position of the toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Maximum number of toasts to show */
  maxToasts?: number;
}

export function OfflineToastContainer({
  position = 'bottom-right',
  maxToasts = 5,
}: OfflineToastContainerProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const manager = getToastManager();
    
    // Initial state
    setToasts(manager.getToasts());

    // Subscribe to changes
    const unsubscribe = manager.subscribe((newToasts) => {
      setToasts(newToasts.slice(-maxToasts));
    });

    return unsubscribe;
  }, [maxToasts]);

  const handleDismiss = (id: string) => {
    getToastManager().dismiss(id);
  };

  const getPositionStyles = (): string => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${getPositionStyles()}`}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

export default OfflineToastContainer;
