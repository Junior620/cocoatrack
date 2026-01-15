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
  metric?: 'deliveries' | 'weightKg' | 'amountXAF';
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
};

/**
 * Skeleton loader for chart
 */
function ChartSkeleton() {
  return (
    <div className="h-64 animate-pulse">
      <div className="h-full bg-gray-100 rounded flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    </div>
  );
}

/**
 * Empty state for chart
 */
function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
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

/**
 * Custom tooltip component
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-2">
        {new Date(label || '').toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}
      </p>
      {payload.map((entry, index) => {
        const config = Object.values(metricConfig).find(
          (c) => c.color === entry.color
        );
        return (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {config?.label || entry.dataKey}: {config?.formatter(entry.value) || entry.value}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Trend Chart Component
 * Displays time series data with configurable metrics
 */
export function TrendChart({ data, loading = false, metric = 'deliveries' }: TrendChartProps) {
  if (loading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return <EmptyChart />;
  }

  const config = metricConfig[metric];

  // Format dates for display
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
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) =>
              metric === 'amountXAF'
                ? `${(value / 1000).toFixed(0)}k`
                : value.toString()
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={() => config.label}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={config.color}
            strokeWidth={2}
            dot={{ fill: config.color, strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
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
          <Tooltip content={<CustomTooltip />} />
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
