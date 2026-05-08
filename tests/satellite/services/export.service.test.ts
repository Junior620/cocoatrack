/**
 * Tests for ExportService
 * 
 * Tests KML generation, CSV export, and batch export functionality
 * for temporal NDVI data and satellite imagery analysis.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '@/lib/satellite/services/export.service';
import type { 
  NDVIResult, 
  TemporalDataPoint, 
  DeforestationEvent,
  KMLExportOptions 
} from '@/lib/satellite/types';
import type { 
  ParcelleKMLData, 
  KMLExportData 
} from '@/lib/satellite/services/export.service';

// Helper function to create mock parcelle data
function createMockParcelle(overrides?: Partial<ParcelleKMLData>): ParcelleKMLData {
  return {
    id: 'parcelle-123',
    code: 'P001',
    label: 'Test Parcelle',
    village: 'Test Village',
    region: 'Centre',
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
    ...overrides,
  };
}

// Helper function to create mock NDVI result
function createMockNDVI(overrides?: Partial<NDVIResult>): NDVIResult {
  return {
    id: 'ndvi-123',
    parcelleId: 'parcelle-123',
    imageryId: 'img-123',
    calculationDate: new Date('2024-01-01'),
    meanNDVI: 0.75,
    minNDVI: 0.65,
    maxNDVI: 0.85,
    stdDevNDVI: 0.05,
    healthStatus: 'excellent',
    ndviRasterUrl: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper function to create mock deforestation event
function createMockDeforestationEvent(
  overrides?: Partial<DeforestationEvent>
): DeforestationEvent {
  return {
    id: 'deforest-123',
    parcelleId: 'parcelle-123',
    baselineDate: new Date('2020-12-31'),
    detectionDate: new Date('2024-01-01'),
    baselineNDVI: 0.8,
    currentNDVI: 0.45,
    ndviChange: -0.35,
    affectedAreaHectares: 1.2,
    affectedAreaPercent: 48.0,
    status: 'pending',
    acknowledgedBy: null,
    acknowledgedAt: null,
    acknowledgmentNotes: null,
    disputedBy: null,
    disputedAt: null,
    disputeReason: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// Helper function to create mock temporal data point
function createMockTemporalPoint(
  overrides?: Partial<TemporalDataPoint>
): TemporalDataPoint {
  return {
    date: new Date('2024-01-01'),
    ndvi: 0.75,
    cloudCover: 15.5,
    healthStatus: 'excellent',
    hasSignificantChange: false,
    ...overrides,
  };
}

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  describe('KML Export - Single Parcelle', () => {
    it('should generate valid KML structure with header and footer', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      // Check KML structure
      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2"');
      expect(kml).toContain('<Document>');
      expect(kml).toContain('</Document>');
      expect(kml).toContain('</kml>');
    });

    it('should include parcelle name in placemark', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            code: 'P001',
            label: 'Test Parcelle',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<name>P001 - Test Parcelle</name>');
    });

    it('should include parcelle geometry coordinates', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<Polygon>');
      expect(kml).toContain('<coordinates>');
      // Coordinates are rounded to remove trailing zeros
      expect(kml).toContain('10,5,0');
      expect(kml).toContain('10.1,5,0');
      expect(kml).toContain('10.1,5.1,0');
    });

    it('should include NDVI data when includeNDVI is true', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          ndvi: createMockNDVI({
            meanNDVI: 0.75,
            healthStatus: 'excellent',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: true,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('Analyse NDVI');
      expect(kml).toContain('0.750');
      expect(kml).toContain('Excellent');
    });

    it('should include deforestation alerts when includeDeforestation is true', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          deforestation: [
            createMockDeforestationEvent({
              ndviChange: -0.35,
              affectedAreaHectares: 1.2,
            }),
          ],
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: true,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('Alertes de Déforestation');
      expect(kml).toContain('1 alerte(s) détectée(s)');
      expect(kml).toContain('-0.350');
      expect(kml).toContain('1.20 ha');
    });

    it('should apply correct style based on health status', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          ndvi: createMockNDVI({
            healthStatus: 'good',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: true,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<styleUrl>#style_good</styleUrl>');
    });

    it('should generate styles for all health statuses', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<Style id="style_excellent">');
      expect(kml).toContain('<Style id="style_good">');
      expect(kml).toContain('<Style id="style_fair">');
      expect(kml).toContain('<Style id="style_poor">');
      expect(kml).toContain('<Style id="style_critical">');
    });

    it('should escape XML special characters in text fields', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            label: 'Test & <Special> "Characters"',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('Test &amp; &lt;Special&gt; &quot;Characters&quot;');
    });

    it('should include parcelle metadata in description', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            code: 'P001',
            village: 'Test Village',
            region: 'Centre',
            surface_hectares: 2.5,
            planteur_name: 'Test Planteur',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('P001');
      expect(kml).toContain('Test Village');
      expect(kml).toContain('Centre');
      expect(kml).toContain('2.50 ha');
      expect(kml).toContain('Test Planteur');
    });
  });

  describe('KML Export - Temporal Data', () => {
    it('should generate time-enabled placemarks when includeTemporal is true', async () => {
      const temporal: TemporalDataPoint[] = [
        createMockTemporalPoint({
          date: new Date('2024-01-01'),
          ndvi: 0.70,
        }),
        createMockTemporalPoint({
          date: new Date('2024-02-01'),
          ndvi: 0.75,
        }),
      ];

      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          temporal,
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: true,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<Folder>');
      expect(kml).toContain('Temporal Analysis');
      expect(kml).toContain('<TimeStamp>');
      expect(kml).toContain('<when>');
    });

    it('should sort temporal data chronologically', async () => {
      const temporal: TemporalDataPoint[] = [
        createMockTemporalPoint({
          date: new Date('2024-03-01'),
          ndvi: 0.80,
        }),
        createMockTemporalPoint({
          date: new Date('2024-01-01'),
          ndvi: 0.70,
        }),
        createMockTemporalPoint({
          date: new Date('2024-02-01'),
          ndvi: 0.75,
        }),
      ];

      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          temporal,
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: true,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      // Check that dates appear in chronological order
      const jan = kml.indexOf('2024-01-01');
      const feb = kml.indexOf('2024-02-01');
      const mar = kml.indexOf('2024-03-01');

      expect(jan).toBeLessThan(feb);
      expect(feb).toBeLessThan(mar);
    });

    it('should include temporal summary in folder description', async () => {
      const temporal: TemporalDataPoint[] = [
        createMockTemporalPoint({
          date: new Date('2024-01-01'),
        }),
        createMockTemporalPoint({
          date: new Date('2024-02-01'),
        }),
      ];

      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          temporal,
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: true,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('Time-enabled visualization');
      expect(kml).toContain('janvier 2024');
      expect(kml).toContain('février 2024');
    });

    it('should mark significant changes in temporal data', async () => {
      const temporal: TemporalDataPoint[] = [
        createMockTemporalPoint({
          date: new Date('2024-01-01'),
          hasSignificantChange: false,
        }),
        createMockTemporalPoint({
          date: new Date('2024-02-01'),
          hasSignificantChange: true,
        }),
      ];

      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
          temporal,
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: true,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('Changement significatif détecté');
    });
  });

  describe('KML Export - Batch Export', () => {
    it('should generate KML with multiple parcelles', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            id: 'parcelle-1',
            code: 'P001',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-2',
            code: 'P002',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-3',
            code: 'P003',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('P001');
      expect(kml).toContain('P002');
      expect(kml).toContain('P003');
    });

    it('should organize parcelles into folders by region', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            id: 'parcelle-1',
            region: 'Centre',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-2',
            region: 'Sud',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-3',
            region: 'Centre',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<name>Centre (2)</name>');
      expect(kml).toContain('<name>Sud (1)</name>');
    });

    it('should handle parcelles without region', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            id: 'parcelle-1',
            region: null,
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-2',
            region: 'Centre',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-3',
            region: 'Sud',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      // With 3 regions (unknown, Centre, Sud), should create separate folders
      expect(kml).toContain('Sans Région');
      expect(kml).toContain('Centre');
      expect(kml).toContain('Sud');
    });

    it('should create single folder when all parcelles in same region', async () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle({
            id: 'parcelle-1',
            region: 'Centre',
          }),
        },
        {
          parcelle: createMockParcelle({
            id: 'parcelle-2',
            region: 'Centre',
          }),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const kml = await exportService.exportKML(data, options);

      expect(kml).toContain('<name>Parcelles (2)</name>');
    });

    it('should estimate KML file size correctly', () => {
      const data: KMLExportData[] = [
        {
          parcelle: createMockParcelle(),
        },
      ];

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const estimatedSize = exportService.estimateKMLSize(data, options);

      expect(estimatedSize).toBeGreaterThan(0);
      expect(typeof estimatedSize).toBe('number');
    });

    it('should recommend compression for large exports', () => {
      // Create a large dataset with more parcelles and temporal data
      const data: KMLExportData[] = Array.from({ length: 200 }, (_, i) => ({
        parcelle: createMockParcelle({
          id: `parcelle-${i}`,
          // Add more complex geometry to increase size
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  // Create a polygon with many points
                  ...Array.from({ length: 50 }, (_, j) => [
                    10.0 + j * 0.01,
                    5.0 + j * 0.01,
                  ]),
                  [10.0, 5.0], // Close the polygon
                ],
              ],
            ],
          },
        }),
        ndvi: createMockNDVI(),
        temporal: Array.from({ length: 24 }, (_, j) =>
          createMockTemporalPoint({
            date: new Date(`2024-${(j % 12) + 1}-01`),
          })
        ),
      }));

      const options: KMLExportOptions = {
        includeTemporal: true,
        includeNDVI: true,
        includeDeforestation: false,
        format: 'kml',
      };

      const shouldCompress = exportService.shouldCompressToKMZ(data, options);

      expect(shouldCompress).toBe(true);
    });

    it('should provide optimization recommendations', () => {
      const data: KMLExportData[] = Array.from({ length: 60 }, (_, i) => ({
        parcelle: createMockParcelle({
          id: `parcelle-${i}`,
        }),
      }));

      const options: KMLExportOptions = {
        includeTemporal: false,
        includeNDVI: false,
        includeDeforestation: false,
        format: 'kml',
      };

      const recommendations = exportService.getOptimizationRecommendations(
        data,
        options
      );

      expect(recommendations).toHaveProperty('estimatedSize');
      expect(recommendations).toHaveProperty('shouldCompress');
      expect(recommendations).toHaveProperty('recommendations');
      expect(Array.isArray(recommendations.recommendations)).toBe(true);
    });
  });

  describe('CSV Export', () => {
  describe('exportTemporalCSVWithStats', () => {
    it('should generate CSV with correct headers', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
    });

    it('should format dates correctly as YYYY-MM-DD', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-03-15'),
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-03-15'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('2024-03-15');
    });

    it('should format NDVI values with 4 decimal places', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.7543,
          minNDVI: 0.6521,
          maxNDVI: 0.8567,
          stdDevNDVI: 0.0543,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      const values = lines[1].split(',');
      
      expect(values[1]).toBe('0.7543'); // mean_ndvi
      expect(values[2]).toBe('0.6521'); // min_ndvi
      expect(values[3]).toBe('0.8567'); // max_ndvi
      expect(values[4]).toBe('0.0543'); // std_dev
    });

    it('should include health status', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      const values = lines[1].split(',');
      
      expect(values[5]).toBe('good');
    });

    it('should calculate change from previous correctly', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.7000,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          parcelleId: 'parcelle-1',
          imageryId: 'img-2',
          calculationDate: new Date('2024-02-01'),
          meanNDVI: 0.7500,
          minNDVI: 0.70,
          maxNDVI: 0.90,
          stdDevNDVI: 0.04,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-02-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      // First entry should have 0 change
      const firstValues = lines[1].split(',');
      expect(firstValues[6]).toBe('0.0000');
      
      // Second entry should have change of 0.05
      const secondValues = lines[2].split(',');
      expect(secondValues[6]).toBe('0.0500');
    });

    it('should handle negative change from previous', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.8000,
          minNDVI: 0.75,
          maxNDVI: 0.90,
          stdDevNDVI: 0.03,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          parcelleId: 'parcelle-1',
          imageryId: 'img-2',
          calculationDate: new Date('2024-02-01'),
          meanNDVI: 0.6500,
          minNDVI: 0.60,
          maxNDVI: 0.75,
          stdDevNDVI: 0.04,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date('2024-02-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      const secondValues = lines[2].split(',');
      expect(secondValues[6]).toBe('-0.1500');
    });

    it('should sort results by calculation date', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '2',
          parcelleId: 'parcelle-1',
          imageryId: 'img-2',
          calculationDate: new Date('2024-03-01'),
          meanNDVI: 0.75,
          minNDVI: 0.70,
          maxNDVI: 0.80,
          stdDevNDVI: 0.03,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-03-01'),
        },
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.70,
          minNDVI: 0.65,
          maxNDVI: 0.75,
          stdDevNDVI: 0.04,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '3',
          parcelleId: 'parcelle-1',
          imageryId: 'img-3',
          calculationDate: new Date('2024-02-01'),
          meanNDVI: 0.72,
          minNDVI: 0.67,
          maxNDVI: 0.77,
          stdDevNDVI: 0.035,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date('2024-02-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      // Check dates are in chronological order
      expect(lines[1]).toContain('2024-01-01');
      expect(lines[2]).toContain('2024-02-01');
      expect(lines[3]).toContain('2024-03-01');
    });

    it('should handle empty array', async () => {
      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', []);
      const lines = csv.split('\n');
      
      // Should only have header
      expect(lines.length).toBe(2); // Header + empty line
      expect(lines[0]).toBe('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
    });

    it('should handle single result', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      expect(lines.length).toBe(3); // Header + 1 data row + empty line
      
      const values = lines[1].split(',');
      expect(values[6]).toBe('0.0000'); // First entry has 0 change
    });

    it('should generate valid CSV format', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          parcelleId: 'parcelle-1',
          imageryId: 'img-2',
          calculationDate: new Date('2024-02-01'),
          meanNDVI: 0.78,
          minNDVI: 0.68,
          maxNDVI: 0.88,
          stdDevNDVI: 0.045,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-02-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      
      // Check CSV structure
      const lines = csv.split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(3); // Header + 2 data rows
      
      // Each line should have 7 columns
      lines.forEach(line => {
        const columns = line.split(',');
        expect(columns.length).toBe(7);
      });
    });

    it('should handle extreme NDVI values', async () => {
      const ndviResults: NDVIResult[] = [
        {
          id: '1',
          parcelleId: 'parcelle-1',
          imageryId: 'img-1',
          calculationDate: new Date('2024-01-01'),
          meanNDVI: -0.1234,
          minNDVI: -0.5678,
          maxNDVI: 0.1234,
          stdDevNDVI: 0.2345,
          healthStatus: 'critical',
          ndviRasterUrl: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          parcelleId: 'parcelle-1',
          imageryId: 'img-2',
          calculationDate: new Date('2024-02-01'),
          meanNDVI: 0.9876,
          minNDVI: 0.9000,
          maxNDVI: 1.0000,
          stdDevNDVI: 0.0234,
          healthStatus: 'excellent',
          ndviRasterUrl: null,
          createdAt: new Date('2024-02-01'),
        },
      ];

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      // Check first row
      const firstValues = lines[1].split(',');
      expect(firstValues[1]).toBe('-0.1234');
      expect(firstValues[2]).toBe('-0.5678');
      
      // Check second row
      const secondValues = lines[2].split(',');
      expect(secondValues[1]).toBe('0.9876');
      expect(secondValues[3]).toBe('1.0000');
    });

    it('should handle all health status types', async () => {
      const healthStatuses: Array<'excellent' | 'good' | 'fair' | 'poor' | 'critical'> = [
        'excellent',
        'good',
        'fair',
        'poor',
        'critical',
      ];

      const ndviResults: NDVIResult[] = healthStatuses.map((status, index) => ({
        id: `${index + 1}`,
        parcelleId: 'parcelle-1',
        imageryId: `img-${index + 1}`,
        calculationDate: new Date(`2024-0${index + 1}-01`),
        meanNDVI: 0.7 - index * 0.1,
        minNDVI: 0.6 - index * 0.1,
        maxNDVI: 0.8 - index * 0.1,
        stdDevNDVI: 0.05,
        healthStatus: status,
        ndviRasterUrl: null,
        createdAt: new Date(`2024-0${index + 1}-01`),
      }));

      const csv = await exportService.exportTemporalCSVWithStats('parcelle-1', ndviResults);
      const lines = csv.split('\n');
      
      healthStatuses.forEach((status, index) => {
        const values = lines[index + 1].split(',');
        expect(values[5]).toBe(status);
      });
    });
  });

  describe('exportTemporalCSV (simple version)', () => {
    it('should generate CSV with temporal data points', async () => {
      const temporal: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 15.5,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.78,
          cloudCover: 10.2,
          healthStatus: 'excellent',
          hasSignificantChange: true,
        },
      ];

      const csv = await exportService.exportTemporalCSV('parcelle-1', temporal);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('Date,NDVI,Cloud Cover (%),Health Status,Significant Change');
      expect(lines[1]).toContain('2024-01-01');
      expect(lines[1]).toContain('0.7500');
      expect(lines[1]).toContain('15.50');
      expect(lines[1]).toContain('excellent');
      expect(lines[1]).toContain('No');
      
      expect(lines[2]).toContain('2024-02-01');
      expect(lines[2]).toContain('Yes');
    });
  });
  });
});
