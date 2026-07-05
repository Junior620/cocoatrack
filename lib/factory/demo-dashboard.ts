/** Données de démonstration pour le tableau de bord usine (présentation client). */

export type FactoryPeriod = 'today' | '7d' | '30d' | 'campaign';

export const FACTORY_PERIOD_LABELS: Record<FactoryPeriod, string> = {
  today: "Aujourd'hui",
  '7d': '7 jours',
  '30d': '30 jours',
  campaign: 'Campagne',
};

const PERIOD_SCALE: Record<FactoryPeriod, number> = {
  today: 0.04,
  '7d': 0.22,
  '30d': 1,
  campaign: 2.8,
};

export interface FactoryDemoMetrics {
  beans_received_kg: number;
  beans_stock_kg: number;
  beans_transformed_kg: number;
  finished_stock_kg: number;
  avg_yield_pct: number;
  avg_loss_pct: number;
  pending_qc_count: number;
  orders_in_progress: number;
}

export type KpiStatus = 'neutral' | 'positive' | 'warning' | 'critical';

export type AlertSeverity = 'warning' | 'danger' | 'info';

export interface FactoryDemoAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  danger: 'Critique',
  warning: 'Attention',
  info: 'Info',
};

export const ALERT_SEVERITY_ORDER: Record<AlertSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

export interface FactoryKpiConfig {
  id: string;
  label: string;
  insight: string;
  status: KpiStatus;
  href?: string;
  unit?: string;
  gradient?: 'green' | 'orange' | 'blue' | 'purple' | 'red';
  change?: number;
  live?: boolean;
}

export type KpiGradient = NonNullable<FactoryKpiConfig['gradient']>;

const KPI_GRADIENT_BY_ID: Record<string, KpiGradient> = {
  beans_received: 'green',
  beans_stock: 'blue',
  beans_transformed: 'orange',
  finished_stock: 'purple',
  avg_yield: 'green',
  avg_loss: 'orange',
  pending_qc: 'red',
  orders_in_progress: 'blue',
};

export function resolveKpiGradient(config: FactoryKpiConfig): KpiGradient {
  if (config.gradient) return config.gradient;
  if (config.status === 'critical') return 'red';
  if (config.status === 'warning') return 'orange';
  if (config.status === 'positive') return 'green';
  return KPI_GRADIENT_BY_ID[config.id] ?? 'green';
}

