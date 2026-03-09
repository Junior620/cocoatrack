'use client';

// CocoaTrack V2 - Planteur Checkbox Component
// Individual checkbox for selecting planteurs in bulk operations
// Requirements: 1.1, 1.2

import { usePlanteurSelection } from '@/contexts/planteur-selection';
import { cn } from '@/lib/utils';

export interface PlanteurCheckboxProps {
  /** The planteur ID */
  planteurId: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PlanteurCheckbox Component
 * 
 * Renders a checkbox for selecting individual planteurs.
 * Integrates with PlanteurSelectionContext to manage selection state.
 * 
 * Requirements:
 * - 1.1: Display checkbox for each planteur row
 * - 1.2: Toggle selection state on click
 */
export function PlanteurCheckbox({
  planteurId,
  disabled = false,
  className,
}: PlanteurCheckboxProps) {
  const { isSelected, toggleSelection } = usePlanteurSelection();
  const checked = isSelected(planteurId);

  const handleChange = () => {
    if (!disabled) {
      toggleSelection(planteurId);
    }
  };

  return (
    <div className={cn('flex items-center', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors'
        )}
        aria-label={`Sélectionner le planteur ${planteurId}`}
        aria-checked={checked}
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

export default PlanteurCheckbox;
