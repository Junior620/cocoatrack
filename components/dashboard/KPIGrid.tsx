'use client';

// CocoaTrack V2 - Enhanced KPI Grid Component
// Displays all dashboard KPIs with gradients and sparklines

import { Package as PackageIcon, Scale, CircleDollarSign, TrendingUp, Users, UsersRound, CalendarCheck, Map, AlertTriangle, ShieldCheck, Leaf, FileText } from 'lucide-react';
import { KPICard, formatCurrency, formatWeight } from './KPICard';
import type { DashboardMetricsWithComparison, TimeSeriesPoint, EntityCounts, ESGMetrics, UninvoicedReceiptsCount } from '@/lib/api/dashboard';

interface KPIGridProps {
  metrics: DashboardMetricsWithComparison | null;
  loading?: boolean;
  trendData?: TimeSeriesPoint[];
  entityCounts?: EntityCounts | null;
  entityCountsLoading?: boolean;
  esgMetrics?: ESGMetrics | null;
  esgLoading?: boolean;
  uninvoicedReceipts?: UninvoicedReceiptsCount | null;
  uninvoicedReceiptsLoading?: boolean;
}

export function KPIGrid({ 
  metrics, 
  loading = false, 
  trendData,
  entityCounts,
  entityCountsLoading = false,
  esgMetrics,
  esgLoading = false,
  uninvoicedReceipts,
  uninvoicedReceiptsLoading = false,
}: KPIGridProps) {
  // Generate sparkline data from trend data
  const deliveriesSparkline = trendData?.slice(-7).map(d => ({ value: d.deliveries })) || [];
  const weightSparkline = trendData?.slice(-7).map(d => ({ value: d.weightKg })) || [];
  const amountSparkline = trendData?.slice(-7).map(d => ({ value: d.amountXAF })) || [];
  
  // Calculate average price sparkline
  const priceSparkline = trendData?.slice(-7).map(d => ({ 
    value: d.weightKg > 0 ? d.amountXAF / d.weightKg : 0 
  })) || [];

  const comparisonContext = metrics?.periodComparison.contextLabel ?? 'vs période précédente';
  const todaySubtitle =
    (entityCounts?.livraisonsAujourdhui ?? 0) === 0
      ? 'Aucune livraison enregistrée aujourd’hui'
      : `${entityCounts?.livraisonsAujourdhui ?? 0} livraison(s) • ${formatWeight(
          entityCounts?.poidsAujourdhui ?? 0
        )}`;
  const latestTodaySubtitle = entityCounts?.derniereLivraisonAujourdhui
    ? `Dernière livraison: ${new Date(entityCounts.derniereLivraisonAujourdhui).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Dernière livraison: non disponible';

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Poids total collecté"
          value={metrics?.totalWeightKg ?? 0}
          subtitle="kg collectés"
          change={metrics?.periodComparison.weightChange}
          changeContext={comparisonContext}
          isNewActivity={metrics?.periodComparison.weightIsNewActivity}
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
          changeContext={comparisonContext}
          isNewActivity={metrics?.periodComparison.amountIsNewActivity}
          loading={loading}
          formatValue={(v) => formatCurrency(Number(v))}
          icon={<CircleDollarSign className="h-5 w-5" />}
          gradient="blue"
          sparklineData={amountSparkline}
        />
        <KPICard
          title="Livraisons"
          value={metrics?.totalDeliveries ?? 0}
          subtitle="Volume de livraisons"
          change={metrics?.periodComparison.deliveriesChange}
          changeContext={comparisonContext}
          isNewActivity={metrics?.periodComparison.deliveriesIsNewActivity}
          loading={loading}
          icon={<PackageIcon className="h-5 w-5" />}
          gradient="orange"
          sparklineData={deliveriesSparkline}
        />
        <KPICard
          title="Prix moyen"
          value={metrics?.averagePricePerKg ?? 0}
          subtitle="XAF/kg"
          change={metrics?.periodComparison.priceChange}
          changeContext={comparisonContext}
          isNewActivity={metrics?.periodComparison.priceIsNewActivity}
          loading={loading}
          formatValue={(v) => `${Number(v).toFixed(2)} XAF/kg`}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="purple"
          sparklineData={priceSparkline}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard
          title="Aujourd'hui"
          value={entityCounts?.livraisonsAujourdhui ?? 0}
          subtitle={todaySubtitle}
          loading={entityCountsLoading}
          icon={<CalendarCheck className="h-5 w-5" />}
          gradient="orange"
          animateCounter={true}
        />
        <KPICard
          title="Validations fournisseurs"
          value={entityCounts?.chefPlanteursActifs ?? 0}
          subtitle={`${entityCounts?.chefPlanteursActifs ?? 0} validé(s) • ${
            entityCounts?.chefPlanteursEnAttente ?? 0
          } en attente`}
          loading={entityCountsLoading}
          icon={<UsersRound className="h-5 w-5" />}
          gradient="green"
          animateCounter={true}
        />
        <KPICard
          title="Planteurs actifs"
          value={entityCounts?.planteursActifs ?? 0}
          subtitle="enregistrés"
          loading={entityCountsLoading}
          icon={<Users className="h-5 w-5" />}
          gradient="blue"
          animateCounter={true}
        />
        <KPICard
          title="Parcelles"
          value={entityCounts?.totalParcelles ?? 0}
          subtitle="enregistrées"
          loading={entityCountsLoading}
          icon={<Map className="h-5 w-5" />}
          gradient="purple"
          animateCounter={true}
        />
        <KPICard
          title="Reçus à facturer"
          value={uninvoicedReceipts?.total ?? 0}
          subtitle={
            (uninvoicedReceipts?.partiallyInvoiced ?? 0) > 0
              ? `${uninvoicedReceipts?.notInvoiced ?? 0} non facturés · ${uninvoicedReceipts?.partiallyInvoiced ?? 0} partiels`
              : 'reçus en attente de facturation'
          }
          loading={uninvoicedReceiptsLoading}
          icon={<FileText className="h-5 w-5" />}
          gradient="orange"
          animateCounter={true}
        />
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
        <p className="mb-3 text-sm font-semibold text-emerald-800">Indicateurs ESG & Traçabilité</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Conformité ESG"
            value={esgMetrics?.conformitePct ?? 0}
            subtitle={`${esgMetrics?.conformesParcelles ?? 0} parcelles conformes`}
            loading={esgLoading}
            formatValue={(v) => `${Number(v).toFixed(1)} %`}
            icon={<ShieldCheck className="h-5 w-5" />}
            gradient="green"
            animateCounter
          />
          <KPICard
            title="Parcelles à risque"
            value={esgMetrics?.parcellesARisque ?? 0}
            subtitle={`Détection risques: ${Number(esgMetrics?.risquePct ?? 0).toFixed(1)} %`}
            loading={esgLoading}
            icon={<AlertTriangle className="h-5 w-5" />}
            gradient="red"
            animateCounter
          />
          <KPICard
            title="Risque déforestation"
            value={esgMetrics?.pendingDeforestationEvents ?? 0}
            subtitle="Alertes en attente d’analyse"
            loading={esgLoading}
            icon={<Leaf className="h-5 w-5" />}
            gradient="orange"
            animateCounter
          />
          <KPICard
            title="Traçabilité livraisons"
            value={esgMetrics?.traceabilityPct ?? 0}
            subtitle={`${esgMetrics?.traceableDeliveries ?? 0} livraisons traçables`}
            loading={esgLoading}
            formatValue={(v) => `${Number(v).toFixed(1)} %`}
            icon={<PackageIcon className="h-5 w-5" />}
            gradient="blue"
            animateCounter
          />
        </div>
        <p className="mt-2 text-xs text-emerald-700/80">
          Les indicateurs sont calculés à partir des données existantes (traçabilité producteur/collecteur/livraison).
        </p>
      </div>

      {entityCounts?.livraisonsAujourdhui ? (
        <p className="text-xs text-gray-500 -mt-2">{latestTodaySubtitle}</p>
      ) : null}
    </div>
  );
}
