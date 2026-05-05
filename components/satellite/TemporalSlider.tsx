'use client';

/**
 * TemporalSlider Component
 * 
 * Interactive timeline slider for viewing historical satellite imagery and NDVI data.
 * Allows users to navigate through time, view temporal changes, and identify significant
 * vegetation changes.
 * 
 * Features:
 * - Interactive slider with date markers
 * - Play/pause animation for automatic date progression
 * - Cloud cover percentage display for each date
 * - Highlighting of dates with significant NDVI changes (>0.15)
 * - Keyboard navigation support (arrow keys, space bar, home/end)
 * - Touch gesture support for mobile devices:
 *   - Swipe left/right for date navigation
 *   - Pinch gesture detection (reserved for future zoom functionality)
 *   - Larger touch targets for better mobile usability
 * - Loading and error states
 * - Responsive design for mobile and desktop
 * 
 * Requirements: Task 3.3.1, Task 3.3.2, Task 3.3.3
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Loader2, AlertCircle } from 'lucide-react';
import type { TemporalDataPoint } from '@/lib/satellite/types';

/**
 * Touch gesture configuration
 */
const SWIPE_THRESHOLD = 50; // Minimum distance in pixels to trigger a swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity (px/ms) to trigger a swipe
const PINCH_THRESHOLD = 20; // Minimum distance change to trigger pinch zoom

export interface TemporalSliderProps {
  /** ID of the parcelle to display temporal data for */
  parcelleId: string;
  /** Start date of the temporal range */
  startDate: Date;
  /** End date of the temporal range */
  endDate: Date;
  /** Time interval for data points */
  interval: 'daily' | 'weekly' | 'monthly';
  /** Callback when the selected date changes */
  onDateChange: (date: Date) => void;
  /** Whether to highlight dates with significant changes (default: true) */
  highlightChanges?: boolean;
  /** Animation speed in milliseconds (default: 1000) */
  animationSpeed?: number;
  /** Custom class name */
  className?: string;
}

interface TemporalSliderState {
  timeline: TemporalDataPoint[];
  loading: boolean;
  error: Error | null;
  selectedIndex: number;
  isPlaying: boolean;
}

/**
 * Touch gesture state for tracking swipe and pinch gestures
 */
interface TouchGestureState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
  initialDistance: number | null; // For pinch gestures
}

