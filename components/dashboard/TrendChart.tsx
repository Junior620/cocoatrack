'use client';

// CocoaTrack V2 - Trend Chart Component
// Displays daily/weekly/monthly trends using Recharts
// Requirements: 6.2

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TimeSeriesPoint } from '@/lib/api/dashboard';

interface TrendChartProps {
  data: TimeSeriesPoint[];
  loading?: boolean;
  metric?: 'deliveries' | 'weightKg' | 'amountXAF' | 'pricePerKg';
  fillHeight?: boolean;
}

const metricConfig = {
  deliveries: {
    label: 'Livraisons',
    color: '#f59e0b', // amber-500
    formatter: (value: number) => `${value}`,
  },
  weightKg: {
    label: 'Poids (kg)',
    color: '#10b981', // emerald-500
    formatter: (value: number) => `${value.toFixed(2)} kg`,
  },
  amountXAF: {
    label: 'Montant (XAF)',
    color: '#3b82f6', // blue-500
    formatter: (value: number) =>
      new Intl.NumberFormat('fr-FR').format(value) + ' XAF',
  },
  pricePerKg: {
    label: 'Prix moyen (XAF/kg)',
    color: '#8b5cf6', // violet-500
    formatter: (value: number) => `${value.toFixed(2)} XAF/kg`,
  },
};

/**
 * Skeleton loader for chart
 */
function ChartSkeleton({ fillHeight = false }: { fillHeight?: boolean }) {
  return (
    <div className={fillHeight ? 'flex-1 min-h-[13rem]' : 'h-64'}>
      <div className="h-full animate-pulse bg-gray-100 rounded flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    </div>
  );
}

/**
 * Empty state for chart
 */
function EmptyChart({ fillHeight = false }: { fillHeight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 ${
        fillHeight ? 'flex-1 min-h-[13rem]' : 'h-64'
      }`}
    >
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
        <p className="mt-2 text-sm text-gray-500">Aucune donnée disponible</p>
      </div>
    </div>
  );
}

function formatTooltipDate(
  label?: string,
  payload?: Array<{ payload?: { date?: string; dateLabel?: string } }>
): string {
  const rawDate = payload?.[0]?.payload?.date;
  if (rawDate) {
    const parsed = new Date(`${rawDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  }

  return payload?.[0]?.payload?.dateLabel || label || 'Date inconnue';
}

/**
 * Custom tooltip component
 */
function CustomTooltip({
  active,
  payload,
  label,
  metricLabel,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload?: { date?: string; dateLabel?: string };
  }>;
  label?: string;
  metricLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-2">
        {formatTooltipDate(label, payload)}
      </p>
      {payload.map((entry, index) => {
        const config = Object.values(metricConfig).find(
          (c) => c.color === entry.color
        );
        return (
          <div key={index} className="space-y-1">
            <p className="text-sm" style={{ color: entry.color }}>
              {config?.label || entry.dataKey}: {config?.formatter(entry.value) || entry.value}
            </p>
            <p className="text-xs text-gray-500">Contexte: {metricLabel}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Trend Chart Component
 * Displays time series data with configurable metrics
 */
export function TrendChart({
  data,
  loading = false,
  metric = 'deliveries',
  fillHeight = false,
}: TrendChartProps) {
  if (loading) {
    return <ChartSkeleton fillHeight={fillHeight} />;
  }

  if (!data || data.length === 0) {
    return <EmptyChart fillHeight={fillHeight} />;
  }

  const config = metricConfig[metric];

  // Format dates for display
  const formattedData = data.map((point) => ({
    ...point,
    pricePerKg: point.weightKg > 0 ? point.amountXAF / point.weightKg : 0,
    dateLabel: new Date(point.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  const hasLimitedPoints = formattedData.length < 3;

  return (
    <div className={fillHeight ? 'flex h-full flex-col' : undefined}>
      {hasLimitedPoints && (
        <p className="mb-2 text-xs text-amber-700">
          Peu de jours avec livraisons — tendance indicative sur {formattedData.length} point
          {formattedData.length > 1 ? 's' : ''}.
        </p>
      )}
      <div className={fillHeight ? 'flex-1 min-h-[13rem] w-full' : 'h-52 w-full min-h-[13rem]'}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) =>
              metric === 'amountXAF'
                ? `${(value / 1000).toFixed(0)}k`
                : metric === 'pricePerKg'
                ? `${value.toFixed(0)}`
                : value.toString()
            }
          />
          <Tooltip content={<CustomTooltip metricLabel={config.label} />} />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={() => config.label}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={config.color}
            strokeWidth={2}
            dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Multi-metric trend chart
 */
export function MultiTrendChart({ data, loading = false }: { data: TimeSeriesPoint[]; loading?: boolean }) {
  if (loading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return <EmptyChart />;
  }

  const formattedData = data.map((point) => ({
    ...point,
    dateLabel: new Date(point.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            content={<CustomTooltip metricLabel={metricConfig.deliveries.label} />}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="deliveries"
            name="Livraisons"
            stroke={metricConfig.deliveries.color}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="weightKg"
            name="Poids (kg)"
            stroke={metricConfig.weightKg.color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
