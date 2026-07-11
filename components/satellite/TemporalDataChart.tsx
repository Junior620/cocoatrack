'use client';

/**
 * TemporalDataChart Component
 * 
 * Line chart visualization for temporal NDVI data showing vegetation health trends over time.
 * Displays NDVI values on Y-axis and dates on X-axis with interactive features.
 * 
 * Features:
 * - Line chart showing NDVI values over time
 * - Highlighted current selected date with vertical reference line
 * - Significant change markers (NDVI change > 0.15)
 * - Interactive tooltips with NDVI value, date, and health status
 * - Color-blind friendly NDVI color scheme
 * - Responsive design for mobile and desktop
 * - Loading and error states
 * 
 * Requirements: Task 3.3.4
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';
import { exportTemporalDataAsCSV } from '@/lib/satellite/utils/csv-export';

export interface TemporalDataChartProps {
  /** Timeline data points to display */
  timeline: TemporalDataPoint[];
  /** Currently selected date */
  selectedDate: Date;
  /** Parcelle ID for CSV export */
  parcelleId: string;
  /** Start date of the temporal range */
  startDate: Date;
  /** End date of the temporal range */
  endDate: Date;
  /** Callback when a data point is clicked */
  onDateSelect?: (date: Date) => void;
  /** Whether to show significant change markers (default: true) */
  showChangeMarkers?: boolean;
  /** Custom class name */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: Error | null;
}

/**
 * Get health status color matching the NDVI color scheme
 */
function getHealthStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    excellent: '#2d5016', // Dark green
    good: '#6FAF3D',      // Green
    fair: '#fbbf24',      // Yellow
    poor: '#E68A1F',      // Orange
    critical: '#ef4444',  // Red
  };
  return colorMap[status] || '#9ca3af';
}

/**
 * Get NDVI color based on value (for gradient visualization)
 */
function getNDVIColor(ndvi: number): string {
  if (ndvi >= 0.8) return '#2d5016'; // Dark green (0.8-1.0)
  if (ndvi >= 0.6) return '#6FAF3D'; // Green (0.6-0.8)
  if (ndvi >= 0.4) return '#84cc16'; // Light green (0.4-0.6)
  if (ndvi >= 0.2) return '#fbbf24'; // Yellow (0.2-0.4)
  return '#ef4444'; // Red (0.0-0.2)
}

/**
 * Format health status for display in French
 */
function formatHealthStatus(status: string): string {
  const statusMap: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Faible',
    critical: 'Critique',
  };
  return statusMap[status] || status;
}

/**
 * Custom tooltip component
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: TemporalDataPoint & { dateLabel: string; ndvi: number | null };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  if (data.ndvi == null || isNaN(Number(data.ndvi))) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-gray-900">
          {new Date(data.date).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="mt-1 text-xs text-gray-500">Pas d&apos;image exploitable ce mois-ci</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {data.isAcquisitionDate ? 'Capture Sentinel-2' : 'Référence mensuelle'}
      </p>
      <p className="mb-2 text-sm font-semibold text-gray-900">
        {new Date(data.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-600">NDVI:</span>
          <span
            className="text-sm font-bold"
            style={{ color: getNDVIColor(data.ndvi) }}
          >
            {data.ndvi.toFixed(3)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-600">État:</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: getHealthStatusColor(data.healthStatus) }}
          >
            {formatHealthStatus(data.healthStatus)}
          </span>
        </div>
        {data.cloudCover > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">Nuages:</span>
            <span className="text-sm font-medium text-gray-700">
              {data.cloudCover.toFixed(0)}%
            </span>
          </div>
        )}
        {data.hasSignificantChange && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
            <AlertCircle className="h-3 w-3" />
            <span>Changement significatif</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for chart
 */
function ChartSkeleton() {
  return (
    <div className="h-[28rem] animate-pulse">
      <div className="flex h-full items-center justify-center rounded-xl bg-gray-100">
        <div className="text-gray-400">Chargement du graphique...</div>
      </div>
    </div>
  );
}

