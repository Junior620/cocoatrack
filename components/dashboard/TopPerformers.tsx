'use client';

// CocoaTrack V2 - Top Performers Component
// Displays top 10 planteurs/fournisseurs by volume
// Requirements: 6.4

import Link from 'next/link';
import type { TopPerformer } from '@/lib/api/dashboard';

interface TopPerformersProps {
  data: TopPerformer[];
  loading?: boolean;
  title: string;
  type: 'planteur' | 'chef_planteur';
  embedded?: boolean;
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
function EmptyTopPerformers({ type }: { type: 'planteur' | 'chef_planteur' }) {
  const actionHref = type === 'chef_planteur' ? '/chef-planteurs?validation_status=pending' : '/planteurs/new';
  const actionLabel = type === 'chef_planteur' ? 'Voir les validations en attente' : 'Créer un planteur';

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
      <p className="mt-2 text-sm font-medium text-gray-700">
        {type === 'chef_planteur'
          ? 'Aucun fournisseur classé pour cette période.'
          : 'Aucun planteur classé pour cette période.'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {type === 'chef_planteur'
          ? 'Les fournisseurs apparaîtront ici dès qu’ils auront des livraisons validées.'
          : 'Le classement apparaîtra dès les premières livraisons validées.'}
      </p>
      <Link
        href={actionHref}
        className="mt-3 inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        {actionLabel}
      </Link>
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
export function TopPerformers({
  data,
  loading = false,
  title,
  type,
  embedded = false,
}: TopPerformersProps) {
  if (loading) {
    return <TopPerformersSkeleton />;
  }

  if (!data || data.length === 0) {
    return <EmptyTopPerformers type={type} />;
  }

  return (
    <div className={embedded ? 'space-y-3' : 'rounded-lg bg-white p-6 shadow space-y-3'}>
      {!embedded && title ? <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3> : null}
      {data.map((performer, index) => (
        <div
          key={performer.id}
          className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RankBadge rank={index + 1} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {performer.name}
              </p>
              <span className="hidden sm:inline text-xs text-gray-500 truncate">({performer.code})</span>
              {type === 'chef_planteur' && performer.validationStatus && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    performer.validationStatus === 'validated'
                      ? 'bg-emerald-100 text-emerald-700'
                      : performer.validationStatus === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {performer.validationStatus === 'validated'
                    ? 'Conforme'
                    : performer.validationStatus === 'pending'
                    ? 'En attente'
                    : 'Rejeté'}
                </span>
              )}
            </div>
            {performer.village && (
              <p className="mt-0.5 text-[11px] text-gray-500">Village: {performer.village}</p>
            )}
            {performer.lastDeliveryAt && (
              <p className="mt-1 text-[11px] text-gray-500">
                Dernière livraison: {new Date(performer.lastDeliveryAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-gray-900">
              {formatWeight(performer.totalWeightKg)}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(performer.totalAmountXAF)}
            </p>
            <p className="text-[11px] text-gray-400">{performer.totalDeliveries} liv.</p>
          </div>
        </div>
      ))}
    </div>
  );
}
