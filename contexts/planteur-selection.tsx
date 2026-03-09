'use client';

// CocoaTrack V2 - Planteur Selection Context
// Manages selection state for bulk planteur operations

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

interface PlanteurSelectionContextValue {
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  selectionCount: number;
}

const PlanteurSelectionContext = createContext<PlanteurSelectionContextValue | undefined>(undefined);

interface PlanteurSelectionProviderProps {
  children: ReactNode;
}

export function PlanteurSelectionProvider({ children }: PlanteurSelectionProviderProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /**
   * Toggle selection for a single planteur
   * Requirements: 1.2
   */
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Toggle selection for all planteurs in the provided list
   * If all are selected, deselect all. Otherwise, select all.
   * Requirements: 1.3
   */
  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      // Check if all provided IDs are already selected
      const allSelected = ids.every((id) => prev.has(id));
      
      if (allSelected) {
        // Deselect all provided IDs
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      } else {
        // Select all provided IDs
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      }
    });
  }, []);

  /**
   * Clear all selections
   * Requirements: 1.4
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if a planteur is selected
   * Requirements: 1.2
   */
  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  /**
   * Get the count of selected planteurs
   * Requirements: 1.4
   */
  const selectionCount = selectedIds.size;

  const value: PlanteurSelectionContextValue = {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    selectionCount,
  };

  return (
    <PlanteurSelectionContext.Provider value={value}>
      {children}
    </PlanteurSelectionContext.Provider>
  );
}

/**
 * Hook to access planteur selection context
 */
export function usePlanteurSelection() {
  const context = useContext(PlanteurSelectionContext);
  if (context === undefined) {
    throw new Error('usePlanteurSelection must be used within a PlanteurSelectionProvider');
  }
  return context;
}
