// CocoaTrack V2 - Planteurs Import Template API Route Tests
// Unit tests for GET /api/planteurs/import/template

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
const mockAddSecurityHeaders = vi.fn((response) => response);

vi.mock('@/lib/security/middleware', () => ({
  addSecurityHeaders: mockAddSecurityHeaders,
}));

// Import after mocks are set up
const { GET } = await import('../route');

describe('GET /api/planteurs/import/template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return CSV with correct headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    const response = await GET(request);
    const csvContent = await response.text();

    expect(response.status).toBe(200);
    expect(csvContent).toContain('nom,prénoms,CNI,téléphone,superficie');
  });

  it('should include example data rows', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    const response = await GET(request);
    const csvContent = await response.text();

    // Check for example rows
    expect(csvContent).toContain('Konan,Yao,CI123456,+2250701234567,5.5');
    expect(csvContent).toContain('Kouassi,Marie,CI789012,+2250709876543,3.2');
    expect(csvContent).toContain('Tra Bi,Jean,,+2250701111111,');
  });

  it('should set correct Content-Type header', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  });

  it('should set Content-Disposition header for download', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="planteurs_import_template.csv"');
  });

  it('should have correct CSV structure with header and 3 example rows', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    const response = await GET(request);
    const csvContent = await response.text();
    const lines = csvContent.split('\n');

    // Should have 4 lines: 1 header + 3 example rows
    expect(lines.length).toBe(4);
    
    // First line should be headers
    expect(lines[0]).toBe('nom,prénoms,CNI,téléphone,superficie');
    
    // Remaining lines should be data
    expect(lines[1]).toBeTruthy();
    expect(lines[2]).toBeTruthy();
    expect(lines[3]).toBeTruthy();
  });

  it('should call addSecurityHeaders', async () => {
    const request = new NextRequest('http://localhost:3000/api/planteurs/import/template', {
      method: 'GET',
    });

    await GET(request);

    expect(mockAddSecurityHeaders).toHaveBeenCalled();
  });
});
