'use client';

import Link from 'next/link';
import { KPICard } from '@/components/dashboard/KPICard';
import type { FactoryKpiConfig } from '@/lib/factory/demo-dashboard';

export interface FactoryKpiCardProps {
  config: FactoryKpiConfig;
  value: number;
  icon: React.ReactNode;
}

export function FactoryKpiCard({ config, value, icon }: FactoryKpiCardProps) {
  const { label, insight, href, unit, gradient = 'green', change, live } = config;

  const formatValue = (v: number | string) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (Number.isNaN(n)) return String(v);
    if (config.id === 'avg_yield' || config.id === 'avg_loss') {
      return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`;
    }
    if (unit === 'kg') {
      return `${n.toLocaleString('fr-FR')} ${unit}`;
    }
    return unit ? `${n.toLocaleString('fr-FR')} ${unit}` : n.toLocaleString('fr-FR');
  };

  const card = (
    <div className="relative h-full">
      {live && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      )}
      <KPICard
        title={label}
        value={value}
        subtitle={live ? `${insight} · temps réel` : insight}
        change={change}
        icon={icon}
        gradient={gradient}
        formatValue={formatValue}
        animateCounter
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }
  return card;
}
