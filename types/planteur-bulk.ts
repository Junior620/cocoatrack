// CocoaTrack V2 - Bulk Planteur Assignment Type Definitions
// Types for bulk assignment operations

/**
 * Request payload for bulk planteur assignment
 * Used by POST /api/planteurs/bulk-assign
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export interface BulkAssignmentRequest {
  /**
   * Array of planteur UUIDs to update
   * Must contain at least one ID
   */
  planteurIds: string[];
  
  /**
   * Chef planteur ID to assign (optional)
   * - undefined: field not modified
   * - null: clear existing assignment
   * - string: assign to this chef planteur
   */
  chefPlanteurId?: string | null;
  
  /**
   * Cooperative ID to assign (optional)
   * - undefined: field not modified
   * - null: clear existing assignment
   * - string: assign to this cooperative
   */
  cooperativeId?: string | null;
}

/**
 * Individual error for a failed planteur update
 */
export interface BulkAssignmentError {
  /**
   * UUID of the planteur that failed to update
   */
  planteurId: string;
  
  /**
   * Name of the planteur (if available)
   */
  planteurName?: string;
  
  /**
   * Error message describing why the update failed
   */
  error: string;
}

/**
 * Response from bulk assignment operation
 * Contains success/failure counts and detailed error information
 * 
 * Requirements: 4.4, 5.1, 5.2, 5.3
 */
export interface BulkAssignmentResponse {
  /**
   * Overall success status
   * - true: all planteurs updated successfully
   * - false: one or more planteurs failed to update
   */
  success: boolean;
  
  /**
   * Number of planteurs successfully updated
   */
  successCount: number;
  
  /**
   * Number of planteurs that failed to update
   */
  failureCount: number;
  
  /**
   * Detailed error information for failed updates
   * Only present when failureCount > 0
   */
  errors?: BulkAssignmentError[];
}

/**
 * Audit log metadata for bulk assignment operations
 * Stored in audit_logs.metadata field
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export interface BulkAssignmentAuditMetadata {
  /**
   * Type of operation (always 'bulk_assignment')
   */
  operation_type: 'bulk_assignment';
  
  /**
   * List of planteur IDs affected by the operation
   */
  planteur_ids: string[];
  
  /**
   * Assignment values applied
   */
  assignments: {
    chef_planteur_id?: string | null;
    cooperative_id?: string | null;
  };
  
  /**
   * Number of planteurs successfully updated
   */
  success_count: number;
  
  /**
   * Number of planteurs that failed to update
   */
  failure_count: number;
  
  /**
   * Detailed error information for failed updates
   */
  errors?: BulkAssignmentError[];
}

/**
 * Selection state for planteur checkboxes
 * Used by PlanteurSelectionContext
 * 
 * Requirements: 1.2, 1.3, 1.4
 */
export interface PlanteurSelectionState {
  /**
   * Set of selected planteur IDs
   */
  selectedIds: Set<string>;
  
  /**
   * Toggle selection for a single planteur
   */
  toggleSelection: (id: string) => void;
  
  /**
   * Toggle selection for all planteurs in the provided list
   */
  toggleAll: (ids: string[]) => void;
  
  /**
   * Clear all selections
   */
  clearSelection: () => void;
  
  /**
   * Check if a planteur is selected
   */
  isSelected: (id: string) => boolean;
  
  /**
   * Number of currently selected planteurs
   */
  selectionCount: number;
}

/**
 * Form data for bulk assignment dialog
 * Used by BulkAssignmentDialog component
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
export interface BulkAssignmentFormData {
  /**
   * Chef planteur ID to assign
   * - null: clear existing assignment
   * - string: assign to this chef planteur
   */
  chefPlanteurId: string | null;
  
  /**
   * Cooperative ID to assign
   * - null: clear existing assignment
   * - string: assign to this cooperative
   */
  cooperativeId: string | null;
}

/**
 * Props for BulkAssignmentDialog component
 */
export interface BulkAssignmentDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  
  /**
   * Array of selected planteur IDs
   */
  selectedPlanteurIds: string[];
  
  /**
   * Callback when dialog is closed
   */
  onClose: () => void;
  
  /**
   * Callback when assignment succeeds
   */
  onSuccess: () => void;
}

/**
 * Props for ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  
  /**
   * Dialog title
   */
  title: string;
  
  /**
   * Dialog message/content
   */
  message: string;
  
  /**
   * Label for confirm button
   */
  confirmLabel: string;
  
  /**
   * Label for cancel button
   */
  cancelLabel: string;
  
  /**
   * Callback when confirmed
   */
  onConfirm: () => void;
  
  /**
   * Callback when cancelled
   */
  onCancel: () => void;
  
  /**
   * Visual variant for the dialog
   */
  variant?: 'info' | 'warning' | 'danger';
}

/**
 * Props for BulkActionToolbar component
 */
export interface BulkActionToolbarProps {
  /**
   * Number of selected planteurs
   */
  selectedCount: number;
  
  /**
   * Callback when bulk assign button is clicked
   */
  onBulkAssign: () => void;
  
  /**
   * Callback when clear selection button is clicked
   */
  onClearSelection: () => void;
}

/**
 * Props for PlanteurCheckbox component
 */
export interface PlanteurCheckboxProps {
  /**
   * Planteur ID
   */
  planteurId: string;
  
  /**
   * Whether the checkbox is disabled
   */
  disabled?: boolean;
}

/**
 * Props for SelectAllCheckbox component
 */
export interface SelectAllCheckboxProps {
  /**
   * Array of all planteur IDs on current page
   */
  planteurIds: string[];
  
  /**
   * Whether the checkbox is disabled
   */
  disabled?: boolean;
}
