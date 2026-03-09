'use client';

// CocoaTrack V2 - Select All Checkbox Component
// Checkbox for selecting/deselecting all planteurs in bulk operations
// Requirements: 1.3

import { usePlanteurSelection } from '@/contexts/planteur-selection';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export interface SelectAllCheckboxProps {
  /** Array of all planteur IDs currently visible/available for selection */
  planteurIds: string[];
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SelectAllCheckbox Component
 * 
 * Renders a checkbox for selecting/deselecting all planteurs.
 * Supports indeterminate state when some (but not all) planteurs are selected.
 * Integrates with PlanteurSelectionContext to manage selection state.
 * 
 * Requirements:
 * - 1.3: Toggle selection for all visible planteurs
 * - Handle indeterminate state (some selected)
 */
export function SelectAllCheckbox({
  planteurIds,
  disabled = false,
  className,
}: SelectAllCheckboxProps) {
  const { isSelected, toggleAll, selectionCount } = usePlanteurSelection();
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Calculate selection state
  const selectedCount = planteurIds.filter((id) => isSelected(id)).length;
  const allSelected = selectedCount === planteurIds.length && planteurIds.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < planteurIds.length;

  // Update indeterminate state
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleChange = () => {
    if (!disabled) {
      toggleAll(planteurIds);
    }
  };

  return (
    <div className={cn('flex items-center', className)}>
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors'
        )}
        aria-label={
          allSelected
            ? 'Désélectionner tous les planteurs'
            : someSelected
            ? 'Sélectionner tous les planteurs (certains sont déjà sélectionnés)'
            : 'Sélectionner tous les planteurs'
        }
        aria-checked={someSelected ? 'mixed' : allSelected}
        role="checkbox"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleChange();
          }
        }}
      />
    </div>
  );
}

export default SelectAllCheckbox;
