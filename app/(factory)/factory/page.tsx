'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  ArrowDownLeft,
  ArrowUpRight,
  PackageOpen,
  Warehouse,
  Cog,
  Boxes,
  Gauge,
  TrendingDown,
  ListOrdered,
} from 'lucide-react';
import { PageTransition, AnimatedSection } from '@/components/dashboard';
import { useFactoryDashboard, useFactoryRealtime, useRefreshFactory } from '@/lib/hooks/useFactory';
import { ProductionChartCard, YieldChartCard } from '@/components/factory/FactoryDashboardCharts';
import { FactoryKpiCard } from '@/components/factory/FactoryKpiCard';
import { FactoryAlertsPanel } from '@/components/factory/FactoryAlertsPanel';
import { FactoryDashboardHeader } from '@/components/factory/FactoryDashboardHeader';
import { FactoryLiveBar } from '@/components/factory/FactoryLiveBar';
import {
  DEMO_MOVEMENTS,
  DEMO_ORDERS,
  DEMO_PRODUCTION,
  DEMO_YIELD_TREND,
  getDemoMetrics,
  getKpiConfigs,
  getMetricNumericValue,
  isFactoryDashboardEmpty,
  type FactoryPeriod,
} from '@/lib/factory/demo-dashboard';

const KPI_ICONS: Record<string, React.ReactNode> = {
  beans_received: <PackageOpen className="h-5 w-5" />,
  beans_stock: <Warehouse className="h-5 w-5" />,
  beans_transformed: <Cog className="h-5 w-5" />,
  finished_stock: <Boxes className="h-5 w-5" />,
  avg_yield: <Gauge className="h-5 w-5" />,
  avg_loss: <TrendingDown className="h-5 w-5" />,
  pending_qc: <ClipboardCheck className="h-5 w-5" />,
  orders_in_progress: <ListOrdered className="h-5 w-5" />,
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'En cours': 'bg-emerald-50 text-emerald-700',
    Planifié: 'bg-gray-100 text-gray-600',
    'Contrôle final': 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function FactoryDashboardPage() {
  const [period, setPeriod] = useState<FactoryPeriod>('30d');
  const { data, isLoading, isFetching, error, dataUpdatedAt } = useFactoryDashboard();
  const { lastSyncAt } = useFactoryRealtime();
  const { refresh } = useRefreshFactory();

  const useDemo = useMemo(() => {
    if (error) return true;
    if (!data) return false;
    return isFactoryDashboardEmpty(data);
  }, [data, error]);

  const metrics = useMemo(() => {
    if (useDemo) return getDemoMetrics(period);
    const scale = period === 'today' ? 0.04 : period === '7d' ? 0.22 : period === 'campaign' ? 2.8 : 1;
    return {
      beans_received_kg: Math.round((data?.beans_received_kg ?? 0) * (period === '30d' ? 1 : scale)),
      beans_stock_kg: data?.beans_stock_kg ?? 0,
      beans_transformed_kg: Math.round((data?.beans_transformed_kg ?? 0) * (period === '30d' ? 1 : scale)),
      finished_stock_kg: data?.finished_stock_kg ?? 0,
      avg_yield_pct: data?.avg_yield_pct ?? 0,
      avg_loss_pct: data?.avg_loss_pct ?? 0,
      pending_qc_count: data?.pending_qc_count ?? 0,
      orders_in_progress: data?.orders_in_progress ?? 0,
    };
  }, [data, period, useDemo]);

  const kpiConfigs = useMemo(
    () => getKpiConfigs(metrics, period, useDemo),
    [metrics, period, useDemo]
  );

  const volumeKpis = kpiConfigs.slice(0, 4);
  const performanceKpis = kpiConfigs.slice(4);

  const lastUpdated = new Date(lastSyncAt?.getTime() ?? dataUpdatedAt ?? Date.now());

  const liveChips = [
    { label: 'Stock fèves', value: `${metrics.beans_stock_kg.toLocaleString('fr-FR')} kg` },
    { label: 'QC en attente', value: String(metrics.pending_qc_count) },
    { label: 'Ordres actifs', value: String(metrics.orders_in_progress) },
  ];

  if (isLoading) {
    return <p className="text-gray-500">Chargement du tableau de bord…</p>;
  }

  return (
    <PageTransition className="space-y-6">
      <FactoryDashboardHeader period={period} onPeriodChange={setPeriod} showDemoBadge={useDemo} />

      <FactoryLiveBar
        lastUpdated={lastUpdated}
        isRefreshing={isFetching}
        onRefresh={refresh}
        chips={liveChips}
        useDemo={useDemo}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {volumeKpis.map((config) => (
          <FactoryKpiCard
            key={config.id}
            config={config}
            value={getMetricNumericValue(config, metrics)}
            icon={KPI_ICONS[config.id]}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {performanceKpis.map((config) => (
          <FactoryKpiCard
            key={config.id}
            config={config}
            value={getMetricNumericValue(config, metrics)}
            icon={KPI_ICONS[config.id]}
          />
        ))}
      </div>

      <AnimatedSection>
        <FactoryAlertsPanel useDemo={useDemo} metrics={metrics} />
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        <div className="grid gap-6 lg:grid-cols-2">
          <ProductionChartCard data={DEMO_PRODUCTION} />
          <YieldChartCard data={DEMO_YIELD_TREND} />
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.15}>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ordres en cours</h2>
                <p className="mt-1 text-sm text-gray-500">{DEMO_ORDERS.length} ordres actifs</p>
              </div>
              <Link
                href="/factory/orders"
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
              >
                Voir tout <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-3">Ordre</th>
                    <th className="pb-3 pr-3">Produit</th>
                    <th className="pb-3 pr-3 text-right">Qté</th>
                    <th className="pb-3 pr-3">Statut</th>
                    <th className="pb-3 text-right">Rendement</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  {DEMO_ORDERS.map((order, i) => (
                    <tr key={order.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                      <td className="py-3 pr-3">
                        <Link href={`/factory/orders/${order.id}`} className="font-medium text-primary-700 hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">{order.product}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {order.quantity_kg.toLocaleString('fr-FR')} kg
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {order.yield_pct != null ? (
                          <span className={order.yield_pct < 77 ? 'font-medium text-amber-600' : 'text-emerald-600'}>
                            {order.yield_pct} %
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-5 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Derniers mouvements</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">Flux stock mis à jour en temps réel</p>
            </div>
            <ul className="space-y-1">
              {DEMO_MOVEMENTS.map((m, i) => {
                const isIn = m.label.includes('Réception') || m.label.includes('Entrée');
                const isQc = m.label.includes('Contrôle');
                const Icon = isQc ? ClipboardCheck : isIn ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-gray-50"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{m.label}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-gray-400">{m.time}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </AnimatedSection>
    </PageTransition>
  );
}
