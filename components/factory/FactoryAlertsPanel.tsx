'use client';

import { AlertTriangle, Package, ClipboardCheck, TrendingDown } from 'lucide-react';
import {
  ALERT_SEVERITY_LABELS,
  buildLiveAlerts,
  DEMO_ALERTS,
  sortAlerts,
  type FactoryDemoAlert,
  type FactoryMetrics,
} from '@/lib/factory/demo-dashboard';

const alertStyles = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
  },
} as const;

function alertIcon(alert: FactoryDemoAlert) {
  if (alert.id === 'stock') return <Package className="h-5 w-5" />;
  if (alert.id === 'qc') return <ClipboardCheck className="h-5 w-5" />;
  if (alert.id === 'yield') return <TrendingDown className="h-5 w-5" />;
  return <AlertTriangle className="h-5 w-5" />;
}

export function FactoryAlertsPanel({
  alerts,
  useDemo,
  metrics,
}: {
  alerts?: FactoryDemoAlert[];
  useDemo: boolean;
  metrics: FactoryMetrics;
}) {
  const items = sortAlerts(alerts ?? (useDemo ? DEMO_ALERTS : buildLiveAlerts(metrics)));

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Alertes usine</h3>
        {items.length > 0 && (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              items.some((a) => a.severity === 'danger')
                ? 'bg-red-100 text-red-600'
                : items.some((a) => a.severity === 'warning')
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
            }`}
          >
            {items.length}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.map((alert) => {
          const style = alertStyles[alert.severity];
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-xl ${style.bg} border ${style.border} transition-all hover:shadow-sm`}
            >
              <div className={`p-2 rounded-lg ${style.iconBg}`}>
                <span className={style.iconColor}>{alertIcon(alert)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${
                      alert.severity === 'danger'
                        ? 'bg-red-100 text-red-700'
                        : alert.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {ALERT_SEVERITY_LABELS[alert.severity]}
                  </span>
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
