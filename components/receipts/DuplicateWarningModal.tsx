'use client';

import { AlertTriangle, ExternalLink, X } from 'lucide-react';

export interface DuplicateReceipt {
  collectionReceiptId: string;
  receiptNumber: string;
  transactionDate: string;
  totalWeight: number;
  similarity: number;
}

interface DuplicateWarningModalProps {
  duplicates: DuplicateReceipt[];
  /** Called when user chooses to continue anyway */
  onContinue: () => void;
  /** Called when user chooses to cancel */
  onCancel: () => void;
}

/**
 * DuplicateWarningModal
 *
 * Shown when potential duplicate receipts are detected on form submission.
 * Allows user to continue or cancel.
 *
 * Requirements: 17.3, 17.4, 17.5, 17.6
 */
export function DuplicateWarningModal({
  duplicates,
  onContinue,
  onCancel,
}: DuplicateWarningModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[60]" aria-hidden="true" />

      {/* Modal */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dup-modal-title"
        aria-describedby="dup-modal-desc"
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 id="dup-modal-title" className="text-base font-semibold text-gray-900">
                Reçus similaires détectés
              </h3>
              <p id="dup-modal-desc" className="mt-1 text-sm text-gray-600">
                {duplicates.length === 1
                  ? 'Un reçu similaire a été trouvé dans le système.'
                  : `${duplicates.length} reçus similaires ont été trouvés dans le système.`}{' '}
                Voulez-vous continuer malgré tout ?
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Duplicate list */}
          <ul className="px-6 py-4 space-y-3 max-h-60 overflow-y-auto">
            {duplicates.map((dup) => (
              <li
                key={dup.collectionReceiptId}
                className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    Reçu N° {dup.receiptNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    Date : {new Date(dup.transactionDate).toLocaleDateString('fr-FR')} &bull;{' '}
                    Poids : {dup.totalWeight.toLocaleString('fr-FR')} kg &bull;{' '}
                    Similarité : {Math.round(dup.similarity * 100)}%
                  </p>
                </div>
                <a
                  href={`/deliveries?receipt=${dup.collectionReceiptId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 flex-shrink-0 text-[#6FAF3D] hover:text-[#5a8f31]"
                  aria-label={`Voir les livraisons du reçu ${dup.receiptNumber}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
            >
              Continuer quand même
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
