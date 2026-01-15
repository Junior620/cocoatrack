'use client';

// CocoaTrack V2 - Enhanced KPI Grid Component
// Displays all dashboard KPIs with gradients and sparklines

import { Package as PackageIcon, Scale, CircleDollarSign, TrendingUp, Users, UsersRound, CalendarCheck } from 'lucide-react';
import { KPICard, formatCurrency, formatWeight } from './KPICard';
import type { DashboardMetricsWithComparison, TimeSeriesPoint, EntityCounts } from '@/lib/api/dashboard';

interface KPIGridProps {
  metrics: DashboardMetricsWithComparison | null;
  loading?: boolean;
  trendData?: TimeSeriesPoint[];
  entityCounts?: EntityCounts | null;
  entityCountsLoading?: boolean;
}

export function KPIGrid({ 
  metrics, 
  loading = false, 
  trendData,
  entityCounts,
  entityCountsLoading = false,
}: KPIGridProps) {
  // Generate sparkline data from trend data
  const deliveriesSparkline = trendData?.slice(-7).map(d => ({ value: d.deliveries })) || [];
  const weightSparkline = trendData?.slice(-7).map(d => ({ value: d.weightKg })) || [];
  const amountSparkline = trendData?.slice(-7).map(d => ({ value: d.amountXAF })) || [];
  
  // Calculate average price sparkline
  const priceSparkline = trendData?.slice(-7).map(d => ({ 
    value: d.weightKg > 0 ? d.amountXAF / d.weightKg : 0 
  })) || [];

  return (
    <div className="space-y-4">
      {/* Main KPIs - First row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Livraisons"
          value={metrics?.totalDeliveries ?? 0}
          subtitle="Ce mois"
          change={metrics?.periodComparison.deliveriesChange}
          loading={loading}
          icon={<PackageIcon className="h-5 w-5" />}
          gradient="orange"
          sparklineData={deliveriesSparkline}
        />
        <KPICard
          title="Poids total"
          value={metrics?.totalWeightKg ?? 0}
          subtitle="kg collectés"
          change={metrics?.periodComparison.weightChange}
          loading={loading}
          formatValue={(v) => formatWeight(Number(v))}
          icon={<Scale className="h-5 w-5" />}
          gradient="green"
          sparklineData={weightSparkline}
        />
        <KPICard
          title="Montant total"
          value={metrics?.totalAmountXAF ?? 0}
          subtitle="XAF"
          change={metrics?.periodComparison.amountChange}
          loading={loading}
          formatValue={(v) => formatCurrency(Number(v))}
          icon={<CircleDollarSign className="h-5 w-5" />}
          gradient="blue"
          sparklineData={amountSparkline}
        />
        <KPICard
          title="Prix moyen"
          value={metrics?.averagePricePerKg ?? 0}
          subtitle="XAF/kg"
          change={metrics?.periodComparison.priceChange}
          loading={loading}
          formatValue={(v) => `${Number(v).toFixed(2)} XAF/kg`}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="purple"
          sparklineData={priceSparkline}
        />
      </div>

      {/* Secondary KPIs - Second row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Aujourd'hui"
          value={entityCounts?.livraisonsAujourdhui ?? 0}
          subtitle={`${formatWeight(entityCounts?.poidsAujourdhui ?? 0)} collectés`}
          loading={entityCountsLoading}
          icon={<CalendarCheck className="h-5 w-5" />}
          gradient="orange"
          animateCounter={true}
        />
        <KPICard
          title="Planteurs actifs"
          value={entityCounts?.planteursActifs ?? 0}
          subtitle="enregistrés"
          loading={entityCountsLoading}
          icon={<Users className="h-5 w-5" />}
          gradient="green"
          animateCounter={true}
        />
        <KPICard
          title="Chef Planteurs"
          value={entityCounts?.chefPlanteursActifs ?? 0}
          subtitle="validés"
          loading={entityCountsLoading}
          icon={<UsersRound className="h-5 w-5" />}
          gradient="blue"
          animateCounter={true}
        />
        <KPICard
          title="En attente"
          value={entityCounts?.chefPlanteursEnAttente ?? 0}
          subtitle="à valider"
          loading={entityCountsLoading}
          icon={<UsersRound className="h-5 w-5" />}
          gradient="purple"
          animateCounter={true}
        />
      </div>
    </div>
  );
}