export function TemporalSlider({
  parcelleId,
  startDate,
  endDate,
  interval,
  onDateChange,
  highlightChanges = true,
  animationSpeed = 1000,
  className = '',
}: TemporalSliderProps) {
  const [state, setState] = useState<TemporalSliderState>({
    timeline: [],
    loading: false,
    error: null,
    selectedIndex: 0,
    isPlaying: false,
  });

  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<TouchGestureState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    isSwiping: false,
    initialDistance: null,
  });

  // Fetch temporal data
  const fetchTemporalData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({
        parcelleId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        interval,
      });

      const response = await fetch(`/api/satellite/temporal?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch temporal data: ${response.statusText}`
        );
      }

      const data = await response.json();
      const timeline: TemporalDataPoint[] = data.data.summary.timeline.map(
        (point: any) => ({
          date: new Date(point.date),
          ndvi: point.ndvi,
          cloudCover: point.cloudCover,
          healthStatus: point.healthStatus,
          hasSignificantChange: point.hasSignificantChange,
        })
      );

      setState(prev => ({
        ...prev,
        timeline,
        loading: false,
        error: null,
        selectedIndex: timeline.length > 0 ? timeline.length - 1 : 0, // Start at most recent
      }));

      // Notify parent of initial date
      if (timeline.length > 0) {
        onDateChange(timeline[timeline.length - 1].date);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      setState(prev => ({
        ...prev,
        timeline: [],
        loading: false,
        error: err,
      }));
    }
  }, [parcelleId, startDate, endDate, interval, onDateChange]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (parcelleId) {
      fetchTemporalData();
    }
  }, [parcelleId, startDate, endDate, interval, fetchTemporalData]);

  // Handle date selection
  const handleDateSelect = useCallback(
    (index: number) => {
      if (index >= 0 && index < state.timeline.length) {
        setState(prev => ({ ...prev, selectedIndex: index }));
        onDateChange(state.timeline[index].date);
      }
    },
    [state.timeline, onDateChange]
  );

  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  // Handle animation
  useEffect(() => {
    if (state.isPlaying && state.timeline.length > 0) {
      animationIntervalRef.current = setInterval(() => {
        setState(prev => {
          const nextIndex = prev.selectedIndex + 1;
          if (nextIndex >= prev.timeline.length) {
            // Stop at the end
            return { ...prev, isPlaying: false, selectedIndex: prev.timeline.length - 1 };
          }
          onDateChange(prev.timeline[nextIndex].date);
          return { ...prev, selectedIndex: nextIndex };
        });
      }, animationSpeed);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [state.isPlaying, state.timeline, animationSpeed, onDateChange]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!sliderRef.current?.contains(document.activeElement)) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handleDateSelect(state.selectedIndex - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleDateSelect(state.selectedIndex + 1);
          break;
        case ' ':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'Home':
          event.preventDefault();
          handleDateSelect(0);
          break;
        case 'End':
          event.preventDefault();
          handleDateSelect(state.timeline.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedIndex, state.timeline.length, handleDateSelect, togglePlayPause]);

  // Handle skip to start
  const skipToStart = useCallback(() => {
    handleDateSelect(0);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [handleDateSelect]);

  // Handle skip to end
  const skipToEnd = useCallback(() => {
    handleDateSelect(state.timeline.length - 1);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [state.timeline.length, handleDateSelect]);

  // Calculate distance between two touch points (for pinch gestures)
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const now = Date.now();

    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isSwiping: false,
      initialDistance: event.touches.length === 2 
        ? getTouchDistance(event.touches[0] as any, event.touches[1] as any)
        : null,
    };
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      // Single touch - swipe gesture
      const touch = event.touches[0];
      touchStateRef.current.currentX = touch.clientX;
      touchStateRef.current.currentY = touch.clientY;

      const deltaX = Math.abs(touch.clientX - touchStateRef.current.startX);
      const deltaY = Math.abs(touch.clientY - touchStateRef.current.startY);

      // Detect horizontal swipe (more horizontal than vertical movement)
      if (deltaX > deltaY && deltaX > 10) {
        touchStateRef.current.isSwiping = true;
        // Prevent default to avoid scrolling while swiping
        event.preventDefault();
      }
    } else if (event.touches.length === 2 && touchStateRef.current.initialDistance !== null) {
      // Two touches - pinch gesture (for potential zoom functionality)
      const currentDistance = getTouchDistance(event.touches[0] as any, event.touches[1] as any);
      const distanceChange = Math.abs(currentDistance - touchStateRef.current.initialDistance);

      if (distanceChange > PINCH_THRESHOLD) {
        // Pinch detected - could be used for zooming timeline view
        // For now, we'll just prevent default behavior
        event.preventDefault();
      }
    }
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!touchStateRef.current.isSwiping) {
      return;
    }

    const deltaX = touchStateRef.current.currentX - touchStateRef.current.startX;
    const deltaY = touchStateRef.current.currentY - touchStateRef.current.startY;
    const deltaTime = Date.now() - touchStateRef.current.startTime;
    const velocity = Math.abs(deltaX) / deltaTime;

    // Check if swipe meets threshold requirements
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      if (deltaX > 0) {
        // Swipe right - go to previous date
        handleDateSelect(state.selectedIndex - 1);
      } else {
        // Swipe left - go to next date
        handleDateSelect(state.selectedIndex + 1);
      }
    }

    // Reset touch state
    touchStateRef.current.isSwiping = false;
    touchStateRef.current.initialDistance = null;
  }, [state.selectedIndex, handleDateSelect]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Get health status color
  const getHealthStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      excellent: '#2d5016',
      good: '#6FAF3D',
      fair: '#fbbf24',
      poor: '#E68A1F',
      critical: '#ef4444',
    };
    return colorMap[status] || '#9ca3af';
  };

  // Calculate slider position percentage
  const getSliderPosition = (): number => {
    if (state.timeline.length === 0) return 0;
    return (state.selectedIndex / (state.timeline.length - 1)) * 100;
  };

  const currentDataPoint = state.timeline[state.selectedIndex];

  return (
    <div
      ref={sliderRef}
      className={`temporal-slider rounded-lg bg-white p-4 shadow-lg ${className}`}
      tabIndex={0}
      role="region"
      aria-label="Temporal slider for satellite imagery"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Loading State */}
      {state.loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            <p className="text-sm font-medium text-gray-700">
              Chargement des données temporelles...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.error && !state.loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900">
                Erreur de chargement
              </h4>
              <p className="mt-1 text-sm text-red-700">{state.error.message}</p>
              <button
                onClick={fetchTemporalData}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slider Content */}
      {!state.loading && !state.error && state.timeline.length > 0 && (
        <>
          {/* Current Date and Info Display */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                {formatDate(currentDataPoint.date)}
              </h4>
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                <span>
                  NDVI: <span className="font-medium">{currentDataPoint.ndvi.toFixed(3)}</span>
                </span>
                <span>
                  Nuages: <span className="font-medium">{currentDataPoint.cloudCover.toFixed(0)}%</span>
                </span>
                <div
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: getHealthStatusColor(currentDataPoint.healthStatus) }}
                >
                  {currentDataPoint.healthStatus === 'excellent' && 'Excellent'}
                  {currentDataPoint.healthStatus === 'good' && 'Bon'}
                  {currentDataPoint.healthStatus === 'fair' && 'Moyen'}
                  {currentDataPoint.healthStatus === 'poor' && 'Faible'}
                  {currentDataPoint.healthStatus === 'critical' && 'Critique'}
                </div>
              </div>
            </div>

            {/* Significant Change Indicator */}
            {highlightChanges && currentDataPoint.hasSignificantChange && (
              <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
                <AlertCircle className="h-4 w-4" />
                <span>Changement significatif</span>
              </div>
            )}
          </div>

          {/* Slider Track */}
          <div className="relative mb-4">
            {/* Track Background - Increased height for better touch targets */}
            <div className="relative h-3 rounded-full bg-gray-200 md:h-2">
              {/* Progress Fill */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-green-600 transition-all duration-200"
                style={{ width: `${getSliderPosition()}%` }}
              />

              {/* Date Markers */}
              <div className="absolute inset-0">
                {state.timeline.map((point, index) => {
                  const position = (index / (state.timeline.length - 1)) * 100;
                  const isSelected = index === state.selectedIndex;
                  const isSignificant = highlightChanges && point.hasSignificantChange;

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(index)}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transform touch-manipulation focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      style={{ left: `${position}%` }}
                      aria-label={`Select date ${formatDate(point.date)}`}
                    >
                      <div
                        className={`
                          h-5 w-5 rounded-full border-2 transition-all md:h-4 md:w-4
                          ${isSelected ? 'border-green-600 bg-white shadow-lg' : 'border-white bg-gray-400'}
                          ${isSignificant && !isSelected ? 'border-orange-500 bg-orange-400' : ''}
                          hover:scale-125 active:scale-110
                        `}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Range Input (for accessibility and touch support) */}
            <input
              type="range"
              min={0}
              max={state.timeline.length - 1}
              value={state.selectedIndex}
              onChange={(e) => handleDateSelect(parseInt(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer touch-manipulation opacity-0"
              aria-label="Temporal slider"
            />
          </div>

          {/* Control Buttons - Larger touch targets on mobile */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={skipToStart}
              disabled={state.selectedIndex === 0}
              className="touch-manipulation rounded-lg border border-gray-300 bg-white p-3 text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 md:p-2"
              aria-label="Skip to start"
            >
              <SkipBack className="h-5 w-5 md:h-4 md:w-4" />
            </button>

            <button
              onClick={togglePlayPause}
              className="touch-manipulation rounded-lg bg-green-600 p-3 text-white transition-colors hover:bg-green-700 active:bg-green-800 md:p-2"
              aria-label={state.isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {state.isPlaying ? (
                <Pause className="h-5 w-5 md:h-4 md:w-4" />
              ) : (
                <Play className="h-5 w-5 md:h-4 md:w-4" />
              )}
            </button>

            <button
              onClick={skipToEnd}
              disabled={state.selectedIndex === state.timeline.length - 1}
              className="touch-manipulation rounded-lg border border-gray-300 bg-white p-3 text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 md:p-2"
              aria-label="Skip to end"
            >
              <SkipForward className="h-5 w-5 md:h-4 md:w-4" />
            </button>
          </div>

          {/* Timeline Info */}
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-600">
            <span>
              {state.selectedIndex + 1} / {state.timeline.length} dates
            </span>
            <span>
              {formatDate(state.timeline[0].date)} - {formatDate(state.timeline[state.timeline.length - 1].date)}
            </span>
          </div>

          {/* Keyboard Shortcuts and Touch Gestures Help */}
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700">Raccourcis:</p>
            <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
              {/* Desktop shortcuts */}
              <div className="hidden md:block">
                <span className="block">← → : Navigation</span>
                <span className="block">Espace : Lecture/Pause</span>
              </div>
              <div className="hidden md:block">
                <span className="block">Home : Début</span>
                <span className="block">End : Fin</span>
              </div>
              {/* Mobile gestures */}
              <div className="md:hidden">
                <span className="block">👆 Glisser : Navigation</span>
                <span className="block">👉 Glisser droite : Date précédente</span>
              </div>
              <div className="md:hidden">
                <span className="block">👈 Glisser gauche : Date suivante</span>
                <span className="block">👇 Appuyer : Sélectionner date</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Data State */}
      {!state.loading && !state.error && state.timeline.length === 0 && (
        <div className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Aucune donnée temporelle disponible
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Essayez de modifier la plage de dates ou l'intervalle
          </p>
        </div>
      )}
    </div>
  );
}

export default TemporalSlider;
