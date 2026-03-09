'use client';

// CocoaTrack V2 - Bulk Action Toolbar Component
// Toolbar for bulk operations on selected planteurs
// Requirements: 1.4, 1.5, 2.1

import { usePlanteurSelection } from '@/contexts/planteur-selection';
import { cn } from '@/lib/utils';
import { Users, X } from 'lucide-react';

export interface BulkActionToolbarProps {
  /** Callback when bulk assign button is clicked */
  onBulkAssign: () => void;
  /** Whether bulk actions are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * BulkActionToolbar Component
 * 
 * Displays a toolbar with bulk action controls when planteurs are selected.
 * Shows the count of selected planteurs and provides buttons for bulk operations.
 * Conditionally renders based on selection count.
 * 
 * Requirements:
 * - 1.4: Display count of selected planteurs
 * - 1.5: Disable bulk action controls when no planteurs are selected
 * - 2.1: Display bulk action toolbar when planteurs are selected
 */
export function BulkActionToolbar({
  onBulkAssign,
  disabled = false,
  className,
}: BulkActionToolbarProps) {
  const { selectionCount, clearSelection } = usePlanteurSelection();

  // Don't render if no planteurs are selected (Requirement 2.1)
  if (selectionCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4',
        'px-3 sm:px-4 py-2.5 sm:py-3 bg-primary-50 border border-primary-200 rounded-lg',
        'transition-all duration-200 ease-in-out',
        className
      )}
      role="toolbar"
      aria-label="Actions en masse pour les planteurs"
    >
      {/* Selection count display (Requirement 1.4) */}
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <Users className="h-5 w-5 text-primary-600" aria-hidden="true" />
        <span className="text-sm font-medium text-primary-900">
          {selectionCount} planteur{selectionCount > 1 ? 's' : ''} sélectionné{selectionCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Clear selection button */}
        <button
          onClick={clearSelection}
          disabled={disabled}
          className={cn(
            'flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg',
            'hover:bg-gray-50 hover:border-gray-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-1.5'
          )}
          aria-label={`Effacer la sélection de ${selectionCount} planteur${selectionCount > 1 ? 's' : ''}`}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span>Effacer</span>
        </button>

        {/* Bulk assign button */}
        <button
          onClick={onBulkAssign}
          disabled={disabled}
          className={cn(
            'flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg',
            'hover:bg-primary-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-1.5'
          )}
          aria-label={`Assigner en masse ${selectionCount} planteur${selectionCount > 1 ? 's' : ''}`}
          type="button"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Assigner en masse</span>
        </button>
      </div>
    </div>
  );
}

export default BulkActionToolbar;
