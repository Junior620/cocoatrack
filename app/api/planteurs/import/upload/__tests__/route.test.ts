// CocoaTrack V2 - Planteurs Import Upload API Route Tests
// Unit tests for POST /api/planteurs/import/upload

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
const mockCreateServerSupabaseClient = vi.fn();
const mockApplyRateLimit = vi.fn(() => ({ allowed: true, result: {} }));
const mockAddSecurityHeaders = vi.fn((response) => response);

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

vi.mock('@/lib/security/middleware', () => ({
  applyRateLimit: mockApplyRateLimit,
  addSecurityHeaders: mockAddSecurityHeaders,
}));

// Import after mocks are set up
const { POST } = await import('../route');

describe('POST /api/planteurs/import/upload', () => {
  let mockSupabase: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
    };
    
    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabase);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    // Mock unauthenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.csv', { type: 'text/csv' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error_code).toBe('UNAUTHORIZED');
  });

  it('should return 403 if user has no cooperative', async () => {
    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock profile with no cooperative
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: null },
            error: null,
          }),
        }),
      }),
    });

    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.csv', { type: 'text/csv' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error_code).toBe('NO_COOPERATIVE');
  });

  it('should return 400 if file is not provided', async () => {
    // Mock authenticated user with cooperative
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: 'coop-123' },
            error: null,
          }),
        }),
      }),
    });

    const formData = new FormData();
    // No file added

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error_code).toBe('FILE_READ_ERROR');
  });

  it('should return 400 if file type is not CSV', async () => {
    // Mock authenticated user with cooperative
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: 'coop-123' },
            error: null,
          }),
        }),
      }),
    });

    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.txt', { type: 'text/plain' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error_code).toBe('INVALID_FILE_TYPE');
  });

  it('should return 400 if file size exceeds 10MB', async () => {
    // Mock authenticated user with cooperative
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: 'coop-123' },
            error: null,
          }),
        }),
      }),
    });

    // Create a file larger than 10MB
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
    const formData = new FormData();
    formData.append('file', new File([largeContent], 'large.csv', { type: 'text/csv' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error_code).toBe('FILE_TOO_LARGE');
  });

  it('should successfully upload a valid CSV file', async () => {
    // Mock authenticated user with cooperative
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock profile query
    const profileMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: 'coop-123' },
            error: null,
          }),
        }),
      }),
    };

    // Mock storage upload
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn(),
    };

    mockSupabase.storage.from.mockReturnValue(storageMock);

    // Mock database insert
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'import-123',
              cooperative_id: 'coop-123',
              filename: 'test.csv',
              file_size: 100,
              file_path: 'coop-123/123456_test.csv',
              import_status: 'uploaded',
              parse_result: null,
              import_summary: null,
              created_by: 'user-123',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    };

    // Setup mock to return different values for different table calls
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileMock;
      } else if (table === 'planteur_import_files') {
        return insertMock;
      }
      return profileMock; // default
    });

    const formData = new FormData();
    formData.append('file', new File(['nom,prénoms\nTest,User'], 'test.csv', { type: 'text/csv' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('import-123');
    expect(data.filename).toBe('test.csv');
    expect(data.import_status).toBe('uploaded');
    expect(storageMock.upload).toHaveBeenCalled();
  });

  it('should cleanup storage if database insert fails', async () => {
    // Mock authenticated user with cooperative
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock profile query
    const profileMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { cooperative_id: 'coop-123' },
            error: null,
          }),
        }),
      }),
    };

    // Mock storage upload (success)
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase.storage.from.mockReturnValue(storageMock);

    // Mock database insert (failure)
    const insertMock = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error'),
          }),
        }),
      }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileMock;
      } else if (table === 'planteur_import_files') {
        return insertMock;
      }
      return profileMock;
    });

    const formData = new FormData();
    formData.append('file', new File(['nom,prénoms\nTest,User'], 'test.csv', { type: 'text/csv' }));

    const request = new NextRequest('http://localhost:3000/api/planteurs/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error_code).toBe('INTERNAL_ERROR');
    expect(storageMock.remove).toHaveBeenCalled();
  });
});
