import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type TrendDirection = 'improving' | 'stable' | 'declining';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface HealthStatusBadgeProps {
  status: HealthStatus;
  showTrend?: boolean;
  trend?: TrendDirection;
  size?: BadgeSize;
  className?: string;
}

/**
 * HealthStatusBadge Component
 * 
 * Displays a color-coded badge indicating the health status of a parcelle
 * based on NDVI analysis. Optionally shows trend indicators.
 * 
 * Color Scheme (from design.md):
 * - Excellent: Dark Green (#2d5016)
 * - Good: Green (#6FAF3D)
 * - Fair: Yellow (#fbbf24)
 * - Poor: Orange (#E68A1F)
 * - Critical: Red (#ef4444)
 */
export default function HealthStatusBadge({
  status,
  showTrend = false,
  trend,
  size = 'md',
  className = '',
}: HealthStatusBadgeProps) {
  // Color mapping based on health status
  const colorClasses = {
    excellent: 'bg-[#2d5016] text-white',
    good: 'bg-[#6FAF3D] text-white',
    fair: 'bg-[#fbbf24] text-gray-900',
    poor: 'bg-[#E68A1F] text-white',
    critical: 'bg-[#ef4444] text-white',
  };

  // Size mapping
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  // Icon size mapping
  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  // Status label mapping (French labels for cocoa context)
  const statusLabels: Record<HealthStatus, string> = {
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Faible',
    critical: 'Critique',
  };

  // Trend icon mapping
  const getTrendIcon = () => {
    if (!showTrend || !trend) return null;

    const iconSize = iconSizes[size];
    const iconClass = 'inline-block ml-1';

    switch (trend) {
      case 'improving':
        return <ArrowUp size={iconSize} className={iconClass} aria-label="En amélioration" />;
      case 'declining':
        return <ArrowDown size={iconSize} className={iconClass} aria-label="En déclin" />;
      case 'stable':
        return <Minus size={iconSize} className={iconClass} aria-label="Stable" />;
      default:
        return null;
    }
  };

  // Trend aria-label for accessibility (French)
  const getTrendLabel = () => {
    if (!showTrend || !trend) return '';
    const trendLabels = {
      improving: 'en amélioration',
      declining: 'en déclin',
      stable: 'stable',
    };
    return `, tendance: ${trendLabels[trend]}`;
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-medium
        ${colorClasses[status]}
        ${sizeClasses[size]}
        ${className}
      `}
      role="status"
      aria-label={`État de santé: ${statusLabels[status]}${getTrendLabel()}`}
    >
      {statusLabels[status]}
      {getTrendIcon()}
    </span>
  );
}
