// CocoaTrack V2 - Online/Offline Indicator
// Shows connection status in the header
// Requirements: 8.4

'use client';

import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus, useOffline } from '@/lib/offline/use-offline';
import Link from 'next/link';

interface OnlineIndicatorProps {
  showPendingCount?: boolean;
  className?: string;
}

/**
 * Displays online/offline status with optional pending operations count
 */
export function OnlineIndicator({
  showPendingCount = true,
  className = '',
}: OnlineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const { pendingCount, conflictCount, isSyncing } = useOffline();

  const totalPending = pendingCount + conflictCount;

  return (
    <Link
      href="/sync"
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 ${className}`}
    >
      {/* Status dot */}
      <span className="relative flex h-2.5 w-2.5">
        {isSyncing ? (
          // Syncing animation
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        ) : !isOnline ? (
          // Offline pulse
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-red-400 opacity-75" />
        ) : null}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isSyncing
              ? 'bg-amber-500'
              : isOnline
                ? 'bg-green-500'
                : 'bg-red-500'
          }`}
        />
      </span>

      {/* Status text */}
      <span
        className={`font-medium ${
          isSyncing
            ? 'text-amber-700'
            : isOnline
              ? 'text-green-700'
              : 'text-red-700'
        }`}
      >
        {isSyncing ? 'Sync...' : isOnline ? 'En ligne' : 'Hors ligne'}
      </span>

      {/* Pending count badge */}
      {showPendingCount && totalPending > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
            conflictCount > 0
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {totalPending}
        </span>
      )}
    </Link>
  );
}

/**
 * Compact version for mobile or tight spaces
 */
export function OnlineIndicatorCompact({ className = '' }: { className?: string }) {
  const isOnline = useOnlineStatus();
  const { pendingCount, conflictCount, isSyncing } = useOffline();

  const totalPending = pendingCount + conflictCount;

  return (
    <Link
      href="/sync"
      className={`relative flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100 ${className}`}
      title={
        isSyncing
          ? 'Synchronisation en cours...'
          : isOnline
            ? `En ligne${totalPending > 0 ? ` - ${totalPending} en attente` : ''}`
            : 'Hors ligne'
      }
    >
      {/* Icon */}
      {isSyncing ? (
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
      ) : isOnline ? (
        <Wifi className="h-5 w-5 text-green-500" />
      ) : (
        <WifiOff className="h-5 w-5 text-red-500" />
      )}

      {/* Badge */}
      {totalPending > 0 && (
        <span
          className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
            conflictCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          }`}
        >
          {totalPending > 9 ? '9+' : totalPending}
        </span>
      )}
    </Link>
  );
}
