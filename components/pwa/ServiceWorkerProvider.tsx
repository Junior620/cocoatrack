// CocoaTrack V2 - Service Worker Provider Component
// Registers the service worker and provides update notifications
// Requirements: REQ-SW-001, REQ-SW-002

'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, AlertTriangle, Loader2 } from 'lucide-react';

import { useServiceWorker } from '@/lib/pwa/use-service-worker';
import type { SafetyCheckResult } from '@/lib/pwa/sw-update-manager';
import { getSyncEngine } from '@/lib/offline/sync-engine';

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
  const [isSyncingFirst, setIsSyncingFirst] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable && shouldShowUpdateNotification()) {
      setShowUpdateBanner(true);
      canSafelyUpdate().then(setSafetyCheck);
    }
  }, [isUpdateAvailable, shouldShowUpdateNotification, canSafelyUpdate]);

  const handleUpdate = useCallback(async () => {
    const check = await canSafelyUpdate();
    setSafetyCheck(check);

    if (!check.canUpdate) {
      if (check.pendingOpsCount > 0) {
        setShowConfirmDialog(true);
        return;
      }
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

  const handleSyncFirst = useCallback(async () => {
    setSyncError(null);
    setIsSyncingFirst(true);
    try {
      const result = await getSyncEngine().sync();
      const check = await canSafelyUpdate();
      setSafetyCheck(check);

      if (result.failed > 0 && check.pendingOpsCount > 0) {
        setSyncError(
          `${result.failed} opération(s) n'ont pas pu être synchronisées. Réessayez ou mettez à jour quand même.`
        );
        return;
      }

      if (check.canUpdate) {
        setShowConfirmDialog(false);
        setIsUpdating(true);
        await update();
        return;
      }

      if (check.pendingOpsCount === 0 && !check.isSyncing) {
        setShowConfirmDialog(false);
      }
    } catch (error) {
      console.error('Sync before update failed:', error);
      setSyncError(
        error instanceof Error
          ? error.message
          : 'La synchronisation a échoué. Réessayez.'
      );
    } finally {
      setIsSyncingFirst(false);
    }
  }, [canSafelyUpdate, update]);

  const handleDismiss = useCallback(() => {
    dismissUpdate(1); // Rappeler le lendemain si reporté
    setShowUpdateBanner(false);
    setShowConfirmDialog(false);
  }, [dismissUpdate]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setSyncError(null);
  }, []);

  const busy = isUpdating || isSyncingFirst;

  return (
    <>
      {children}

      {showUpdateBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-900/10">
            <div className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <RefreshCw className="h-5 w-5" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Nouvelle version disponible
                    </p>
                    <p className="mt-0.5 text-sm text-gray-600">
                      Mise à jour recommandée pour de meilleures performances.
                    </p>
                    {currentVersion && (
                      <p className="mt-1 text-xs text-gray-400">
                        Version installée : {currentVersion}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {safetyCheck && !safetyCheck.canUpdate && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                    <span>{safetyCheck.reason}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={busy || safetyCheck?.isSyncing}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Installation…
                      </>
                    ) : (
                      'Mettre à jour'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    disabled={busy}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sw-update-dialog-title"
            className="w-full max-w-sm rounded-xl border border-gray-100 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <h3 id="sw-update-dialog-title" className="text-base font-semibold text-gray-900">
                Opérations en attente
              </h3>
            </div>

            <p className="mb-2 text-sm text-gray-600">
              Vous avez{' '}
              <span className="font-semibold text-gray-900">{safetyCheck?.pendingOpsCount}</span>{' '}
              opération(s) non synchronisée(s).
            </p>
            <p className="mb-5 text-sm text-gray-600">
              Synchronisez vos données avant de mettre à jour pour éviter toute perte.
            </p>

            {syncError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                <span>{syncError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSyncFirst}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSyncingFirst ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Synchronisation…
                  </>
                ) : (
                  'Synchroniser d\u2019abord'
                )}
              </button>
              <button
                type="button"
                onClick={handleForceUpdate}
                disabled={busy}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Mettre à jour quand même
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={busy}
                className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800 disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
