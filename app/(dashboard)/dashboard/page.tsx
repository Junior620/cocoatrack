'use client';

// CocoaTrack V2 - Enhanced Dashboard Page
// Main dashboard with KPIs, charts, alerts, and activity calendar

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { 
  KPIGrid, 
  TrendChart, 
  TopPerformers, 
  PageTransition, 
  AnimatedSection,
  EmptyState,
  AlertsWidget,
  ActivityCalendar,
  OrphanParcellesWidget,
} from '@/components/dashboard';
import {
  useDashboardMetricsWithComparison,
  useDailyTrend,
  useTopPlanteurs,
  useTopChefPlanteurs,
  useDashboardRealtime,
  useRefreshDashboard,
  useEntityCounts,
  useESGMetrics,
} from '@/lib/hooks';
import { buildDashboardFilters } from '@/lib/api/dashboard';
import { useAuth } from '@/lib/auth';
import { RefreshCw, Calendar } from 'lucide-react';

type Period = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
type Metric = 'deliveries' | 'weightKg' | 'amountXAF' | 'pricePerKg';

const periodLabels: Record<Period, string> = {
  all: 'Toutes les données',
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
  custom: 'Personnalisé',
};

const metricLabels: Record<Metric, string> = {
  deliveries: 'Livraisons',
  weightKg: 'Poids (kg)',
  amountXAF: 'Montant (XAF)',
  pricePerKg: 'Prix moyen (XAF/kg)',
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('all');
  const [chartMetric, setChartMetric] = useState<Metric>('weightKg');
  const [trendYear, setTrendYear] = useState(() => new Date().getFullYear());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { user } = useAuth();
  const cooperativeId = user?.cooperative_id ?? undefined;

  const filters = buildDashboardFilters(
    period,
    { cooperativeId },
    customFrom,
    customTo
  );

  // Fetch data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = 
    useDashboardMetricsWithComparison(period, filters);
  
  const { data: dailyTrend, isLoading: trendLoading } = useDailyTrend(filters);
  const { data: topPlanteurs, isLoading: planteursLoading } = useTopPlanteurs(filters, 5);
  const { data: topChefPlanteurs, isLoading: chefsLoading } = useTopChefPlanteurs(filters);

  // Fetch entity counts (planteurs, chef planteurs, today's deliveries)
  const { data: entityCounts, isLoading: entityCountsLoading } = useEntityCounts(cooperativeId);
  const { data: esgMetrics, isLoading: esgLoading } = useESGMetrics(filters);

  // Subscribe to realtime updates
  useDashboardRealtime(cooperativeId);

  // Manual refresh
  const { refresh } = useRefreshDashboard();

  const isLoading = metricsLoading || trendLoading || planteursLoading || chefsLoading;
  const hasData = (metrics?.totalDeliveries ?? 0) > 0;

  const availableTrendYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const point of dailyTrend ?? []) {
      years.add(new Date(`${point.date}T12:00:00`).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [dailyTrend]);

  const filteredTrend = (dailyTrend ?? []).filter((point) => {
    return new Date(`${point.date}T12:00:00`).getFullYear() === trendYear;
  });

  // Transform daily trend for activity calendar
  const activityData = dailyTrend?.map(d => ({
    date: d.date,
    count: d.deliveries,
  })) || [];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d&apos;ensemble de vos activités de collecte de cacao
          </p>
        </div>

        {/* Period selector and refresh */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <span className="text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          )}

          <button
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 transition-all ml-auto sm:ml-0"
            title="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {metricsError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                Erreur lors du chargement des données
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {metricsError instanceof Error ? metricsError.message : 'Une erreur est survenue'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards with sparklines */}
      <KPIGrid 
        metrics={metrics ?? null} 
        loading={metricsLoading} 
        trendData={filteredTrend ?? undefined}
        entityCounts={entityCounts ?? null}
        entityCountsLoading={entityCountsLoading}
        esgMetrics={esgMetrics ?? null}
        esgLoading={esgLoading}
      />

      {/* Orphan Parcelles Widget - only shows if orphan_count > 0 */}
      <OrphanParcellesWidget cooperativeId={cooperativeId} />

      {/* Show empty state if no data */}
      {!isLoading && !hasData && (
        <AnimatedSection animation="fadeUp" delay={0.1}>
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <EmptyState type="dashboard" />
          </div>
        </AnimatedSection>
      )}

      {/* Charts Section - only show if has data or loading */}
      {(hasData || isLoading) && (
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            {/* Trend chart */}
            <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="mb-4 shrink-0 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Tendances</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    {(Object.keys(metricLabels) as Metric[]).map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setChartMetric(metric)}
                        className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          chartMetric === metric
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        {metricLabels[metric]}
                      </button>
                    ))}
                  </div>
                  <select
                    value={trendYear}
                    onChange={(e) => setTrendYear(Number(e.target.value))}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label="Filtrer par année"
                  >
                    {availableTrendYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {!trendLoading && (!filteredTrend || filteredTrend.length === 0) ? (
                  <div className="flex flex-1 items-center justify-center min-h-[13rem]">
                    <EmptyState type="chart" />
                  </div>
                ) : (
                  <TrendChart
                    data={filteredTrend ?? []}
                    loading={trendLoading}
                    metric={chartMetric}
                    fillHeight
                  />
                )}
              </div>
            </div>

            {/* Top Planteurs */}
            <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="mb-4 shrink-0 text-lg font-semibold text-gray-900">Top 5 Planteurs</h3>
              <div className="flex min-h-0 flex-1 flex-col">
              {!planteursLoading && (!topPlanteurs || topPlanteurs.length === 0) ? (
                <div className="flex flex-1 items-center justify-center min-h-[13rem]">
                  <EmptyState type="performers" />
                </div>
              ) : (
                <TopPerformers
                  data={(topPlanteurs ?? []).slice(0, 5)}
                  loading={planteursLoading}
                  title=""
                  type="planteur"
                  embedded
                />
              )}
              </div>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Second row */}
      <AnimatedSection animation="fadeUp" delay={0.3}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Chef Planteurs */}
          {(hasData || isLoading) && (
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Fournisseurs</h3>
              {!chefsLoading && (!topChefPlanteurs || topChefPlanteurs.length === 0) ? (
                <EmptyState
                  type="performers"
                  title="Aucun fournisseur classé pour cette période."
                  description="Les fournisseurs apparaîtront ici dès qu’ils auront des livraisons. Associez un fournisseur à vos livraisons importées si besoin."
                  actionLabel="Voir les validations en attente"
                  actionHref="/chef-planteurs?validation_status=pending"
                />
              ) : (
                <TopPerformers
                  data={topChefPlanteurs ?? []}
                  loading={chefsLoading}
                  title=""
                  type="chef_planteur"
                  embedded
                />
              )}
            </div>
          )}

          {/* Alerts Widget */}
          <AlertsWidget loading={isLoading} cooperativeId={cooperativeId} />
        </div>
      </AnimatedSection>

      {/* Third row - Activity Calendar */}
      {(hasData || isLoading) && (
        <AnimatedSection animation="fadeUp" delay={0.4}>
          <div className="grid gap-6 lg:grid-cols-2">
            <ActivityCalendar data={activityData} loading={trendLoading} />
            
            {/* ESG compact card */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
              <h3 className="text-base font-semibold text-emerald-900 mb-3">Risques & Conformité</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between text-emerald-800">
                  <span>Conformité ESG</span>
                  <span className="font-semibold">{(esgMetrics?.conformitePct ?? 0).toFixed(1)}%</span>
                </p>
                <p className="flex items-center justify-between text-emerald-800">
                  <span>Parcelles à risque</span>
                  <span className="font-semibold">{esgMetrics?.parcellesARisque ?? 0}</span>
                </p>
                <p className="flex items-center justify-between text-emerald-800">
                  <span>Alertes déforestation</span>
                  <span className="font-semibold">{esgMetrics?.pendingDeforestationEvents ?? 0}</span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/parcelles"
                  className="inline-flex rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Voir les parcelles concernées
                </Link>
                <Link
                  href="/chef-planteurs?validation_status=pending"
                  className="inline-flex rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Voir validations
                </Link>
              </div>
            </div>
          </div>
        </AnimatedSection>
      )}
    </PageTransition>
  );
}
