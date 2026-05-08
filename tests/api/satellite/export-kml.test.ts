/**
 * Integration tests for KML export API endpoint
 * 
 * Tests the POST /api/satellite/export/kml endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KMLExportOptions } from '@/lib/satellite/types';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock export service
const mockExportService = {
  exportKML: vi.fn(),
  shouldCompressToKMZ: vi.fn(),
};

vi.mock('@/lib/satellite/services/export.service', () => ({
  exportService: mockExportService,
}));

describe('POST /api/satellite/export/kml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
      method: 'POST',
      body: JSON.stringify({
        parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
        options: {
          includeNDVI: true,
          includeDeforestation: false,
          includeTemporal: false,
          format: 'kml',
        },
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if parcelleIds is missing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
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

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('parcelleIds');
  });

  it('should return 400 if parcelleIds contains invalid UUIDs', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
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

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid UUID format');
  });

  it('should return 400 if more than 100 parcelles requested', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Generate 101 valid UUIDs
    const parcelleIds = Array.from({ length: 101 }, (_, i) => 
      `123e4567-e89b-12d3-a456-${String(i).padStart(12, '0')}`
    );

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
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

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Maximum 100 parcelles');
  });

  it('should return 400 if options format is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
      method: 'POST',
      body: JSON.stringify({
        parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
        options: {
          includeNDVI: true,
          includeDeforestation: false,
          includeTemporal: false,
          format: 'invalid',
        },
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid format');
  });

  it('should return 404 if no parcelles found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    mockSupabase.from = mockFrom;

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
      method: 'POST',
      body: JSON.stringify({
        parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
        options: {
          includeNDVI: true,
          includeDeforestation: false,
          includeTemporal: false,
          format: 'kml',
        },
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('No parcelles found');
  });

  it('should successfully generate KML export for single parcelle', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockParcelle = {
      id: '123e4567-e89b-12d3-a456-426614174000',
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

    const mockFrom = vi.fn((table: string) => {
      if (table === 'parcelles') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [mockParcelle],
              error: null,
            }),
          }),
        };
      }
      // For NDVI, deforestation, temporal queries
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });

    mockSupabase.from = mockFrom;

    // Mock storage upload
    const mockStorageFrom = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'kml-exports/user-123/test.kml' },
        error: null,
      }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed-url' },
        error: null,
      }),
    });

    mockSupabase.storage.from = mockStorageFrom;

    // Mock export service
    mockExportService.exportKML.mockResolvedValue('<?xml version="1.0"?><kml>...</kml>');
    mockExportService.shouldCompressToKMZ.mockReturnValue(false);

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
      method: 'POST',
      body: JSON.stringify({
        parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
        options: {
          includeNDVI: false,
          includeDeforestation: false,
          includeTemporal: false,
          format: 'kml',
        },
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('fileUrl');
    expect(data).toHaveProperty('expiresAt');
    expect(data).toHaveProperty('filename');
    expect(data).toHaveProperty('estimatedSize');
    expect(data).toHaveProperty('parcelleCount');
    expect(data.parcelleCount).toBe(1);
    expect(data.fileUrl).toContain('signed-url');
  });

  it('should validate date filters', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { POST } = await import('@/app/api/satellite/export/kml/route');
    const request = new Request('http://localhost/api/satellite/export/kml', {
      method: 'POST',
      body: JSON.stringify({
        parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
        options: {
          includeNDVI: true,
          includeDeforestation: false,
          includeTemporal: true,
          startDate: 'invalid-date',
          format: 'kml',
        },
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid startDate');
  });
});
