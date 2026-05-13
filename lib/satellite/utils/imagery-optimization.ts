/**
 * Imagery Optimization Utilities
 * 
 * Task 6.4.1: Optimize imagery loading
 * 
 * This module provides utilities for optimizing satellite imagery loading:
 * - Progressive image loading (low-res preview → high-res)
 * - WebP format conversion for smaller file sizes
 * - Lazy loading for off-screen imagery
 * - Image compression
 * 
 * Validates: Requirements 1.1, 1.5, 11.1
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Image quality levels for progressive loading
 */
export type ImageQuality = 'preview' | 'standard' | 'high';

/**
 * Image format options
 */
export type ImageFormat = 'jpeg' | 'webp' | 'png';

/**
 * Progressive loading configuration
 */
export interface ProgressiveLoadConfig {
  /** Enable progressive loading */
  enabled: boolean;
  /** Preview quality (0-100) */
  previewQuality: number;
  /** Standard quality (0-100) */
  standardQuality: number;
  /** High quality (0-100) */
  highQuality: number;
  /** Preview resolution scale (0-1) */
  previewScale: number;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Target format */
  format: ImageFormat;
  /** Quality (0-100) */
  quality: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
}

/**
 * Optimized imagery data
 */
export interface OptimizedImageryData {
  /** Preview URL (low resolution) */
  previewUrl: string;
  /** Standard URL (medium resolution) */
  standardUrl: string;
  /** High quality URL (full resolution) */
  highUrl: string;
  /** Format used */
  format: ImageFormat;
  /** Estimated file sizes in bytes */
  sizes: {
    preview: number;
    standard: number;
    high: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default progressive loading configuration
 */
export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveLoadConfig = {
  enabled: true,
  previewQuality: 30,
  standardQuality: 70,
  highQuality: 90,
  previewScale: 0.25, // 25% of original size
};

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  format: 'webp',
  quality: 85,
  maxWidth: 2048,
  maxHeight: 2048,
};

/**
 * WebP support detection cache
 */
let webpSupported: boolean | null = null;

// ============================================================================
// WebP Support Detection
// ============================================================================

/**
 * Check if the browser supports WebP format
 * 
 * Uses a cached result to avoid repeated checks.
 * 
 * @returns Promise resolving to true if WebP is supported
 * 
 * @example
 * ```typescript
 * const supported = await supportsWebP();
 * if (supported) {
 *   // Use WebP format
 * } else {
 *   // Fall back to JPEG
 * }
 * ```
 */
export async function supportsWebP(): Promise<boolean> {
  // Return cached result if available
  if (webpSupported !== null) {
    return webpSupported;
  }

  // Server-side: assume WebP is supported (will be handled by Next.js Image)
  if (typeof window === 'undefined') {
    webpSupported = true;
    return true;
  }

  // Client-side: test WebP support
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      webpSupported = img.width === 1;
      resolve(webpSupported);
    };
    
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    
    // Tiny WebP test image (1x1 pixel)
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

// ============================================================================
// Format Selection
// ============================================================================

/**
 * Select the optimal image format based on browser support
 * 
 * @param preferredFormat - Preferred format
 * @returns Optimal format to use
 * 
 * @example
 * ```typescript
 * const format = await selectOptimalFormat('webp');
 * // Returns 'webp' if supported, otherwise 'jpeg'
 * ```
 */
export async function selectOptimalFormat(
  preferredFormat: ImageFormat = 'webp'
): Promise<ImageFormat> {
  // If WebP is preferred, check support
  if (preferredFormat === 'webp') {
    const supported = await supportsWebP();
    return supported ? 'webp' : 'jpeg';
  }
  
  return preferredFormat;
}

// ============================================================================
// URL Generation
// ============================================================================

/**
 * Generate optimized imagery URLs for progressive loading
 * 
 * Creates three versions of the imagery:
 * 1. Preview: Low resolution, fast loading
 * 2. Standard: Medium resolution, balanced quality/size
 * 3. High: Full resolution, best quality
 * 
 * @param baseUrl - Base imagery URL
 * @param config - Progressive loading configuration
 * @returns Optimized imagery URLs
 * 
 * @example
 * ```typescript
 * const urls = generateProgressiveUrls(
 *   'https://example.com/imagery/parcelle-123',
 *   DEFAULT_PROGRESSIVE_CONFIG
 * );
 * 
 * // Load preview first
 * loadImage(urls.previewUrl);
 * 
 * // Then load standard quality
 * loadImage(urls.standardUrl);
 * 
 * // Finally load high quality
 * loadImage(urls.highUrl);
 * ```
 */
export function generateProgressiveUrls(
  baseUrl: string,
  config: ProgressiveLoadConfig = DEFAULT_PROGRESSIVE_CONFIG
): Pick<OptimizedImageryData, 'previewUrl' | 'standardUrl' | 'highUrl'> {
  const format = 'webp'; // Will be handled by Next.js Image optimization
  
  // Generate URLs with quality parameters
  const addParams = (url: string, quality: number, scale?: number): string => {
    const separator = url.includes('?') ? '&' : '?';
    let params = `${separator}format=${format}&quality=${quality}`;
    
    if (scale && scale < 1) {
      params += `&scale=${scale}`;
    }
    
    return `${url}${params}`;
  };
  
  return {
    previewUrl: addParams(baseUrl, config.previewQuality, config.previewScale),
    standardUrl: addParams(baseUrl, config.standardQuality),
    highUrl: addParams(baseUrl, config.highQuality),
  };
}

/**
 * Generate a tile URL with optimization parameters
 * 
 * @param tileUrl - Base tile URL template
 * @param quality - Image quality (0-100)
 * @param format - Image format
 * @returns Optimized tile URL
 * 
 * @example
 * ```typescript
 * const optimizedUrl = generateOptimizedTileUrl(
 *   'https://example.com/tiles/{z}/{x}/{y}',
 *   85,
 *   'webp'
 * );
 * ```
 */
export function generateOptimizedTileUrl(
  tileUrl: string,
  quality: number = 85,
  format: ImageFormat = 'webp'
): string {
  // Add optimization parameters to tile URL
  const separator = tileUrl.includes('?') ? '&' : '?';
  return `${tileUrl}${separator}format=${format}&quality=${quality}`;
}

// ============================================================================
// Lazy Loading
// ============================================================================

/**
 * Intersection Observer options for lazy loading
 */
export interface LazyLoadOptions {
  /** Root margin for triggering load (e.g., '50px') */
  rootMargin?: string;
  /** Threshold for triggering load (0-1) */
  threshold?: number;
  /** Load immediately if true */
  immediate?: boolean;
}

/**
 * Default lazy load options
 */
export const DEFAULT_LAZY_LOAD_OPTIONS: LazyLoadOptions = {
  rootMargin: '50px', // Start loading 50px before entering viewport
  threshold: 0.01, // Trigger when 1% visible
  immediate: false,
};

/**
 * Create an Intersection Observer for lazy loading imagery
 * 
 * @param callback - Callback when element becomes visible
 * @param options - Lazy load options
 * @returns Intersection Observer instance
 * 
 * @example
 * ```typescript
 * const observer = createLazyLoadObserver(
 *   (entry) => {
 *     if (entry.isIntersecting) {
 *       loadImagery();
 *     }
 *   },
 *   { rootMargin: '100px' }
 * );
 * 
 * observer.observe(imageElement);
 * ```
 */
export function createLazyLoadObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options: LazyLoadOptions = DEFAULT_LAZY_LOAD_OPTIONS
): IntersectionObserver | null {
  // Server-side: return null
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        callback(entry);
      });
    },
    {
      rootMargin: options.rootMargin,
      threshold: options.threshold,
    }
  );
}

