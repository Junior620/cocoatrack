'use client';

// CocoaTrack V2 - Parcelle Stats Cards Component
// Displays 3 KPI cards: Total, Assignées, Orphelines
// @see Requirements 6.1, 6.2, 6.3

import { Map, CheckCircle, AlertTriangle } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import type { ParcelleStats } from '@/types/parcelles';

// =============================================================================
// Types
// =============================================================================

export interface ParcelleStatsCardsProps {
  /** Statistics data */
  stats: ParcelleStats | null;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format hectares for display
 */
function formatHectares(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ha';
}

/**
 * Calculate percentage
 */
function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ParcelleStatsCards Component
 * 
 * Displays 3 KPI cards showing:
 * - Total parcelles (count + surface)
 * - Assignées (count + surface + %)
 * - Orphelines (count + surface + % + warning indicator)
 * 
 * Uses the existing KPICard component style from the dashboard.
 * 
 * @see Requirements 6.1, 6.2, 6.3
 */
export function ParcelleStatsCards({ stats, loading = false }: ParcelleStatsCardsProps) {
  const totalParcelles = stats?.total_parcelles ?? 0;
  const assignedParcelles = stats?.assigned_parcelles ?? 0;
  const orphanParcelles = stats?.orphan_parcelles ?? 0;
  
  const assignedPct = calculatePercentage(assignedParcelles, totalParcelles);
  const orphanPct = calculatePercentage(orphanParcelles, totalParcelles);
  
  const hasOrphans = orphanParcelles > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Total parcelles card */}
      <KPICard
        title="Total Parcelles"
        value={totalParcelles}
        subtitle={formatHectares(stats?.total_surface_ha ?? 0)}
        loading={loading}
        icon={<Map className="h-5 w-5" />}
        gradient="blue"
        animateCounter={true}
      />
      
      {/* Assignées card */}
      <KPICard
        title="Parcelles Assignées"
        value={assignedParcelles}
        subtitle={`${assignedPct}% • ${formatHectares(stats?.assigned_surface_ha ?? 0)}`}
        loading={loading}
        icon={<CheckCircle className="h-5 w-5" />}
        gradient="green"
        animateCounter={true}
      />
      
      {/* Orphelines card - with warning indicator if > 0 */}
      <div className="relative">
        <KPICard
          title="Parcelles Orphelines"
          value={orphanParcelles}
          subtitle={`${orphanPct}% • ${formatHectares(stats?.orphan_surface_ha ?? 0)}`}
          loading={loading}
          icon={<AlertTriangle className="h-5 w-5" />}
          gradient={hasOrphans ? 'orange' : 'green'}
          animateCounter={true}
        />
        
        {/* Warning badge overlay when orphans exist */}
        {!loading && hasOrphans && (
          <div className="absolute -top-2 -right-2 z-10">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg animate-pulse">
              !
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