function interpretAvgNdvi(avg: number): { label: string; tone: string } {
  if (avg >= 0.7) return { label: 'Végétation excellente', tone: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
  if (avg >= 0.5) return { label: 'Végétation bonne', tone: 'text-green-800 bg-green-50 border-green-200' };
  if (avg >= 0.3) return { label: 'Végétation faible', tone: 'text-amber-800 bg-amber-50 border-amber-200' };
  return { label: 'Végétation critique', tone: 'text-red-800 bg-red-50 border-red-200' };
}

function formatShortDate(date: Date | string, monthly = false): string {
  if (monthly) {
    return new Date(date).toLocaleDateString('fr-FR', {
      month: 'short',
      year: 'numeric',
    });
  }
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Empty state for chart
 */
function EmptyChart() {
  return (
    <div className="flex h-[28rem] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">Aucune donnée temporelle disponible</p>
        <p className="mt-1 text-xs text-gray-400">
          Lancez « Historique GEE » pour calculer le NDVI de la période
        </p>
      </div>
    </div>
  );
}

/**
 * Error state for chart
 */
function ErrorChart({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex h-80 items-center justify-center rounded-lg border border-red-200 bg-red-50">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2 text-sm font-medium text-red-900">Erreur de chargement</p>
        <p className="mt-1 text-xs text-red-700">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Calculate NDVI trend indicator
 */
function calculateTrend(timeline: TemporalDataPoint[]): {
  trend: 'improving' | 'stable' | 'declining';
  change: number;
} {
  // Filter out NaN values (missing data points)
  const validPoints = timeline.filter((p) => !isNaN(p.ndvi));
  
  if (validPoints.length < 2) {
    return { trend: 'stable', change: 0 };
  }

  const firstNDVI = validPoints[0].ndvi;
  const lastNDVI = validPoints[validPoints.length - 1].ndvi;
  const change = lastNDVI - firstNDVI;

  if (change > 0.05) return { trend: 'improving', change };
  if (change < -0.05) return { trend: 'declining', change };
  return { trend: 'stable', change };
}

/**
 * Temporal Data Chart Component
 * Displays NDVI values over time with interactive features
 */
export function TemporalDataChart({
  timeline,
  selectedDate,
  parcelleId,
  startDate,
  endDate,
  onDateSelect,
  showChangeMarkers = true,
  className = '',
  loading = false,
  error = null,
}: TemporalDataChartProps) {
  // Handle loading state
  if (loading) {
    return <ChartSkeleton />;
  }

  // Handle error state
  if (error) {
    return <ErrorChart error={error} />;
  }

  // Handle empty state
  if (!timeline || timeline.length === 0) {
    return <EmptyChart />;
  }

  // CSV Export handler
  const handleExportCSV = () => {
    try {
      exportTemporalDataAsCSV(timeline, parcelleId, startDate, endDate);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Erreur lors de l\'export CSV. Veuillez réessayer.');
    }
  };

  // Format data for recharts
  // Monthly series: show month + year only (day is often a synthetic grid day)
  const timeRangeMonths = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const isLongPeriod = timeRangeMonths > 24;
  const isMediumPeriod = timeRangeMonths > 12 && timeRangeMonths <= 24;
  const looksMonthly =
    timeline.length >= 2 &&
    (() => {
      const gaps = [];
      for (let i = 1; i < Math.min(timeline.length, 6); i++) {
        const a = new Date(timeline[i - 1].date).getTime();
        const b = new Date(timeline[i].date).getTime();
        gaps.push(Math.abs(b - a) / (1000 * 60 * 60 * 24));
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      return avgGap >= 20; // ~monthly spacing
    })();
  const hasAcquisitionDates = timeline.some((p) => p.isAcquisitionDate);

  const formattedData = timeline.map((point) => ({
    ...point,
    ndvi: isNaN(point.ndvi) ? null : point.ndvi,
    dateLabel:
      hasAcquisitionDates
        ? new Date(point.date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: isLongPeriod ? 'numeric' : '2-digit',
          })
        : looksMonthly || isLongPeriod || isMediumPeriod
          ? new Date(point.date).toLocaleDateString('fr-FR', {
              month: 'short',
              year: isLongPeriod ? 'numeric' : '2-digit',
            })
          : new Date(point.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            }),
    dateTimestamp: new Date(point.date).getTime(),
  }));

  // For very long periods, show only every Nth label to avoid overcrowding
  const tickInterval = isLongPeriod ? Math.ceil(formattedData.length / 12) : isMediumPeriod ? Math.ceil(formattedData.length / 18) : 0;

  // Find selected date index
  const selectedTimestamp = new Date(selectedDate).getTime();
  const selectedDataPoint = formattedData.find(
    (point) => point.dateTimestamp === selectedTimestamp
  );

  // Calculate trend
  const { trend, change } = calculateTrend(timeline);

  // Calculate statistics - filter out NaN values (missing data points)
  const validDataPoints = timeline.filter((p) => !isNaN(p.ndvi));
  const avgNDVI = validDataPoints.length > 0
    ? validDataPoints.reduce((sum, p) => sum + p.ndvi, 0) / validDataPoints.length
    : 0;
  const minNDVI = validDataPoints.length > 0
    ? Math.min(...validDataPoints.map((p) => p.ndvi))
    : 0;
  const maxNDVI = validDataPoints.length > 0
    ? Math.max(...validDataPoints.map((p) => p.ndvi))
    : 0;
  const significantChanges = timeline.filter((p) => p.hasSignificantChange).length;

  const significantChangePoints = timeline.filter(
    (p) => p.hasSignificantChange && !isNaN(p.ndvi)
  );
  const missingPoints = timeline.filter((p) => isNaN(p.ndvi)).length;
  const avgInterpretation = interpretAvgNdvi(avgNDVI);

  const trendConfig =
    trend === 'improving'
      ? {
          icon: TrendingUp,
          label: 'En amélioration',
          hint: 'Le NDVI a progressé sur la période',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          iconClass: 'text-emerald-600',
        }
      : trend === 'declining'
        ? {
            icon: TrendingDown,
            label: 'En déclin',
            hint: 'Le NDVI a baissé sur la période, à surveiller',
            className: 'border-red-200 bg-red-50 text-red-800',
            iconClass: 'text-red-600',
          }
        : {
            icon: Minus,
            label: 'Stable',
            hint: 'Peu de variation nette sur la période',
            className: 'border-gray-200 bg-gray-50 text-gray-800',
            iconClass: 'text-gray-600',
          };
  const TrendIcon = trendConfig.icon;

  // Handle chart click
  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedPoint = data.activePayload[0].payload;
      if (onDateSelect) {
        onDateSelect(new Date(clickedPoint.date));
      }
    }
  };

  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:p-6 ${className}`}>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Évolution NDVI</h3>
          <p className="mt-1 text-sm text-gray-500">
            Santé de la végétation du {formatShortDate(startDate)} au {formatShortDate(endDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex min-w-[11rem] flex-col rounded-xl border px-3.5 py-2.5 ${trendConfig.className}`}
            title={trendConfig.hint}
          >
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trendConfig.iconClass}`} />
              <span className="text-sm font-semibold">{trendConfig.label}</span>
              <span className="text-xs opacity-70">
                ({change >= 0 ? '+' : ''}
                {change.toFixed(3)})
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug opacity-80">{trendConfig.hint}</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            title="Exporter les données en CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`rounded-xl border p-3.5 ${avgInterpretation.tone}`}>
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">NDVI moyen</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{avgNDVI.toFixed(3)}</p>
          <p className="mt-1 text-xs font-medium">{avgInterpretation.label}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">NDVI min</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{minNDVI.toFixed(3)}</p>
          <p className="mt-1 text-xs text-gray-500">Point le plus bas</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">NDVI max</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{maxNDVI.toFixed(3)}</p>
          <p className="mt-1 text-xs text-gray-500">Point le plus haut</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-orange-700/70">
            Changements
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-orange-700">
            {significantChanges}
          </p>
          <p className="mt-1 text-xs text-orange-700/80">Variation &gt; 0,15</p>
        </div>
      </div>

      {/* Health bands legend (outside chart to avoid cut-off labels) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-medium text-gray-600">Zones :</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-700" /> Excellent ≥ 0,7
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-50 px-2.5 py-1 text-lime-800">
          <span className="h-2 w-2 rounded-full bg-lime-500" /> Bon 0,5–0,7
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Faible 0,3–0,5
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-red-800">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Critique &lt; 0,3
        </span>
        {missingPoints > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            {missingPoints} mois sans image
          </span>
        )}
      </div>

      {/* Chart, larger for readability */}
      <div className="h-[26rem] w-full sm:h-[28rem] lg:h-[32rem]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 16, right: 16, left: 4, bottom: 8 }}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

            {/* Soft health zones */}
            <ReferenceArea y1={0.7} y2={1.0} fill="#2d5016" fillOpacity={0.06} ifOverflow="extendDomain" />
            <ReferenceArea y1={0.5} y2={0.7} fill="#84cc16" fillOpacity={0.05} ifOverflow="extendDomain" />
            <ReferenceArea y1={0.3} y2={0.5} fill="#fbbf24" fillOpacity={0.06} ifOverflow="extendDomain" />
            <ReferenceArea y1={0} y2={0.3} fill="#ef4444" fillOpacity={0.05} ifOverflow="extendDomain" />

            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              angle={isLongPeriod ? -45 : -35}
              textAnchor="end"
              height={isLongPeriod ? 72 : 56}
              interval={tickInterval}
            />

            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.3, 0.5, 0.7, 1.0]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={40}
              label={{
                value: 'NDVI',
                angle: -90,
                position: 'insideLeft',
                offset: 8,
                style: { fontSize: 11, fill: '#9ca3af' },
              }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              wrapperStyle={{ fontSize: '12px', paddingBottom: 4 }}
              iconType="line"
            />

            <ReferenceLine y={0.7} stroke="#2d5016" strokeDasharray="4 4" strokeOpacity={0.35} />
            <ReferenceLine y={0.5} stroke="#ca8a04" strokeDasharray="4 4" strokeOpacity={0.35} />
            <ReferenceLine y={0.3} stroke="#E68A1F" strokeDasharray="4 4" strokeOpacity={0.35} />

            {selectedDataPoint && (
              <ReferenceLine
                x={selectedDataPoint.dateLabel}
                stroke="#6FAF3D"
                strokeWidth={2}
                strokeOpacity={0.85}
              />
            )}

            <Line
              type="monotone"
              dataKey="ndvi"
              name="NDVI"
              stroke="#6FAF3D"
              strokeWidth={3}
              connectNulls={false}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (payload == null || isNaN(payload.ndvi) || cx == null || cy == null) {
                  return <g key={`dot-empty-${index}`} />;
                }
                const isChange = showChangeMarkers && payload.hasSignificantChange;
                return (
                  <g key={`dot-${index}`}>
                    {isChange && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="none"
                        stroke="#E68A1F"
                        strokeWidth={2}
                        opacity={0.7}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isChange ? 6 : 4}
                      fill={isChange ? '#E68A1F' : getNDVIColor(payload.ndvi)}
                      stroke="white"
                      strokeWidth={2}
                    />
                  </g>
                );
              }}
              activeDot={{
                r: 7,
                strokeWidth: 2,
                stroke: 'white',
                fill: '#6FAF3D',
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Significant changes list, dates visibles sans hover */}
      {showChangeMarkers && significantChangePoints.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-800">
            <AlertCircle className="h-4 w-4" />
            Changements significatifs ({significantChangePoints.length})
            {hasAcquisitionDates ? ' · dates de capture' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {significantChangePoints.map((point) => (
              <button
                key={String(point.date)}
                type="button"
                onClick={() => onDateSelect?.(new Date(point.date))}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs text-orange-900 transition hover:border-orange-300 hover:bg-orange-50"
              >
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="font-medium">
                  {formatShortDate(point.date, looksMonthly && !hasAcquisitionDates)}
                </span>
                <span className="tabular-nums text-orange-700/80">NDVI {point.ndvi.toFixed(3)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-orange-800/70">
            {hasAcquisitionDates
              ? 'Dates = jour de passage Sentinel-2. Variation absolue > 0,15 entre deux mesures.'
              : 'Dates de référence mensuelles. Relancez « Historique GEE » pour afficher les vraies dates de capture.'}
          </p>
        </div>
      )}

      {missingPoints > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Les trous dans la courbe correspondent à des mois sans image Sentinel-2 exploitable
          (nuages, couverture insuffisante). Ce n&apos;est pas une baisse de NDVI.
        </p>
      )}
    </div>
  );
}

export default TemporalDataChart;
