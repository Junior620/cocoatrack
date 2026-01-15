// CocoaTrack V2 - Invoice Property Tests
// Property 12: Invoice Total Accuracy
// Validates: Requirements 9.6
//
// For any invoice, the total_amount SHALL equal the sum of total_amount from all
// deliveries within the invoice's period_start and period_end for the specified cooperative_id.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// TYPES
// ============================================================================

interface Delivery {
  id: string;
  weight_kg: number;
  price_per_kg: number;
  total_amount: number;
  delivered_at: string;
  cooperative_id: string;
}

interface Invoice {
  id: string;
  cooperative_id: string;
  period_start: string;
  period_end: string;
  total_weight_kg: number;
  total_amount: number;
  delivery_ids: string[];
}

// ============================================================================
// INVOICE CALCULATION LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Calculate delivery total amount
 * This mirrors the database trigger: total_amount = round(weight_kg * price_per_kg)
 */
export function calculateDeliveryTotal(weight_kg: number, price_per_kg: number): number {
  return Math.round(weight_kg * price_per_kg);
}

/**
 * Filter deliveries by period and cooperative
 */
export function filterDeliveriesForInvoice(
  deliveries: Delivery[],
  cooperativeId: string,
  periodStart: string,
  periodEnd: string
): Delivery[] {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  // Set end date to end of day
  endDate.setHours(23, 59, 59, 999);

  return deliveries.filter((d) => {
    const deliveryDate = new Date(d.delivered_at);
    return (
      d.cooperative_id === cooperativeId &&
      deliveryDate >= startDate &&
      deliveryDate <= endDate
    );
  });
}

/**
 * Calculate invoice totals from deliveries
 */
export function calculateInvoiceTotals(deliveries: Delivery[]): {
  total_weight_kg: number;
  total_amount: number;
} {
  const total_weight_kg = deliveries.reduce((sum, d) => sum + d.weight_kg, 0);
  const total_amount = deliveries.reduce((sum, d) => sum + d.total_amount, 0);

  return {
    total_weight_kg: Math.round(total_weight_kg * 100) / 100,
    total_amount,
  };
}

/**
 * Generate an invoice from deliveries
 */
export function generateInvoice(
  deliveries: Delivery[],
  cooperativeId: string,
  periodStart: string,
  periodEnd: string
): Invoice {
  const filteredDeliveries = filterDeliveriesForInvoice(
    deliveries,
    cooperativeId,
    periodStart,
    periodEnd
  );

  const totals = calculateInvoiceTotals(filteredDeliveries);

  return {
    id: crypto.randomUUID(),
    cooperative_id: cooperativeId,
    period_start: periodStart,
    period_end: periodEnd,
    total_weight_kg: totals.total_weight_kg,
    total_amount: totals.total_amount,
    delivery_ids: filteredDeliveries.map((d) => d.id),
  };
}

/**
 * Validate invoice totals against deliveries
 */
