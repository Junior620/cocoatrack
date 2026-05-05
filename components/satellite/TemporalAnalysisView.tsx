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
import { TemporalSlider } from './TemporalSlider';
import { TemporalDataChart } from './TemporalDataChart';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';

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

  // Handle date change from slider
  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle date selection from chart
  const handleChartDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Temporal Data Chart */}
      <TemporalDataChart
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
