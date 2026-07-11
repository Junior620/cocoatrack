'use client';

/**
 * TemporalAnalysisView Component
 * 
 * Integrated view combining TemporalSlider and TemporalDataChart for comprehensive
 * temporal NDVI analysis. This component demonstrates the integration of Task 3.3.1-3.3.4.
 * 
 * Features:
 * - Synchronized temporal slider and chart
 * - Shared state management for selected date
 * - Coordinated data fetching
 * - Responsive layout for mobile and desktop
 * 
 * Usage Example:
 * ```tsx
 * <TemporalAnalysisView
 *   parcelleId="123e4567-e89b-12d3-a456-426614174000"
 *   startDate={new Date('2023-01-01')}
 *   endDate={new Date('2024-01-01')}
 * />
 * ```
 */

import { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { TemporalSlider } from './TemporalSlider';
import { TemporalDataChart } from './TemporalDataChart';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';

// ============================================================================
// Backfill helper, calls POST /api/satellite/ndvi/backfill
// ============================================================================

interface BackfillResult {
  calculated: number;
  skipped: number;
  failed: number;
  errors?: Array<{ date: string; reason: string }>;
}

async function runBackfill(parcelleId: string, months: number): Promise<BackfillResult> {
  const res = await fetch('/api/satellite/ndvi/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parcelleId, months, forceRecalculate: false }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data as BackfillResult;
}

export interface TemporalAnalysisViewProps {
  /** ID of the parcelle to analyze */
  parcelleId: string;
  /** Start date of the temporal range */
  startDate: Date;
  /** End date of the temporal range */
  endDate: Date;
  /** Time interval for data points (default: 'monthly') */
  interval?: 'daily' | 'weekly' | 'monthly';
  /** Custom class name */
  className?: string;
}

/**
 * TemporalAnalysisView Component
 * 
 * Provides an integrated temporal analysis interface with synchronized slider and chart.
 */
export function TemporalAnalysisView({
  parcelleId,
  startDate,
  endDate,
  interval = 'monthly',
  className = '',
}: TemporalAnalysisViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(endDate);
  const [timeline, setTimeline] = useState<TemporalDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Backfill state
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [chartKey, setChartKey] = useState(0); // force chart refresh after backfill

  // Handle date change from slider
  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle date selection from chart
  const handleChartDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle backfill from GEE
  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillError(null);

    try {
      const months = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const result = await runBackfill(parcelleId, Math.max(1, Math.min(months, 24)));
      setBackfillResult(result);
      // Force chart to re-fetch data
      setChartKey(k => k + 1);
    } catch (err) {
      setBackfillError((err as Error).message);
    } finally {
      setBackfilling(false);
    }
  }, [parcelleId, startDate, endDate]);

  return (
    <div className={`space-y-6 ${className}`}>

      {/* ── Backfill banner ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">
            Charger l'historique depuis Google Earth Engine
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Récupère les données NDVI réelles des 12 derniers mois depuis les archives Sentinel-2.
          </p>
        </div>

        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {backfilling ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Chargement en cours…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Charger l'historique GEE
            </>
          )}
        </button>
      </div>

      {/* Backfill result */}
      {backfillResult && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p>
            Terminé, {backfillResult.calculated} mois calculés
            {backfillResult.skipped > 0 && `, ${backfillResult.skipped} déjà présents`}
            {backfillResult.failed > 0 && (
              <span className="text-amber-700"> · {backfillResult.failed} mois sans image disponible</span>
            )}
          </p>
        </div>
      )}

      {/* Backfill error */}
      {backfillError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <p>Erreur : {backfillError}</p>
        </div>
      )}

      {/* Temporal Data Chart */}
      <TemporalDataChart
        key={chartKey}
        timeline={timeline}
        selectedDate={selectedDate}
        parcelleId={parcelleId}
        startDate={startDate}
        endDate={endDate}
        onDateSelect={handleChartDateSelect}
        showChangeMarkers={true}
        loading={loading}
        error={error}
      />

      {/* Temporal Slider */}
      <TemporalSlider
        parcelleId={parcelleId}
        startDate={startDate}
        endDate={endDate}
        interval={interval}
        onDateChange={handleDateChange}
        highlightChanges={true}
      />

      {/* Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="text-sm font-semibold text-blue-900">
          Comment utiliser l'analyse temporelle
        </h4>
        <ul className="mt-2 space-y-1 text-xs text-blue-700">
          <li>
            • Utilisez le curseur pour naviguer entre les dates disponibles
          </li>
          <li>
            • Cliquez sur le graphique pour sélectionner une date spécifique
          </li>
          <li>
            • Les marqueurs orange indiquent des changements significatifs (NDVI &gt; 0.15)
          </li>
          <li>
            • La ligne verticale verte montre la date actuellement sélectionnée
          </li>
          <li>
            • Survolez les points du graphique pour voir les détails
          </li>
        </ul>
      </div>
    </div>
  );
}

export default TemporalAnalysisView;
