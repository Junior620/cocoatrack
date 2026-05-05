/**
 * NDVI Raster Generator Service
 * 
 * Generates PNG raster images from NDVI pixel data for visualization on maps.
 * Uses the Canvas API (node-canvas in Node.js) to create colored images where
 * each pixel represents an NDVI value mapped to a color.
 * 
 * The generated rasters can be displayed as overlays on Leaflet maps to provide
 * visual representation of vegetation health across parcelles.
 */

import type { MultiPolygon } from 'geojson';
import { ndviToRGB, type RGBColor } from '../utils/ndvi-colors';

// ============================================================================
// Types
// ============================================================================

/**
 * Raster generation options
 */
export interface RasterGenerationOptions {
  /**
   * Width of the output image in pixels
   * Higher values = better quality but larger file size
   * Default: 512
   */
  width?: number;

  /**
   * Height of the output image in pixels
   * Default: 512
   */
  height?: number;

  /**
   * Image format
   * Default: 'png'
   */
  format?: 'png' | 'jpeg';

  /**
   * JPEG quality (0-100), only used if format is 'jpeg'
   * Default: 90
   */
  quality?: number;

  /**
   * Whether to add transparency for NaN values
   * Default: true
   */
  transparentNaN?: boolean;
}

/**
 * Generated raster result
 */
export interface RasterResult {
  /**
   * Image buffer (PNG or JPEG)
   */
  buffer: Buffer;

  /**
   * Image width in pixels
   */
  width: number;

  /**
   * Image height in pixels
   */
  height: number;

  /**
   * Image format
   */
  format: 'png' | 'jpeg';

  /**
   * File size in bytes
   */
  sizeBytes: number;

  /**
   * Geographic bounds [minLng, minLat, maxLng, maxLat]
   */
  bounds: [number, number, number, number];
}

// ============================================================================
// RasterGeneratorService Class
// ============================================================================

/**
 * Service for generating NDVI raster images
 */
