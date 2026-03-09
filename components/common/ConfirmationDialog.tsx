'use client';

// CocoaTrack V2 - Confirmation Dialog Component
// Reusable confirmation dialog with title, message, and actions
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ConfirmationDialogProps } from '@/types/planteur-bulk';

/**
 * ConfirmationDialog Component
 * 
 * Reusable confirmation dialog for user actions.
 * Supports different visual variants (info, warning, danger) and customizable labels.
 * 
 * Requirements:
 * - 3.1: Display confirmation dialog when user submits assignment
 * - 3.2: Show the number of planteurs to be updated
 * - 3.3: Show the chef planteur name if being assigned
 * - 3.4: Show the cooperative name if being assigned
 * - 3.5: Execute bulk assignment when user confirms
 * - 3.6: Return to assignment dialog when user cancels
 */
export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  // Get variant-specific styles and icon
  const variantStyles = {
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    danger: {
      icon: AlertCircle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-4 sm:p-6 animate-slide-up">
        {/* Icon */}
        <div className={`mx-auto w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`} aria-hidden="true">
          <Icon className={`h-6 w-6 ${styles.iconColor}`} />
        </div>

        {/* Title */}
        <h3 id="confirmation-dialog-title" className="text-base sm:text-lg font-semibold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <div id="confirmation-dialog-message" className="text-sm text-gray-600 text-center mb-4 sm:mb-6">
          {message}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            type="button"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.confirmButton}`}
            type="button"
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
