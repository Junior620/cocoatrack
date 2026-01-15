'use client';

// CocoaTrack V2 - Touch Target Components
// REQ-RESP-004: Touch Targets
// Minimum 44x44px for all interactive elements
// 8px minimum spacing between targets

import React, { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

// =============================================================================
// Types
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to display */
  icon?: ReactNode;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Children */
  children?: ReactNode;
}

type TouchButtonProps = BaseButtonProps & 
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

type TouchLinkProps = BaseButtonProps & 
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
    href: string;
  };

// =============================================================================
// Style Utilities
// =============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] min-w-[44px] px-3 py-2 text-sm gap-1.5',
  md: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm gap-2',
  lg: 'min-h-[48px] min-w-[48px] px-6 py-3 text-base gap-2.5',
};

const baseStyles = `
  inline-flex items-center justify-center
  font-medium rounded-xl
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  touch-manipulation
  select-none
`;

// =============================================================================
// TouchButton Component
// =============================================================================

/**
 * TouchButton - Accessible button with minimum 44x44px touch target
 * 
 * REQ-RESP-004: All interactive elements have minimum 44x44px touch target
 */
export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  function TouchButton(
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      loading = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} />
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
            {children && <span>{children}</span>}
            {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

// =============================================================================
// TouchLink Component
// =============================================================================

/**
 * TouchLink - Accessible link styled as button with minimum 44x44px touch target
 * 
 * REQ-RESP-004: All interactive elements have minimum 44x44px touch target
 */
export const TouchLink = forwardRef<HTMLAnchorElement, TouchLinkProps>(
  function TouchLink(
    {
      href,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className = '',
      ...props
    },
    ref
  ) {
    return (
      <Link
        ref={ref}
        href={href}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
        {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
      </Link>
    );
  }
);

// =============================================================================
// TouchIconButton Component
// =============================================================================

interface TouchIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label */
  label: string;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Badge count */
  badge?: number;
}

/**
 * TouchIconButton - Icon-only button with minimum 44x44px touch target
 * 
 * REQ-RESP-004: All interactive elements have minimum 44x44px touch target
 */
export const TouchIconButton = forwardRef<HTMLButtonElement, TouchIconButtonProps>(
  function TouchIconButton(
    {
      icon,
      label,
      variant = 'ghost',
      size = 'md',
      badge,
      className = '',
      ...props
    },
    ref
  ) {
    const iconSizeStyles: Record<ButtonSize, string> = {
      sm: 'min-h-[44px] min-w-[44px] p-2',
      md: 'min-h-[44px] min-w-[44px] p-2.5',
      lg: 'min-h-[48px] min-w-[48px] p-3',
    };

    return (
      <button
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${iconSizeStyles[size]}
          relative
          ${className}
        `}
        aria-label={label}
        {...props}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  }
);

// =============================================================================
// TouchTarget Wrapper
// =============================================================================

interface TouchTargetWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * TouchTargetWrapper - Ensures child element has minimum touch target size
 * Use this to wrap existing elements that need larger touch targets
 * 
 * REQ-RESP-004: All interactive elements have minimum 44x44px touch target
 */
export function TouchTargetWrapper({ children, className = '' }: TouchTargetWrapperProps) {
  return (
    <div 
      className={`
        relative inline-flex items-center justify-center
        min-h-[44px] min-w-[44px]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// =============================================================================
// TouchTargetGroup
// =============================================================================

interface TouchTargetGroupProps {
  children: ReactNode;
  /** Gap between items (in Tailwind spacing units) */
  gap?: 2 | 3 | 4;
  /** Direction */
  direction?: 'row' | 'column';
  className?: string;
}

/**
 * TouchTargetGroup - Groups touch targets with proper spacing
 * 
 * REQ-RESP-004: 8px minimum spacing between targets
 */
export function TouchTargetGroup({ 
  children, 
  gap = 2, 
  direction = 'row',
  className = '' 
}: TouchTargetGroupProps) {
  const gapClass = {
    2: 'gap-2', // 8px - minimum required
    3: 'gap-3', // 12px
    4: 'gap-4', // 16px
  }[gap];

  return (
    <div 
      className={`
        flex ${direction === 'row' ? 'flex-row' : 'flex-col'}
        ${gapClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// =============================================================================
// Loading Spinner
// =============================================================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[size];

  return (
    <svg
      className={`animate-spin ${spinnerSize}`}
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
  );
}

export default TouchButton;
