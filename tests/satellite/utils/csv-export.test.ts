/**
 * Unit tests for CSV export utilities
 * 
 * Tests the CSV generation and download functionality for temporal NDVI data.
 * 
 * Requirements: Task 3.4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertTemporalDataToCSV,
  generateTemporalCSVFilename,
  downloadCSV,
  exportTemporalDataAsCSV,
  type TemporalCSVDataPoint,
} from '../../../lib/satellite/utils/csv-export';

describe('CSV Export Utilities', () => {
  describe('convertTemporalDataToCSV', () => {
    it('should convert temporal data to CSV format with headers', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
          minNDVI: 0.70,
          maxNDVI: 0.80,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.80,
          cloudCover: 15,
          healthStatus: 'excellent',
          hasSignificantChange: false,
          minNDVI: 0.75,
          maxNDVI: 0.85,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('date,mean_ndvi,mean_evi,mean_ndmi,mean_ndwi,mean_savi,min_ndvi,max_ndvi,change_from_previous');
      expect(csv).toContain('2024-01-01,0.7500,,,,,0.7000,0.8000,0.0000');
      expect(csv).toContain('2024-02-01,0.8000,,,,,0.7500,0.8500,0.0500');
    });

    it('should convert temporal data without headers when specified', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline, false);

      expect(csv).not.toContain('date,mean_ndvi');
      expect(csv).toContain('2024-01-01,0.7500');
    });

    it('should handle empty timeline', () => {
      const timeline: TemporalCSVDataPoint[] = [];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toBe('date,mean_ndvi,mean_evi,mean_ndmi,mean_ndwi,mean_savi,min_ndvi,max_ndvi,change_from_previous\n');
    });

    it('should calculate change from previous correctly', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.60,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.75,
          cloudCover: 15,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.70,
          cloudCover: 20,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      // First point should have 0.0000 change
      expect(csv).toContain('2024-01-01,0.6000,,,,,0.6000,0.6000,0.0000');
      // Second point: 0.75 - 0.60 = 0.15
      expect(csv).toContain('2024-02-01,0.7500,,,,,0.7500,0.7500,0.1500');
      // Third point: 0.70 - 0.75 = -0.05
      expect(csv).toContain('2024-03-01,0.7000,,,,,0.7000,0.7000,-0.0500');
    });

    it('should use mean NDVI when min/max not provided', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01,0.7500,,,,,0.7500,0.7500,0.0000');
    });

    it('should export mean_evi when present', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          evi: 0.42,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01,0.7500,0.4200,,,,0.7500,0.7500,0.0000');
    });

    it('should export mean_ndmi when present', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          evi: 0.42,
          ndmi: 0.18,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01,0.7500,0.4200,0.1800,,,0.7500,0.7500,0.0000');
    });

    it('should export mean_ndwi when present', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          evi: 0.42,
          ndmi: 0.18,
          ndwi: -0.05,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01,0.7500,0.4200,0.1800,-0.0500,,0.7500,0.7500,0.0000');
    });

    it('should export mean_savi when present', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          evi: 0.42,
          ndmi: 0.18,
          ndwi: -0.05,
          savi: 0.33,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01,0.7500,0.4200,0.1800,-0.0500,0.3300,0.7500,0.7500,0.0000');
    });

    it('should handle Date objects and ISO strings', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('2024-01-01');
    });

    it('should format NDVI values to 4 decimal places', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.123456789,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
          minNDVI: 0.111111111,
          maxNDVI: 0.999999999,
        },
      ];

      const csv = convertTemporalDataToCSV(timeline);

      expect(csv).toContain('0.1235'); // Rounded to 4 decimals
      expect(csv).toContain('0.1111');
      expect(csv).toContain('1.0000');
    });
  });

  describe('generateTemporalCSVFilename', () => {
    it('should generate filename with parcelle ID and date range', () => {
      const parcelleId = '12345678-1234-1234-1234-123456789abc';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const filename = generateTemporalCSVFilename(parcelleId, startDate, endDate);

      expect(filename).toBe('temporal-ndvi-12345678-2024-01-01-to-2024-12-31.csv');
    });

    it('should truncate parcelle ID to 8 characters', () => {
      const parcelleId = 'abcdefghijklmnop';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const filename = generateTemporalCSVFilename(parcelleId, startDate, endDate);

      expect(filename).toContain('abcdefgh');
      expect(filename).not.toContain('ijklmnop');
    });

    it('should format dates as YYYY-MM-DD', () => {
      const parcelleId = '12345678';
      const startDate = new Date('2024-03-15');
      const endDate = new Date('2024-06-20');

      const filename = generateTemporalCSVFilename(parcelleId, startDate, endDate);

      expect(filename).toContain('2024-03-15');
      expect(filename).toContain('2024-06-20');
    });
  });

  describe('downloadCSV', () => {
    let createElementSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;
    let mockLink: any;

    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock DOM elements and methods
      mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
      };

      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create download link with correct attributes', () => {
      const csvContent = 'date,ndvi\n2024-01-01,0.75';
      const filename = 'test-export.csv';

      downloadCSV(csvContent, filename);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', filename);
    });

    it('should trigger download and cleanup', () => {
      const csvContent = 'date,ndvi\n2024-01-01,0.75';

      downloadCSV(csvContent);

      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should use default filename when not provided', () => {
      const csvContent = 'date,ndvi\n2024-01-01,0.75';

      downloadCSV(csvContent);

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'temporal-ndvi-data.csv');
    });
  });

  describe('exportTemporalDataAsCSV', () => {
    let createElementSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;
    let mockLink: any;

    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
      };

      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should export temporal data with generated filename', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];
      const parcelleId = '12345678-1234-1234-1234-123456789abc';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      exportTemporalDataAsCSV(timeline, parcelleId, startDate, endDate);

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        'temporal-ndvi-12345678-2024-01-01-to-2024-12-31.csv'
      );
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should convert data to CSV and trigger download', () => {
      const timeline: TemporalCSVDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.80,
          cloudCover: 15,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
      ];
      const parcelleId = 'test-parcelle';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');

      exportTemporalDataAsCSV(timeline, parcelleId, startDate, endDate);

      expect(appendChildSpy).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
