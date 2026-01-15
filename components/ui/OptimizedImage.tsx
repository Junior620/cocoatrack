'use client';

// CocoaTrack V2 - OptimizedImage Component
// Task 24.2: Optimize images
// Validates: Requirements REQ-PERF-002
// WebP format with JPEG fallback, lazy loading with blur placeholders

import { useState, useEffect, useRef, useCallback } from 'react';
import Image, { type ImageProps } from 'next/image';

export interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  /** Fallback image URL if main image fails to load */
  fallbackSrc?: string;
  /** Show blur placeholder while loading */
  showBlurPlaceholder?: boolean;
  /** Custom blur data URL (base64) */
  blurDataURL?: string;
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
  /** Aspect ratio for placeholder (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Background color for placeholder */
  placeholderColor?: string;
}

// Default blur placeholder (tiny gray gradient)
const DEFAULT_BLUR_DATA_URL = 
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNlNWU3ZWIiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNkMWQ1ZGIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==';

/**
 * OptimizedImage - Enhanced image component with performance optimizations
 * 
 * Features:
 * - Uses Next.js Image for automatic WebP/AVIF optimization
 * - Lazy loading by default (native browser lazy loading)
 * - Blur placeholder while loading
 * - Graceful fallback on error
 * - Aspect ratio preservation
 * 
 * Next.js Image automatically:
 * - Serves WebP/AVIF when browser supports it
 * - Falls back to JPEG/PNG for older browsers
 * - Generates responsive srcset
 * - Lazy loads images below the fold
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  showBlurPlaceholder = true,
  blurDataURL = DEFAULT_BLUR_DATA_URL,
  onLoad,
  onError,
  aspectRatio,
  placeholderColor = '#e5e7eb',
  className = '',
  priority = false,
  loading,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setCurrentSrc(src);
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setHasError(true);
      onError?.();
    }
  }, [fallbackSrc, currentSrc, onError]);

  // Error state - show placeholder
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 ${className}`}
        style={{ 
          aspectRatio,
          backgroundColor: placeholderColor,
        }}
      >
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Blur placeholder background */}
      {showBlurPlaceholder && !isLoaded && (
        <div 
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: placeholderColor }}
        />
      )}
      
      <Image
        src={currentSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        placeholder={showBlurPlaceholder ? 'blur' : 'empty'}
        blurDataURL={showBlurPlaceholder ? blurDataURL : undefined}
        priority={priority}
        loading={loading || (priority ? undefined : 'lazy')}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}

/**
 * ResponsiveImage - Image that adapts to container width
 * Uses fill mode with object-fit for responsive behavior
 */
export function ResponsiveImage({
  src,
  alt,
  aspectRatio = '16/9',
  objectFit = 'cover',
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'fill' | 'width' | 'height'> & {
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}) {
  return (
    <div 
      className={`relative w-full ${className}`}
      style={{ aspectRatio }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        style={{ objectFit }}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        {...props}
      />
    </div>
  );
}

/**
 * AvatarImage - Optimized circular avatar image
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  fallbackInitials,
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height'> & {
  size?: number;
  fallbackInitials?: string;
}) {
  const [hasError, setHasError] = useState(false);

  // Generate initials from alt text if not provided
  const initials = fallbackInitials || alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (hasError || !src) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

export default OptimizedImage;
