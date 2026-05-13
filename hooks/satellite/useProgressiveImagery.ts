/**
 * useProgressiveImagery Hook
 * 
 * Task 6.4.1: Optimize imagery loading
 * 
 * Custom React hook for progressive satellite imagery loading.
 * Implements:
 * - Progressive loading (preview → standard → high quality)
 * - Lazy loading with Intersection Observer
 * - WebP format with JPEG fallback
 * - Loading state management
 * 
 * Validates: Requirements 1.1, 1.5, 11.1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  generateProgressiveUrls,
  createLazyLoadObserver,
  preloadImage,
  supportsWebP,
  estimateProgressiveSizes,
  DEFAULT_PROGRESSIVE_CONFIG,
  DEFAULT_LAZY_LOAD_OPTIONS,
  type ProgressiveLoadConfig,
  type LazyLoadOptions,
  type ImageQuality,
} from '@/lib/satellite/utils/imagery-optimization';

// ============================================================================
// Types
// ============================================================================

/**
 * Progressive imagery loading state
 */
export interface ProgressiveImageryState {
  /** Current quality level loaded */
  currentQuality: ImageQuality | null;
  /** Current image URL */
  currentUrl: string | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether imagery is in viewport (for lazy loading) */
  isVisible: boolean;
  /** WebP support status */
  webpSupported: boolean;
  /** Estimated file sizes */
  estimatedSizes: {
    preview: number;
    standard: number;
    high: number;
  } | null;
}

/**
 * Hook options
 */
