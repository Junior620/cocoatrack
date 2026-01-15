// CocoaTrack V2 - Service Worker Provider Component
// Registers the service worker and provides update notifications
// Requirements: REQ-SW-001, REQ-SW-002

'use client';

import { useEffect, useState, useCallback } from 'react';

import { useServiceWorker } from '@/lib/pwa/use-service-worker';
import type { SafetyCheckResult } from '@/lib/pwa/sw-update-manager';

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that registers the service worker
 * and shows update notifications when available
 * REQ-SW-001: Safe Service Worker Update with safety checks
 */
export function ServiceWorkerProvider({
  children,
}: ServiceWorkerProviderProps) {
  const { 
    isUpdateAvailable, 
    update, 
    forceUpdate,
    dismissUpdate,
    canSafelyUpdate,
    shouldShowUpdateNotification,
    currentVersion,
  } = useServiceWorker();
  
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable && shouldShowUpdateNotification()) {
      setShowUpdateBanner(true);
      // Check if we can safely update
      canSafelyUpdate().then(setSafetyCheck);
    }
  }, [isUpdateAvailable, shouldShowUpdateNotification, canSafelyUpdate]);

  const handleUpdate = useCallback(async () => {
    // Re-check safety before updating
    const check = await canSafelyUpdate();
    setSafetyCheck(check);

    if (!check.canUpdate) {
      // Show confirmation dialog if there are pending ops
      if (check.pendingOpsCount > 0) {
        setShowConfirmDialog(true);
        return;
      }
      // If syncing, just show the message
      return;
    }

    setIsUpdating(true);
    try {
      await update();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  }, [canSafelyUpdate, update]);

  const handleForceUpdate = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsUpdating(true);
    try {
      await forceUpdate();
    } catch (error) {
      console.error('Force update failed:', error);
      setIsUpdating(false);
    }
  }, [forceUpdate]);

  const handleDismiss = useCallback(() => {
    dismissUpdate(7); // Dismiss for 7 days
    setShowUpdateBanner(false);
  }, [dismissUpdate]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return (
    <>
      {children}
      
      {/* Update Available Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg bg-amber-600 p-4 shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  Mise à jour disponible
                </p>
                <p className="mt-1 text-xs text-amber-100">
                  Une nouvelle version de CocoaTrack est prête.
                  {currentVersion && (
                    <span className="block mt-0.5 opacity-75">
                      Version actuelle: {currentVersion}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="ml-2 text-amber-200 hover:text-white"
                aria-label="Fermer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Safety warning if applicable */}
            {safetyCheck && !safetyCheck.canUpdate && (
              <div className="rounded bg-amber-700/50 p-2 text-xs text-amber-100">
                <span className="font-medium">⚠️ Attention:</span> {safetyCheck.reason}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded px-3 py-2 text-sm text-amber-100 hover:bg-amber-700/50"
                disabled={isUpdating}
              >
                Plus tard
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating || safetyCheck?.isSyncing}
                className="flex-1 rounded bg-white px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mise à jour...
                  </span>
                ) : (
                  'Mettre à jour'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for pending operations */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Opérations en attente
              </h3>
            </div>
            
            <p className="mb-2 text-sm text-gray-600">
              Vous avez <span className="font-semibold text-amber-600">{safetyCheck?.pendingOpsCount}</span> opération(s) 
              non synchronisée(s).
            </p>
            <p className="mb-6 text-sm text-gray-600">
              Il est recommandé de synchroniser vos données avant de mettre à jour 
              pour éviter toute perte.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelConfirm}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Synchroniser d&apos;abord
              </button>
              <button
                onClick={handleForceUpdate}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Mettre à jour quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
