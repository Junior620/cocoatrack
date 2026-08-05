/**
 * Index-specific chart bands & labels for TemporalDataChart.
 * Bands apply only when a single index is visible.
 */

export type ChartIndexKey = 'ndvi' | 'evi' | 'ndmi' | 'ndwi';

export interface IndexBand {
  y1: number;
  y2: number;
  fill: string;
  fillOpacity: number;
  label: 'Critique' | 'À surveiller' | 'Satisfaisant';
}

export const INDEX_META: Record<
  ChartIndexKey,
  { short: string; labelFr: string; color: string; dash?: string }
> = {
  ndvi: {
    short: 'NDVI',
    labelFr: 'Vigueur de la végétation',
    color: '#6FAF3D',
  },
  evi: {
    short: 'EVI',
    labelFr: 'Végétation dense',
    color: '#0284c7',
    dash: '6 4',
  },
  ndmi: {
    short: 'NDMI',
    labelFr: 'Humidité de la végétation',
    color: '#b45309',
    dash: '2 3',
  },
  ndwi: {
    short: 'NDWI',
    labelFr: 'Présence d’eau',
    color: '#0e7490',
    dash: '4 2',
  },
};

/** Soft health zones — adapted per index (single-index mode only) */
export function getIndexBands(index: ChartIndexKey): IndexBand[] {
  switch (index) {
    case 'ndvi':
      return [
        { y1: 0.55, y2: 1, fill: '#2d5016', fillOpacity: 0.07, label: 'Satisfaisant' },
        { y1: 0.3, y2: 0.55, fill: '#fbbf24', fillOpacity: 0.07, label: 'À surveiller' },
        { y1: -1, y2: 0.3, fill: '#ef4444', fillOpacity: 0.06, label: 'Critique' },
      ];
    case 'evi':
      return [
        { y1: 0.35, y2: 1, fill: '#2d5016', fillOpacity: 0.07, label: 'Satisfaisant' },
        { y1: 0.2, y2: 0.35, fill: '#fbbf24', fillOpacity: 0.07, label: 'À surveiller' },
        { y1: -1, y2: 0.2, fill: '#ef4444', fillOpacity: 0.06, label: 'Critique' },
      ];
    case 'ndmi':
      return [
        { y1: 0.12, y2: 1, fill: '#2d5016', fillOpacity: 0.07, label: 'Satisfaisant' },
        { y1: 0.05, y2: 0.12, fill: '#fbbf24', fillOpacity: 0.07, label: 'À surveiller' },
        { y1: -1, y2: 0.05, fill: '#ef4444', fillOpacity: 0.06, label: 'Critique' },
      ];
    case 'ndwi':
      return [
        { y1: -0.1, y2: 0.05, fill: '#2d5016', fillOpacity: 0.06, label: 'Satisfaisant' },
        { y1: 0.05, y2: 0.15, fill: '#fbbf24', fillOpacity: 0.07, label: 'À surveiller' },
        { y1: 0.15, y2: 1, fill: '#0e7490', fillOpacity: 0.08, label: 'Critique' },
        { y1: -1, y2: -0.1, fill: '#64748b', fillOpacity: 0.05, label: 'À surveiller' },
      ];
    default:
      return [];
  }
}

export function bandLegendFor(index: ChartIndexKey): Array<{
  label: string;
  className: string;
}> {
  switch (index) {
    case 'ndvi':
      return [
        { label: 'Satisfaisant ≥ 0,55', className: 'bg-emerald-50 text-emerald-800' },
        { label: 'À surveiller 0,30–0,55', className: 'bg-amber-50 text-amber-900' },
        { label: 'Critique < 0,30', className: 'bg-red-50 text-red-800' },
      ];
    case 'evi':
      return [
        { label: 'Satisfaisant ≥ 0,35', className: 'bg-emerald-50 text-emerald-800' },
        { label: 'À surveiller 0,20–0,35', className: 'bg-amber-50 text-amber-900' },
        { label: 'Critique < 0,20', className: 'bg-red-50 text-red-800' },
      ];
    case 'ndmi':
      return [
        { label: 'Satisfaisant ≥ 0,12', className: 'bg-emerald-50 text-emerald-800' },
        { label: 'À surveiller 0,05–0,12', className: 'bg-amber-50 text-amber-900' },
        { label: 'Critique < 0,05', className: 'bg-red-50 text-red-800' },
      ];
    case 'ndwi':
      return [
        { label: 'Normal ≈ −0,10–0,05', className: 'bg-emerald-50 text-emerald-800' },
        { label: 'Surface humide ≥ 0,05', className: 'bg-amber-50 text-amber-900' },
        { label: 'Eau / inondation ≥ 0,15', className: 'bg-cyan-50 text-cyan-900' },
      ];
  }
}

export function classifyNdviDelta(delta: number): {
  direction: 'up' | 'down' | 'flat';
  labelFr: string;
  severity: 'critical' | 'moderate' | 'mild' | 'none';
} {
  if (delta <= -0.35) {
    return { direction: 'down', labelFr: 'Baisse critique', severity: 'critical' };
  }
  if (delta <= -0.15) {
    return { direction: 'down', labelFr: 'Baisse importante', severity: 'moderate' };
  }
  if (delta < -0.05) {
    return { direction: 'down', labelFr: 'Baisse modérée', severity: 'mild' };
  }
  if (delta >= 0.35) {
    return { direction: 'up', labelFr: 'Forte amélioration', severity: 'critical' };
  }
  if (delta >= 0.15) {
    return { direction: 'up', labelFr: 'Reprise importante', severity: 'moderate' };
  }
  if (delta > 0.05) {
    return { direction: 'up', labelFr: 'Amélioration', severity: 'mild' };
  }
  return { direction: 'flat', labelFr: 'Stable', severity: 'none' };
}

export function confidenceFromQuality(
  quality: 'good' | 'acceptable' | 'degraded' | null | undefined,
  cloudCover: number | null | undefined
): { labelFr: string; tone: string; detailFr: string } {
  if (quality === 'degraded' || (cloudCover != null && cloudCover >= 95)) {
    return {
      labelFr: 'Faible',
      tone: 'border-red-200 bg-red-50 text-red-900',
      detailFr: 'Image trop nuageuse — mesure peu fiable',
    };
  }
  if (quality === 'acceptable' || (cloudCover != null && cloudCover >= 80)) {
    return {
      labelFr: 'Moyenne',
      tone: 'border-amber-200 bg-amber-50 text-amber-950',
      detailFr: 'Couverture nuageuse élevée — interpréter avec prudence',
    };
  }
  if (cloudCover != null && cloudCover > 40) {
    return {
      labelFr: 'Bonne',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      detailFr: `Couverture nuageuse ${cloudCover.toFixed(0)} %`,
    };
  }
  return {
    labelFr: 'Bonne',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    detailFr:
      cloudCover != null && cloudCover > 0
        ? `Couverture nuageuse ${cloudCover.toFixed(0)} %`
        : 'Image exploitable',
  };
}

/** Rough valid-pixel proxy from cloud cover when no pixel mask is stored */
export function estimateValidPixelsPercent(
  cloudCover: number | null | undefined
): number | null {
  if (cloudCover == null || isNaN(Number(cloudCover))) return null;
  return Math.max(0, Math.min(100, 100 - Number(cloudCover)));
}
