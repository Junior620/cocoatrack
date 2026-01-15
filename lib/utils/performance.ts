// CocoaTrack V2 - Performance Monitoring Utilities
// Task 8.11: Performance Optimization
// Validates: Requirements 13.3, 13.4, 13.5

/**
 * Web Vitals metrics
 */
export interface WebVitals {
  TTFB: number; // Time to First Byte (target < 200ms)
  FCP: number; // First Contentful Paint
  LCP: number; // Largest Contentful Paint (target < 2.5s)
  FID: number; // First Input Delay
  CLS: number; // Cumulative Layout Shift
  INP: number; // Interaction to Next Paint
}

/**
 * Performance thresholds based on requirements
 */
export const PERFORMANCE_THRESHOLDS = {
  TTFB: 200, // ms
  LCP: 2500, // ms
  FID: 100, // ms
  CLS: 0.1, // score
  INP: 200, // ms
  LIGHTHOUSE_SCORE: 90, // target > 90
};

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
  }

  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // @ts-expect-error Sentry may not be defined
    if (window.Sentry) {
      // @ts-expect-error Sentry may not be defined
      window.Sentry.captureMessage(`Web Vital: ${metric.name}`, {
        level: metric.rating === 'poor' ? 'warning' : 'info',
        extra: {
          metricId: metric.id,
          metricName: metric.name,
          metricValue: metric.value,
          metricRating: metric.rating,
        },
      });
    }
  }

  // Send to analytics endpoint
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
    fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web-vital',
        ...metric,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
      }),
    }).catch(() => {
      // Silently fail - don't block user experience
    });
  }
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string) {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Render Time] ${componentName}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Request idle callback polyfill
 */
export function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }

  // Fallback for browsers that don't support requestIdleCallback
  const start = Date.now();
  return globalThis.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallback(handle: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Defer non-critical work to idle time
 */
export function deferToIdle<T>(
  work: () => T,
  timeout = 2000
): Promise<T> {
  return new Promise((resolve) => {
    requestIdleCallback(
      () => {
        resolve(work());
      },
      { timeout }
    );
  });
}

/**
 * Batch DOM updates for better performance
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
  if (typeof window === 'undefined') return;

  requestAnimationFrame(() => {
    updates.forEach((update) => update());
  });
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number } | null {
  if (typeof window === 'undefined') return null;

  // @ts-expect-error performance.memory is non-standard
  const memory = performance.memory;
  if (!memory) return null;

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
  };
}

/**
 * Check if device has reduced motion preference
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if device is on slow connection
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!connection) return false;

  const slowTypes = ['slow-2g', '2g', '3g'];
  return slowTypes.includes(connection.effectiveType || '');
}

/**
 * Check if device should save data
 */
export function shouldSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Adaptive loading based on device capabilities
 */
export function getLoadingStrategy(): 'eager' | 'lazy' | 'minimal' {
  if (shouldSaveData() || isSlowConnection()) {
    return 'minimal';
  }

  if (prefersReducedMotion()) {
    return 'lazy';
  }

  return 'eager';
}

/**
 * Performance observer for long tasks
 */
export function observeLongTasks(callback: (duration: number) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry.duration);
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}

/**
 * Measure time to interactive
 */
export function measureTTI(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(0);
      return;
    }

    // Wait for load event
    if (document.readyState === 'complete') {
      resolve(performance.now());
    } else {
      window.addEventListener('load', () => {
        // Add small delay to account for post-load scripts
        setTimeout(() => {
          resolve(performance.now());
        }, 100);
      });
    }
  });
}
