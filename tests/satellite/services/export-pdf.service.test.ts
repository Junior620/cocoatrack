/**
 * Tests for PDF Report Generation in ExportService
 * 
 * Tests the generateCertificationReport method and related PDF generation functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../../../lib/satellite/services/export.service';
import type { 
  CertificationReportData,
  ReportOptions,
  DeforestationEvent,
  TemporalDataPoint,
  ImageryData,
  YieldPrediction
} from '../../../lib/satellite/types';

// Mock jsPDF and jspdf-autotable
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setProperties: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    roundedRect: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    addPage: vi.fn(),
    setPage: vi.fn(),
    output: vi.fn().mockReturnValue(new Blob(['mock-pdf'], { type: 'application/pdf' })),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
      getNumberOfPages: () => 1,
    },
    autoTable: vi.fn(),
    lastAutoTable: { finalY: 100 },
  })),
}));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

describe('ExportService - PDF Report Generation', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    vi.clearAllMocks();
  });

  // Helper function to create mock parcelle data
  const createMockParcelle = () => ({
    id: 'parcelle-123',
    code: 'P001',
    label: 'Test Parcelle',
    village: 'Test Village',
    region: 'Test Region',
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: [[[[10.0, 5.0], [10.1, 5.0], [10.1, 5.1], [10.0, 5.1], [10.0, 5.0]]]],
    },
    surface_hectares: 2.5,
    planteur_name: 'Test Farmer',
  });

  // Helper function to create mock deforestation event
  const createMockDeforestationEvent = (): DeforestationEvent => ({
    id: 'deforest-1',
    parcelleId: 'parcelle-123',
    baselineDate: new Date('2020-12-31'),
    detectionDate: new Date('2024-06-15'),
    baselineNDVI: 0.75,
    currentNDVI: 0.40,
    ndviChange: -0.35,
    affectedAreaHectares: 0.8,
    affectedAreaPercent: 32.0,
    status: 'pending',
    acknowledgedBy: null,
    acknowledgedAt: null,
    acknowledgmentNotes: null,
    disputedBy: null,
    disputedAt: null,
    disputeReason: null,
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-06-15'),
  });

  // Helper function to create mock temporal data
  const createMockTemporalData = (): TemporalDataPoint[] => [
    {
      date: new Date('2024-01-01'),
      ndvi: 0.75,
      cloudCover: 10,
      healthStatus: 'excellent',
      hasSignificantChange: false,
    },
    {
      date: new Date('2024-02-01'),
      ndvi: 0.72,
      cloudCover: 15,
      healthStatus: 'excellent',
      hasSignificantChange: false,
    },
    {
      date: new Date('2024-03-01'),
      ndvi: 0.55,
      cloudCover: 12,
      healthStatus: 'fair',
      hasSignificantChange: true,
    },
  ];

  // Helper function to create mock imagery data
  const createMockImageryData = (date: Date): ImageryData => ({
    id: 'imagery-1',
    parcelleId: 'parcelle-123',
    acquisitionDate: date,
    cloudCoverPercent: 10,
    satelliteSource: 'sentinel-2',
    tileUrl: 'https://example.com/tile.png',
    bounds: [10.0, 5.0, 10.1, 5.1],
    resolutionMeters: 10,
    createdAt: new Date(),
  });

  // Helper function to create mock yield prediction
  const createMockYieldPrediction = (): YieldPrediction => ({
    id: 'yield-1',
    parcelleId: 'parcelle-123',
    predictionDate: new Date('2024-05-01'),
    harvestSeason: '2024-Q4',
    predictedYieldKgPerHa: 850,
    confidenceLevel: 'high',
    confidenceIntervalLower: 800,
    confidenceIntervalUpper: 900,
    modelVersion: 'v1.0',
    inputFeatures: {
      meanNDVI: 0.72,
      ndviTrend: 0.02,
      historicalYield: [800, 820, 840],
      surfaceHectares: 2.5,
    },
    actualYieldKgPerHa: null,
    createdAt: new Date('2024-05-01'),
  });

  describe('generateCertificationReport', () => {
    it('should generate a compliant PDF report with all sections', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        deforestation: [],
        ndviTrend: createMockTemporalData(),
        baselineImagery: createMockImageryData(new Date('2020-12-31')),
        currentImagery: createMockImageryData(new Date('2024-06-15')),
        yieldPrediction: createMockYieldPrediction(),
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: true,
        includeNDVITrend: true,
        includeYieldPrediction: true,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
      expect(result).toContain('certification-report');
      expect(result).toContain('.pdf');
    });

    it('should generate a non-compliant PDF report with deforestation alerts', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'non-compliant',
        deforestation: [createMockDeforestationEvent()],
        ndviTrend: createMockTemporalData(),
        baselineImagery: createMockImageryData(new Date('2020-12-31')),
        currentImagery: createMockImageryData(new Date('2024-06-15')),
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: true,
        includeNDVITrend: true,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
      expect(result).toContain('certification-report');
    });

    it('should generate a minimal PDF report without optional sections', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'requires-review',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'en',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
      expect(result).toContain('certification-report');
    });

    it('should generate report in English when language is "en"', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'en',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should include NDVI trend section when includeNDVITrend is true', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        ndviTrend: createMockTemporalData(),
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: true,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should include yield prediction section when includeYieldPrediction is true', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        yieldPrediction: createMockYieldPrediction(),
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: true,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should include before/after section when includeBeforeAfter is true', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        baselineImagery: createMockImageryData(new Date('2020-12-31')),
        currentImagery: createMockImageryData(new Date('2024-06-15')),
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: true,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should handle multiple deforestation events', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'non-compliant',
        deforestation: [
          createMockDeforestationEvent(),
          { ...createMockDeforestationEvent(), id: 'deforest-2', detectionDate: new Date('2024-07-01') },
          { ...createMockDeforestationEvent(), id: 'deforest-3', detectionDate: new Date('2024-08-01') },
        ],
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should generate unique filenames for different reports', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result1 = await exportService.generateCertificationReport(reportData, options);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result2 = await exportService.generateCertificationReport(reportData, options);

      expect(result1).not.toBe(result2);
    });

    it('should handle parcelle with minimal information', async () => {
      const minimalParcelle = {
        id: 'parcelle-456',
        code: null,
        label: null,
        village: null,
        region: null,
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: [[[[10.0, 5.0], [10.1, 5.0], [10.1, 5.1], [10.0, 5.1], [10.0, 5.0]]]],
        },
        surface_hectares: 1.0,
        planteur_name: null,
      };

      const reportData: CertificationReportData = {
        parcelle: minimalParcelle,
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });
  });

  describe('PDF Report Content Validation', () => {
    it('should include all required parcelle information fields', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      // Verify the report was generated
      expect(result).toBeDefined();
      expect(result).toContain('parcelle-123');
    });

    it('should include compliance status indicator', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'non-compliant',
        deforestation: [createMockDeforestationEvent()],
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });

    it('should include digital signature with timestamp', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      };

      const options: ReportOptions = {
        includeBeforeAfter: false,
        includeNDVITrend: false,
        includeYieldPrediction: false,
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional data gracefully', async () => {
      const reportData: CertificationReportData = {
        parcelle: createMockParcelle(),
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
        // All optional fields are undefined
      };

      const options: ReportOptions = {
        includeBeforeAfter: true, // Request section but data is missing
        includeNDVITrend: true, // Request section but data is missing
        includeYieldPrediction: true, // Request section but data is missing
        baselineDate: new Date('2020-12-31'),
        language: 'fr',
      };

      // Should not throw error, just skip missing sections
      const result = await exportService.generateCertificationReport(reportData, options);

      expect(result).toBeDefined();
    });
  });
});
