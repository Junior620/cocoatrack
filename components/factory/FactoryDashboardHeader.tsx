'use client';

import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';
import { FACTORY_PERIOD_LABELS, type FactoryPeriod } from '@/lib/factory/demo-dashboard';

export function FactoryDashboardHeader({
  period,
  onPeriodChange,
  showDemoBadge,
}: {
  period: FactoryPeriod;
  onPeriodChange: (period: FactoryPeriod) => void;
  showDemoBadge?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord usine</h1>
          {showDemoBadge && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Mode démonstration
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Réception, transformation, rendement et stock produits finis
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as FactoryPeriod)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
          >
            {(Object.keys(FACTORY_PERIOD_LABELS) as FactoryPeriod[]).map((key) => (
              <option key={key} value={key}>
                {FACTORY_PERIOD_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/factory/receipts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle réception</span>
          <span className="sm:hidden">Réception</span>
        </Link>
        <Link
          href="/factory/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ordre de transformation</span>
          <span className="sm:hidden">Ordre</span>
        </Link>
      </div>
    </div>
  );
}
