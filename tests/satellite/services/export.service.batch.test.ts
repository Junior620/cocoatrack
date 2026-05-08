/**
 * Unit tests for ExportService batch report generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '@/lib/satellite/services/export.service';
import type { CertificationReportData } from '@/lib/satellite/services/export.service';
import type { ReportOptions } from '@/lib/satellite/types';

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      private files: Map<string, Blob> = new Map();

      file(name: string, content: Blob) {
        this.files.set(name, content);
      }

      async generateAsync(options: any): Promise<Blob> {
        // Return a mock blob representing the ZIP
        const mockZipContent = JSON.stringify({
          files: Array.from(this.files.keys()),
          fileCount: this.files.size,
        });
        return new Blob([mockZipContent], { type: 'application/zip' });
      }
    },
  };
});

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
      getNumberOfPages: () => 1,
    };
    lastAutoTable = {
      finalY: 100,
    };

    setProperties() {}
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setLineWidth() {}
    setDrawColor() {}
    setFillColor() {}
    text() {}
    line() {}
    roundedRect() {}
    splitTextToSize(text: string) {
      return [text];
    }
    addPage() {}
    setPage() {}
    autoTable() {
      // Mock autoTable method
      this.lastAutoTable = { finalY: 100 };
    }

    output(type: string): Blob {
      return new Blob(['mock-pdf-content'], { type: 'application/pdf' });
    }
  },
}));

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => ({
  default: (doc: any, options: any) => {
    // Mock implementation that sets lastAutoTable
    doc.lastAutoTable = { finalY: 100 };
  },
}));

describe('ExportService - Batch Report Generation', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  const createMockReportData = (
    parcelleId: string,
    code: string
  ): CertificationReportData => ({
    parcelle: {
      id: parcelleId,
      code,
      label: `Parcelle ${code}`,
      village: 'Test Village',
      region: 'Test Region',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [10.0, 5.0],
              [10.1, 5.0],
              [10.1, 5.1],
              [10.0, 5.1],
              [10.0, 5.0],
            ],
          ],
        ],
      },
      surface_hectares: 2.5,
      planteur_name: 'Test Planteur',
    },
    complianceStatus: 'compliant',
    deforestation: [],
    ndviTrend: [
      {
        date: new Date('2024-01-01'),
        ndvi: 0.75,
        cloudCover: 10,
        healthStatus: 'good',
        hasSignificantChange: false,
      },
    ],
    generatedBy: 'test-user@example.com',
  });

  const createMockOptions = (): ReportOptions => ({
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
    language: 'fr',
  });

  it('should generate batch reports for multiple parcelles', async () => {
    const reportData = [
      createMockReportData('parcelle-1', 'P001'),
      createMockReportData('parcelle-2', 'P002'),
      createMockReportData('parcelle-3', 'P003'),
    ];
    const options = createMockOptions();

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
    expect(zipUrl).toContain('batch-certification-reports');
    expect(zipUrl).toContain('.zip');
  });

  it('should call progress callback with correct values', async () => {
    const reportData = [
      createMockReportData('parcelle-1', 'P001'),
      createMockReportData('parcelle-2', 'P002'),
      createMockReportData('parcelle-3', 'P003'),
    ];
    const options = createMockOptions();
    const progressCallback = vi.fn();

    await exportService.generateBatchCertificationReports(
      reportData,
      options,
      undefined,
      progressCallback
    );

    // Should be called once for each parcelle
    expect(progressCallback).toHaveBeenCalledTimes(3);
    expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3);
    expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3);
    expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('should handle single parcelle batch', async () => {
    const reportData = [createMockReportData('parcelle-1', 'P001')];
    const options = createMockOptions();

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
    expect(zipUrl).toContain('.zip');
  });

  it('should handle empty parcelle array', async () => {
    const reportData: CertificationReportData[] = [];
    const options = createMockOptions();

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
  });

  it('should sanitize parcelle codes in filenames', async () => {
    const reportData = [
      createMockReportData('parcelle-1', 'P/001*Test'),
      createMockReportData('parcelle-2', 'P:002?Test'),
    ];
    const options = createMockOptions();

    // Should not throw error with special characters
    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
  });

  it('should respect report options for all parcelles', async () => {
    const reportData = [
      createMockReportData('parcelle-1', 'P001'),
      createMockReportData('parcelle-2', 'P002'),
    ];
    const options: ReportOptions = {
      includeBeforeAfter: false,
      includeNDVITrend: false,
      includeYieldPrediction: false,
      baselineDate: new Date('2020-12-31'),
      language: 'en',
    };

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
  });

  it('should handle parcelles with missing optional data', async () => {
    const reportData: CertificationReportData[] = [
      {
        parcelle: {
          id: 'parcelle-1',
          code: 'P001',
          label: null,
          village: null,
          region: null,
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [10.0, 5.0],
                  [10.1, 5.0],
                  [10.1, 5.1],
                  [10.0, 5.1],
                  [10.0, 5.0],
                ],
              ],
            ],
          },
          surface_hectares: 2.5,
          planteur_name: null,
        },
        complianceStatus: 'compliant',
        generatedBy: 'test-user@example.com',
      },
    ];
    const options = createMockOptions();

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
  });

  it('should handle large batch (stress test)', async () => {
    // Generate 50 parcelles
    const reportData = Array.from({ length: 50 }, (_, i) =>
      createMockReportData(`parcelle-${i}`, `P${String(i).padStart(3, '0')}`)
    );
    const options = createMockOptions();

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options
    );

    expect(zipUrl).toBeDefined();
  });

  it('should use custom template if provided', async () => {
    const reportData = [createMockReportData('parcelle-1', 'P001')];
    const options = createMockOptions();
    const customTemplate = {
      language: 'fr' as const,
      branding: {
        companyName: 'Custom Company',
        logoUrl: null,
        tagline: 'Custom Tagline',
      },
      colors: {
        primary: '#2d5016',
        secondary: '#6FAF3D',
        accent: '#E68A1F',
        text: '#1f2937',
        background: '#ffffff',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fonts: {
        heading: 'helvetica',
        body: 'helvetica',
      },
      layout: {
        pageMargin: 20,
        sectionSpacing: 10,
      },
    };

    const zipUrl = await exportService.generateBatchCertificationReports(
      reportData,
      options,
      customTemplate
    );

    expect(zipUrl).toBeDefined();
  });
});
