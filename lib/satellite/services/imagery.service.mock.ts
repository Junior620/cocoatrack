/**
 * Mock Imagery Service (Development Only)
 * 
 * This is a mock implementation of the ImageryService for development and testing
 * purposes. It generates synthetic band data that produces realistic NDVI values.
 * 
 * DO NOT USE IN PRODUCTION - This is for development only until Google Earth Engine
 * is properly configured.
 * 
 * To use this mock service:
 * 1. Set environment variable: NEXT_PUBLIC_USE_MOCK_IMAGERY=true
 * 2. The NDVI service will automatically use mock data
 */

import type { MultiPolygon } from 'geojson';
import type { BandData, ImageryData, ImageryDate } from '../types';

/**
 * Mock Imagery Service
 * 
 * Generates synthetic satellite imagery data for development and testing.
 */
export class MockImageryService {
  /**
   * Get mock band data for NDVI calculation
   * 
   * Generates synthetic Red and NIR band data that produces realistic NDVI values.
   * The data simulates a healthy cocoa plantation with NDVI values typically
   * between 0.5 and 0.8.
   * 
   * @param geometry - Parcelle geometry (not used in mock)
   * @param date - Target date (not used in mock)
   * @param bands - Requested bands (must include 'B4' and 'B8')
   * @returns Mock band data
   */
  async getBands(
    geometry: MultiPolygon,
    date: Date,
    bands: string[]
  ): Promise<BandData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Validate requested bands — NDVI needs B4+B8; NDMI-only can be B8A+B11
    const hasNdviBands = bands.includes('B4') && bands.includes('B8');
    const hasNdmiBands = bands.includes('B8A') && bands.includes('B11');
    if (!hasNdviBands && !hasNdmiBands) {
      throw new Error(
        'Mock imagery service requires B4+B8 (NDVI) and/or B8A+B11 (NDMI)'
      );
    }

    // Generate mock band data
    // We'll create a 20x20 pixel grid to simulate a small parcelle
    const gridSize = 20;
    const red: number[][] = [];
    const nir: number[][] = [];
    const blue: number[][] = [];
    const green: number[][] = [];
    const nirNarrow: number[][] = [];
    const swir: number[][] = [];

    for (let row = 0; row < gridSize; row++) {
      const redRow: number[] = [];
      const nirRow: number[] = [];
      const blueRow: number[] = [];
      const greenRow: number[] = [];
      const nirNarrowRow: number[] = [];
      const swirRow: number[] = [];

      for (let col = 0; col < gridSize; col++) {
        // Generate realistic values for healthy vegetation
        // Red band: Lower reflectance (chlorophyll absorbs red light)
        // Typical range: 50-150 for vegetation (DN × 10000 scale)
        const redValue = 60 + Math.random() * 60; // 60-120

        // NIR band: Higher reflectance (vegetation reflects NIR)
        // Typical range: 200-400 for healthy vegetation
        const nirValue = 250 + Math.random() * 100; // 250-350

        // Blue band: low for vegetation (chlorophyll absorption)
        const blueValue = 40 + Math.random() * 40; // 40-80

        // Green: between blue and red for vegetation (NDWI McFeeters)
        const greenValue = 50 + Math.random() * 50; // 50-100

        // SWIR: moderate for moist canopy (lower than NIR → positive NDMI)
        const swirValue = 120 + Math.random() * 60; // 120-180

        // Add some spatial variation to make it more realistic
        // Create a gradient effect from top-left to bottom-right
        const gradientFactor = (row + col) / (gridSize * 2);
        const adjustedRed = redValue * (0.8 + gradientFactor * 0.4);
        const adjustedNir = nirValue * (0.9 + gradientFactor * 0.2);
        const adjustedBlue = blueValue * (0.85 + gradientFactor * 0.3);
        const adjustedGreen = greenValue * (0.85 + gradientFactor * 0.3);
        const adjustedSwir = swirValue * (0.9 + gradientFactor * 0.2);

        redRow.push(adjustedRed);
        nirRow.push(adjustedNir);
        blueRow.push(adjustedBlue);
        greenRow.push(adjustedGreen);
        nirNarrowRow.push(adjustedNir * 0.98);
        swirRow.push(adjustedSwir);
      }

      red.push(redRow);
      nir.push(nirRow);
      blue.push(blueRow);
      green.push(greenRow);
      nirNarrow.push(nirNarrowRow);
      swir.push(swirRow);
    }

