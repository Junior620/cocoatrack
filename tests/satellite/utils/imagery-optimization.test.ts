/**
 * Tests for Imagery Optimization Utilities
 * 
 * Task 6.4.1: Optimize imagery loading
 * 
 * Tests for:
 * - WebP support detection
 * - Format selection
 * - Progressive URL generation
 * - Lazy loading observer creation
 * - Compression estimation
 * - File size formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  supportsWebP,
  selectOptimalFormat,
  generateProgressiveUrls,
  generateOptimizedTileUrl,
  createLazyLoadObserver,
  estimateCompressedSize,
  estimateProgressiveSizes,
  preloadImage,
  formatFileSize,
  calculateSavings,
  DEFAULT_PROGRESSIVE_CONFIG,
} from '@/lib/satellite/utils/imagery-optimization';

// Mock Image constructor for testing
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 0;
  height = 0;

  constructor() {
    // Simulate async image loading
    setTimeout(() => {
      if (this.src.includes('data:image/webp')) {
        this.width = 1;
        this.height = 1;
        this.onload?.();
      } else if (this.src.includes('data:image/png')) {
        this.width = 1;
        this.height = 1;
        this.onload?.();
      } else if (this.src.includes('invalid')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 10);
  }
}

// Replace global Image with mock
global.Image = MockImage as any;

describe('Imagery Optimization Utilities', () => {
  describe('supportsWebP', () => {
    it('should detect WebP support', async () => {
      const supported = await supportsWebP();
      expect(typeof supported).toBe('boolean');
    }, 10000);

    it('should cache the result', async () => {
      const result1 = await supportsWebP();
      const result2 = await supportsWebP();
      expect(result1).toBe(result2);
    }, 10000);
  });

  describe('selectOptimalFormat', () => {
    it('should return webp when supported', async () => {
      const format = await selectOptimalFormat('webp');
      expect(['webp', 'jpeg']).toContain(format);
    }, 10000);

    it('should return jpeg when requested', async () => {
      const format = await selectOptimalFormat('jpeg');
      expect(format).toBe('jpeg');
    });

    it('should return png when requested', async () => {
      const format = await selectOptimalFormat('png');
      expect(format).toBe('png');
    });
  });

  describe('generateProgressiveUrls', () => {
    it('should generate three quality levels', () => {
      const baseUrl = 'https://example.com/imagery/parcelle-123';
      const urls = generateProgressiveUrls(baseUrl);

      expect(urls.previewUrl).toContain(baseUrl);
      expect(urls.standardUrl).toContain(baseUrl);
      expect(urls.highUrl).toContain(baseUrl);
    });

    it('should include quality parameters', () => {
      const baseUrl = 'https://example.com/imagery/parcelle-123';
      const urls = generateProgressiveUrls(baseUrl);

      expect(urls.previewUrl).toContain('quality=');
      expect(urls.standardUrl).toContain('quality=');
      expect(urls.highUrl).toContain('quality=');
    });

    it('should include scale parameter for preview', () => {
      const baseUrl = 'https://example.com/imagery/parcelle-123';
      const urls = generateProgressiveUrls(baseUrl);

      expect(urls.previewUrl).toContain('scale=');
    });

    it('should use custom configuration', () => {
      const baseUrl = 'https://example.com/imagery/parcelle-123';
      const config = {
        ...DEFAULT_PROGRESSIVE_CONFIG,
        previewQuality: 50,
      };
      const urls = generateProgressiveUrls(baseUrl, config);

      expect(urls.previewUrl).toContain('quality=50');
    });

    it('should handle URLs with existing query parameters', () => {
      const baseUrl = 'https://example.com/imagery/parcelle-123?existing=param';
      const urls = generateProgressiveUrls(baseUrl);

      expect(urls.previewUrl).toContain('existing=param');
      expect(urls.previewUrl).toContain('&quality=');
    });
  });

  describe('generateOptimizedTileUrl', () => {
    it('should add optimization parameters', () => {
      const tileUrl = 'https://example.com/tiles/{z}/{x}/{y}';
      const optimized = generateOptimizedTileUrl(tileUrl, 85, 'webp');

      expect(optimized).toContain('format=webp');
      expect(optimized).toContain('quality=85');
    });

    it('should preserve tile placeholders', () => {
      const tileUrl = 'https://example.com/tiles/{z}/{x}/{y}';
      const optimized = generateOptimizedTileUrl(tileUrl);

      expect(optimized).toContain('{z}');
      expect(optimized).toContain('{x}');
      expect(optimized).toContain('{y}');
    });

    it('should handle URLs with existing parameters', () => {
      const tileUrl = 'https://example.com/tiles/{z}/{x}/{y}?token=abc';
      const optimized = generateOptimizedTileUrl(tileUrl, 85, 'webp');

      expect(optimized).toContain('token=abc');
      expect(optimized).toContain('&format=webp');
    });
  });

  describe('createLazyLoadObserver', () => {
    it('should create an IntersectionObserver', () => {
      const callback = vi.fn();
      const observer = createLazyLoadObserver(callback);

      // In test environment, IntersectionObserver might not be available
      if (typeof IntersectionObserver !== 'undefined') {
        expect(observer).toBeInstanceOf(IntersectionObserver);
      } else {
        expect(observer).toBeNull();
      }
    });

    it('should use custom options', () => {
      const callback = vi.fn();
      const options = {
        rootMargin: '100px',
        threshold: 0.5,
      };
      const observer = createLazyLoadObserver(callback, options);

      // Observer should be created with custom options
      expect(observer).toBeDefined();
    });
  });

  describe('estimateCompressedSize', () => {
    it('should estimate WebP compression', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const compressed = estimateCompressedSize(originalSize, 'webp', 85);

      expect(compressed).toBeLessThan(originalSize);
      expect(compressed).toBeGreaterThan(0);
    });

    it('should estimate JPEG compression', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const compressed = estimateCompressedSize(originalSize, 'jpeg', 85);

      expect(compressed).toBeLessThan(originalSize);
      expect(compressed).toBeGreaterThan(0);
    });

    it('should estimate PNG compression', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const compressed = estimateCompressedSize(originalSize, 'png', 85);

      expect(compressed).toBeLessThan(originalSize);
      expect(compressed).toBeGreaterThan(0);
    });

    it('should compress more at lower quality', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const highQuality = estimateCompressedSize(originalSize, 'webp', 90);
      const lowQuality = estimateCompressedSize(originalSize, 'webp', 50);

      expect(lowQuality).toBeLessThan(highQuality);
    });

    it('should show WebP compresses better than JPEG', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const webp = estimateCompressedSize(originalSize, 'webp', 85);
      const jpeg = estimateCompressedSize(originalSize, 'jpeg', 85);

      expect(webp).toBeLessThan(jpeg);
    });
  });

  describe('estimateProgressiveSizes', () => {
    it('should estimate sizes for all quality levels', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const sizes = estimateProgressiveSizes(originalSize);

      expect(sizes.preview).toBeGreaterThan(0);
      expect(sizes.standard).toBeGreaterThan(0);
      expect(sizes.high).toBeGreaterThan(0);
    });

    it('should have preview smaller than standard', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const sizes = estimateProgressiveSizes(originalSize);

      expect(sizes.preview).toBeLessThan(sizes.standard);
    });

    it('should have standard smaller than high', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const sizes = estimateProgressiveSizes(originalSize);

      expect(sizes.standard).toBeLessThan(sizes.high);
    });

    it('should use custom configuration', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const config = {
        ...DEFAULT_PROGRESSIVE_CONFIG,
        previewScale: 0.5, // Larger preview
      };
      const sizes = estimateProgressiveSizes(originalSize, config);

      expect(sizes.preview).toBeGreaterThan(0);
    });
  });

  describe('preloadImage', () => {
    it('should preload a valid image', async () => {
      // Use a data URL for testing
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      await expect(preloadImage(dataUrl)).resolves.toBeUndefined();
    }, 10000);

    it('should reject for invalid image', async () => {
      const invalidUrl = 'https://invalid-url-that-does-not-exist.com/image.jpg';
      
      await expect(preloadImage(invalidUrl)).rejects.toThrow();
    }, 10000);
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('should format with one decimal place', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1536 * 1024)).toBe('1.5 MB');
    });
  });

  describe('calculateSavings', () => {
    it('should calculate savings correctly', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const optimizedSize = 1.25 * 1024 * 1024; // 1.25MB
      const savings = calculateSavings(originalSize, optimizedSize);

      expect(savings.savedBytes).toBe(originalSize - optimizedSize);
      expect(savings.percentage).toBe(75); // 75% reduction
    });

    it('should format savings', () => {
      const originalSize = 5 * 1024 * 1024; // 5MB
      const optimizedSize = 1.25 * 1024 * 1024; // 1.25MB
      const savings = calculateSavings(originalSize, optimizedSize);

      expect(savings.formatted).toContain('MB');
      expect(savings.formatted).toContain('75%');
    });

    it('should handle zero savings', () => {
      const size = 1024 * 1024; // 1MB
      const savings = calculateSavings(size, size);

      expect(savings.savedBytes).toBe(0);
      expect(savings.percentage).toBe(0);
    });

    it('should handle 100% savings', () => {
      const originalSize = 1024 * 1024; // 1MB
      const optimizedSize = 0;
      const savings = calculateSavings(originalSize, optimizedSize);

      expect(savings.savedBytes).toBe(originalSize);
      expect(savings.percentage).toBe(100);
    });
  });
});
