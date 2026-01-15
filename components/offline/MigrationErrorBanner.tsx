/**
 * CocoaTrack V2 - Migration Error Banner
 * 
 * Displays migration errors and provides recovery options:
 * - Retry migration
 * - Réinitialiser les données (reset database preserving ops_queue)
 * 
 * Requirements: REQ-IDB-002
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, X, Loader2 } from 'lucide-react';
import { useMigration } from '@/lib/offline/use-migration';

export interface MigrationErrorBannerProps {
  onDismiss?: () => void;
  onMigrationSuccess?: () => void;
}

export function MigrationErrorBanner({
  onDismiss,
  onMigrationSuccess,
}: MigrationErrorBannerProps) {
  const {
    status,
    error,
    rollbackAvailable,
    opsQueueBackupCount,
    isLoading,
    runRollback,
    resetData,
    dismissError,
  } = useMigration();

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Only show when there's an error
  if (status !== 'failed' || !error) {
    return null;
  }

  const handleRetry = async () => {
    const result = await runRollback();
    if (result.success) {
      onMigrationSuccess?.();
    }
  };

  const handleReset = async () => {
    const result = await resetData();
    if (result.success) {
      setShowConfirmReset(false);
      onMigrationSuccess?.();
    }
  };

  const handleDismiss = () => {
    dismissError();
    onDismiss?.();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-red-800">
              Erreur de migration de la base de données
            </h3>
            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
            
            {opsQueueBackupCount > 0 && (
              <p className="mt-1 text-xs text-red-600">
                {opsQueueBackupCount} opération(s) en attente sauvegardée(s)
              </p>
            )}

            {!showConfirmReset ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {rollbackAvailable && (
                  <button
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Réessayer
                  </button>
                )}
                
                <button
                  onClick={() => setShowConfirmReset(true)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Réinitialiser les données
                </button>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-red-100 rounded-md">
                <p className="text-sm text-red-800 font-medium">
                  Êtes-vous sûr de vouloir réinitialiser les données ?
                </p>
                <p className="mt-1 text-xs text-red-700">
                  Cette action supprimera toutes les données locales sauf les opérations en attente de synchronisation.
                  Les données seront re-téléchargées lors de la prochaine synchronisation.
                </p>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleReset}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Confirmer la réinitialisation
                  </button>
                  
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-white hover:bg-red-50 border border-red-300 rounded-md transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MigrationErrorBanner;
