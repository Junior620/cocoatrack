// CocoaTrack V2 - iOS Manual Sync Button
// Visible sync button for iOS where Background Sync is unavailable
// Requirements: REQ-IOS-003

'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Check, AlertCircle, Cloud, CloudOff } from 'lucide-react';

import { useIOSManualSync } from '@/lib/pwa/use-ios-manual-sync';
import { detectIOS, hasBackgroundSync } from '@/lib/pwa/ios-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface IOSManualSyncButtonProps {
  /** Button variant */
  variant?: 'default' | 'compact' | 'icon-only' | 'prominent';
  /** Additional CSS classes */
  className?: string;
  /** Callback when sync completes */
  onSyncComplete?: () => void;
  /** Whether to show even on non-iOS devices */
  forceShow?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * iOS Manual Sync Button
 * 
 * Provides a visible "Synchroniser" button for iOS devices where
 * Background Sync is not available.
 * 
 * REQ-IOS-003: Visible "Synchroniser" button when Background Sync unavailable
 */
export function IOSManualSyncButton({
  variant = 'default',
  className = '',
  onSyncComplete,
  forceShow = false,
}: IOSManualSyncButtonProps) {
  const [shouldShow, setShouldShow] = useState(false);
  
  const {
    needsManualSync,
    isSyncing,
    pendingCount,
    lastSyncResult,
    error,
    sync,
  } = useIOSManualSync({
    onSyncComplete: () => {
      onSyncComplete?.();
    },
  });

  // Determine if button should be shown
  useEffect(() => {
    if (forceShow) {
      setShouldShow(true);
      return;
    }

    const detection = detectIOS();
    const needsManual = detection.isIOS || !hasBackgroundSync();
    setShouldShow(needsManual);
  }, [forceShow]);

  // Don't render if not needed
  if (!shouldShow && !needsManualSync) {
    return null;
  }

  // Handle sync click
  const handleSync = async () => {
    try {
      await sync();
    } catch {
      // Error is handled by the hook
    }
  };

  // Determine button state
  const isSuccess = lastSyncResult?.success && !error;
  const hasError = !!error || (lastSyncResult && !lastSyncResult.success);
  const hasPending = pendingCount > 0;

  // Icon based on state
  const getIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (hasError) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (isSuccess && !hasPending) {
      return <Check className="h-4 w-4" />;
    }
    if (hasPending) {
      return <CloudOff className="h-4 w-4" />;
    }
    return <Cloud className="h-4 w-4" />;
  };

  // Button colors based on state
  const getColors = () => {
    if (hasError) {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    if (hasPending) {
      return 'bg-amber-600 hover:bg-amber-700 text-white';
    }
    if (isSuccess) {
      return 'bg-green-600 hover:bg-green-700 text-white';
    }
    return 'bg-blue-600 hover:bg-blue-700 text-white';
  };

  // Render based on variant
  switch (variant) {
    case 'icon-only':
      return (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`relative rounded-full p-2 transition-colors disabled:opacity-50 ${getColors()} ${className}`}
          title={hasPending ? `${pendingCount} opération(s) en attente` : 'Synchroniser'}
          aria-label="Synchroniser"
        >
          {getIcon()}
          {hasPending && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-600">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      );

    case 'compact':
      return (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${getColors()} ${className}`}
        >
          {getIcon()}
          <span>
            {isSyncing ? 'Sync...' : hasPending ? `Sync (${pendingCount})` : 'Sync'}
          </span>
        </button>
      );

    case 'prominent':
      return (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            hasPending ? 'animate-pulse' : ''
          } ${getColors()} ${className}`}
        >
          {getIcon()}
          <span>
            {isSyncing
              ? 'Synchronisation en cours...'
              : hasPending
              ? `Synchroniser (${pendingCount} en attente)`
              : 'Synchroniser maintenant'}
          </span>
        </button>
      );

    default:
      return (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${getColors()} ${className}`}
        >
          {getIcon()}
          <span>
            {isSyncing
              ? 'Synchronisation...'
              : hasPending
              ? `Synchroniser (${pendingCount})`
              : 'Synchroniser'}
          </span>
        </button>
      );
  }
}

/**
 * Floating iOS Manual Sync Button
 * Fixed position button for easy access on iOS
 */
export function IOSFloatingSyncButton({
  className = '',
  onSyncComplete,
}: Omit<IOSManualSyncButtonProps, 'variant'>) {
  const [shouldShow, setShouldShow] = useState(false);
  
  const {
    needsManualSync,
    isSyncing,
    pendingCount,
    error,
    sync,
  } = useIOSManualSync({
    onSyncComplete: () => {
      onSyncComplete?.();
    },
  });

  // Determine if button should be shown
  useEffect(() => {
    const detection = detectIOS();
    const needsManual = detection.isIOS || !hasBackgroundSync();
    setShouldShow(needsManual && pendingCount > 0);
  }, [pendingCount]);

  // Don't render if not needed or no pending operations
  if (!shouldShow && !needsManualSync) {
    return null;
  }

  if (pendingCount === 0) {
    return null;
  }

  // Handle sync click
  const handleSync = async () => {
    try {
      await sync();
    } catch {
      // Error is handled by the hook
    }
  };

  const hasError = !!error;

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all disabled:opacity-50 ${
        hasError
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-amber-600 hover:bg-amber-700'
      } text-white ${isSyncing ? '' : 'animate-bounce'} ${className}`}
      aria-label={`Synchroniser ${pendingCount} opération(s)`}
    >
      {isSyncing ? (
        <RefreshCw className="h-5 w-5 animate-spin" />
      ) : hasError ? (
        <AlertCircle className="h-5 w-5" />
      ) : (
        <CloudOff className="h-5 w-5" />
      )}
      <span className="text-sm font-medium">
        {isSyncing ? 'Sync...' : pendingCount}
      </span>
    </button>
  );
}

export default IOSManualSyncButton;
