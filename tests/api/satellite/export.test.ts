/**
 * Integration tests for Export API endpoints
 * 
 * Tests:
 * - GET /api/satellite/export/csv
 * - POST /api/satellite/export/csv
 * - POST /api/satellite/export/kml
 * 
 * Covers:
 * - CSV export (single parcelle, date filtering)
 * - KML export (single and batch, with options)
 * - Authentication and authorization
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as GET_CSV, POST as POST_CSV } from '@/app/api/satellite/export/csv/route';
import { POST as POST_KML } from '@/app/api/satellite/export/kml/route';
import type { NDVIResult } from '@/lib/satellite/types';

// Hoist mocks to avoid initialization issues
const { mockSupabase, mockExportService } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  };

  const mockExportService = {
    exportTemporalCSVWithStats: vi.fn(),
    exportKML: vi.fn(),
    shouldCompressToKMZ: vi.fn(),
  };

  return { mockSupabase, mockExportService };
});

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock export service
vi.mock('@/lib/satellite/services/export.service', () => ({
  exportService: mockExportService,
}));

describe('Export API Integration Tests', () => {
  const testParcelleId = '123e4567-e89b-12d3-a456-426614174000';
  const testUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock: authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: testUserId } },
      error: null,
    });
  });

  describe('GET /api/satellite/export/csv', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const url = new URL(`http://localhost/api/satellite/export/csv?parcelleId=${testParcelleId}`);
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should require parcelleId parameter', async () => {
      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parcelleId');
    });

    it('should validate parcelleId format', async () => {
      const url = new URL('http://localhost/api/satellite/export/csv?parcelleId=invalid-uuid');
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid parcelleId');
    });

    it('should return 404 for non-existent parcelle', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      const url = new URL(`http://localhost/api/satellite/export/csv?parcelleId=${testParcelleId}`);
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(404);
    });

    it('should return CSV with correct content type and headers', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
      };

      const mockNDVIResults = [
        {
          id: 'ndvi-1',
          parcelle_id: testParcelleId,
          imagery_id: null,
          calculation_date: '2024-05-01T00:00:00Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-05-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockParcelle,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'ndvi_results') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockNDVIResults,
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      mockExportService.exportTemporalCSVWithStats.mockResolvedValue(
        'date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous\n2024-05-01,0.75,0.65,0.85,0.05,excellent,0.00'
      );

      const url = new URL(`http://localhost/api/satellite/export/csv?parcelleId=${testParcelleId}`);
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');
      expect(response.headers.get('content-disposition')).toContain('attachment');
      expect(response.headers.get('content-disposition')).toContain('.csv');

      const csv = await response.text();
      expect(csv).toContain('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
    });

    it('should filter by startDate', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
      };

      const mockNDVIResults = [
        {
          id: 'ndvi-1',
          parcelle_id: testParcelleId,
          imagery_id: null,
          calculation_date: '2024-05-05T00:00:00Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-05-05T00:00:00Z',
        },
      ];

      let gteCalledWith: string | null = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockParcelle,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'ndvi_results') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  gte: vi.fn((field: string, value: string) => {
                    gteCalledWith = value;
                    return Promise.resolve({
                      data: mockNDVIResults,
                      error: null,
                    });
                  }),
                }),
              }),
            }),
          };
        }
      });

      mockExportService.exportTemporalCSVWithStats.mockResolvedValue(
        'date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous\n2024-05-05,0.75,0.65,0.85,0.05,excellent,0.00'
      );

      const startDate = '2024-05-01T00:00:00.000Z';
      const url = new URL(`http://localhost/api/satellite/export/csv?parcelleId=${testParcelleId}&startDate=${startDate}`);
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(200);
      expect(gteCalledWith).toBe(startDate);
    });

    it('should validate date format', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockParcelle,
                  error: null,
                }),
              }),
            }),
          };
        }
        // For ndvi_results table, return a proper chain
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      });

      const url = new URL(`http://localhost/api/satellite/export/csv?parcelleId=${testParcelleId}&startDate=invalid-date`);
      const request = new NextRequest(url);
      const response = await GET_CSV(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid startDate');
    });
  });

  describe('POST /api/satellite/export/csv', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({ parcelleId: testParcelleId }),
      });
      const response = await POST_CSV(request);

      expect(response.status).toBe(401);
    });

    it('should require parcelleId in body', async () => {
      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST_CSV(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid request body');
    });

    it('should validate parcelleId format', async () => {
      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({ parcelleId: 'invalid-uuid' }),
      });
      const response = await POST_CSV(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid request body');
    });

    it('should return CSV with correct content type and headers', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
      };

      const mockNDVIResults = [
        {
          id: 'ndvi-1',
          parcelle_id: testParcelleId,
          imagery_id: null,
          calculation_date: '2024-05-01T00:00:00Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-05-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockParcelle,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'ndvi_results') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockNDVIResults,
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      mockExportService.exportTemporalCSVWithStats.mockResolvedValue(
        'date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous\n2024-05-01,0.75,0.65,0.85,0.05,excellent,0.00'
      );

      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({ parcelleId: testParcelleId }),
      });
      const response = await POST_CSV(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');

      const csv = await response.text();
      expect(csv).toContain('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
    });

    it('should handle both startDate and endDate filters', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
      };

      const mockNDVIResults = [
        {
          id: 'ndvi-1',
          parcelle_id: testParcelleId,
          imagery_id: null,
          calculation_date: '2024-05-03T00:00:00Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-05-03T00:00:00Z',
        },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockParcelle,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'ndvi_results') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({
                      data: mockNDVIResults,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
      });

      mockExportService.exportTemporalCSVWithStats.mockResolvedValue(
        'date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous\n2024-05-03,0.75,0.65,0.85,0.05,excellent,0.00'
      );

      const url = new URL('http://localhost/api/satellite/export/csv');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleId: testParcelleId,
          startDate: '2024-05-01T00:00:00.000Z',
          endDate: '2024-05-05T00:00:00.000Z',
        }),
      });
      const response = await POST_CSV(request);

      expect(response.status).toBe(200);
      const csv = await response.text();
      expect(csv.split('\n').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/satellite/export/kml', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should require parcelleIds array', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parcelleIds');
    });

    it('should validate parcelleIds contain valid UUIDs', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: ['invalid-uuid'],
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid UUID format');
    });

    it('should reject more than 100 parcelles', async () => {
      const parcelleIds = Array.from({ length: 101 }, (_, i) =>
        `123e4567-e89b-12d3-a456-${String(i).padStart(12, '0')}`
      );

      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds,
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Maximum 100 parcelles');
    });

    it('should validate options format', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'invalid',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid format');
    });

    it('should validate boolean options', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: 'yes', // Should be boolean
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('must be boolean');
    });

    it('should validate date filters', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: true,
            includeDeforestation: false,
            includeTemporal: true,
            startDate: 'invalid-date',
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid startDate');
    });

    it('should return 404 for non-existent parcelles', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: false,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('No parcelles found');
    });

    it('should successfully export single parcelle as KML', async () => {
      const mockParcelle = {
        id: testParcelleId,
        code: 'P001',
        label: 'Test Parcelle',
        village: 'Test Village',
        region: 'Test Region',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        },
        surface_hectares: 2.5,
        planteur: { nom: 'Doe', prenom: 'John' },
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [mockParcelle],
            error: null,
          }),
        }),
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'kml-exports/user-123/test.kml' },
          error: null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-url' },
          error: null,
        }),
      });

      mockExportService.exportKML.mockResolvedValue('<?xml version="1.0"?><kml>...</kml>');
      mockExportService.shouldCompressToKMZ.mockReturnValue(false);

      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
          options: {
            includeNDVI: false,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('fileUrl');
      expect(data).toHaveProperty('expiresAt');
      expect(data).toHaveProperty('filename');
      expect(data).toHaveProperty('estimatedSize');
      expect(data).toHaveProperty('parcelleCount');
      
      expect(data.parcelleCount).toBe(1);
      expect(data.filename).toContain('.kml');
      expect(data.fileUrl).toBeTruthy();
      expect(data.estimatedSize).toBeGreaterThan(0);
    });

    it('should successfully export multiple parcelles as KML (batch)', async () => {
      const testParcelleIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
      ];

      const mockParcelles = testParcelleIds.map((id, index) => ({
        id,
        code: `P00${index + 1}`,
        label: `Test Parcelle ${index + 1}`,
        village: 'Test Village',
        region: 'Test Region',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        },
        surface_hectares: 2.5,
        planteur: { nom: 'Doe', prenom: 'John' },
      }));

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: mockParcelles,
            error: null,
          }),
        }),
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'kml-exports/user-123/test.kml' },
          error: null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-url' },
          error: null,
        }),
      });

      mockExportService.exportKML.mockResolvedValue('<?xml version="1.0"?><kml>...</kml>');
      mockExportService.shouldCompressToKMZ.mockReturnValue(false);

      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: testParcelleIds,
          options: {
            includeNDVI: false,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.parcelleCount).toBe(testParcelleIds.length);
      expect(data.filename).toContain('parcelles');
    });

    it('should handle invalid JSON in request body', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: 'invalid-json',
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle missing options object', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [testParcelleId],
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('options');
    });

    it('should handle empty parcelleIds array', async () => {
      const url = new URL('http://localhost/api/satellite/export/kml');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          parcelleIds: [],
          options: {
            includeNDVI: false,
            includeDeforestation: false,
            includeTemporal: false,
            format: 'kml',
          },
        }),
      });
      const response = await POST_KML(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parcelleIds');
    });
  });
});
