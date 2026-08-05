'use client';

/**
 * TemporalDataChart — lecture métier satellitaire (NDVI par défaut).
 *
 * - Un indice dominant ; possibilité de comparer jusqu’à 4 indices
 * - Axe Y −1 → 1 + ligne zéro
 * - Bandes de seuils adaptées (masquées en multi)
 * - Segments linéaires (pas de lissage artificiel)
 * - Hausses / baisses explicites + résumé immédiat
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from 'lucide-react';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';
import { exportTemporalDataAsCSV } from '@/lib/satellite/utils/csv-export';
import {
  interpretNdviEviCurves,
  verdictTone,
} from '@/lib/satellite/curve-interpretation';
import { calculateNdviEviGap } from '@/lib/satellite/evi-alerts';
import { interpretNDMILevel } from '@/lib/satellite/ndmi-levels';
import { interpretNDWILevel } from '@/lib/satellite/ndwi-levels';
import { shouldShowSavi, interpretSAVILevel } from '@/lib/satellite/savi-context';
import { getCocoaSeasonContext } from '@/lib/satellite/seasonality';
import { buildIndexLegendSentence } from '@/lib/satellite/index-legend';
import {
  INDEX_META,
  type ChartIndexKey,
  getIndexBands,
  bandLegendFor,
  classifyNdviDelta,
  confidenceFromQuality,
  estimateValidPixelsPercent,
} from '@/lib/satellite/chart-index-bands';

const MAX_VISIBLE_INDICES = 4;
const ALL_INDICES: ChartIndexKey[] = ['ndvi', 'evi', 'ndmi', 'ndwi'];

export interface TemporalDataChartProps {
  timeline: TemporalDataPoint[];
  anneePlantation?: number | null;
  densiteArbresHa?: number | null;
  selectedDate: Date;
  parcelleId?: string;
  startDate?: Date;
  endDate?: Date;
  onDateSelect?: (date: Date) => void;
  showChangeMarkers?: boolean;
  className?: string;
  loading?: boolean;
  error?: Error | null;
}

function getHealthStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    excellent: '#2d5016',
    good: '#6FAF3D',
    fair: '#fbbf24',
    poor: '#E68A1F',
    critical: '#ef4444',
  };
  return colorMap[status] || '#9ca3af';
}

function getNDVIColor(ndvi: number): string {
  if (ndvi >= 0.8) return '#2d5016';
  if (ndvi >= 0.6) return '#6FAF3D';
  if (ndvi >= 0.4) return '#84cc16';
  if (ndvi >= 0.2) return '#fbbf24';
  return '#ef4444';
}

function formatHealthStatus(status: string): string {
  const statusMap: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Faible',
    critical: 'Critique',
  };
  return statusMap[status] || status;
}

function formatShortDate(date: Date | string, monthly = false): string {
  if (monthly) {
    return new Date(date).toLocaleDateString('fr-FR', {
      month: 'short',
      year: 'numeric',
    });
  }
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ChartPoint = Omit<
  TemporalDataPoint,
  'ndvi' | 'evi' | 'ndmi' | 'ndwi' | 'savi' | 'imageryQuality'
> & {
  dateLabel: string;
  dateTimestamp: number;
  ndvi: number | null;
  evi: number | null;
  ndmi: number | null;
  ndwi: number | null;
  savi: number | null;
  ndviDelta: number | null;
  showSavi: boolean;
  imageryQuality: 'good' | 'acceptable' | 'degraded' | null;
};

function CustomTooltip({
  active,
  payload,
  visible,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  visible: ChartIndexKey[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  if (data.ndvi == null || isNaN(Number(data.ndvi))) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-gray-900">
          {new Date(data.date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Pas d&apos;image exploitable à cette date
        </p>
      </div>
    );
  }

  const conf = confidenceFromQuality(data.imageryQuality, data.cloudCover);
  const validPct = estimateValidPixelsPercent(data.cloudCover);
  const delta = data.ndviDelta;
  const deltaClass =
    delta == null
      ? null
      : classifyNdviDelta(delta);

  return (
    <div className="max-w-xs rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {data.isAcquisitionDate ? 'Capture Sentinel-2' : 'Référence mensuelle'}
      </p>
      <p className="mb-2 text-sm font-semibold text-gray-900">
        {new Date(data.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <div className="space-y-1.5">
        {visible.includes('ndvi') && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">NDVI</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: getNDVIColor(data.ndvi) }}
            >
              {data.ndvi.toFixed(3)}
            </span>
          </div>
        )}
        {visible.includes('evi') && data.evi != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">EVI</span>
            <span className="text-sm font-bold tabular-nums text-sky-700">
              {data.evi.toFixed(3)}
            </span>
          </div>
        )}
        {visible.includes('ndmi') && data.ndmi != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">NDMI</span>
            <span className="text-sm font-semibold tabular-nums text-amber-900">
              {data.ndmi.toFixed(3)}
              <span className="ml-1 text-[11px] font-medium opacity-80">
                · {interpretNDMILevel(data.ndmi).labelFr}
              </span>
            </span>
          </div>
        )}
        {visible.includes('ndwi') && data.ndwi != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">NDWI</span>
            <span className="text-sm font-semibold tabular-nums text-cyan-900">
              {data.ndwi.toFixed(3)}
              <span className="ml-1 text-[11px] font-medium opacity-80">
                · {interpretNDWILevel(data.ndwi).labelFr}
              </span>
            </span>
          </div>
        )}
        {data.showSavi && data.savi != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-600">SAVI</span>
            <span className="text-sm font-semibold tabular-nums text-stone-800">
              {data.savi.toFixed(3)}
            </span>
          </div>
        )}
        {deltaClass && delta != null && Math.abs(delta) > 0.05 && (
          <p
            className={`mt-1 text-xs font-medium ${
              deltaClass.direction === 'down'
                ? 'text-red-700'
                : deltaClass.direction === 'up'
                  ? 'text-emerald-700'
                  : 'text-gray-600'
            }`}
          >
            {deltaClass.direction === 'down' ? '↓' : deltaClass.direction === 'up' ? '↑' : '→'}{' '}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(3)} — {deltaClass.labelFr}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-600">État</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: getHealthStatusColor(data.healthStatus) }}
          >
            {formatHealthStatus(data.healthStatus)}
          </span>
        </div>
        <div className="mt-2 space-y-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700">
          <p>
            <span className="font-medium">Confiance :</span> {conf.labelFr}
          </p>
          {validPct != null && (
            <p>
              <span className="font-medium">Pixels valides (proxy) :</span>{' '}
              {validPct.toFixed(0)} %
            </p>
          )}
          {data.cloudCover != null && data.cloudCover > 0 && (
            <p>
              <span className="font-medium">Couverture nuageuse :</span>{' '}
              {data.cloudCover.toFixed(0)} %
            </p>
          )}
          <p className="text-gray-500">{conf.detailFr}</p>
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[28rem] animate-pulse">
      <div className="flex h-full items-center justify-center rounded-xl bg-gray-100">
        <div className="text-gray-400">Chargement du graphique...</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[28rem] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
      <div className="text-center">
        <p className="mt-2 text-sm text-gray-500">
          Aucune donnée temporelle disponible
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Lancez « Historique GEE » pour calculer le NDVI de la période
        </p>
      </div>
    </div>
  );
}

function ErrorChart({ error }: { error: Error }) {
  return (
    <div className="flex h-80 items-center justify-center rounded-lg border border-red-200 bg-red-50">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2 text-sm font-medium text-red-900">
          Erreur de chargement
        </p>
        <p className="mt-1 text-xs text-red-700">{error.message}</p>
      </div>
    </div>
  );
}

function calculateTrend(timeline: TemporalDataPoint[]): {
  trend: 'improving' | 'stable' | 'declining';
  change: number;
} {
  const valid = timeline.filter((p) => !isNaN(p.ndvi));
  if (valid.length < 2) return { trend: 'stable', change: 0 };
  const change = valid[valid.length - 1].ndvi - valid[0].ndvi;
  if (change > 0.05) return { trend: 'improving', change };
  if (change < -0.05) return { trend: 'declining', change };
  return { trend: 'stable', change };
}

function trendLabelFr(
  trend: 'improving' | 'stable' | 'declining',
  lastNdvi: number
): string {
  if (trend === 'improving') return 'En amélioration';
  if (trend === 'declining') return 'En baisse';
  if (lastNdvi < 0.3) return 'Stable à un niveau faible';
  if (lastNdvi < 0.45) return 'Stable à un niveau moyen';
  return 'Stable';
}

export function TemporalDataChart({
  timeline,
  anneePlantation = null,
  densiteArbresHa = null,
  selectedDate,
  parcelleId = 'export',
  startDate: startDateProp,
  endDate: endDateProp,
  onDateSelect,
  showChangeMarkers = true,
  className = '',
  loading = false,
  error = null,
}: TemporalDataChartProps) {
  const [visible, setVisible] = useState<ChartIndexKey[]>(['ndvi']);

  const toggleIndex = (key: ChartIndexKey) => {
    setVisible((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((k) => k !== key);
      }
      // Up to 4 indices (NDVI, EVI, NDMI, NDWI)
      return [...prev, key];
    });
  };

  if (loading) return <ChartSkeleton />;
  if (error) return <ErrorChart error={error} />;
  if (!timeline || timeline.length === 0) return <EmptyChart />;

  const startDate =
    startDateProp ??
    new Date(
      Math.min(...timeline.map((p) => new Date(p.date).getTime()))
    );
  const endDate =
    endDateProp ??
    new Date(
      Math.max(...timeline.map((p) => new Date(p.date).getTime()))
    );

  const handleExportCSV = () => {
    try {
      exportTemporalDataAsCSV(timeline, parcelleId, startDate, endDate);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert("Erreur lors de l'export CSV. Veuillez réessayer.");
    }
  };

  const timeRangeMonths =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const isLongPeriod = timeRangeMonths > 24;
  const hasAcquisitionDates = timeline.some((p) => p.isAcquisitionDate);
  const looksMonthly =
    timeline.length >= 2 &&
    (() => {
      const gaps: number[] = [];
      for (let i = 1; i < Math.min(timeline.length, 6); i++) {
        const a = new Date(timeline[i - 1].date).getTime();
        const b = new Date(timeline[i].date).getTime();
        gaps.push(Math.abs(b - a) / (1000 * 60 * 60 * 24));
      }
      return gaps.reduce((s, g) => s + g, 0) / gaps.length >= 20;
    })();

  const formattedData: ChartPoint[] = timeline.map((point, index) => {
    let prevNdvi: number | null = null;
    for (let i = index - 1; i >= 0; i--) {
      if (!isNaN(timeline[i].ndvi)) {
        prevNdvi = timeline[i].ndvi;
        break;
      }
    }
    const ndvi = isNaN(point.ndvi) ? null : point.ndvi;
    return {
      ...point,
      ndvi,
      evi:
        point.evi == null || isNaN(Number(point.evi))
          ? null
          : Number(point.evi),
      ndmi:
        point.ndmi == null || isNaN(Number(point.ndmi))
          ? null
          : Number(point.ndmi),
      ndwi:
        point.ndwi == null || isNaN(Number(point.ndwi))
          ? null
          : Number(point.ndwi),
      savi:
        point.savi == null || isNaN(Number(point.savi))
          ? null
          : Number(point.savi),
      ndviDelta:
        ndvi != null && prevNdvi != null ? ndvi - prevNdvi : null,
      showSavi: shouldShowSavi({
        meanNdvi: ndvi,
        meanEvi: point.evi,
        anneePlantation,
        densiteArbresHa,
      }),
      imageryQuality: point.imageryQuality ?? null,
      dateLabel: hasAcquisitionDates
        ? new Date(point.date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: isLongPeriod ? 'numeric' : '2-digit',
          })
        : looksMonthly || isLongPeriod
          ? new Date(point.date).toLocaleDateString('fr-FR', {
              month: 'short',
              year: isLongPeriod ? 'numeric' : '2-digit',
            })
          : new Date(point.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            }),
      dateTimestamp: new Date(point.date).getTime(),
    };
  });

  const tickInterval = isLongPeriod
    ? Math.ceil(formattedData.length / 12)
    : formattedData.length > 18
      ? Math.ceil(formattedData.length / 14)
      : 0;

  const selectedTimestamp = new Date(selectedDate).getTime();
  const selectedDataPoint = formattedData.find(
    (p) => p.dateTimestamp === selectedTimestamp
  );

  const validNdvi = timeline.filter((p) => !isNaN(p.ndvi));
  const lastPoint = [...validNdvi].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
  const currentNdvi = lastPoint?.ndvi ?? null;
  const currentStatus = lastPoint?.healthStatus ?? 'fair';
  const { trend, change } = calculateTrend(timeline);
  const conf = confidenceFromQuality(
    lastPoint?.imageryQuality,
    lastPoint?.cloudCover
  );

  const significantChangePoints = formattedData.filter(
    (p) =>
      p.hasSignificantChange &&
      p.ndvi != null &&
      p.ndviDelta != null &&
      Math.abs(p.ndviDelta) > 0.15
  );

  const singleIndex = visible.length === 1 ? visible[0] : null;
  const bands = singleIndex ? getIndexBands(singleIndex) : [];
  const bandLegend = singleIndex ? bandLegendFor(singleIndex) : [];

  const avgNDVI =
    validNdvi.length > 0
      ? validNdvi.reduce((s, p) => s + p.ndvi, 0) / validNdvi.length
      : 0;
  const avgEVI = (() => {
    const pts = timeline.filter((p) => p.evi != null && !isNaN(Number(p.evi)));
    return pts.length
      ? pts.reduce((s, p) => s + Number(p.evi), 0) / pts.length
      : null;
  })();
  const avgNDMI = (() => {
    const pts = timeline.filter((p) => p.ndmi != null && !isNaN(Number(p.ndmi)));
    return pts.length
      ? pts.reduce((s, p) => s + Number(p.ndmi), 0) / pts.length
      : null;
  })();
  const avgNDWI = (() => {
    const pts = timeline.filter((p) => p.ndwi != null && !isNaN(Number(p.ndwi)));
    return pts.length
      ? pts.reduce((s, p) => s + Number(p.ndwi), 0) / pts.length
      : null;
  })();
  const avgSAVI = (() => {
    const pts = timeline.filter((p) => p.savi != null && !isNaN(Number(p.savi)));
    return pts.length
      ? pts.reduce((s, p) => s + Number(p.savi), 0) / pts.length
      : null;
  })();
  const showSavi = shouldShowSavi({
    meanNdvi: avgNDVI,
    meanEvi: avgEVI,
    anneePlantation,
    densiteArbresHa,
  });
  const seasonCtx = getCocoaSeasonContext();
  const interpretation = interpretNdviEviCurves(
    timeline.map((p) => ({
      date: p.date,
      ndvi: p.ndvi,
      evi: p.evi ?? null,
      ndmi: p.ndmi ?? null,
    }))
  );
  const indexLegend = buildIndexLegendSentence({
    meanNdvi: avgNDVI,
    meanEvi: avgEVI,
    meanNdmi: avgNDMI,
    meanNdwi: avgNDWI,
    meanSavi: avgSAVI,
    saviRelevant: showSavi,
    imageryQuality: lastPoint?.imageryQuality ?? null,
  });

  const lastUpdateLabel = lastPoint
    ? formatShortDate(lastPoint.date)
    : formatShortDate(endDate);

  const TrendIcon =
    trend === 'improving'
      ? TrendingUp
      : trend === 'declining'
        ? TrendingDown
        : Minus;

  const handleChartClick = (data: unknown) => {
    const payload = (
      data as { activePayload?: Array<{ payload: ChartPoint }> } | null
    )?.activePayload?.[0]?.payload;
    if (payload && onDateSelect) {
      onDateSelect(new Date(payload.date));
    }
  };

  const renderNdviDot = (props: {
    cx?: number;
    cy?: number;
    payload?: ChartPoint;
    index?: number;
  }) => {
    const { cx, cy, payload, index } = props;
    if (
      payload == null ||
      payload.ndvi == null ||
      isNaN(payload.ndvi) ||
      cx == null ||
      cy == null
    ) {
      return <g key={`dot-empty-${index}`} />;
    }
    const isSelected =
      selectedDataPoint &&
      payload.dateTimestamp === selectedDataPoint.dateTimestamp;
    const delta = payload.ndviDelta;
    const isChange =
      showChangeMarkers &&
      payload.hasSignificantChange &&
      delta != null &&
      Math.abs(delta) > 0.15;
    const up = isChange && delta! > 0;
    const down = isChange && delta! < 0;
    const ring = down ? '#dc2626' : up ? '#059669' : null;

    return (
      <g key={`dot-${index}`}>
        {isSelected && (
          <circle
            cx={cx}
            cy={cy}
            r={12}
            fill="none"
            stroke="#64748b"
            strokeWidth={2}
            opacity={0.45}
          />
        )}
        {ring && (
          <circle
            cx={cx}
            cy={cy}
            r={9}
            fill="none"
            stroke={ring}
            strokeWidth={2}
            opacity={0.85}
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={isChange || isSelected ? 5 : 3.5}
          fill={
            down ? '#dc2626' : up ? '#059669' : getNDVIColor(payload.ndvi)
          }
          stroke="white"
          strokeWidth={2}
        />
      </g>
    );
  };

  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:p-6 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">
            Évolution satellitaire de la parcelle
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {formatShortDate(startDate)} → {formatShortDate(endDate)} ·
            Sentinel-2 · Dernière mise à jour : {lastUpdateLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      {/* Immediate summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            NDVI actuel
          </p>
          <p
            className="mt-1 text-2xl font-bold tabular-nums"
            style={{
              color:
                currentNdvi != null ? getNDVIColor(currentNdvi) : undefined,
            }}
          >
            {currentNdvi != null ? currentNdvi.toFixed(2) : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Dernière capture valide</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Tendance
          </p>
          <div className="mt-1 flex items-center gap-2">
            <TrendIcon
              className={`h-5 w-5 ${
                trend === 'improving'
                  ? 'text-emerald-600'
                  : trend === 'declining'
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            />
            <p className="text-sm font-semibold text-gray-900">
              {trendLabelFr(trend, currentNdvi ?? 0)}
            </p>
          </div>
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            Δ période {change >= 0 ? '+' : ''}
            {change.toFixed(3)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            État
          </p>
          <p className="mt-1">
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: getHealthStatusColor(currentStatus) }}
            >
              {formatHealthStatus(currentStatus)}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">Basé sur le NDVI</p>
        </div>
        <div className={`rounded-xl border p-3.5 ${conf.tone}`}>
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
            Confiance
          </p>
          <p className="mt-1 text-2xl font-bold">{conf.labelFr}</p>
          <p className="mt-1 text-xs opacity-80">{conf.detailFr}</p>
        </div>
      </div>

      {/* Index selector */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {ALL_INDICES.map((key) => {
            const meta = INDEX_META[key];
            const on = visible.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleIndex(key)}
                title={meta.labelFr}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition ${
                  on
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: on ? '#fff' : meta.color }}
                />
                <span>
                  {meta.short}
                  <span
                    className={`ml-1.5 font-normal ${
                      on ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    — {meta.labelFr}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500">
          {visible.length === 1
            ? 'Un indice · activez-en d’autres pour comparer'
            : `${visible.length} indices affichés`}
        </p>
      </div>

      {/* Band legend */}
      {singleIndex ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-medium text-gray-600">
            Seuils {INDEX_META[singleIndex].short} :
          </span>
          {bandLegend.map((b) => (
            <span
              key={b.label}
              className={`inline-flex rounded-full px-2.5 py-1 ${b.className}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-gray-500">
          Zones de seuils masquées en comparaison (échelles d&apos;interprétation
          différentes).
        </p>
      )}

      <p className="mb-4 text-sm leading-relaxed text-gray-700">
        {indexLegend}
        <span className="mt-1 block text-xs text-gray-500">
          {seasonCtx.labelFr} — {seasonCtx.hintFr}
        </span>
      </p>

      {/* Chart */}
      <div className="h-[26rem] w-full sm:h-[28rem] lg:h-[32rem]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
            onClick={handleChartClick}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical={false}
            />

            {bands.map((b) => (
              <ReferenceArea
                key={`${b.y1}-${b.y2}-${b.label}`}
                y1={b.y1}
                y2={b.y2}
                fill={b.fill}
                fillOpacity={b.fillOpacity}
                ifOverflow="extendDomain"
              />
            ))}

            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              angle={-35}
              textAnchor="end"
              height={56}
              interval={tickInterval}
            />

            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) =>
                Number(v).toLocaleString('fr-FR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              }
            />

            <Tooltip content={<CustomTooltip visible={visible} />} />

            <ReferenceLine
              y={0}
              stroke="#334155"
              strokeWidth={1.5}
              strokeOpacity={0.7}
            />

            {selectedDataPoint && (
              <ReferenceLine
                x={selectedDataPoint.dateLabel}
                stroke="#64748b"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="3 3"
              />
            )}

            {visible.includes('ndvi') && (
              <Line
                type="linear"
                dataKey="ndvi"
                name="NDVI"
                stroke={INDEX_META.ndvi.color}
                strokeWidth={visible.length === 1 ? 2.75 : 2.5}
                connectNulls={false}
                isAnimationActive={false}
                dot={renderNdviDot}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  stroke: 'white',
                  fill: INDEX_META.ndvi.color,
                }}
              />
            )}

            {visible.includes('evi') && (
              <Line
                type="linear"
                dataKey="evi"
                name="EVI"
                stroke={INDEX_META.evi.color}
                strokeWidth={visible[0] === 'evi' ? 2.5 : 1.75}
                strokeOpacity={visible[0] === 'evi' ? 1 : 0.75}
                strokeDasharray={INDEX_META.evi.dash}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ r: 3, strokeWidth: 1, stroke: '#fff', fill: INDEX_META.evi.color }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: INDEX_META.evi.color }}
              />
            )}

            {visible.includes('ndmi') && (
              <Line
                type="linear"
                dataKey="ndmi"
                name="NDMI"
                stroke={INDEX_META.ndmi.color}
                strokeWidth={visible[0] === 'ndmi' ? 2.5 : 1.75}
                strokeOpacity={visible[0] === 'ndmi' ? 1 : 0.7}
                strokeDasharray={INDEX_META.ndmi.dash}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ r: 3, strokeWidth: 1, stroke: '#fff', fill: INDEX_META.ndmi.color }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: INDEX_META.ndmi.color }}
              />
            )}

            {visible.includes('ndwi') && (
              <Line
                type="linear"
                dataKey="ndwi"
                name="NDWI"
                stroke={INDEX_META.ndwi.color}
                strokeWidth={visible[0] === 'ndwi' ? 2.5 : 1.75}
                strokeOpacity={visible[0] === 'ndwi' ? 1 : 0.7}
                strokeDasharray={INDEX_META.ndwi.dash}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ r: 3, strokeWidth: 1, stroke: '#fff', fill: INDEX_META.ndwi.color }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: INDEX_META.ndwi.color }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Significant changes timeline */}
      {showChangeMarkers && significantChangePoints.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertCircle className="h-4 w-4 text-slate-600" />
            Chronologie des variations NDVI ({significantChangePoints.length})
            {hasAcquisitionDates ? ' · dates de capture' : ''}
          </div>
          <ul className="space-y-2">
            {significantChangePoints.map((point) => {
              const delta = point.ndviDelta ?? 0;
              const info = classifyNdviDelta(delta);
              const tone =
                info.direction === 'down'
                  ? 'border-red-200 bg-white text-red-950'
                  : info.direction === 'up'
                    ? 'border-emerald-200 bg-white text-emerald-950'
                    : 'border-gray-200 bg-white text-gray-800';
              return (
                <li key={String(point.date)}>
                  <button
                    type="button"
                    onClick={() => onDateSelect?.(new Date(point.date))}
                    className={`flex w-full flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:shadow-sm ${tone}`}
                  >
                    <span className="font-medium">
                      {formatShortDate(
                        point.date,
                        looksMonthly && !hasAcquisitionDates
                      )}
                    </span>
                    <span className="font-semibold">
                      {info.labelFr}
                    </span>
                    <span className="tabular-nums font-medium">
                      {delta >= 0 ? '+' : ''}
                      {delta.toFixed(3)}
                    </span>
                    <span className="tabular-nums text-xs opacity-70">
                      NDVI {point.ndvi!.toFixed(3)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-slate-600">
            {hasAcquisitionDates
              ? 'Dates = jour de passage Sentinel-2. Variation absolue > 0,15 entre deux mesures consécutives.'
              : 'Dates de référence mensuelles. Relancez « Historique GEE » pour les vraies dates de capture.'}
          </p>
        </div>
      )}

      {/* Compact analysis */}
      <div
        className={`mt-4 rounded-xl border p-4 ${verdictTone(interpretation.verdict)}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
          Lecture rapide
        </p>
        <h4 className="mt-1 text-base font-semibold">{interpretation.title}</h4>
        <p className="mt-1 text-sm leading-relaxed opacity-90">
          {interpretation.summary}
        </p>
        <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium">
          Action : {interpretation.recommendation}
        </p>
      </div>

      {showSavi && avgSAVI != null && (
        <p className="mt-3 text-xs text-stone-600">
          SAVI (peuplement clair / jeune) : {avgSAVI.toFixed(3)} —{' '}
          {interpretSAVILevel(avgSAVI).labelFr}
          {avgEVI != null
            ? ` · Écart NDVI−EVI ${calculateNdviEviGap(avgNDVI, avgEVI)?.toFixed(3)}`
            : ''}
        </p>
      )}
    </div>
  );
}

export default TemporalDataChart;
