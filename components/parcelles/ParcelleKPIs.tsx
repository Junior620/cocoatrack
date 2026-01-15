'use client';

// CocoaTrack V2 - Parcelle KPIs Component
// Displays KPI cards for parcelles statistics

import { Map, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import type { ParcelleKPIStats } from '@/lib/api/parcelles';

interface ParcelleKPIsProps {
  /** KPI statistics data */
  stats: ParcelleKPIStats | null;
  /** Loading state */
  loading?: boolean;
}

/**
 * Format hectares for display
 */
function formatHectares(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num) + ' ha';
}

/**
 * ParcelleKPIs Component
 * 
 * Displays KPI cards showing:
 * - Total parcelles
 * - En cours (count + %)
 * - Conformes (count + %)
 * - Non conformes (count + %)
 * 
 * Uses the existing KPICard component style from the dashboard.
 */
export function ParcelleKPIs({ stats, loading = false }: ParcelleKPIsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total parcelles card */}
      <KPICard
        title="Total Parcelles"
        value={stats?.total ?? 0}
        subtitle={formatHectares(stats?.total_hectares ?? 0)}
        loading={loading}
        icon={<Map className="h-5 w-5" />}
        gradient="blue"
        animateCounter={true}
      />
      
      {/* En cours card */}
      <KPICard
        title="En cours"
        value={stats?.en_cours ?? 0}
        subtitle={`${stats?.en_cours_pct ?? 0}% du total`}
        loading={loading}
        icon={<Clock className="h-5 w-5" />}
        gradient="orange"
        animateCounter={true}
      />
      
      {/* Conformes card */}
      <KPICard
        title="Conformes"
        value={stats?.conformes ?? 0}
        subtitle={`${stats?.conformes_pct ?? 0}% du total`}
        loading={loading}
        icon={<CheckCircle className="h-5 w-5" />}
        gradient="green"
        animateCounter={true}
      />
      
      {/* Non conformes card */}
      <KPICard
        title="Non conformes"
        value={stats?.non_conformes ?? 0}
        subtitle={`${stats?.non_conformes_pct ?? 0}% du total`}
        loading={loading}
        icon={<AlertTriangle className="h-5 w-5" />}
        gradient="red"
        animateCounter={true}
      />
    </div>
  );
}

export type { ParcelleKPIsProps };
