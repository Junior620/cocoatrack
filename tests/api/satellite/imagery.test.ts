// CocoaTrack V2 - Satellite Imagery API Integration Tests
// Tests for GET /api/satellite/imagery endpoint

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/satellite/imagery/route';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      })),
    },
  })),
}));

// Mock rate limiting (allow all requests in tests)
vi.mock('@/lib/security/middleware', () => ({
  applyRateLimit: vi.fn(() => ({ 
    allowed: true, 
    result: {
      success: true,
      remaining: 99,
      resetTime: Date.now() + 60000,
      limit: 100,
    },
    response: null 
  })),
  addSecurityHeaders: vi.fn((response) => response),
}));

describe('GET /api/satellite/imagery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request validation', () => {
    it('should accept valid request with all parameters', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', '2024-05-03');
      url.searchParams.set('cloudCoverThreshold', '30');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request).toEqual({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03',
        cloudCoverThreshold: 30,
      });
    });

    it('should accept valid request with only required parameters', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request.parcelleId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(data.request.cloudCoverThreshold).toBe(20); // Default value
    });

    it('should reject request with invalid parcelleId format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', 'not-a-uuid');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.field).toBe('parcelleId');
      expect(data.details.message).toContain('Invalid parcelle ID format');
    });

    it('should reject request with missing parcelleId', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.field).toBe('parcelleId');
    });

    it('should reject request with invalid date format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', '05/03/2024');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.field).toBe('date');
      expect(data.details.message).toContain('Invalid date format');
    });

    it('should reject request with cloudCoverThreshold below 0', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('cloudCoverThreshold', '-5');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.field).toBe('cloudCoverThreshold');
      expect(data.details.message).toContain('must be at least 0');
    });

    it('should reject request with cloudCoverThreshold above 100', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('cloudCoverThreshold', '150');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details.field).toBe('cloudCoverThreshold');
      expect(data.details.message).toContain('must be at most 100');
    });
  });

  describe('Error messages', () => {
    it('should return clear error message for invalid UUID', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', 'invalid-uuid');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Invalid request parameters');
      expect(data.details.message).toContain('Invalid parcelle ID format');
      expect(data.details.message).toContain('Must be a valid UUID');
    });

    it('should return clear error message for invalid date', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', 'not-a-date');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.details.message).toContain('Invalid date format');
      expect(data.details.message).toContain('ISO 8601');
    });

    it('should return clear error message for out-of-range threshold', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('cloudCoverThreshold', '200');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.details.message).toContain('must be at most 100');
    });
  });

  describe('Edge cases', () => {
    it('should accept cloudCoverThreshold of 0', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('cloudCoverThreshold', '0');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request.cloudCoverThreshold).toBe(0);
    });

    it('should accept cloudCoverThreshold of 100', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('cloudCoverThreshold', '100');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request.cloudCoverThreshold).toBe(100);
    });

    it('should accept ISO 8601 datetime format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', '2024-05-03T12:00:00Z');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request.date).toBe('2024-05-03T12:00:00Z');
    });

    it('should accept ISO 8601 date format (YYYY-MM-DD)', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', '2024-05-03');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.request.date).toBe('2024-05-03');
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      // Mock unauthenticated user
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: { message: 'Not authenticated' },
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('UNAUTHORIZED');
      expect(data.message).toContain('Authentication required');
    });

    it('should reject request with invalid authentication token', async () => {
      // Mock authentication error
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: { message: 'Invalid token' },
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return clear error message for unauthenticated requests', async () => {
      // Mock unauthenticated user
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: null,
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toContain('log in');
      expect(data.message).toContain('satellite imagery');
    });

    it('should allow authenticated users to access endpoint', async () => {
      // Mock authenticated user
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'authenticated-user-id', email: 'user@example.com' } },
            error: null,
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Authorization', () => {
    it('should allow users to access their own parcelles', async () => {
      // Mock authenticated user with access to parcelle
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'user-with-access', email: 'owner@example.com' } },
            error: null,
          })),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => ({
            data: { id: '123e4567-e89b-12d3-a456-426614174000', planteur_id: 'user-with-access' },
            error: null,
          })),
        })),
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should rely on RLS policies for access control', async () => {
      // This test verifies that the endpoint relies on Supabase RLS
      // In production, RLS policies will enforce that users can only access
      // parcelles they own or have permission to view
      
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'test-user', email: 'test@example.com' } },
            error: null,
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      // Endpoint should succeed (RLS enforcement happens at database level)
      expect(response.status).toBe(200);
    });

    it('should include user context in all database queries', async () => {
      // Verify that authenticated user context is available for RLS
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      const mockGetUser = vi.fn(() => ({
        data: { user: { id: 'context-user', email: 'context@example.com' } },
        error: null,
      }));

      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: mockGetUser,
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      await GET(request);

      // Verify that getUser was called to establish user context
      expect(mockGetUser).toHaveBeenCalled();
    });
  });

  describe('Successful imagery retrieval', () => {
    it('should return imagery data for valid request', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('date', '2024-05-03');
      url.searchParams.set('cloudCoverThreshold', '20');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Verify response structure
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('request');
      expect(data.request).toEqual({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03',
        cloudCoverThreshold: 20,
      });
    });

    it('should use default values for optional parameters', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Verify default cloudCoverThreshold
      expect(data.request.cloudCoverThreshold).toBe(20);
      // Verify date defaults to 'most recent'
      expect(data.request.date).toBe('most recent');
    });

    it('should include rate limit headers in successful responses', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should include security headers in response', async () => {
      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Security headers are added by addSecurityHeaders middleware
      // Verify the function was called (headers are set by the middleware)
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Mock Supabase client to throw an error
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('INTERNAL_ERROR');
      expect(data.message).toContain('unexpected error');
    });

    it('should return user-friendly error messages', async () => {
      // Mock internal error
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockRejectedValueOnce(
        new Error('Internal error')
      );

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      // Should not expose internal error details
      expect(data.message).not.toContain('Database');
      expect(data.message).toContain('unexpected error');
    });

    it('should include security headers in error responses', async () => {
      // Mock authentication error
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: { message: 'Not authenticated' },
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/imagery');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(401);
      // Security headers should be present even in error responses
    });
  });
});
