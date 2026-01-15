// CocoaTrack V2 - Web Vitals Reporter
// Task 8.11: Performance Optimization
// Validates: Requirements 13.3, 13.4, 13.5

'use client';

import { useEffect } from 'react';
import { reportWebVitals, PERFORMANCE_THRESHOLDS } from '@/lib/utils/performance';

/**
 * Get rating based on metric value and thresholds
 */
function getRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, { good: number; poor: number }> = {
    TTFB: { good: 200, poor: 400 },
    FCP: { good: 1800, poor: 3000 },
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    INP: { good: 200, poor: 500 },
  };

  const threshold = thresholds[name];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Web Vitals Reporter Component
 * Automatically reports Core Web Vitals metrics
 */
export function WebVitalsReporter() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Dynamic import of web-vitals library
    import('web-vitals').then(({ onCLS, onLCP, onTTFB, onINP, onFCP }) => {
      // Report each metric
      const reportMetric = (metric: { name: string; value: number; id: string }) => {
        reportWebVitals({
          id: metric.id,
          name: metric.name,
          value: metric.value,
          rating: getRating(metric.name, metric.value),
        });
      };

      onCLS(reportMetric);
      onLCP(reportMetric);
      onTTFB(reportMetric);
      onINP(reportMetric);
      onFCP(reportMetric);
    }).catch(() => {
      // web-vitals not available, use fallback
      measureBasicMetrics();
    });
  }, []);

  return null;
}

/**
 * Fallback metrics measurement when web-vitals is not available
 */
function measureBasicMetrics() {
  if (typeof window === 'undefined') return;

  // Measure TTFB
  const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigationEntry) {
    const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
    reportWebVitals({
      id: 'ttfb-fallback',
      name: 'TTFB',
      value: ttfb,
      rating: getRating('TTFB', ttfb),
    });
  }

  // Measure LCP using PerformanceObserver
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          reportWebVitals({
            id: 'lcp-fallback',
            name: 'LCP',
            value: lastEntry.startTime,
            rating: getRating('LCP', lastEntry.startTime),
          });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observation not supported
    }
  }
}

/**
 * Performance Dashboard Component (for development)
 */
export function PerformanceDebugger() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="font-bold mb-2">Performance Targets</div>
      <div>TTFB: &lt; {PERFORMANCE_THRESHOLDS.TTFB}ms</div>
      <div>LCP: &lt; {PERFORMANCE_THRESHOLDS.LCP}ms</div>
      <div>FID: &lt; {PERFORMANCE_THRESHOLDS.FID}ms</div>
      <div>CLS: &lt; {PERFORMANCE_THRESHOLDS.CLS}</div>
      <div>Lighthouse: &gt; {PERFORMANCE_THRESHOLDS.LIGHTHOUSE_SCORE}</div>
    </div>
  );
}

export default WebVitalsReporter;