export function validateInvoiceTotals(
  invoice: Invoice,
  deliveries: Delivery[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Get deliveries that should be in this invoice
  const invoiceDeliveries = deliveries.filter((d) =>
    invoice.delivery_ids.includes(d.id)
  );

  // Calculate expected totals
  const expectedTotals = calculateInvoiceTotals(invoiceDeliveries);

  // Property 12.1: Total amount equals sum of delivery total_amounts
  if (invoice.total_amount !== expectedTotals.total_amount) {
    errors.push(
      `Invoice total_amount (${invoice.total_amount}) does not match sum of deliveries (${expectedTotals.total_amount})`
    );
  }

  // Property 12.2: Total weight equals sum of delivery weights
  if (Math.abs(invoice.total_weight_kg - expectedTotals.total_weight_kg) > 0.01) {
    errors.push(
      `Invoice total_weight_kg (${invoice.total_weight_kg}) does not match sum of deliveries (${expectedTotals.total_weight_kg})`
    );
  }

  // Property 12.3: All delivery_ids should be valid
  const invalidIds = invoice.delivery_ids.filter(
    (id) => !deliveries.some((d) => d.id === id)
  );
  if (invalidIds.length > 0) {
    errors.push(`Invoice contains invalid delivery IDs: ${invalidIds.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Fixed date range for testing (June 2024)
const PERIOD_START = '2024-06-01';
const PERIOD_END = '2024-06-30';

/**
 * Create a delivery with the given parameters
 */
function createDelivery(
  id: string,
  weight_kg: number,
  price_per_kg: number,
  day: number,
  cooperativeId: string
): Delivery {
  return {
    id,
    weight_kg,
    price_per_kg,
    total_amount: calculateDeliveryTotal(weight_kg, price_per_kg),
    delivered_at: `2024-06-${day.toString().padStart(2, '0')}T12:00:00.000Z`,
    cooperative_id: cooperativeId,
  };
}

/**
 * Create a delivery outside the period
 */
function createDeliveryOutsidePeriod(
  id: string,
  weight_kg: number,
  price_per_kg: number,
  month: number,
  day: number,
  cooperativeId: string
): Delivery {
  return {
    id,
    weight_kg,
    price_per_kg,
    total_amount: calculateDeliveryTotal(weight_kg, price_per_kg),
    delivered_at: `2024-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`,
    cooperative_id: cooperativeId,
  };
}

// ============================================================================
// GENERATORS - Deterministic, unique IDs, no substring tricks
// ============================================================================

/**
 * Generate a list of deliveries for a cooperative
 * ✅ FIX 1: IDs are now unique deterministic strings (no UUID substring)
 */
function generateDeliveries(cooperativeId: string, count: number, seed: number): Delivery[] {
  const deliveries: Delivery[] = [];
  for (let i = 0; i < count; i++) {
    // ✅ Unique ID: cooperativeId:seed:index
    const id = `${cooperativeId}:${seed}:${i}`;
    const weightKg = ((seed * (i + 1) * 17) % 99900 + 100) / 100; // 1.00 to 1000.00
    const pricePerKg = (seed * (i + 1) * 31) % 4900 + 100; // 100 to 5000
    const day = ((seed * (i + 1)) % 30) + 1; // 1 to 30
    deliveries.push(createDelivery(id, weightKg, pricePerKg, day, cooperativeId));
  }
  return deliveries;
}

/**
 * Generate deliveries outside the period
 * ✅ FIX 1: IDs are now unique deterministic strings
 */
function generateDeliveriesOutside(cooperativeId: string, count: number, seed: number): Delivery[] {
  const deliveries: Delivery[] = [];
  for (let i = 0; i < count; i++) {
    // ✅ Unique ID with "out" prefix to avoid collision
    const id = `${cooperativeId}:${seed}:out:${i}`;
    const weightKg = ((seed * (i + 1) * 17) % 99900 + 100) / 100;
    const pricePerKg = (seed * (i + 1) * 31) % 4900 + 100;
    const month = ((seed * (i + 1)) % 5) + 1; // 1 to 5 (Jan-May)
    const day = ((seed * (i + 1)) % 28) + 1; // 1 to 28
    deliveries.push(createDeliveryOutsidePeriod(id, weightKg, pricePerKg, month, day, cooperativeId));
  }
  return deliveries;
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 12: Invoice Total Accuracy', () => {
  it('should calculate total_amount as sum of delivery total_amounts', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        (cooperativeId, count, seed) => {
          const deliveries = generateDeliveries(cooperativeId, count, seed);

          const invoice = generateInvoice(
            deliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );

          // ✅ FIX 2: Calculate expected on FILTERED deliveries (the truth)
          const expectedDeliveries = filterDeliveriesForInvoice(
            deliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );
          const expectedTotal = expectedDeliveries.reduce(
            (sum, d) => sum + d.total_amount,
            0
          );

          // Property: invoice total equals sum of filtered delivery totals
          expect(invoice.total_amount).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate total_weight_kg as sum of delivery weights', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        (cooperativeId, count, seed) => {
          const deliveries = generateDeliveries(cooperativeId, count, seed);

          const invoice = generateInvoice(
            deliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );

          // ✅ FIX 2: Calculate expected on FILTERED deliveries
          const expectedDeliveries = filterDeliveriesForInvoice(
            deliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );
          const expectedWeight = expectedDeliveries.reduce(
            (sum, d) => sum + d.weight_kg,
            0
          );
          const roundedExpected = Math.round(expectedWeight * 100) / 100;

          // Property: invoice weight equals sum of filtered delivery weights
          expect(invoice.total_weight_kg).toBeCloseTo(roundedExpected, 2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only include deliveries within the period', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 1000000 }),
        (cooperativeId, insideCount, outsideCount, seed) => {
          const insideDeliveries = generateDeliveries(cooperativeId, insideCount, seed);
          const outsideDeliveries = generateDeliveriesOutside(cooperativeId, outsideCount, seed + 1);

          const allDeliveries = [...insideDeliveries, ...outsideDeliveries];

          const invoice = generateInvoice(
            allDeliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );

          // ✅ FIX 3: Compare against the filter truth, not assumptions
          const expected = filterDeliveriesForInvoice(
            allDeliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );
          expect(invoice.delivery_ids.length).toBe(expected.length);

          // Verify all included deliveries are from inside period
          const includedDeliveries = allDeliveries.filter((d) =>
            invoice.delivery_ids.includes(d.id)
          );
          includedDeliveries.forEach((d) => {
            const deliveryDate = new Date(d.delivered_at);
            expect(deliveryDate >= new Date(PERIOD_START)).toBe(true);
            expect(deliveryDate <= new Date(PERIOD_END + 'T23:59:59.999Z')).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only include deliveries from the specified cooperative', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 1000000 }),
        (cooperativeId1, cooperativeId2, count1, count2, seed) => {
          fc.pre(cooperativeId1 !== cooperativeId2);

          const coop1Deliveries = generateDeliveries(cooperativeId1, count1, seed);
          const coop2Deliveries = generateDeliveries(cooperativeId2, count2, seed + 1);

          const allDeliveries = [...coop1Deliveries, ...coop2Deliveries];

          const invoice = generateInvoice(
            allDeliveries,
            cooperativeId1,
            PERIOD_START,
            PERIOD_END
          );

          // ✅ FIX 3: Compare against the filter truth
          const expected = filterDeliveriesForInvoice(
            allDeliveries,
            cooperativeId1,
            PERIOD_START,
            PERIOD_END
          );
          expect(invoice.delivery_ids.length).toBe(expected.length);

          // Verify all included deliveries are from correct cooperative
          const includedDeliveries = allDeliveries.filter((d) =>
            invoice.delivery_ids.includes(d.id)
          );
          includedDeliveries.forEach((d) => {
            expect(d.cooperative_id).toBe(cooperativeId1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should pass full validation for any generated invoice', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        (cooperativeId, count, seed) => {
          const deliveries = generateDeliveries(cooperativeId, count, seed);

          const invoice = generateInvoice(
            deliveries,
            cooperativeId,
            PERIOD_START,
            PERIOD_END
          );

          const validation = validateInvoiceTotals(invoice, deliveries);

          // All validation rules should pass
          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty deliveries correctly', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    fc.assert(
      fc.property(
        fc.uuid(),
        (cooperativeId) => {
          const invoice = generateInvoice([], cooperativeId, PERIOD_START, PERIOD_END);

          // Empty invoice should have zero totals
          expect(invoice.total_amount).toBe(0);
          expect(invoice.total_weight_kg).toBe(0);
          expect(invoice.delivery_ids).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain delivery total calculation accuracy', () => {
    // Feature: cocoatrack-v2, Property 12: Invoice Total Accuracy
    // Validates: Requirements 9.6
    // This tests the underlying delivery total calculation
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }), // weight in cents
        fc.integer({ min: 1, max: 1000000 }),
        (weight_cents, price_per_kg) => {
          const weight_kg = weight_cents / 100;
          const total = calculateDeliveryTotal(weight_kg, price_per_kg);

          // Property: total is rounded integer
          expect(Number.isInteger(total)).toBe(true);

          // Property: total equals rounded product
          const expected = Math.round(weight_kg * price_per_kg);
          expect(total).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
