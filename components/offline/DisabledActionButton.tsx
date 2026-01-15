// CocoaTrack V2 - Disabled Action Button
// Button component that handles degraded mode disabled states
// Requirements: REQ-OFF-011

'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { useDegradedMode } from '@/lib/offline/use-degraded-mode';
import type { DisabledAction } from '@/lib/offline/degraded-mode-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface DisabledActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** The action type to check for disabled state */
  action: DisabledAction | string;
  /** Children to render inside the button */
  children: ReactNode;
  /** Additional disabled condition (combined with degraded mode check) */
  additionalDisabled?: boolean;
  /** Custom tooltip when disabled by degraded mode */
  customTooltip?: string;
  /** Variant style */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Icon to show before text */
  icon?: ReactNode;
}

// ============================================================================
// STYLES
// ============================================================================

const variantStyles = {
  primary: {
    base: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  },
  secondary: {
    base: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-amber-500',
    disabled: 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed',
  },
  danger: {
    base: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
  },
  ghost: {
    base: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    disabled: 'text-gray-400 cursor-not-allowed',
  },
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Button component that automatically handles degraded mode disabled states
 * 
 * Features:
 * - Automatically checks if the action is disabled in current degraded mode
 * - Shows tooltip explaining why the button is disabled
 * - Combines with additional disabled conditions
 * - Supports multiple variants and sizes
 * 
 * @example
 * ```tsx
 * <DisabledActionButton
 *   action="create_delivery"
 *   onClick={handleCreate}
 *   variant="primary"
 * >
 *   Créer une livraison
 * </DisabledActionButton>
 * ```
 */
export const DisabledActionButton = forwardRef<
  HTMLButtonElement,
  DisabledActionButtonProps
>(function DisabledActionButton(
  {
    action,
    children,
    additionalDisabled = false,
    customTooltip,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    className = '',
    ...props
  },
  ref
) {
  const { isActionDisabled, getDisabledTooltip } = useDegradedMode();

  const isDisabledByDegradedMode = isActionDisabled(action);
  const isDisabled = isDisabledByDegradedMode || additionalDisabled || isLoading;

  const tooltip = isDisabledByDegradedMode
    ? customTooltip || getDisabledTooltip()
    : undefined;

  const styles = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      title={tooltip}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        ${sizeStyle}
        ${isDisabled ? styles.disabled : styles.base}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
});

// ============================================================================
// LINK VARIANT
// ============================================================================

export interface DisabledActionLinkProps {
  /** The action type to check for disabled state */
  action: DisabledAction | string;
  /** Children to render inside the link */
  children: ReactNode;
  /** Link href */
  href: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom tooltip when disabled by degraded mode */
  customTooltip?: string;
}

/**
 * Link component that handles degraded mode disabled states
 * Renders as a disabled span when the action is blocked
 */
export function DisabledActionLink({
  action,
  children,
  href,
  className = '',
  customTooltip,
}: DisabledActionLinkProps) {
  const { isActionDisabled, getDisabledTooltip } = useDegradedMode();

  const isDisabled = isActionDisabled(action);
  const tooltip = isDisabled ? customTooltip || getDisabledTooltip() : undefined;

  if (isDisabled) {
    return (
      <span
        className={`cursor-not-allowed opacity-50 ${className}`}
        title={tooltip}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

// ============================================================================
// WRAPPER COMPONENT
// ============================================================================

export interface DisabledActionWrapperProps {
  /** The action type to check for disabled state */
  action: DisabledAction | string;
  /** Children to render */
  children: ReactNode;
  /** Render function when disabled (optional) */
  renderDisabled?: (tooltip: string) => ReactNode;
}

/**
 * Wrapper component that conditionally renders children based on degraded mode
 * 
 * @example
 * ```tsx
 * <DisabledActionWrapper
 *   action="create_delivery"
 *   renderDisabled={(tooltip) => (
 *     <div title={tooltip} className="opacity-50 cursor-not-allowed">
 *       {children}
 *     </div>
 *   )}
 * >
 *   <CreateDeliveryForm />
 * </DisabledActionWrapper>
 * ```
 */
export function DisabledActionWrapper({
  action,
  children,
  renderDisabled,
}: DisabledActionWrapperProps) {
  const { isActionDisabled, getDisabledTooltip } = useDegradedMode();

  const isDisabled = isActionDisabled(action);

  if (isDisabled && renderDisabled) {
    return <>{renderDisabled(getDisabledTooltip())}</>;
  }

  if (isDisabled) {
    return (
      <div
        className="pointer-events-none opacity-50"
        title={getDisabledTooltip()}
        aria-disabled="true"
      >
        {children}
      </div>
    );
  }

  return <>{children}</>;
}

export default DisabledActionButton;
