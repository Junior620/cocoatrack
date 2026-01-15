'use client';

// CocoaTrack V2 - Swipe Actions Components
// REQ-RESP-006: Swipe Actions Standardisées
// - Swipe left: secondary actions (archive, delete)
// - Swipe right: primary action (open, validate)
// - Visual feedback during swipe
// - Confirmation for destructive actions
// - 5s undo snackbar

import React, { useState, useRef, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, Undo2, AlertTriangle } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface SwipeAction<T = unknown> {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Action icon */
  icon: ReactNode;
  /** Background color class (Tailwind) */
  bgColor: string;
  /** Text color class (Tailwind) */
  textColor?: string;
  /** Action handler */
  onAction: (item: T) => void | Promise<void>;
  /** Whether action is destructive (requires confirmation) */
  destructive?: boolean;
  /** Custom confirmation message */
  confirmMessage?: string;
}

interface UndoAction {
  id: string;
  label: string;
  onUndo: () => void | Promise<void>;
  expiresAt: number;
}

// =============================================================================
// Undo Snackbar Context
// =============================================================================

interface UndoContextValue {
  showUndo: (action: Omit<UndoAction, 'id' | 'expiresAt'>) => void;
  hideUndo: (id: string) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo() {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within UndoProvider');
  }
  return context;
}

// =============================================================================
// Undo Provider
// =============================================================================

interface UndoProviderProps {
  children: ReactNode;
}

export function UndoProvider({ children }: UndoProviderProps) {
  const [undoActions, setUndoActions] = useState<UndoAction[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showUndo = useCallback((action: Omit<UndoAction, 'id' | 'expiresAt'>) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + 5000; // 5 seconds

    const newAction: UndoAction = {
      ...action,
      id,
      expiresAt,
    };

    setUndoActions((prev) => [...prev, newAction]);

    // Auto-remove after 5 seconds
    const timeout = setTimeout(() => {
      setUndoActions((prev) => prev.filter((a) => a.id !== id));
      timeoutRefs.current.delete(id);
    }, 5000);

    timeoutRefs.current.set(id, timeout);
  }, []);

  const hideUndo = useCallback((id: string) => {
    setUndoActions((prev) => prev.filter((a) => a.id !== id));
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo, hideUndo }}>
      {children}
      <UndoSnackbarContainer actions={undoActions} onDismiss={hideUndo} />
    </UndoContext.Provider>
  );
}

// =============================================================================
// Undo Snackbar Container
// =============================================================================

interface UndoSnackbarContainerProps {
  actions: UndoAction[];
  onDismiss: (id: string) => void;
}

