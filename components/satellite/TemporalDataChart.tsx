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
  Dot,
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
    payload: TemporalDataPoint & { dateLabel: string };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
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
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-600">Nuages:</span>
          <span className="text-sm font-medium text-gray-700">
            {data.cloudCover.toFixed(0)}%
          </span>
        </div>
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
 * Custom dot component for significant changes
 */
function CustomDot(props: any) {
  const { cx, cy, payload, showChangeMarkers } = props;

  if (!showChangeMarkers || !payload.hasSignificantChange) {
    return null;
  }

  return (
    <g>
      {/* Outer ring for emphasis */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="none"
        stroke="#E68A1F"
        strokeWidth={2}
        opacity={0.6}
      />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={5} fill="#E68A1F" />
      {/* Alert icon */}
      <circle cx={cx} cy={cy} r={3} fill="white" />
    </g>
  );
}

/**
 * Skeleton loader for chart
 */
function ChartSkeleton() {
  return (
    <div className="h-80 animate-pulse">
      <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
        <div className="text-gray-400">Chargement du graphique...</div>
      </div>
    </div>
  );
}

/**
 * Empty state for chart
 */
function EmptyChart() {
  return (
    <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
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
          Sélectionnez une parcelle pour voir l'évolution NDVI
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
  // For long periods (>24 months), show only year-month format
  // For medium periods (12-24 months), show abbreviated format
  // For short periods (<12 months), show day-month format
  const timeRangeMonths = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const isLongPeriod = timeRangeMonths > 24;
  const isMediumPeriod = timeRangeMonths > 12 && timeRangeMonths <= 24;
  
  const formattedData = timeline.map((point) => ({
    ...point,
    dateLabel: isLongPeriod
      ? new Date(point.date).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'short',
        })
      : isMediumPeriod
      ? new Date(point.date).toLocaleDateString('fr-FR', {
          month: 'short',
          year: '2-digit',
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
    <div className={`rounded-lg bg-white p-4 shadow-lg ${className}`}>
      {/* Header with statistics */}
      <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Évolution NDVI</h3>
          <p className="mt-1 text-sm text-gray-600">
            Analyse temporelle de la santé de la végétation
          </p>
        </div>

        {/* Actions and Trend indicator */}
        <div className="flex items-center gap-3">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            title="Exporter les données en CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>

          {/* Trend indicator */}
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            {trend === 'improving' && (
              <>
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  En amélioration
                </span>
              </>
            )}
            {trend === 'declining' && (
              <>
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">En déclin</span>
              </>
            )}
            {trend === 'stable' && (
              <>
                <Minus className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Stable</span>
              </>
            )}
            <span className="text-xs text-gray-500">
              ({change >= 0 ? '+' : ''}
              {change.toFixed(3)})
            </span>
          </div>
        </div>
      </div>

      {/* Statistics summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">NDVI Moyen</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {avgNDVI.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">NDVI Min</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {minNDVI.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">NDVI Max</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {maxNDVI.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Changements</p>
          <p className="mt-1 text-lg font-bold text-orange-600">
            {significantChanges}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            
            {/* X-Axis: Dates */}
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
              angle={isLongPeriod ? -60 : -45}
              textAnchor="end"
              height={isLongPeriod ? 80 : 60}
              interval={tickInterval}
            />
            
            {/* Y-Axis: NDVI values */}
            <YAxis
              domain={[-0.1, 1.0]}
              ticks={[-0.1, 0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
              label={{
                value: 'NDVI',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#6b7280' },
              }}
            />
            
            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} />
            
            {/* Legend */}
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="line"
            />
            
            {/* Reference lines for NDVI thresholds */}
            <ReferenceLine
              y={0.7}
              stroke="#2d5016"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              label={{
                value: 'Excellent',
                position: 'right',
                fontSize: 10,
                fill: '#2d5016',
              }}
            />
            <ReferenceLine
              y={0.5}
              stroke="#fbbf24"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              label={{
                value: 'Moyen',
                position: 'right',
                fontSize: 10,
                fill: '#fbbf24',
              }}
            />
            <ReferenceLine
              y={0.3}
              stroke="#E68A1F"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              label={{
                value: 'Faible',
                position: 'right',
                fontSize: 10,
                fill: '#E68A1F',
              }}
            />
            
            {/* Vertical line for selected date */}
            {selectedDataPoint && (
              <ReferenceLine
                x={selectedDataPoint.dateLabel}
                stroke="#6FAF3D"
                strokeWidth={2}
                label={{
                  value: 'Sélectionné',
                  position: 'top',
                  fontSize: 10,
                  fill: '#6FAF3D',
                  fontWeight: 'bold',
                }}
              />
            )}
            
            {/* NDVI line */}
            <Line
              type="monotone"
              dataKey="ndvi"
              name="NDVI"
              stroke="#6FAF3D"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={getNDVIColor(payload.ndvi)}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: 'white',
                fill: '#6FAF3D',
              }}
            />
            
            {/* Significant change markers */}
            {showChangeMarkers && (
              <Line
                type="monotone"
                dataKey="ndvi"
                stroke="transparent"
                dot={(props) => (
                  <CustomDot {...props} showChangeMarkers={showChangeMarkers} />
                )}
                activeDot={false}
                legendType="none"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for significant changes */}
      {showChangeMarkers && significantChanges > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border-2 border-orange-500 bg-orange-400" />
            <span className="font-medium text-orange-700">
              Changement significatif (NDVI &gt; 0.15)
            </span>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-700">Guide de lecture:</p>
        <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-2">
          <span>• NDVI &gt; 0.7: Végétation excellente</span>
          <span>• NDVI 0.5-0.7: Végétation bonne à moyenne</span>
          <span>• NDVI 0.3-0.5: Végétation faible</span>
          <span>• NDVI &lt; 0.3: Végétation critique</span>
        </div>
      </div>
    </div>
  );
}

export default TemporalDataChart;
