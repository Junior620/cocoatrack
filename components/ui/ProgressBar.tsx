'use client';

// CocoaTrack V2 - Progress Bar Component with Alert Colors
// Visual indicator for usage percentages with color-coded alerts

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  labelFormat?: (value: number, max: number) => string;
}

// Get color based on percentage
function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-600'; // Dépassement
  if (percentage >= 90) return 'bg-red-500';  // Critique
  if (percentage >= 70) return 'bg-orange-500'; // Attention
  return 'bg-green-500'; // Normal
}

function getProgressBgColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-100';
  if (percentage >= 90) return 'bg-red-50';
  if (percentage >= 70) return 'bg-orange-50';
  return 'bg-gray-100';
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  showValue = true,
  size = 'md',
  className,
  labelFormat,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 120) : 0; // Cap at 120% for visual
  const displayPercentage = max > 0 ? (value / max) * 100 : 0;
  
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const defaultLabel = (v: number, m: number) => 
    `${v.toLocaleString('fr-FR')} / ${m.toLocaleString('fr-FR')} kg`;

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {showLabel && (
            <span className="text-xs text-gray-600">
              {(labelFormat || defaultLabel)(value, max)}
            </span>
          )}
          {showValue && (
            <span className={cn(
              'text-xs font-medium',
              displayPercentage >= 100 ? 'text-red-600' :
              displayPercentage >= 90 ? 'text-red-500' :
              displayPercentage >= 70 ? 'text-orange-500' :
              'text-green-600'
            )}>
              {displayPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={cn(
        'w-full rounded-full overflow-hidden',
        sizeClasses[size],
        getProgressBgColor(displayPercentage)
      )}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            getProgressColor(displayPercentage)
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {/* Overflow indicator for >100% */}
        {displayPercentage > 100 && (
          <div 
            className="absolute right-0 top-0 h-full bg-red-700 animate-pulse"
            style={{ width: '4px' }}
          />
        )}
      </div>
    </div>
  );
}

// Compact version for tables
export function ProgressBarCompact({
  value,
  max = 100,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex-1 h-2 rounded-full overflow-hidden',
        getProgressBgColor(percentage)
      )}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            getProgressColor(percentage)
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-medium min-w-[40px] text-right',
        percentage >= 100 ? 'text-red-600' :
        percentage >= 90 ? 'text-red-500' :
        percentage >= 70 ? 'text-orange-500' :
        'text-green-600'
      )}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

// Alert badge component
export function AlertBadge({
  level,
  children,
  className,
}: {
  level: 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const levelClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      levelClasses[level],
      className
    )}>
      {children}
    </span>
  );
}