function UndoSnackbarContainer({ actions, onDismiss }: UndoSnackbarContainerProps) {
  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 space-y-2">
      {actions.map((action) => (
        <UndoSnackbar
          key={action.id}
          action={action}
          onDismiss={() => onDismiss(action.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Undo Snackbar
// =============================================================================

interface UndoSnackbarProps {
  action: UndoAction;
  onDismiss: () => void;
}

function UndoSnackbar({ action, onDismiss }: UndoSnackbarProps) {
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const duration = action.expiresAt - startTime;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [action.expiresAt]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await action.onUndo();
    } finally {
      onDismiss();
    }
  };

  return (
    <div className="bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden animate-slide-up">
      {/* Progress bar */}
      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-primary-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between p-3 gap-3">
        <span className="text-sm flex-1">{action.label}</span>

        <button
          onClick={handleUndo}
          disabled={isUndoing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-400 hover:text-primary-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] justify-center"
        >
          <Undo2 className="h-4 w-4" />
          <span>Annuler</span>
        </button>

        <button
          onClick={onDismiss}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


// =============================================================================
// Confirmation Dialog
// =============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-slide-up">
        {/* Icon */}
        {destructive && (
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        )}

        {/* Content */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors min-h-[44px]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-sm font-medium text-white rounded-xl transition-colors min-h-[44px] ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Swipeable List Item
// =============================================================================

interface SwipeableListItemProps<T> {
  item: T;
  children: ReactNode;
  /** Left swipe actions (secondary - archive, delete) */
  leftActions?: SwipeAction<T>[];
  /** Right swipe action (primary - open, validate) */
  rightAction?: SwipeAction<T>;
  /** Click handler */
  onClick?: () => void;
  /** Whether to show undo snackbar after action */
  showUndo?: boolean;
  /** Undo label */
  undoLabel?: string;
  /** Undo handler */
  onUndo?: () => void | Promise<void>;
}

export function SwipeableListItem<T>({
  item,
  children,
  leftActions = [],
  rightAction,
  onClick,
  showUndo: enableUndo = false,
  undoLabel = 'Action annulée',
  onUndo,
}: SwipeableListItemProps<T>) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmAction, setConfirmAction] = useState<SwipeAction<T> | null>(null);
  const startXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Try to use undo context if available
  let undoContext: UndoContextValue | null = null;
  try {
    undoContext = useUndo();
  } catch {
    // Not within UndoProvider, that's okay
  }

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;

    // Limit swipe distance
    const limitedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));

    // Only allow swipe in directions with actions
    if (diff > 0 && !rightAction) return;
    if (diff < 0 && leftActions.length === 0) return;

    setTranslateX(limitedDiff);
  }, [isDragging, leftActions.length, rightAction]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (Math.abs(translateX) >= SWIPE_THRESHOLD) {
      if (translateX > 0 && rightAction) {
        // Right swipe - primary action
        if (rightAction.destructive) {
          setConfirmAction(rightAction);
        } else {
          executeAction(rightAction);
        }
      } else if (translateX < 0 && leftActions.length > 0) {
        // Left swipe - keep revealed for action selection
        setTranslateX(-MAX_SWIPE);
        return;
      }
    }

    setTranslateX(0);
  }, [translateX, rightAction, leftActions]);

  const executeAction = async (action: SwipeAction<T>) => {
    await action.onAction(item);
    
    // Show undo snackbar if enabled
    if (enableUndo && undoContext && onUndo) {
      undoContext.showUndo({
        label: undoLabel,
        onUndo,
      });
    }
    
    setTranslateX(0);
    setConfirmAction(null);
  };

  const handleActionClick = (action: SwipeAction<T>) => {
    if (action.destructive) {
      setConfirmAction(action);
    } else {
      executeAction(action);
    }
  };

  const handleConfirm = () => {
    if (confirmAction) {
      executeAction(confirmAction);
    }
  };

  const handleCancel = () => {
    setConfirmAction(null);
    setTranslateX(0);
  };

  const resetSwipe = () => {
    setTranslateX(0);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl mb-3">
        {/* Left actions (revealed on left swipe) */}
        {leftActions.length > 0 && (
          <div
            className="absolute inset-y-0 right-0 flex items-stretch"
            style={{ width: MAX_SWIPE }}
          >
            {leftActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={`
                  flex-1 flex flex-col items-center justify-center gap-1
                  ${action.bgColor} ${action.textColor || 'text-white'}
                  min-w-[60px] min-h-[44px] touch-manipulation
                `}
                aria-label={action.label}
              >
                {action.icon}
                <span className="text-[10px] font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Right action (revealed on right swipe) */}
        {rightAction && (
          <div
            className="absolute inset-y-0 left-0 flex items-stretch"
            style={{ width: MAX_SWIPE }}
          >
            <button
              onClick={() => handleActionClick(rightAction)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                ${rightAction.bgColor} ${rightAction.textColor || 'text-white'}
                min-h-[44px] touch-manipulation
              `}
              aria-label={rightAction.label}
            >
              {rightAction.icon}
              <span className="text-[10px] font-medium">{rightAction.label}</span>
            </button>
          </div>
        )}

        {/* Card content */}
        <div
          ref={cardRef}
          className={`
            relative bg-white border border-gray-100 rounded-xl shadow-sm
            transition-transform ${isDragging ? '' : 'duration-200'}
            touch-manipulation
          `}
          style={{ transform: `translateX(${translateX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (Math.abs(translateX) < 5) {
              onClick?.();
            } else {
              resetSwipe();
            }
          }}
        >
          {children}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.destructive ? 'Confirmer la suppression' : 'Confirmer'}
        message={confirmAction?.confirmMessage || 'Êtes-vous sûr de vouloir effectuer cette action ?'}
        confirmLabel={confirmAction?.label || 'Confirmer'}
        destructive={confirmAction?.destructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

export default SwipeableListItem;
