'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FactoryProductionPoint, FactoryYieldPoint } from '@/lib/factory/demo-dashboard';

const THRESHOLD = 77;

const PRODUCT_COLORS: Record<string, string> = {
  'Beurre cacao': '#5C4033',
  'Poudre cacao': '#9A7349',
  'Masse cacao': '#C9822B',
  Tourteaux: '#2F5230',
};

function FactoryAnalyticCard({
  title,
  subtitle,
  kpis,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  kpis: Array<{ label: string; value: string; accent?: string }>;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-4 border-b border-gray-100 pb-4">
        {kpis.map((kpi) => (
          <div key={kpi.label}>
            <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
            <p className={`mt-0.5 text-lg font-semibold tabular-nums ${kpi.accent ?? 'text-gray-900'}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="min-h-[240px] flex-1">{children}</div>

      {footer && (
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">{footer}</p>
      )}
    </section>
  );
}

function ProductionTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: FactoryProductionPoint & { fill: string } }>;
  total: number;
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload;
  const pct = total > 0 ? ((item.kg / total) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-lg border border-[#e0d4c8] bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
        <p className="text-sm font-semibold text-[#3d2b1f]">{item.product}</p>
      </div>
      <p className="mt-1.5 text-base font-bold tabular-nums text-[#5C4033]">
        {item.kg.toLocaleString('fr-FR')} kg
      </p>
      <p className="text-xs text-[#8B6914]">{pct} % du total</p>
    </div>
  );
}

function YieldTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FactoryYieldPoint & { belowThreshold?: boolean } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload;
  const delta = item.yield - THRESHOLD;
  const below = item.yield < THRESHOLD;

  return (
    <div className="rounded-lg border border-[#e0d4c8] bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-[#8B6914]">{item.day}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-[#3d2b1f]">{item.yield.toFixed(1)} %</p>
      <p className={`mt-0.5 text-xs ${below ? 'text-[#c45c2a]' : 'text-[#234D1E]'}`}>
        {below ? '↓' : '↑'} {Math.abs(delta).toFixed(1)} pt vs seuil ({THRESHOLD} %)
      </p>
    </div>
  );
}

function ProductionLegend({ data }: { data: FactoryProductionPoint[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {data.map((d) => (
        <span key={d.product} className="flex items-center gap-1.5 text-[11px] text-[#6b5344]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: PRODUCT_COLORS[d.product] ?? '#5C4033' }}
          />
          {d.product}
        </span>
      ))}
    </div>
  );
}

function enrichProduction(data: FactoryProductionPoint[]) {
  return data.map((d) => ({
    ...d,
    fill: PRODUCT_COLORS[d.product] ?? '#5C4033',
    shortLabel: d.product.replace(' cacao', '').replace('Tourteaux', 'Tourteaux'),
  }));
}

function enrichYield(data: FactoryYieldPoint[]) {
  return data.map((d) => ({
    ...d,
    belowThreshold: d.yield < THRESHOLD,
  }));
}

export function ProductionChartCard({ data }: { data: FactoryProductionPoint[] }) {
  const enriched = enrichProduction(data);
  const total = data.reduce((s, d) => s + d.kg, 0);
  const dominant = [...data].sort((a, b) => b.kg - a.kg)[0];
  const dominantPct = total > 0 ? Math.round((dominant.kg / total) * 100) : 0;

  return (
    <FactoryAnalyticCard
      title="Production par produit dérivé"
      subtitle="Répartition des sorties usine sur la période"
      kpis={[
        { label: 'Production totale', value: `${(total / 1000).toFixed(1)} t` },
        { label: 'Produit dominant', value: dominant?.product.replace(' cacao', '') ?? 'N/A', accent: 'text-primary-700' },
      ]}
      footer={`La ${dominant?.product.toLowerCase()} représente ${dominantPct} % de la production de la période.`}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={enriched} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="#f0ebe4" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fill: '#a08a6e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: '#c4b09a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`}
            width={36}
          />
          <Tooltip
            cursor={{ fill: 'rgba(92, 64, 51, 0.04)', radius: 6 }}
            content={<ProductionTooltip total={total} />}
          />
          <Bar dataKey="kg" radius={[8, 8, 0, 0]} maxBarSize={52}>
            {enriched.map((entry) => (
              <Cell key={entry.product} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ProductionLegend data={data} />
    </FactoryAnalyticCard>
  );
}

export function YieldChartCard({ data }: { data: FactoryYieldPoint[] }) {
  const enriched = enrichYield(data);
  const avg = data.reduce((s, d) => s + d.yield, 0) / data.length;
  const best = Math.max(...data.map((d) => d.yield));
  const aboveThreshold = data.filter((d) => d.yield >= THRESHOLD).length;

  return (
    <FactoryAnalyticCard
      title="Évolution du rendement usine"
      subtitle="Tendance sur les 30 derniers jours"
      kpis={[
        { label: 'Rendement moyen', value: `${avg.toFixed(1)} %`, accent: 'text-emerald-600' },
        { label: 'Seuil cible', value: `${THRESHOLD} %` },
        { label: 'Meilleur jour', value: `${best.toFixed(1)} %`, accent: 'text-amber-600' },
      ]}
      footer={`Le rendement reste au-dessus du seuil sur ${aboveThreshold} des ${data.length} derniers relevés.`}
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={enriched} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#234D1E" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#234D1E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f0ebe4" strokeDasharray="4 4" vertical={false} />
          <ReferenceArea y1={THRESHOLD} y2={84} fill="#234D1E" fillOpacity={0.05} />
          <ReferenceArea y1={72} y2={THRESHOLD} fill="#C9822B" fillOpacity={0.06} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#a08a6e', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[72, 84]}
            tick={{ fill: '#c4b09a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={32}
          />
          <Tooltip content={<YieldTooltip />} />
          <ReferenceLine
            y={THRESHOLD}
            stroke="#C9822B"
            strokeDasharray="5 5"
            strokeOpacity={0.7}
            label={{
              value: `Seuil ${THRESHOLD}%`,
              position: 'insideTopRight',
              fill: '#a08a6e',
              fontSize: 10,
            }}
          />
          <Area
            type="monotone"
            dataKey="yield"
            stroke="#234D1E"
            strokeWidth={2.5}
            fill="url(#yieldFill)"
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { belowThreshold: boolean } };
              if (payload.belowThreshold) {
                return (
                  <circle
                    key={`dot-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#fff"
                    stroke="#c45c2a"
                    strokeWidth={2}
                  />
                );
              }
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} fill="transparent" />;
            }}
            activeDot={{ r: 5, fill: '#234D1E', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex justify-center gap-5 text-[11px] text-[#6b5344]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#234D1E]" />
          Rendement réel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t border-dashed border-[#C9822B]" />
          Seuil cible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-[#c45c2a] bg-white" />
          Sous seuil
        </span>
      </div>
    </FactoryAnalyticCard>
  );
}

/** @deprecated Use ProductionChartCard */
export function ProductionByProductChart({ data }: { data: FactoryProductionPoint[] }) {
  return <ProductionChartCard data={data} />;
}

/** @deprecated Use YieldChartCard */
export function YieldTrendChart({ data }: { data: FactoryYieldPoint[] }) {
  return <YieldChartCard data={data} />;
}