export interface UseProgressiveImageryOptions {
  /** Base imagery URL */
  baseUrl: string;
  /** Progressive loading configuration */
  progressiveConfig?: Partial<ProgressiveLoadConfig>;
  /** Lazy loading configuration */
  lazyLoadOptions?: LazyLoadOptions;
  /** Enable lazy loading */
  enableLazyLoad?: boolean;
  /** Estimated original file size (for size estimation) */
  estimatedOriginalSize?: number;
  /** Callback when quality level changes */
  onQualityChange?: (quality: ImageQuality) => void;
  /** Callback when loading completes */
  onLoadComplete?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
export interface UseProgressiveImageryReturn extends ProgressiveImageryState {
  /** Ref to attach to the image container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Manually trigger loading (bypasses lazy loading) */
  load: () => void;
  /** Retry loading after error */
  retry: () => void;
  /** Reset to initial state */
  reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for progressive satellite imagery loading
 * 
 * @param options - Hook configuration options
 * @returns Progressive imagery state and controls
 * 
 * @example
 * ```typescript
 * function ImageryComponent({ parcelleId, imageryUrl }) {
 *   const {
 *     containerRef,
 *     currentUrl,
 *     currentQuality,
 *     loading,
 *     error,
 *     retry,
 *   } = useProgressiveImagery({
 *     baseUrl: imageryUrl,
 *     enableLazyLoad: true,
 *     onQualityChange: (quality) => {
 *       console.log('Loaded quality:', quality);
 *     },
 *   });
 * 
 *   return (
 *     <div ref={containerRef}>
 *       {loading && <LoadingSpinner />}
 *       {error && <ErrorMessage onRetry={retry} />}
 *       {currentUrl && (
 *         <img src={currentUrl} alt="Satellite imagery" />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useProgressiveImagery(
  options: UseProgressiveImageryOptions
): UseProgressiveImageryReturn {
  const {
    baseUrl,
    progressiveConfig = {},
    lazyLoadOptions = {},
    enableLazyLoad = true,
    estimatedOriginalSize,
    onQualityChange,
    onLoadComplete,
    onError,
  } = options;

  // Merge configurations with defaults
  const config: ProgressiveLoadConfig = {
    ...DEFAULT_PROGRESSIVE_CONFIG,
    ...progressiveConfig,
  };

  const lazyOptions: LazyLoadOptions = {
    ...DEFAULT_LAZY_LOAD_OPTIONS,
    ...lazyLoadOptions,
  };

  // State
  const [state, setState] = useState<ProgressiveImageryState>({
    currentQuality: null,
    currentUrl: null,
    loading: false,
    error: null,
    isVisible: !enableLazyLoad, // If lazy load disabled, consider visible
    webpSupported: false,
    estimatedSizes: null,
  });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Check WebP support on mount
  useEffect(() => {
    supportsWebP().then((supported) => {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, webpSupported: supported }));
      }
    });
  }, []);

  // Calculate estimated sizes
  useEffect(() => {
    if (estimatedOriginalSize) {
      const sizes = estimateProgressiveSizes(estimatedOriginalSize, config);
      setState((prev) => ({ ...prev, estimatedSizes: sizes }));
    }
  }, [estimatedOriginalSize, config]);

  /**
   * Load a specific quality level
   */
  const loadQuality = useCallback(
    async (quality: ImageQuality, url: string) => {
      if (!mountedRef.current || loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Preload the image
        await preloadImage(url);

        if (!mountedRef.current) {
          return;
        }

        // Update state with loaded image
        setState((prev) => ({
          ...prev,
          currentQuality: quality,
          currentUrl: url,
          loading: false,
          error: null,
        }));

        // Notify callback
        if (onQualityChange) {
          onQualityChange(quality);
        }

        // If this is the high quality, loading is complete
        if (quality === 'high' && onLoadComplete) {
          onLoadComplete();
        }
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        const err = error instanceof Error ? error : new Error('Failed to load imagery');
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err,
        }));

        if (onError) {
          onError(err);
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [onQualityChange, onLoadComplete, onError]
  );

  /**
   * Load imagery progressively
   */
  const loadProgressive = useCallback(async () => {
    if (!baseUrl || !config.enabled) {
      return;
    }

    // Generate URLs for all quality levels
    const urls = generateProgressiveUrls(baseUrl, config);

    // Load preview first (fast)
    await loadQuality('preview', urls.previewUrl);

    // Then load standard quality
    await loadQuality('standard', urls.standardUrl);

    // Finally load high quality
    await loadQuality('high', urls.highUrl);
  }, [baseUrl, config, loadQuality]);

  /**
   * Manually trigger loading
   */
  const load = useCallback(() => {
    if (!state.isVisible && enableLazyLoad) {
      // Mark as visible to trigger loading
      setState((prev) => ({ ...prev, isVisible: true }));
    } else {
      loadProgressive();
    }
  }, [state.isVisible, enableLazyLoad, loadProgressive]);

  /**
   * Retry loading after error
   */
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
    loadProgressive();
  }, [loadProgressive]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState({
      currentQuality: null,
      currentUrl: null,
      loading: false,
      error: null,
      isVisible: !enableLazyLoad,
      webpSupported: state.webpSupported,
      estimatedSizes: state.estimatedSizes,
    });
    loadingRef.current = false;
  }, [enableLazyLoad, state.webpSupported, state.estimatedSizes]);

  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    if (!enableLazyLoad || !containerRef.current) {
      return;
    }

    // Create observer
    observerRef.current = createLazyLoadObserver(
      (entry) => {
        if (entry.isIntersecting && !state.isVisible) {
          setState((prev) => ({ ...prev, isVisible: true }));
        }
      },
      lazyOptions
    );

    // Observe container
    if (observerRef.current && containerRef.current) {
      observerRef.current.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enableLazyLoad, lazyOptions, state.isVisible]);

  // Start loading when visible
  useEffect(() => {
    if (state.isVisible && !state.currentUrl && !state.loading && !state.error) {
      loadProgressive();
    }
  }, [state.isVisible, state.currentUrl, state.loading, state.error, loadProgressive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    ...state,
    containerRef,
    load,
    retry,
    reset,
  };
}

export default useProgressiveImagery;
