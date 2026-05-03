// CocoaTrack V2 - Satellite Imagery Validation Tests
// Tests for satellite imagery request validation schemas

import { describe, it, expect } from 'vitest';
import {
  satelliteImageryRequestSchema,
  parseSatelliteImageryRequest,
  formatValidationError,
} from '@/lib/validations/satellite';

describe('satelliteImageryRequestSchema', () => {
  describe('parcelleId validation', () => {
    it('should accept valid UUID', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parcelleId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should reject invalid UUID format', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: 'not-a-uuid',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid parcelle ID format');
      }
    });

    it('should reject missing parcelleId', () => {
      const result = satelliteImageryRequestSchema.safeParse({});
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('parcelleId');
      }
    });

    it('should reject empty string parcelleId', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '',
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('date validation', () => {
    it('should accept valid ISO 8601 date (YYYY-MM-DD)', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe('2024-05-03');
      }
    });

    it('should accept valid ISO 8601 datetime', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03T12:00:00Z',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe('2024-05-03T12:00:00Z');
      }
    });

    it('should accept missing date (optional)', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeUndefined();
      }
    });

    it('should reject invalid date format', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '05/03/2024',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid date format');
      }
    });

    it('should reject invalid date string', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: 'not-a-date',
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('cloudCoverThreshold validation', () => {
    it('should accept valid threshold (0)', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: 0,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cloudCoverThreshold).toBe(0);
      }
    });

    it('should accept valid threshold (50)', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: 50,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cloudCoverThreshold).toBe(50);
      }
    });

    it('should accept valid threshold (100)', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: 100,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cloudCoverThreshold).toBe(100);
      }
    });

    it('should default to 20 when not provided', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cloudCoverThreshold).toBe(20);
      }
    });

    it('should reject threshold below 0', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: -1,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must be at least 0');
      }
    });

    it('should reject threshold above 100', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: 101,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must be at most 100');
      }
    });

    it('should reject non-numeric threshold', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        cloudCoverThreshold: 'fifty',
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('combined validation', () => {
    it('should accept all valid parameters', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03',
        cloudCoverThreshold: 30,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          parcelleId: '123e4567-e89b-12d3-a456-426614174000',
          date: '2024-05-03',
          cloudCoverThreshold: 30,
        });
      }
    });

    it('should reject multiple invalid parameters', () => {
      const result = satelliteImageryRequestSchema.safeParse({
        parcelleId: 'invalid-uuid',
        date: 'invalid-date',
        cloudCoverThreshold: 150,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('parseSatelliteImageryRequest', () => {
  it('should parse valid query parameters', () => {
    const searchParams = new URLSearchParams({
      parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-05-03',
      cloudCoverThreshold: '30',
    });
    
    const result = parseSatelliteImageryRequest(searchParams);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        parcelleId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-05-03',
        cloudCoverThreshold: 30,
      });
    }
  });

  it('should parse with missing optional parameters', () => {
    const searchParams = new URLSearchParams({
      parcelleId: '123e4567-e89b-12d3-a456-426614174000',
    });
    
    const result = parseSatelliteImageryRequest(searchParams);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parcelleId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.data.date).toBeUndefined();
      expect(result.data.cloudCoverThreshold).toBe(20); // Default value
    }
  });

  it('should handle invalid cloudCoverThreshold string', () => {
    const searchParams = new URLSearchParams({
      parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      cloudCoverThreshold: 'not-a-number',
    });
    
    const result = parseSatelliteImageryRequest(searchParams);
    
    // Should use default value when parsing fails
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cloudCoverThreshold).toBe(20);
    }
  });

  it('should return error for invalid parcelleId', () => {
    const searchParams = new URLSearchParams({
      parcelleId: 'invalid-uuid',
    });
    
    const result = parseSatelliteImageryRequest(searchParams);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('parcelleId');
    }
  });

  it('should return error for missing parcelleId', () => {
    const searchParams = new URLSearchParams({});
    
    const result = parseSatelliteImageryRequest(searchParams);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('parcelleId');
    }
  });
});

describe('formatValidationError', () => {
  it('should format validation error with field and message', () => {
    const parseResult = satelliteImageryRequestSchema.safeParse({
      parcelleId: 'invalid-uuid',
    });
    
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const formatted = formatValidationError(parseResult.error);
      
      expect(formatted).toHaveProperty('field');
      expect(formatted).toHaveProperty('message');
      expect(formatted.field).toBe('parcelleId');
      expect(formatted.message).toContain('Invalid parcelle ID format');
    }
  });

  it('should format nested field path', () => {
    const parseResult = satelliteImageryRequestSchema.safeParse({
      parcelleId: '123e4567-e89b-12d3-a456-426614174000',
      cloudCoverThreshold: -5,
    });
    
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const formatted = formatValidationError(parseResult.error);
      
      expect(formatted.field).toBe('cloudCoverThreshold');
      expect(formatted.message).toContain('must be at least 0');
    }
  });
});
