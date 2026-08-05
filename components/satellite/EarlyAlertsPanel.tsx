'use client';

/**
 * Coop panel: single « à voir cette semaine » visit-priority queue.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Droplets,
  Leaf,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type EarlyAlertItem = {
  parcelleId: string;
  code: string | null;
  label: string | null;
  village: string | null;
  eviLevel: string;
  ndmiLevel: string;
  ndwiLevel: string;
  saviLevel?: string;
  ndreLevel?: string;
  combinedCode: string;
  combinedLevel: string;
  visitPriority: string;
  visitScore?: number;
  visitReasons?: string[];
  messageFr: string;
  meanNDVI: number | null;
  meanEVI: number | null;
  meanNDMI: number | null;
  meanNDWI: number | null;
  meanSAVI?: number | null;
  meanNDRE?: number | null;
  imageryQuality?: string | null;
};

type EarlyAlertsPayload = {
  season: { labelFr: string; hintFr: string; season: string };
  alerts: EarlyAlertItem[];
  scanned: number;
  counts: {
    alert: number;
    watch: number;
    combined: number;
    hydric: number;
    canopy: number;
    surfaceWet: number;
    savi?: number;
    ndre?: number;
    visitsHigh?: number;
  };
};

type FilterType =
  | 'visits'
  | 'any'
  | 'ndmi'
  | 'evi'
  | 'ndwi'
  | 'savi'
  | 'ndre'
  | 'combined';

export function EarlyAlertsPanel({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EarlyAlertsPayload | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('visits');
  const [level, setLevel] = useState<'any' | 'alert'>('any');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: filterType,
        level,
        limit: '150',
      });
      const res = await fetch(`/api/satellite/early-alerts?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Impossible de charger les alertes');
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erreur');
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filterType, level]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const exportCsv = () => {
    const params = new URLSearchParams({
      type: filterType,
      level,
      limit: '300',
    });
    window.open(`/api/satellite/early-alerts/export?${params}`, '_blank');
  };

  return (
    <div
      className={`rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            À voir cette semaine
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            File unique : double signal EVI∩NDMI, eau de surface, jeunes (SAVI),
            chlorophylle (NDRE).
            {data?.season ? (
              <span className="mt-1 block text-xs text-amber-900/80">
                {data.season.labelFr} — {data.season.hintFr}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={fetchAlerts}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualiser
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['visits', 'File visite'],
            ['any', 'Toutes'],
            ['combined', 'Double signal'],
            ['ndmi', 'Hydrique'],
            ['evi', 'Canopée'],
            ['ndwi', 'Surface'],
            ['savi', 'Jeunes'],
            ['ndre', 'NDRE'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilterType(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === value
                ? 'bg-amber-700 text-white'
                : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLevel((l) => (l === 'any' ? 'alert' : 'any'))}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            level === 'alert'
              ? 'bg-orange-700 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          {level === 'alert' ? 'Priorité haute' : 'Toutes priorités'}
        </button>
      </div>

      {data && !loading && (
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-900">
            {data.counts.visitsHigh ?? data.counts.alert} priorité haute
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
            {data.counts.watch} surveillance
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-amber-950 border border-amber-200">
            <Droplets className="h-3 w-3" /> {data.counts.hydric} hydrique
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sky-950 border border-sky-200">
            <Leaf className="h-3 w-3" /> {data.counts.canopy} canopée
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-cyan-950 border border-cyan-200">
            <Droplets className="h-3 w-3" /> {data.counts.surfaceWet ?? 0} surface
          </span>
          {(data.counts.savi ?? 0) > 0 && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-800 border border-stone-200">
              {data.counts.savi} SAVI
            </span>
          )}
          <span className="rounded-full bg-white px-2.5 py-1 text-gray-600 border border-gray-200">
            {data.scanned} parcelles scannées
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Priorisation des visites…
        </div>
      )}

      {!loading && data && data.alerts.length === 0 && (
        <p className="text-sm text-gray-600">
          Aucune parcelle à prioriser cette semaine. Complétez Historique GEE
          ou renseignez année / densité de plantation.
        </p>
      )}

      {data && data.alerts.length > 0 && (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {data.alerts.slice(0, 40).map((a) => (
            <li key={a.parcelleId}>
              <Link
                href={`/parcelles/${a.parcelleId}`}
                className="flex gap-3 rounded-lg border border-amber-100 bg-white/80 px-3 py-2.5 transition-colors hover:border-amber-300 hover:bg-white"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    a.visitPriority === 'high'
                      ? 'text-orange-600'
                      : 'text-amber-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {a.code || a.label || a.parcelleId.slice(0, 8)}
                    </span>
                    {a.village && (
                      <span className="text-xs text-gray-500">{a.village}</span>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        a.visitPriority === 'high'
                          ? 'bg-orange-100 text-orange-900'
                          : a.visitPriority === 'medium'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {a.visitPriority}
                      {a.visitScore != null ? ` · ${a.visitScore}` : ''}
                    </span>
                    {a.combinedCode === 'canopy_and_hydric' && (
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-orange-900">
                        Double
                      </span>
                    )}
                    {a.ndmiLevel !== 'none' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                        NDMI {a.ndmiLevel}
                      </span>
                    )}
                    {a.ndwiLevel && a.ndwiLevel !== 'none' && (
                      <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-900">
                        NDWI {a.ndwiLevel}
                      </span>
                    )}
                    {a.saviLevel && a.saviLevel !== 'none' && (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-800">
                        SAVI {a.saviLevel}
                      </span>
                    )}
                    {a.ndreLevel && a.ndreLevel !== 'none' && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-900">
                        NDRE {a.ndreLevel}
                      </span>
                    )}
                    {a.eviLevel !== 'none' && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                        EVI {a.eviLevel}
                      </span>
                    )}
                    {a.imageryQuality === 'degraded' && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
                        Image dégradée
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                    {a.messageFr}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-gray-500">
                    NDVI {a.meanNDVI?.toFixed(3) ?? '—'}
                    {a.meanEVI != null ? ` · EVI ${a.meanEVI.toFixed(3)}` : ''}
                    {a.meanNDMI != null
                      ? ` · NDMI ${a.meanNDMI.toFixed(3)}`
                      : ''}
                    {a.meanNDWI != null
                      ? ` · NDWI ${a.meanNDWI.toFixed(3)}`
                      : ''}
                    {a.meanSAVI != null
                      ? ` · SAVI ${a.meanSAVI.toFixed(3)}`
                      : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
