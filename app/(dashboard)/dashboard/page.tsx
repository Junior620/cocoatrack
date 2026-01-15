'use client';

// CocoaTrack V2 - Enhanced Dashboard Page
// Main dashboard with KPIs, charts, alerts, and activity calendar

import { useState } from 'react';
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
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { RefreshCw, Calendar } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';
type Metric = 'deliveries' | 'weightKg' | 'amountXAF';

const periodLabels: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
};

const metricLabels: Record<Metric, string> = {
  deliveries: 'Livraisons',
  weightKg: 'Poids (kg)',
  amountXAF: 'Montant (XAF)',
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [chartMetric, setChartMetric] = useState<Metric>('weightKg');
  const { user } = useAuth();
  const cooperativeId = user?.cooperative_id ?? undefined;

  const filters = { cooperativeId };

  // Fetch data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = 
    useDashboardMetricsWithComparison(period, filters);
  
  const { data: dailyTrend, isLoading: trendLoading } = useDailyTrend(filters);
  const { data: topPlanteurs, isLoading: planteursLoading } = useTopPlanteurs(filters);
  const { data: topChefPlanteurs, isLoading: chefsLoading } = useTopChefPlanteurs(filters);

  // Fetch entity counts (planteurs, chef planteurs, today's deliveries)
  const { data: entityCounts, isLoading: entityCountsLoading } = useEntityCounts(cooperativeId);

  // Subscribe to realtime updates
  useDashboardRealtime(cooperativeId);

  // Manual refresh
  const { refresh } = useRefreshDashboard();

  const isLoading = metricsLoading || trendLoading || planteursLoading || chefsLoading;
  const hasData = (metrics?.totalDeliveries ?? 0) > 0;

  // Transform daily trend for activity calendar
  const activityData = dailyTrend?.map(d => ({
    date: d.date,
    count: d.deliveries,
  })) || [];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d&apos;ensemble de vos activités de collecte de cacao
          </p>
        </div>

        {/* Period selector and refresh */}
        <div className="flex items-center gap-3">
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

          <button
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 transition-all"
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
        trendData={dailyTrend ?? undefined}
        entityCounts={entityCounts ?? null}
        entityCountsLoading={entityCountsLoading}
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
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Trend chart */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Tendances</h3>
                <select
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value as Metric)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  {Object.entries(metricLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {!trendLoading && (!dailyTrend || dailyTrend.length === 0) ? (
                <EmptyState type="chart" />
              ) : (
                <TrendChart
                  data={dailyTrend ?? []}
                  loading={trendLoading}
                  metric={chartMetric}
                />
              )}
            </div>

            {/* Top Planteurs */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Planteurs</h3>
              {!planteursLoading && (!topPlanteurs || topPlanteurs.length === 0) ? (
                <EmptyState type="performers" />
              ) : (
                <TopPerformers
                  data={topPlanteurs ?? []}
                  loading={planteursLoading}
                  title=""
                  type="planteur"
                />
              )}
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
                <EmptyState type="performers" />
              ) : (
                <TopPerformers
                  data={topChefPlanteurs ?? []}
                  loading={chefsLoading}
                  title=""
                  type="chef_planteur"
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
            
            {/* Info card */}
            <div className="rounded-xl bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-100 p-6">
              <h3 className="text-lg font-semibold text-primary-900 mb-4">Informations</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary-100">
                    <svg className="h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-primary-800">Les données sont mises à jour en temps réel</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary-100">
                    <svg className="h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-primary-800">Les pourcentages comparent avec la période précédente</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary-100">
                    <svg className="h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-primary-800">Utilisez <kbd className="px-1.5 py-0.5 bg-white/80 rounded text-xs font-mono">Ctrl+K</kbd> pour rechercher rapidement</span>
                </li>
              </ul>
            </div>
          </div>
        </AnimatedSection>
      )}
    </PageTransition>
  );
}