export class RasterGeneratorService {
  /**
   * Generate a PNG raster image from NDVI pixel data
   * 
   * This method:
   * 1. Creates a canvas with specified dimensions
   * 2. Maps each NDVI value to an RGB color
   * 3. Draws pixels on the canvas
   * 4. Exports the canvas as a PNG buffer
   * 5. Returns the buffer with metadata
   * 
   * @param ndviValues - 2D array of NDVI values (rows x columns)
   * @param geometry - Parcelle geometry for bounds calculation
   * @param options - Raster generation options
   * @returns Raster result with image buffer and metadata
   * 
   * @example
   * ```typescript
   * const service = new RasterGeneratorService();
   * const ndviValues = [[0.5, 0.6], [0.7, 0.8]];
   * const raster = await service.generateRaster(ndviValues, geometry);
   * // Save raster.buffer to file or upload to storage
   * ```
   */
  async generateRaster(
    ndviValues: number[][],
    geometry: MultiPolygon,
    options: RasterGenerationOptions = {}
  ): Promise<RasterResult> {
    const {
      width = 512,
      height = 512,
      format = 'png',
      quality = 90,
      transparentNaN = true,
    } = options;

    // Validate input
    if (ndviValues.length === 0 || ndviValues[0].length === 0) {
      throw new Error('NDVI values array is empty');
    }

    // Calculate bounds from geometry
    const bounds = this.calculateBounds(geometry);

    // Create canvas (browser or node-canvas)
    const canvas = await this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Get dimensions of NDVI data
    const dataHeight = ndviValues.length;
    const dataWidth = ndviValues[0].length;

    // Calculate scaling factors
    const scaleX = width / dataWidth;
    const scaleY = height / dataHeight;

    // Create image data
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Fill image data with colored pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Map canvas coordinates to NDVI data coordinates
        const dataX = Math.floor(x / scaleX);
        const dataY = Math.floor(y / scaleY);

        // Get NDVI value
        const ndvi = ndviValues[dataY]?.[dataX];

        // Calculate pixel index in image data array (RGBA format)
        const pixelIndex = (y * width + x) * 4;

        if (isNaN(ndvi)) {
          // Handle NaN values (no data)
          if (transparentNaN) {
            // Transparent pixel
            data[pixelIndex] = 0;     // R
            data[pixelIndex + 1] = 0; // G
            data[pixelIndex + 2] = 0; // B
            data[pixelIndex + 3] = 0; // A (transparent)
          } else {
            // Black pixel
            data[pixelIndex] = 0;     // R
            data[pixelIndex + 1] = 0; // G
            data[pixelIndex + 2] = 0; // B
            data[pixelIndex + 3] = 255; // A (opaque)
          }
        } else {
          // Map NDVI to RGB color
          const color = ndviToRGB(ndvi);

          data[pixelIndex] = color.r;     // R
          data[pixelIndex + 1] = color.g; // G
          data[pixelIndex + 2] = color.b; // B
          data[pixelIndex + 3] = 255;     // A (opaque)
        }
      }
    }

    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Export canvas to buffer
    const buffer = await this.canvasToBuffer(canvas, format, quality);

    return {
      buffer,
      width,
      height,
      format,
      sizeBytes: buffer.length,
      bounds,
    };
  }

  /**
   * Calculate geographic bounds from MultiPolygon geometry
   * 
   * @param geometry - MultiPolygon geometry
   * @returns Bounds array [minLng, minLat, maxLng, maxLat]
   */
  private calculateBounds(geometry: MultiPolygon): [number, number, number, number] {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    // Iterate through all polygons and coordinates
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }

    return [minLng, minLat, maxLng, maxLat];
  }

  /**
   * Create a canvas element (browser or node-canvas)
   * 
   * @param width - Canvas width
   * @param height - Canvas height
   * @returns Canvas element
   */
  private async createCanvas(width: number, height: number): Promise<any> {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Browser environment
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    // Node.js environment - use node-canvas
    try {
      // Dynamic import to avoid bundling issues
      const { createCanvas } = await import('canvas');
      return createCanvas(width, height);
    } catch (error) {
      throw new Error(
        'canvas package is required for server-side raster generation. ' +
        'Install it with: npm install canvas'
      );
    }
  }

  /**
   * Convert canvas to buffer
   * 
   * @param canvas - Canvas element
   * @param format - Image format
   * @param quality - JPEG quality (0-100)
   * @returns Image buffer
   */
  private async canvasToBuffer(
    canvas: any,
    format: 'png' | 'jpeg',
    quality: number
  ): Promise<Buffer> {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      // Browser environment - convert to blob then to buffer
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          async (blob: Blob | null) => {
            if (!blob) {
              reject(new Error('Failed to convert canvas to blob'));
              return;
            }

            const arrayBuffer = await blob.arrayBuffer();
            resolve(Buffer.from(arrayBuffer));
          },
          format === 'png' ? 'image/png' : 'image/jpeg',
          quality / 100
        );
      });
    }

    // Node.js environment - use node-canvas toBuffer
    if (format === 'png') {
      return canvas.toBuffer('image/png');
    } else {
      return canvas.toBuffer('image/jpeg', { quality: quality / 100 });
    }
  }

  /**
   * Generate a legend image for NDVI color scale
   * 
   * Creates a horizontal gradient bar showing the NDVI color scale
   * with labels for each threshold.
   * 
   * @param options - Raster generation options
   * @returns Raster result with legend image
   */
  async generateLegend(
    options: RasterGenerationOptions = {}
  ): Promise<RasterResult> {
    const {
      width = 400,
      height = 60,
      format = 'png',
      quality = 90,
    } = options;

    // Create canvas
    const canvas = await this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw gradient bar
    const barHeight = 30;
    const barY = (height - barHeight) / 2;

    for (let x = 0; x < width; x++) {
      // Map x position to NDVI value (0 to 1)
      const ndvi = x / width;
      const color = ndviToRGB(ndvi);

      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(x, barY, 1, barHeight);
    }

    // Add border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, barY, width, barHeight);

    // Export to buffer
    const buffer = await this.canvasToBuffer(canvas, format, quality);

    return {
      buffer,
      width,
      height,
      format,
      sizeBytes: buffer.length,
      bounds: [0, 0, 1, 1], // Dummy bounds for legend
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of RasterGeneratorService
 */
export const rasterGeneratorService = new RasterGeneratorService();