    // Add some "stressed" areas (higher red, lower NIR) to simulate realistic conditions
    // This creates patches of lower NDVI values
    const numStressedAreas = 2;
    for (let i = 0; i < numStressedAreas; i++) {
      const centerRow = Math.floor(Math.random() * gridSize);
      const centerCol = Math.floor(Math.random() * gridSize);
      const radius = 2;

      for (let row = Math.max(0, centerRow - radius); row < Math.min(gridSize, centerRow + radius); row++) {
        for (let col = Math.max(0, centerCol - radius); col < Math.min(gridSize, centerCol + radius); col++) {
          // Increase red (stress indicator)
          red[row][col] *= 1.3;
          // Decrease NIR (less healthy vegetation)
          nir[row][col] *= 0.8;
          blue[row][col] *= 1.15;
          green[row][col] *= 1.1;
          nirNarrow[row][col] *= 0.85;
          swir[row][col] *= 1.2; // drier → higher SWIR → lower NDMI
        }
      }
    }

    console.log('[MOCK] Generated synthetic band data:', {
      gridSize: `${gridSize}x${gridSize}`,
      redRange: `${Math.min(...red.flat()).toFixed(1)} - ${Math.max(...red.flat()).toFixed(1)}`,
      nirRange: `${Math.min(...nir.flat()).toFixed(1)} - ${Math.max(...nir.flat()).toFixed(1)}`,
      blueRange: `${Math.min(...blue.flat()).toFixed(1)} - ${Math.max(...blue.flat()).toFixed(1)}`,
      expectedNDVI: '0.5 - 0.8 (healthy vegetation)',
    });

    return {
      red: hasNdviBands ? red : [[0]],
      nir: hasNdviBands ? nir : [[0]],
      blue: bands.includes('B2') ? blue : undefined,
      green: bands.includes('B3') ? green : undefined,
      nirNarrow: bands.includes('B8A') ? nirNarrow : undefined,
      swir: bands.includes('B11') ? swir : undefined,
      bounds: [0, 0, gridSize, gridSize],
      resolution: 10, // 10 meters (Sentinel-2 resolution)
    };
  }

  /**
   * Get mock imagery data
   * 
   * @param geometry - Parcelle geometry
   * @param date - Target date
   * @param cloudCoverThreshold - Cloud cover threshold (not used in mock)
   * @returns Mock imagery data
   */
  async getImagery(
    geometry: MultiPolygon,
    date: Date,
    cloudCoverThreshold: number = 20
  ): Promise<ImageryData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      id: `mock-imagery-${Date.now()}`,
      parcelleId: 'mock-parcelle',
      acquisitionDate: date,
      cloudCoverPercent: Math.random() * 15, // 0-15% cloud cover
      satelliteSource: 'sentinel-2',
      tileUrl: 'https://example.com/mock-tile.png',
      bounds: [-10.5, 5.2, -10.4, 5.3], // Mock bounds for Cameroon
      resolutionMeters: 10,
      createdAt: new Date(),
    };
  }

  /**
   * Get available imagery dates
   * 
   * @param geometry - Parcelle geometry
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Mock imagery dates
   */
  async getAvailableDates(
    geometry: MultiPolygon,
    startDate: Date,
    endDate: Date
  ): Promise<ImageryDate[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Generate mock dates (one per week)
    const dates: ImageryDate[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push({
        date: new Date(current),
        cloudCoverPercent: Math.random() * 30, // 0-30% cloud cover
        available: true,
      });

      // Move to next week
      current.setDate(current.getDate() + 7);
    }

    return dates;
  }
}

/**
 * Singleton instance of MockImageryService
 */
export const mockImageryService = new MockImageryService();

/**
 * Check if mock imagery service should be used
 * 
 * Returns true if NEXT_PUBLIC_USE_MOCK_IMAGERY environment variable is set to 'true'
 */
export function shouldUseMockImagery(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_IMAGERY === 'true';
}
