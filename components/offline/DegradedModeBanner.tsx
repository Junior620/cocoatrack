// CocoaTrack V2 - Degraded Mode Banner
// Fixed banner showing degraded mode status with appropriate message
// Requirements: REQ-OFF-011

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, AlertCircle, RefreshCw, X } from 'lucide-react';

import { useDegradedMode } from '@/lib/offline/use-degraded-mode';
import type { DegradedMode } from '@/lib/offline/degraded-mode-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface DegradedModeBannerProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether the banner can be dismissed (only for queue_pressure) */
  dismissable?: boolean;
  /** Callback when sync button is clicked */
  onSyncClick?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the banner configuration based on degraded mode
 */
function getBannerConfig(mode: DegradedMode): {
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
} {
  switch (mode) {
    case 'queue_pressure':
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        textColor: 'text-amber-800',
        iconColor: 'text-amber-500',
        buttonBgColor: 'bg-amber-600',
        buttonTextColor: 'text-white',
        buttonHoverColor: 'hover:bg-amber-700',
      };
    case 'read_only_storage':
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-500',
        buttonBgColor: 'bg-red-600',
        buttonTextColor: 'text-white',
        buttonHoverColor: 'hover:bg-red-700',
      };
    case 'read_only_auth':
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-500',
        buttonBgColor: 'bg-orange-600',
        buttonTextColor: 'text-white',
        buttonHoverColor: 'hover:bg-orange-700',
      };
    default:
      return {
        icon: null,
        bgColor: '',
        borderColor: '',
        textColor: '',
        iconColor: '',
        buttonBgColor: '',
        buttonTextColor: '',
        buttonHoverColor: '',
      };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Fixed banner component for degraded mode notifications
 * 
 * Displays:
 * - Warning banner for queue_pressure (dismissable)
 * - Error banner for read_only_storage (not dismissable)
 * - Warning banner for read_only_auth (not dismissable)
 * 
 * Features:
 * - Prominent sync button (pulsing in read-only modes)
 * - Appropriate message based on mode
 * - Fixed position at top of viewport
 */
export function DegradedModeBanner({
  className = '',
  dismissable = true,
  onSyncClick,
}: DegradedModeBannerProps) {
  const { state, mode, isDegraded } = useDegradedMode();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when mode changes
  useEffect(() => {
    setIsDismissed(false);
  }, [mode]);

  // Don't render if not in degraded mode or dismissed
  if (!isDegraded || mode === 'normal') {
    return null;
  }

  // Only queue_pressure can be dismissed
  const canDismiss = dismissable && mode === 'queue_pressure';
  
  if (isDismissed && canDismiss) {
    return null;
  }

  const config = getBannerConfig(mode);
  const showPulsingSync = mode === 'read_only_storage' || mode === 'read_only_auth';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 border-b ${config.bgColor} ${config.borderColor} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Message */}
          <div className="flex items-center gap-3">
            <span className={config.iconColor}>{config.icon}</span>
            <p className={`text-sm font-medium ${config.textColor}`}>
              {state.messageFr}
            </p>
            
            {/* Details */}
            {mode === 'queue_pressure' && (
              <span className={`text-xs ${config.textColor} opacity-75`}>
                ({state.details.opsQueueCount} opérations)
              </span>
            )}
            {mode === 'read_only_storage' && (
              <span className={`text-xs ${config.textColor} opacity-75`}>
                ({state.details.storagePercent}% utilisé)
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Sync Button */}
            <Link
              href="/sync"
              onClick={onSyncClick}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${config.buttonBgColor} ${config.buttonTextColor} ${config.buttonHoverColor} ${
                showPulsingSync ? 'animate-pulse' : ''
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${showPulsingSync ? 'animate-spin' : ''}`} />
              Synchroniser maintenant
            </Link>

            {/* Dismiss Button (only for queue_pressure) */}
            {canDismiss && (
              <button
                onClick={() => setIsDismissed(true)}
                className={`rounded-md p-1.5 ${config.textColor} opacity-75 hover:opacity-100 transition-opacity`}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline version of the degraded mode banner (not fixed position)
 * Useful for embedding in page content
 */
export function DegradedModeInlineBanner({
  className = '',
  onSyncClick,
}: Omit<DegradedModeBannerProps, 'dismissable'>) {
  const { state, mode, isDegraded } = useDegradedMode();

  // Don't render if not in degraded mode
  if (!isDegraded || mode === 'normal') {
    return null;
  }

  const config = getBannerConfig(mode);
  const showPulsingSync = mode === 'read_only_storage' || mode === 'read_only_auth';

  return (
    <div
      className={`rounded-lg border ${config.bgColor} ${config.borderColor} p-4 ${className}`}
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Message */}
        <div className="flex items-center gap-3">
          <span className={config.iconColor}>{config.icon}</span>
          <div>
            <p className={`text-sm font-medium ${config.textColor}`}>
              {state.messageFr}
            </p>
            {mode === 'queue_pressure' && (
              <p className={`text-xs ${config.textColor} opacity-75 mt-0.5`}>
                {state.details.opsQueueCount} opérations en attente de synchronisation
              </p>
            )}
            {mode === 'read_only_storage' && (
              <p className={`text-xs ${config.textColor} opacity-75 mt-0.5`}>
                Stockage utilisé: {state.details.storagePercent}%
              </p>
            )}
          </div>
        </div>

        {/* Sync Button */}
        <Link
          href="/sync"
          onClick={onSyncClick}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${config.buttonBgColor} ${config.buttonTextColor} ${config.buttonHoverColor} ${
            showPulsingSync ? 'animate-pulse' : ''
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${showPulsingSync ? 'animate-spin' : ''}`} />
          Synchroniser
        </Link>
      </div>
    </div>
  );
}

export default DegradedModeBanner;