// ============================================================================
// Compression Estimation
// ============================================================================

/**
 * Estimate compressed file size based on format and quality
 * 
 * This is a rough estimation based on typical compression ratios.
 * Actual sizes may vary depending on image content.
 * 
 * @param originalSize - Original file size in bytes
 * @param format - Target format
 * @param quality - Quality setting (0-100)
 * @returns Estimated compressed size in bytes
 * 
 * @example
 * ```typescript
 * const originalSize = 5 * 1024 * 1024; // 5MB
 * const compressedSize = estimateCompressedSize(originalSize, 'webp', 85);
 * console.log(`Estimated size: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
 * ```
 */
export function estimateCompressedSize(
  originalSize: number,
  format: ImageFormat,
  quality: number
): number {
  // Compression ratios (approximate)
  const compressionRatios: Record<ImageFormat, number> = {
    webp: 0.25, // WebP typically achieves 75% reduction
    jpeg: 0.35, // JPEG typically achieves 65% reduction
    png: 0.60,  // PNG typically achieves 40% reduction (lossless)
  };
  
  // Quality factor (lower quality = more compression)
  const qualityFactor = quality / 100;
  
  // Base compression ratio for the format
  const baseRatio = compressionRatios[format];
  
  // Adjust ratio based on quality
  // At 100% quality, use base ratio
  // At 0% quality, use base ratio * 0.5 (more compression)
  const adjustedRatio = baseRatio * (0.5 + (qualityFactor * 0.5));
  
  return Math.round(originalSize * adjustedRatio);
}

