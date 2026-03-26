'use client';

// CocoaTrack V2 - ReceiptImportButton
// Button to open the receipt import wizard, visible only to managers and admins
// Requirements: 1.1, 1.2, 1.3, 1.4

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ReceiptImportWizard } from './ReceiptImportWizard';

export interface ReceiptImportButtonProps {
  /** Called after a successful import with the number of deliveries created */
  onImportComplete?: (deliveryCount: number) => void;
}

/**
 * ReceiptImportButton
 *
 * Displays an "Importer un reçu de collecte" button on the deliveries page.
 * Only visible to managers and admins (Req 1.1, 1.2).
 * Opens the ReceiptImportWizard modal on click (Req 1.3).
 * Positioned in the page header area (Req 1.4).
 */
export function ReceiptImportButton({ onImportComplete }: ReceiptImportButtonProps) {
  const { user } = useAuth();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Hide button for unauthorized users (Req 1.2)
  if (!user || (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'agent')) {
    return null;
  }

  // Cooperative ID from profile (optional - user can select in wizard if not set)
  const cooperativeId = user.cooperative_id;

  const handleImportComplete = (deliveryCount: number) => {
    setIsWizardOpen(false);
    onImportComplete?.(deliveryCount);
  };

  return (
    <>
      {/* Import button (Req 1.1, 1.4) */}
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Upload className="mr-2 h-4 w-4" />
        Importer un reçu de collecte
      </button>

      {/* Wizard modal (Req 1.3) */}
      {isWizardOpen && (
        <ReceiptImportWizard
          cooperativeId={cooperativeId}
          onImportComplete={handleImportComplete}
          onClose={() => setIsWizardOpen(false)}
        />
      )}
    </>
  );
}
