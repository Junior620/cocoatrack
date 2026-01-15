'use client';

// CocoaTrack V2 - Top Performers Component
// Displays top 10 planteurs/fournisseurs by volume
// Requirements: 6.4

import type { TopPerformer } from '@/lib/api/dashboard';

interface TopPerformersProps {
  data: TopPerformer[];
  loading?: boolean;
  title: string;
  type: 'planteur' | 'chef_planteur';
}

/**
 * Skeleton loader for top performers list
 */
function TopPerformersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state for top performers
 */
function EmptyTopPerformers() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <svg
        className="h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <p className="mt-2 text-sm text-gray-500">Aucune donnée disponible</p>
    </div>
  );
}

/**
 * Rank badge component
 */
function RankBadge({ rank }: { rank: number }) {
  const colors = {
    1: 'bg-amber-100 text-amber-800 border-amber-300',
    2: 'bg-gray-100 text-gray-800 border-gray-300',
    3: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const color = colors[rank as keyof typeof colors] || 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full border ${color}`}
    >
      {rank}
    </span>
  );
}

/**
 * Format weight for display
 */
function formatWeight(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}t`;
  }
  return `${value.toFixed(0)}kg`;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M XAF`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k XAF`;
  }
  return `${value} XAF`;
}

/**
 * Top Performers Component
 * Displays a ranked list of top performers
 */
export function TopPerformers({ data, loading = false, title, type }: TopPerformersProps) {
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        <TopPerformersSkeleton />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        <EmptyTopPerformers />
      </div>
    );
  }

  // Calculate max weight for progress bar
  const maxWeight = Math.max(...data.map((p) => p.totalWeightKg));

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((performer, index) => (
          <div
            key={performer.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RankBadge rank={index + 1} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {performer.name}
                </p>
                <span className="text-xs text-gray-500">({performer.code})</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${(performer.totalWeightKg / maxWeight) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {performer.totalDeliveries} liv.
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {formatWeight(performer.totalWeightKg)}
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(performer.totalAmountXAF)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
