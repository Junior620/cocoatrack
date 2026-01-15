'use client';

// CocoaTrack V2 - LazyMapContainer Component
// Task 24.1: Implement map lazy loading
// Validates: Requirements REQ-PERF-005
// Loads Leaflet/Mapbox only when map is visible using IntersectionObserver

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MapSkeleton } from '@/lib/utils/lazy-load';

export interface LazyMapContainerProps {
  /** The map component to render when visible */
  children: ReactNode;
  /** Height of the container */
  height?: string;
  /** Additional CSS classes */
  className?: string;
  /** Root margin for IntersectionObserver (load before fully visible) */
  rootMargin?: string;
  /** Threshold for IntersectionObserver */
  threshold?: number;
  /** Custom placeholder component */
  placeholder?: ReactNode;
  /** Callback when map becomes visible */
  onVisible?: () => void;
  /** Force load immediately (bypass lazy loading) */
  forceLoad?: boolean;
}

/**
 * LazyMapContainer - Wrapper component that lazy loads map content
 * 
 * Uses IntersectionObserver to detect when the container is visible
 * and only then renders the actual map component (Leaflet/Mapbox).
 * This significantly reduces initial bundle size and improves FCP.
 * 
 * Features:
 * - IntersectionObserver-based visibility detection
 * - Configurable root margin for preloading
 * - Custom placeholder support
 * - Graceful fallback for browsers without IntersectionObserver
 * - Once loaded, stays loaded (no unloading on scroll)
 */
export function LazyMapContainer({
  children,
  height = '400px',
  className = '',
  rootMargin = '100px',
  threshold = 0.1,
  placeholder,
  onVisible,
  forceLoad = false,
}: LazyMapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(forceLoad);
  const [hasBeenVisible, setHasBeenVisible] = useState(forceLoad);

  // Handle visibility change
  const handleVisibilityChange = useCallback((visible: boolean) => {
    if (visible && !hasBeenVisible) {
      setIsVisible(true);
      setHasBeenVisible(true);
      onVisible?.();
    }
  }, [hasBeenVisible, onVisible]);

  useEffect(() => {
    // Skip if already loaded or force load is enabled
    if (hasBeenVisible || forceLoad) return;

    const element = containerRef.current;
    if (!element) return;

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load immediately for browsers without IntersectionObserver
      handleVisibilityChange(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            handleVisibilityChange(true);
            // Once visible, stop observing
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [hasBeenVisible, forceLoad, rootMargin, threshold, handleVisibilityChange]);

  // Default placeholder with map icon
  const defaultPlaceholder = (
    <div 
      className="flex h-full w-full items-center justify-center bg-gray-100 rounded-lg"
      style={{ minHeight: height }}
    >
      <div className="text-center">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-sm text-gray-500">Chargement de la carte...</p>
        <p className="text-xs text-gray-400 mt-1">Faites défiler pour afficher</p>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ height, minHeight: height }}
    >
      {isVisible ? (
        children
      ) : (
        placeholder || defaultPlaceholder
      )}
    </div>
  );
}

export default LazyMapContainer;
