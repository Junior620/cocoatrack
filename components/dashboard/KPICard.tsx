'use client';

// CocoaTrack V2 - Enhanced KPI Card Component
// Displays a single KPI metric with gradient, sparkline, and animations

import { useRef, useEffect, useMemo } from 'react';
import { useCounterAnimation, useFadeIn } from '@/lib/hooks/useGSAP';

interface SparklineData {
  value: number;
}

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle: string;
  change?: number;
  loading?: boolean;
  formatValue?: (value: number | string) => string;
  icon?: React.ReactNode;
  animateCounter?: boolean;
  sparklineData?: SparklineData[];
  gradient?: 'green' | 'orange' | 'blue' | 'purple' | 'red';
}

function formatNumber(value: number | string): string {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' XAF';
}

export function formatWeight(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' kg';
}

const gradientStyles = {
  green: {
    bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    sparkline: '#10b981',
    border: 'border-emerald-100',
  },
  orange: {
    bg: 'from-amber-500/10 via-amber-500/5 to-transparent',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    sparkline: '#f59e0b',
    border: 'border-amber-100',
  },
  blue: {
    bg: 'from-blue-500/10 via-blue-500/5 to-transparent',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    sparkline: '#3b82f6',
    border: 'border-blue-100',
  },
  purple: {
    bg: 'from-purple-500/10 via-purple-500/5 to-transparent',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    sparkline: '#8b5cf6',
    border: 'border-purple-100',
  },
  red: {
    bg: 'from-red-500/10 via-red-500/5 to-transparent',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    sparkline: '#ef4444',
    border: 'border-red-100',
  },
};

function Sparkline({ data, color }: { data: SparklineData[]; color: string }) {
  const width = 80;
  const height = 32;
  const padding = 2;

  const points = useMemo(() => {
    if (!data || data.length < 2) return '';
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [data]);

  const areaPoints = useMemo(() => {
    if (!data || data.length < 2) return '';
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const linePoints = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
      return { x, y };
    });

    return `M ${padding} ${height} ` +
      linePoints.map((p, i) => `${i === 0 ? 'L' : ''} ${p.x} ${p.y}`).join(' ') +
      ` L ${width - padding} ${height} Z`;
  }, [data]);

  if (!data || data.length < 2) {
    return (
      <div className="w-20 h-8 flex items-center justify-center">
        <div className="w-full h-0.5 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPoints} fill={`url(#gradient-${color})`} />
      <path d={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KPICardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-10 w-10 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded mb-2" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  const isPositive = change >= 0;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
      isPositive 
        ? 'bg-emerald-50 text-emerald-700' 
        : 'bg-red-50 text-red-700'
    }`}>
      <svg 
        className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function KPICard({
  title,
  value,
  subtitle,
  change,
  loading = false,
  formatValue = formatNumber,
  icon,
  animateCounter = true,
  sparklineData,
  gradient = 'green',
}: KPICardProps) {
  const valueRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useFadeIn<HTMLDivElement>(0, 0.5);
  const style = gradientStyles[gradient];

  const numericValue = typeof value === 'number' ? value : 0;
  const animatedValue = useCounterAnimation(
    numericValue,
    1.2,
    animateCounter && typeof value === 'number' && !loading
  );

  useEffect(() => {
    if (valueRef.current && !loading && typeof value === 'string') {
      valueRef.current.classList.add('kpi-value-animate');
      const timeout = setTimeout(() => {
        valueRef.current?.classList.remove('kpi-value-animate');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [value, loading]);

  if (loading) {
    return <KPICardSkeleton />;
  }

  const displayValue = typeof value === 'number' 
    ? (animateCounter ? animatedValue : value)
    : value;

  return (
    <div 
      ref={cardRef}
      className={`relative overflow-hidden rounded-xl bg-white p-6 shadow-sm border ${style.border} 
        hover:shadow-lg hover:scale-[1.02] transition-all duration-300 ease-out cursor-default group`}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      {/* Content */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {icon && (
            <div className={`p-2.5 rounded-xl ${style.iconBg} ${style.iconColor} 
              group-hover:scale-110 transition-transform duration-300`}>
              {icon}
            </div>
          )}
        </div>
        
        <p
          ref={valueRef}
          className="text-3xl font-bold text-gray-900 tracking-tight transition-all duration-300"
        >
          {formatValue(displayValue)}
        </p>
        
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{subtitle}</p>
            {change !== undefined && <ChangeIndicator change={change} />}
          </div>
          
          {sparklineData && sparklineData.length > 0 && (
            <Sparkline data={sparklineData} color={style.sparkline} />
          )}
        </div>
      </div>
    </div>
  );
}

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'kpi-card-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
      .kpi-value-animate {
        animation: kpi-pulse 0.3s ease-out;
      }
      @keyframes kpi-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(styleElement);
  }
}