/**
 * Estimate sizes for progressive loading levels
 * 
 * @param originalSize - Original file size in bytes
 * @param config - Progressive loading configuration
 * @returns Estimated sizes for each quality level
 * 
 * @example
 * ```typescript
 * const sizes = estimateProgressiveSizes(5 * 1024 * 1024);
 * console.log('Preview:', (sizes.preview / 1024).toFixed(0), 'KB');
 * console.log('Standard:', (sizes.standard / 1024).toFixed(0), 'KB');
 * console.log('High:', (sizes.high / 1024).toFixed(0), 'KB');
 * ```
 */
export function estimateProgressiveSizes(
  originalSize: number,
  config: ProgressiveLoadConfig = DEFAULT_PROGRESSIVE_CONFIG
): { preview: number; standard: number; high: number } {
  const format: ImageFormat = 'webp';
  
  // Preview is scaled down, so size is reduced by scale factor squared
  const previewBaseSize = originalSize * (config.previewScale ** 2);
  
  return {
    preview: estimateCompressedSize(previewBaseSize, format, config.previewQuality),
    standard: estimateCompressedSize(originalSize, format, config.standardQuality),
    high: estimateCompressedSize(originalSize, format, config.highQuality),
  };
}

// ============================================================================
// Preloading
// ============================================================================

/**
 * Preload an image to cache it in the browser
 * 
 * @param url - Image URL to preload
 * @returns Promise that resolves when image is loaded
 * 
 * @example
 * ```typescript
 * // Preload high-quality image while showing preview
 * preloadImage(urls.highUrl).then(() => {
 *   console.log('High quality image ready');
 * });
 * ```
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    
    img.src = url;
  });
}

/**
 * Preload multiple images in sequence
 * 
 * @param urls - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 * 
 * @example
 * ```typescript
 * await preloadImages([
 *   urls.previewUrl,
 *   urls.standardUrl,
 *   urls.highUrl,
 * ]);
 * ```
 */
export async function preloadImages(urls: string[]): Promise<void> {
  for (const url of urls) {
    await preloadImage(url);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 * 
 * @example
 * ```typescript
 * formatFileSize(1536000); // "1.5 MB"
 * formatFileSize(2048); // "2.0 KB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Calculate data savings from optimization
 * 
 * @param originalSize - Original file size in bytes
 * @param optimizedSize - Optimized file size in bytes
 * @returns Savings information
 * 
 * @example
 * ```typescript
 * const savings = calculateSavings(5000000, 1250000);
 * console.log(`Saved ${savings.percentage}% (${savings.savedBytes} bytes)`);
 * ```
 */
export function calculateSavings(
  originalSize: number,
  optimizedSize: number
): {
  savedBytes: number;
  percentage: number;
  formatted: string;
} {
  const savedBytes = originalSize - optimizedSize;
  const percentage = (savedBytes / originalSize) * 100;
  
  return {
    savedBytes,
    percentage: Math.round(percentage),
    formatted: `${formatFileSize(savedBytes)} (${Math.round(percentage)}%)`,
  };
}
