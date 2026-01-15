// CocoaTrack V2 - Pagination Property Tests
// Property 16: Pagination Consistency
// Validates: Requirements 3.1, 6.11
//
// For any paginated list request with page_size N, the response SHALL contain
// at most N items, and the total_count SHALL equal the actual count of all matching records.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PaginatedResult } from '@/types';

// ============================================================================
// PAGINATION LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Calculate pagination metadata from total count and page parameters
 */
export function calculatePagination(
  totalCount: number,
  page: number,
  pageSize: number
): { from: number; to: number; totalPages: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const totalPages = Math.ceil(totalCount / pageSize);
  return { from, to, totalPages };
}

/**
 * Create a paginated result from data array
 */
export function createPaginatedResult<T>(
  allData: T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const total = allData.length;
  const { from, totalPages } = calculatePagination(total, page, pageSize);
  const data = allData.slice(from, from + pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Validate that a paginated result is consistent
 * Note: This validates the core pagination properties without enforcing
 * page range constraints (which are handled by the API layer)
 */
export function validatePaginatedResult<T>(
  result: PaginatedResult<T>,
  expectedTotal: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 16.1: Response contains at most pageSize items
  if (result.data.length > result.pageSize) {
    errors.push(
      `Data length (${result.data.length}) exceeds pageSize (${result.pageSize})`
    );
  }

  // Property 16.2: Total equals actual count of all matching records
  if (result.total !== expectedTotal) {
    errors.push(
      `Total (${result.total}) does not match expected total (${expectedTotal})`
    );
  }

  // Property 16.3: totalPages is correctly calculated
  const expectedTotalPages = Math.ceil(expectedTotal / result.pageSize);
  if (result.totalPages !== expectedTotalPages) {
    errors.push(
      `totalPages (${result.totalPages}) does not match expected (${expectedTotalPages})`
    );
  }

  // Property 16.4: Page number must be positive
  // Note: Pages beyond totalPages are valid (return empty data) - this is API behavior
  if (result.page < 1) {
    errors.push(`Page (${result.page}) must be at least 1`);
  }

  // Property 16.5: Data length is consistent with page position
  // - Pages within range: may have up to pageSize items
  // - Last page: may have fewer items
  // - Pages beyond range: should have 0 items
  if (result.totalPages > 0 && result.page <= result.totalPages) {
    if (result.page === result.totalPages) {
      // Last page may have fewer items
      const expectedLastPageItems = expectedTotal % result.pageSize || result.pageSize;
      if (result.data.length > expectedLastPageItems) {
        errors.push(
          `Last page has ${result.data.length} items, expected at most ${expectedLastPageItems}`
        );
      }
    }
  } else if (result.page > result.totalPages) {
    // Pages beyond range should return empty data
    if (result.data.length !== 0) {
      errors.push(
        `Page ${result.page} is beyond totalPages ${result.totalPages}, expected empty data`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 16: Pagination Consistency', () => {
  // Arbitrary for valid pagination parameters
  const paginationParamsArb = fc.record({
    page: fc.integer({ min: 1, max: 100 }),
    pageSize: fc.integer({ min: 1, max: 100 }),
  });

  // Arbitrary for data arrays of various sizes
  const dataArrayArb = fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.integer(),
    }),
    { minLength: 0, maxLength: 500 }
  );

  it('should return at most pageSize items for any page', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(dataArrayArb, paginationParamsArb, (data, params) => {
        const result = createPaginatedResult(data, params.page, params.pageSize);
        
        // Core property: data length <= pageSize
        expect(result.data.length).toBeLessThanOrEqual(params.pageSize);
      }),
      { numRuns: 100 }
    );
  });

  it('should have total equal to actual count of all records', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(dataArrayArb, paginationParamsArb, (data, params) => {
        const result = createPaginatedResult(data, params.page, params.pageSize);
        
        // Core property: total equals actual data count
        expect(result.total).toBe(data.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should calculate totalPages correctly', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(dataArrayArb, paginationParamsArb, (data, params) => {
        const result = createPaginatedResult(data, params.page, params.pageSize);
        
        // Core property: totalPages = ceil(total / pageSize)
        const expectedTotalPages = Math.ceil(data.length / params.pageSize);
        expect(result.totalPages).toBe(expectedTotalPages);
      }),
      { numRuns: 100 }
    );
  });

  it('should return correct items for each page', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(dataArrayArb, paginationParamsArb, (data, params) => {
        const result = createPaginatedResult(data, params.page, params.pageSize);
        
        // Calculate expected slice
        const from = (params.page - 1) * params.pageSize;
        const expectedData = data.slice(from, from + params.pageSize);
        
        // Core property: returned data matches expected slice
        expect(result.data).toEqual(expectedData);
      }),
      { numRuns: 100 }
    );
  });

  it('should pass full validation for any valid pagination', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(dataArrayArb, paginationParamsArb, (data, params) => {
        const result = createPaginatedResult(data, params.page, params.pageSize);
        const validation = validatePaginatedResult(result, data.length);
        
        // All validation rules should pass
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty data correctly', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(paginationParamsArb, (params) => {
        const result = createPaginatedResult([], params.page, params.pageSize);
        
        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle page beyond data range', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid() }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (data, pageSize) => {
          const totalPages = Math.ceil(data.length / pageSize);
          const beyondPage = totalPages + 5;
          
          const result = createPaginatedResult(data, beyondPage, pageSize);
          
          // Page beyond range should return empty data but correct total
          expect(result.data).toEqual([]);
          expect(result.total).toBe(data.length);
          expect(result.totalPages).toBe(totalPages);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency across all pages', () => {
    // Feature: cocoatrack-v2, Property 16: Pagination Consistency
    // Validates: Requirements 3.1, 6.11
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), value: fc.integer() }), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (data, pageSize) => {
          const totalPages = Math.ceil(data.length / pageSize);
          const allItems: { id: string; value: number }[] = [];
          
          // Collect all items from all pages
          for (let page = 1; page <= totalPages; page++) {
            const result = createPaginatedResult(data, page, pageSize);
            allItems.push(...result.data);
            
            // Each page should report same total
            expect(result.total).toBe(data.length);
            expect(result.totalPages).toBe(totalPages);
          }
          
          // All items collected should equal original data
          expect(allItems).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });
});