/** Extrait un % de variation depuis l'insight démo (ex. "+12 % vs…"). */
export function extractInsightChange(insight: string): number | undefined {
  const match = insight.match(/\+(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return undefined;
  return parseFloat(match[1].replace(',', '.'));
}

const LIVE_KPI_IDS = new Set(['beans_stock', 'pending_qc', 'orders_in_progress']);

function enrichKpiConfig(config: FactoryKpiConfig, period?: FactoryPeriod): FactoryKpiConfig {
  const live =
    LIVE_KPI_IDS.has(config.id) || (config.id === 'beans_received' && period === 'today');
  return {
    ...config,
    gradient: resolveKpiGradient(config),
    change: config.change ?? extractInsightChange(config.insight),
    live,
  };
}

export type FactoryMetrics = FactoryDemoMetrics;

export interface FactoryDemoOrder {
  id: string;
  order_number: string;
  product: string;
  quantity_kg: number;
  status: string;
  yield_pct: number | null;
}

export interface FactoryDemoMovement {
  time: string;
  label: string;
}

export interface FactoryProductionPoint {
  product: string;
  kg: number;
}

export interface FactoryYieldPoint {
  day: string;
  yield: number;
  threshold: number;
}

const BASE_METRICS: FactoryDemoMetrics = {
  beans_received_kg: 18_500,
  beans_stock_kg: 42_300,
  beans_transformed_kg: 12_800,
  finished_stock_kg: 7_950,
  avg_yield_pct: 78.4,
  avg_loss_pct: 6.2,
  pending_qc_count: 4,
  orders_in_progress: 3,
};

export function isFactoryDashboardEmpty(metrics: {
  beans_received_kg: number;
  beans_stock_kg: number;
  beans_transformed_kg: number;
  finished_stock_kg: number;
}): boolean {
  return (
    metrics.beans_received_kg === 0 &&
    metrics.beans_stock_kg === 0 &&
    metrics.beans_transformed_kg === 0 &&
    metrics.finished_stock_kg === 0
  );
}

export function getDemoMetrics(period: FactoryPeriod): FactoryDemoMetrics {
  const scale = PERIOD_SCALE[period];
  return {
    beans_received_kg: Math.round(BASE_METRICS.beans_received_kg * scale),
    beans_stock_kg: BASE_METRICS.beans_stock_kg,
    beans_transformed_kg: Math.round(BASE_METRICS.beans_transformed_kg * scale),
    finished_stock_kg: BASE_METRICS.finished_stock_kg,
    avg_yield_pct: BASE_METRICS.avg_yield_pct,
    avg_loss_pct: BASE_METRICS.avg_loss_pct,
    pending_qc_count: period === 'today' ? 2 : BASE_METRICS.pending_qc_count,
    orders_in_progress: BASE_METRICS.orders_in_progress,
  };
}

export const DEMO_ALERTS: FactoryDemoAlert[] = [
  {
    id: 'stock',
    severity: 'danger',
    message: 'Stock poudre de cacao faible (850 kg restants)',
  },
  {
    id: 'qc',
    severity: 'warning',
    message: '4 lots en attente de contrôle qualité',
  },
  {
    id: 'yield',
    severity: 'warning',
    message: 'Rendement inférieur au seuil sur OT-2026-014',
  },
];

const DEMO_KPI_INSIGHTS: Record<
  string,
  Record<FactoryPeriod, { insight: string; status?: KpiStatus }>
> = {
  beans_received: {
    today: { insight: '+2 % vs hier' },
    '7d': { insight: '+3 % vs semaine précédente' },
    '30d': { insight: '+12 % vs période précédente' },
    campaign: { insight: '+18 % vs campagne N-1' },
  },
  beans_stock: {
    today: { insight: 'Niveau confortable' },
    '7d': { insight: 'Niveau confortable' },
    '30d': { insight: 'Niveau confortable' },
    campaign: { insight: 'Couverture ~6 semaines' },
  },
  beans_transformed: {
    today: { insight: 'Production du jour en cours' },
    '7d': { insight: '+5 % cette semaine' },
    '30d': { insight: '+8 % cette période' },
    campaign: { insight: '+14 % sur la campagne' },
  },
  finished_stock: {
    today: { insight: 'Stock disponible' },
    '7d': { insight: 'Stock disponible' },
    '30d': { insight: 'Stock disponible' },
    campaign: { insight: 'Rotation normale' },
  },
  avg_yield: {
    today: { insight: '+1,4 pt au-dessus du seuil', status: 'positive' },
    '7d': { insight: '+1,2 pt au-dessus du seuil', status: 'positive' },
    '30d': { insight: '+1,4 pt au-dessus du seuil', status: 'positive' },
    campaign: { insight: '+1,1 pt au-dessus du seuil', status: 'positive' },
  },
  avg_loss: {
    today: { insight: 'À surveiller', status: 'warning' },
    '7d': { insight: 'À surveiller', status: 'warning' },
    '30d': { insight: 'À surveiller', status: 'warning' },
    campaign: { insight: 'Légèrement au-dessus de la cible', status: 'warning' },
  },
  pending_qc: {
    today: { insight: 'Action requise', status: 'warning' },
    '7d': { insight: 'Action requise', status: 'warning' },
    '30d': { insight: 'Action requise', status: 'warning' },
    campaign: { insight: 'Action requise', status: 'warning' },
  },
  orders_in_progress: {
    today: { insight: 'Production active' },
    '7d': { insight: 'Production active' },
    '30d': { insight: 'Production active' },
    campaign: { insight: '3 lignes engagées' },
  },
};

const YIELD_THRESHOLD = 77;

export function getDemoKpiConfigs(period: FactoryPeriod): FactoryKpiConfig[] {
  const pick = (id: string, label: string, extra?: Partial<FactoryKpiConfig>): FactoryKpiConfig => {
    const periodInsight = DEMO_KPI_INSIGHTS[id]?.[period];
    return {
      id,
      label,
      insight: periodInsight?.insight ?? 'Non renseigné',
      status: periodInsight?.status ?? 'neutral',
      ...extra,
    };
  };

  return [
    pick('beans_received', 'Fèves reçues', { href: '/factory/receipts', unit: 'kg' }),
    pick('beans_stock', 'Stock fèves', { href: '/factory/stocks', unit: 'kg' }),
    pick('beans_transformed', 'Fèves transformées', { href: '/factory/orders', unit: 'kg' }),
    pick('finished_stock', 'Produits finis en stock', { href: '/factory/products', unit: 'kg' }),
    pick('avg_yield', 'Rendement moyen', { unit: '%' }),
    pick('avg_loss', 'Taux de perte moyen', { unit: '%' }),
    pick('pending_qc', 'Lots en attente QC', { href: '/factory/quality' }),
    pick('orders_in_progress', 'Ordres en cours', { href: '/factory/orders' }),
  ].map((c) => enrichKpiConfig(c, period));
}

export function getLiveKpiConfigs(metrics: FactoryMetrics, period: FactoryPeriod): FactoryKpiConfig[] {
  const periodLabel =
    period === 'today' ? "aujourd'hui" : period === '7d' ? 'sur 7 jours' : period === 'campaign' ? 'campagne' : 'sur 30 jours';

  const yieldAbove = metrics.avg_yield_pct >= YIELD_THRESHOLD;
  const yieldDelta = metrics.avg_yield_pct - YIELD_THRESHOLD;

  return ([
    {
      id: 'beans_received',
      label: 'Fèves reçues',
      insight: `Données ${periodLabel}`,
      status: 'neutral',
      href: '/factory/receipts',
      unit: 'kg',
    },
    {
      id: 'beans_stock',
      label: 'Stock fèves',
      insight: metrics.beans_stock_kg > 0 ? 'Stock actuel' : 'Aucun stock enregistré',
      status: 'neutral',
      href: '/factory/stocks',
      unit: 'kg',
    },
    {
      id: 'beans_transformed',
      label: 'Fèves transformées',
      insight: `Données ${periodLabel}`,
      status: 'neutral',
      href: '/factory/orders',
      unit: 'kg',
    },
    {
      id: 'finished_stock',
      label: 'Produits finis en stock',
      insight: metrics.finished_stock_kg > 0 ? 'Stock disponible' : 'Aucun produit fini en stock',
      status: 'neutral',
      href: '/factory/products',
      unit: 'kg',
    },
    {
      id: 'avg_yield',
      label: 'Rendement moyen',
      insight:
        metrics.avg_yield_pct > 0
          ? yieldAbove
            ? `+${yieldDelta.toFixed(1)} pt au-dessus du seuil`
            : `${Math.abs(yieldDelta).toFixed(1)} pt sous le seuil`
          : 'Pas encore de données',
      status: metrics.avg_yield_pct > 0 ? (yieldAbove ? 'positive' : 'warning') : 'neutral',
      unit: '%',
    },
    {
      id: 'avg_loss',
      label: 'Taux de perte moyen',
      insight: metrics.avg_loss_pct > 5 ? 'À surveiller' : metrics.avg_loss_pct > 0 ? 'Dans la cible' : 'Pas encore de données',
      status: metrics.avg_loss_pct > 5 ? 'warning' : 'neutral',
      unit: '%',
    },
    {
      id: 'pending_qc',
      label: 'Lots en attente QC',
      insight: metrics.pending_qc_count > 0 ? 'Action requise' : 'Aucun lot en attente',
      status: metrics.pending_qc_count > 0 ? 'warning' : 'positive',
      href: '/factory/quality',
    },
    {
      id: 'orders_in_progress',
      label: 'Ordres en cours',
      insight: metrics.orders_in_progress > 0 ? 'Production active' : 'Aucun ordre actif',
      status: 'neutral',
      href: '/factory/orders',
    },
  ] as FactoryKpiConfig[]).map((c) => enrichKpiConfig(c, period));
}

export function getKpiConfigs(metrics: FactoryMetrics, period: FactoryPeriod, useDemo: boolean): FactoryKpiConfig[] {
  return useDemo ? getDemoKpiConfigs(period) : getLiveKpiConfigs(metrics, period);
}

export function getMetricNumericValue(config: FactoryKpiConfig, metrics: FactoryMetrics): number {
  switch (config.id) {
    case 'beans_received':
      return metrics.beans_received_kg;
    case 'beans_stock':
      return metrics.beans_stock_kg;
    case 'beans_transformed':
      return metrics.beans_transformed_kg;
    case 'finished_stock':
      return metrics.finished_stock_kg;
    case 'avg_yield':
      return metrics.avg_yield_pct;
    case 'avg_loss':
      return metrics.avg_loss_pct;
    case 'pending_qc':
      return metrics.pending_qc_count;
    case 'orders_in_progress':
      return metrics.orders_in_progress;
    default:
      return 0;
  }
}

export function getMetricValue(config: FactoryKpiConfig, metrics: FactoryMetrics): string | number {
  switch (config.id) {
    case 'beans_received':
      return metrics.beans_received_kg.toLocaleString('fr-FR');
    case 'beans_stock':
      return metrics.beans_stock_kg.toLocaleString('fr-FR');
    case 'beans_transformed':
      return metrics.beans_transformed_kg.toLocaleString('fr-FR');
    case 'finished_stock':
      return metrics.finished_stock_kg.toLocaleString('fr-FR');
    case 'avg_yield':
      return metrics.avg_yield_pct.toFixed(1);
    case 'avg_loss':
      return metrics.avg_loss_pct.toFixed(1);
    case 'pending_qc':
      return metrics.pending_qc_count;
    case 'orders_in_progress':
      return metrics.orders_in_progress;
    default:
      return '0';
  }
}

export function buildLiveAlerts(metrics: FactoryMetrics): FactoryDemoAlert[] {
  const alerts: FactoryDemoAlert[] = [];

  if (metrics.pending_qc_count > 0) {
    alerts.push({
      id: 'qc',
      severity: 'warning',
      message: `${metrics.pending_qc_count} lot(s) en attente de contrôle qualité`,
    });
  }
  if (metrics.avg_yield_pct > 0 && metrics.avg_yield_pct < YIELD_THRESHOLD) {
    alerts.push({
      id: 'yield',
      severity: 'warning',
      message: `Rendement moyen inférieur au seuil (${YIELD_THRESHOLD} %)`,
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: 'ok',
      severity: 'info',
      message: 'Aucune alerte active, usine conforme',
    });
  }

  return alerts.sort((a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity]);
}

export function sortAlerts(alerts: FactoryDemoAlert[]): FactoryDemoAlert[] {
  return [...alerts].sort((a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity]);
}

export const DEMO_ORDERS: FactoryDemoOrder[] = [
  {
    id: '1',
    order_number: 'OT-2026-014',
    product: 'Beurre / Poudre',
    quantity_kg: 2_500,
    status: 'En cours',
    yield_pct: 76,
  },
  {
    id: '2',
    order_number: 'OT-2026-015',
    product: 'Masse cacao',
    quantity_kg: 1_200,
    status: 'Planifié',
    yield_pct: null,
  },
  {
    id: '3',
    order_number: 'OT-2026-016',
    product: 'Poudre cacao',
    quantity_kg: 3_000,
    status: 'Contrôle final',
    yield_pct: 81,
  },
];

export const DEMO_MOVEMENTS: FactoryDemoMovement[] = [
  { time: '10:35', label: 'Réception lot L-2026-084, 3 200 kg' },
  { time: '11:10', label: 'Contrôle qualité validé, lot L-2026-081' },
  { time: '12:45', label: 'Sortie stock vers transformation, 1 500 kg' },
  { time: '14:20', label: 'Entrée stock beurre cacao, 620 kg' },
  { time: '15:55', label: 'Ordre OT-2026-014, saisie production partielle' },
];

export const DEMO_PRODUCTION: FactoryProductionPoint[] = [
  { product: 'Beurre cacao', kg: 2_850 },
  { product: 'Poudre cacao', kg: 3_200 },
  { product: 'Masse cacao', kg: 1_200 },
  { product: 'Tourteaux', kg: 700 },
];

export const DEMO_YIELD_TREND: FactoryYieldPoint[] = [
  { day: '05/06', yield: 77.2, threshold: 77 },
  { day: '08/06', yield: 79.1, threshold: 77 },
  { day: '11/06', yield: 78.5, threshold: 77 },
  { day: '14/06', yield: 76.8, threshold: 77 },
  { day: '17/06', yield: 80.2, threshold: 77 },
  { day: '20/06', yield: 79.4, threshold: 77 },
  { day: '23/06', yield: 75.9, threshold: 77 },
  { day: '26/06', yield: 78.8, threshold: 77 },
  { day: '29/06', yield: 81.0, threshold: 77 },
  { day: '02/07', yield: 78.4, threshold: 77 },
];
