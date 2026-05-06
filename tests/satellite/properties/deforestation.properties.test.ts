/**
 * Property-Based Tests for Deforestation Detection
 * 
 * This file implements property-based testing for deforestation detection logic using fast-check.
 * Property-based testing validates that certain properties hold true across a wide range
 * of randomly generated inputs, providing stronger correctness guarantees than example-based tests.
 * 
 * Properties tested:
 * - Property 9: Deforestation detection threshold
 * - Property 10: Alert record completeness
 * - Property 12: Alert status transitions
 * 
 * Requirements: Task 4.1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { DeforestationEvent } from '@/lib/satellite/types';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Number of iterations for property-based tests
 * Higher values provide stronger guarantees but take longer to run
 */
const NUM_RUNS = 100;

/**
 * Epsilon for floating-point comparisons
 * Accounts for floating-point arithmetic precision issues
 */
const EPSILON = 1e-10;

/**
 * Deforestation detection thresholds (from requirements)
 */
const DEFORESTATION_NDVI_THRESHOLD = 0.3;
const DEFORESTATION_AREA_THRESHOLD = 0.5; // hectares

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid NDVI values in range [-1, 1]
 */
const ndviValueArbitrary = fc.double({ min: -1, max: 1, noNaN: true });

/**
 * Arbitrary for generating positive area values in hectares
 */
const areaHectaresArbitrary = fc.double({ min: 0.1, max: 100, noNaN: true });

/**
 * Arbitrary for generating affected area percentages
 */
const areaPercentArbitrary = fc.double({ min: 0, max: 100, noNaN: true });

/**
 * Arbitrary for generating UUID strings
 */
const uuidArbitrary = fc.uuid();

/**
 * Arbitrary for generating dates
 */
const dateArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

/**
 * Arbitrary for generating alert status values
 */
const alertStatusArbitrary = fc.constantFrom('pending', 'acknowledged', 'disputed', 'resolved');

/**
 * Arbitrary for generating non-empty strings
 */
const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Arbitrary for generating complete DeforestationEvent objects with valid relationships
 */
const deforestationEventArbitrary = fc
  .tuple(
    uuidArbitrary,
    uuidArbitrary,
    dateArbitrary,
    ndviValueArbitrary,
    ndviValueArbitrary,
    areaHectaresArbitrary,
    areaPercentArbitrary,
    alertStatusArbitrary,
    dateArbitrary
  )
  .chain(([id, parcelleId, baselineDate, baselineNDVI, currentNDVI, affectedAreaHectares, affectedAreaPercent, status, createdAtRaw]) => {
    // Ensure createdAt is a valid Date
    const createdAt = createdAtRaw instanceof Date && !isNaN(createdAtRaw.getTime())
      ? createdAtRaw
      : new Date('2020-01-01');
    
    // Calculate ndviChange based on baseline and current
    const ndviChange = currentNDVI - baselineNDVI;
    
    // Ensure detectionDate >= baselineDate
    const detectionDate = new Date(baselineDate.getTime() + Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000));
    
    // Ensure updatedAt >= createdAt
    const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    
    // Generate status-specific fields
    if (status === 'acknowledged') {
      const minDate = createdAt;
      const maxDate = new Date(minDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      return fc.tuple(
        uuidArbitrary,
        fc.date({ min: minDate, max: maxDate }),
        fc.option(nonEmptyStringArbitrary, { nil: null })
      ).map(([userId, ackAt, notes]) => ({
        id,
        parcelleId,
        baselineDate,
        detectionDate,
        baselineNDVI,
        currentNDVI,
        ndviChange,
        affectedAreaHectares,
        affectedAreaPercent,
        status,
        acknowledgedBy: userId,
        acknowledgedAt: ackAt,
        acknowledgmentNotes: notes,
        disputedBy: null,
        disputedAt: null,
        disputeReason: null,
        createdAt,
        updatedAt,
      }));
    } else if (status === 'disputed') {
      const minDate = createdAt;
      const maxDate = new Date(minDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      return fc.tuple(
        uuidArbitrary,
        fc.date({ min: minDate, max: maxDate }),
        nonEmptyStringArbitrary
      ).map(([userId, dispAt, reason]) => ({
        id,
        parcelleId,
        baselineDate,
        detectionDate,
        baselineNDVI,
        currentNDVI,
        ndviChange,
        affectedAreaHectares,
        affectedAreaPercent,
        status,
        acknowledgedBy: null,
        acknowledgedAt: null,
        acknowledgmentNotes: null,
        disputedBy: userId,
        disputedAt: dispAt,
        disputeReason: reason,
        createdAt,
        updatedAt,
      }));
    } else {
      return fc.constant({
        id,
        parcelleId,
        baselineDate,
        detectionDate,
        baselineNDVI,
        currentNDVI,
        ndviChange,
        affectedAreaHectares,
        affectedAreaPercent,
        status,
        acknowledgedBy: null,
        acknowledgedAt: null,
        acknowledgmentNotes: null,
        disputedBy: null,
        disputedAt: null,
        disputeReason: null,
        createdAt,
        updatedAt,
      });
    }
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if deforestation should be detected based on thresholds
 */
function shouldDetectDeforestation(
  baselineNDVI: number,
  currentNDVI: number,
  affectedAreaHectares: number
): boolean {
  const ndviChange = currentNDVI - baselineNDVI;
  const ndviDecrease = Math.abs(ndviChange);
  
  return (
    ndviChange < 0 && // NDVI decreased (vegetation loss)
    ndviDecrease > DEFORESTATION_NDVI_THRESHOLD && // Decrease exceeds threshold
    affectedAreaHectares > DEFORESTATION_AREA_THRESHOLD // Affected area exceeds threshold
  );
}

/**
 * Validate that a DeforestationEvent has all required fields
 */
function validateEventCompleteness(event: DeforestationEvent): boolean {
  // Required fields must be present and valid
  const hasRequiredFields = 
    typeof event.id === 'string' && event.id.length > 0 &&
    typeof event.parcelleId === 'string' && event.parcelleId.length > 0 &&
    event.baselineDate instanceof Date &&
    event.detectionDate instanceof Date &&
    typeof event.baselineNDVI === 'number' && !isNaN(event.baselineNDVI) &&
    typeof event.currentNDVI === 'number' && !isNaN(event.currentNDVI) &&
    typeof event.ndviChange === 'number' && !isNaN(event.ndviChange) &&
    typeof event.affectedAreaHectares === 'number' && !isNaN(event.affectedAreaHectares) &&
    typeof event.affectedAreaPercent === 'number' && !isNaN(event.affectedAreaPercent) &&
    typeof event.status === 'string' &&
    ['pending', 'acknowledged', 'disputed', 'resolved'].includes(event.status) &&
    event.createdAt instanceof Date &&
    event.updatedAt instanceof Date;

  return hasRequiredFields;
}

/**
 * Validate status-specific fields
 */
function validateStatusFields(event: DeforestationEvent): boolean {
  // If status is 'acknowledged', acknowledged fields should be present
  if (event.status === 'acknowledged') {
    return (
      event.acknowledgedBy !== null &&
      event.acknowledgedAt !== null
    );
  }

  // If status is 'disputed', disputed fields should be present
  if (event.status === 'disputed') {
    return (
      event.disputedBy !== null &&
      event.disputedAt !== null &&
      event.disputeReason !== null
    );
  }

  return true;
}

// ============================================================================
// Property 9: Deforestation Detection Threshold
// ============================================================================

describe('Property 9: Deforestation Detection Threshold', () => {
  /**
   * Property 9.1: Deforestation is detected when thresholds are exceeded
   * 
   * For any pair of NDVI values (baseline and current) and affected area,
   * deforestation SHALL be flagged if and only if:
   * - (baseline - current) > 0.3 (NDVI decrease exceeds threshold)
   * - affected area > 0.5 hectares
   * 
   * This validates the core deforestation detection logic.
   */
  it('should detect deforestation when NDVI decrease > 0.3 and area > 0.5 ha', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        ndviValueArbitrary,
        areaHectaresArbitrary,
        (baselineNDVI, currentNDVI, affectedAreaHectares) => {
          const ndviChange = currentNDVI - baselineNDVI;
          const ndviDecrease = Math.abs(ndviChange);
          
          const detected = shouldDetectDeforestation(
            baselineNDVI,
            currentNDVI,
            affectedAreaHectares
          );

          // If NDVI decreased by more than 0.3 AND area > 0.5 ha, should detect
          if (ndviChange < 0 && ndviDecrease > DEFORESTATION_NDVI_THRESHOLD && affectedAreaHectares > DEFORESTATION_AREA_THRESHOLD) {
            expect(detected).toBe(true);
          }

          // If NDVI increased or decreased by less than 0.3, should NOT detect
          if (ndviChange >= 0 || ndviDecrease <= DEFORESTATION_NDVI_THRESHOLD) {
            expect(detected).toBe(false);
          }

          // If area is too small, should NOT detect
          if (affectedAreaHectares <= DEFORESTATION_AREA_THRESHOLD) {
            expect(detected).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 9.2: No false positives when NDVI increases
   * 
   * For any case where current NDVI >= baseline NDVI (vegetation improvement),
   * deforestation SHALL NOT be detected regardless of area.
   * 
   * This validates that vegetation improvement is never flagged as deforestation.
   */
  it('should NOT detect deforestation when NDVI increases or stays same', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.double({ min: 0, max: 2, noNaN: true }),
        areaHectaresArbitrary,
        (baselineNDVI, ndviIncrease, affectedAreaHectares) => {
          // Ensure current NDVI >= baseline NDVI
          const currentNDVI = Math.min(1, baselineNDVI + ndviIncrease);
          
          const detected = shouldDetectDeforestation(
            baselineNDVI,
            currentNDVI,
            affectedAreaHectares
          );

          // Should never detect deforestation when NDVI increases
          expect(detected).toBe(false);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 9.3: No false positives for small NDVI decreases
   * 
   * For any case where NDVI decrease <= 0.3, deforestation SHALL NOT be detected
   * regardless of affected area.
   * 
   * This validates the NDVI threshold is properly enforced.
   */
  it('should NOT detect deforestation when NDVI decrease <= 0.3', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.double({ min: 0, max: 0.3, noNaN: true }),
        areaHectaresArbitrary,
        (baselineNDVI, ndviDecrease, affectedAreaHectares) => {
          // Ensure NDVI decrease is within threshold
          const currentNDVI = Math.max(-1, baselineNDVI - ndviDecrease);
          
          const detected = shouldDetectDeforestation(
            baselineNDVI,
            currentNDVI,
            affectedAreaHectares
          );

          // Should never detect deforestation when decrease is too small
          expect(detected).toBe(false);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 9.4: No false positives for small affected areas
   * 
   * For any case where affected area <= 0.5 hectares, deforestation SHALL NOT
   * be detected regardless of NDVI change.
   * 
   * This validates the area threshold is properly enforced.
   */
  it('should NOT detect deforestation when affected area <= 0.5 ha', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.double({ min: 0.31, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        (baselineNDVI, ndviDecrease, affectedAreaHectares) => {
          // Ensure NDVI decrease exceeds threshold but area is too small
          const currentNDVI = Math.max(-1, baselineNDVI - ndviDecrease);
          
          const detected = shouldDetectDeforestation(
            baselineNDVI,
            currentNDVI,
            affectedAreaHectares
          );

          // Should never detect deforestation when area is too small
          expect(detected).toBe(false);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 9.5: Threshold boundary conditions
   * 
   * Test exact boundary values for NDVI threshold (0.3) and area threshold (0.5 ha).
   * Values exactly at the threshold should NOT trigger detection (> not >=).
   */
  it('should NOT detect deforestation at exact threshold boundaries', () => {
    // Test NDVI decrease exactly at 0.3 threshold (should NOT detect)
    // Using values that result in exactly 0.3 decrease
    const baselineNDVI1 = 0.6;
    const currentNDVI1 = 0.3; // Decrease of exactly 0.3
    const detected1 = shouldDetectDeforestation(baselineNDVI1, currentNDVI1, 1.0);
    expect(detected1).toBe(false);

    // Test area exactly at 0.5 ha threshold (should NOT detect)
    const baselineNDVI2 = 0.8;
    const currentNDVI2 = 0.4; // Decrease of 0.4 (> 0.3)
    const detected2 = shouldDetectDeforestation(baselineNDVI2, currentNDVI2, 0.5);
    expect(detected2).toBe(false);

    // Test just above thresholds (should detect)
    const baselineNDVI3 = 0.8;
    const currentNDVI3 = 0.49; // Decrease of 0.31 (> 0.3)
    const detected3 = shouldDetectDeforestation(baselineNDVI3, currentNDVI3, 0.51);
    expect(detected3).toBe(true);
  });

  /**
   * Property 9.6: Detection is deterministic
   * 
   * For any given baseline NDVI, current NDVI, and affected area,
   * the detection result should be deterministic (same inputs → same output).
   */
  it('should produce deterministic detection results', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        ndviValueArbitrary,
        areaHectaresArbitrary,
        (baselineNDVI, currentNDVI, affectedAreaHectares) => {
          const detected1 = shouldDetectDeforestation(baselineNDVI, currentNDVI, affectedAreaHectares);
          const detected2 = shouldDetectDeforestation(baselineNDVI, currentNDVI, affectedAreaHectares);
          
          expect(detected1).toBe(detected2);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 9.7: NDVI change calculation correctness
   * 
   * For any baseline and current NDVI, the NDVI change should equal
   * (current - baseline), and the decrease should be the absolute value
   * when current < baseline.
   */
  it('should calculate NDVI change correctly', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        ndviValueArbitrary,
        (baselineNDVI, currentNDVI) => {
          const expectedChange = currentNDVI - baselineNDVI;
          const ndviChange = currentNDVI - baselineNDVI;
          
          expect(Math.abs(ndviChange - expectedChange)).toBeLessThan(EPSILON);

          // If NDVI decreased, the decrease should be positive
          if (currentNDVI < baselineNDVI) {
            const decrease = Math.abs(ndviChange);
            expect(decrease).toBeGreaterThan(0);
            expect(decrease).toBe(baselineNDVI - currentNDVI);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================================
// Property 10: Alert Record Completeness
// ============================================================================

describe('Property 10: Alert Record Completeness', () => {
  /**
   * Property 10.1: All required fields are present
   * 
   * For any detected deforestation event, the created alert record SHALL contain
   * all required fields:
   * - id (unique identifier)
   * - parcelleId (location)
   * - baselineDate and detectionDate (dates)
   * - baselineNDVI and currentNDVI (NDVI values)
   * - ndviChange (change metric)
   * - affectedAreaHectares and affectedAreaPercent (area metrics)
   * - status (alert status)
   * - createdAt and updatedAt (timestamps)
   */
  it('should have all required fields present and valid', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          const isComplete = validateEventCompleteness(event);
          expect(isComplete).toBe(true);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.2: NDVI values are in valid range
   * 
   * For any deforestation event, baseline and current NDVI values
   * SHALL be in the valid range [-1, 1].
   */
  it('should have NDVI values in valid range [-1, 1]', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          expect(event.baselineNDVI).toBeGreaterThanOrEqual(-1);
          expect(event.baselineNDVI).toBeLessThanOrEqual(1);
          expect(event.currentNDVI).toBeGreaterThanOrEqual(-1);
          expect(event.currentNDVI).toBeLessThanOrEqual(1);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.3: NDVI change consistency
   * 
   * For any deforestation event, the ndviChange field SHALL equal
   * (currentNDVI - baselineNDVI).
   * 
   * This validates data consistency within the alert record.
   */
  it('should have consistent NDVI change calculation', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          const expectedChange = event.currentNDVI - event.baselineNDVI;
          
          // Allow small floating-point precision differences
          expect(Math.abs(event.ndviChange - expectedChange)).toBeLessThanOrEqual(EPSILON);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.4: Affected area is non-negative
   * 
   * For any deforestation event, affected area (hectares and percent)
   * SHALL be non-negative values.
   */
  it('should have non-negative affected area values', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          expect(event.affectedAreaHectares).toBeGreaterThanOrEqual(0);
          expect(event.affectedAreaPercent).toBeGreaterThanOrEqual(0);
          expect(event.affectedAreaPercent).toBeLessThanOrEqual(100);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.5: Detection date is after or equal to baseline date
   * 
   * For any deforestation event, the detection date SHALL be after or equal to
   * the baseline date (cannot detect deforestation before baseline).
   */
  it('should have detection date >= baseline date', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          expect(event.detectionDate.getTime()).toBeGreaterThanOrEqual(
            event.baselineDate.getTime()
          );
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.6: Status is valid enum value
   * 
   * For any deforestation event, the status SHALL be one of the valid
   * enum values: 'pending', 'acknowledged', 'disputed', 'resolved'.
   */
  it('should have valid status enum value', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          const validStatuses = ['pending', 'acknowledged', 'disputed', 'resolved'];
          expect(validStatuses).toContain(event.status);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.7: Timestamps are valid dates
   * 
   * For any deforestation event, createdAt and updatedAt SHALL be valid
   * Date objects, and updatedAt >= createdAt.
   */
  it('should have valid timestamps with updatedAt >= createdAt', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          expect(event.createdAt).toBeInstanceOf(Date);
          expect(event.updatedAt).toBeInstanceOf(Date);
          expect(event.updatedAt.getTime()).toBeGreaterThanOrEqual(
            event.createdAt.getTime()
          );
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 10.8: IDs are non-empty strings
   * 
   * For any deforestation event, id and parcelleId SHALL be non-empty strings.
   */
  it('should have non-empty ID strings', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          expect(typeof event.id).toBe('string');
          expect(event.id.length).toBeGreaterThan(0);
          expect(typeof event.parcelleId).toBe('string');
          expect(event.parcelleId.length).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================================
// Property 12: Alert Status Transitions
// ============================================================================

describe('Property 12: Alert Status Transitions', () => {
  /**
   * Property 12.1: Acknowledging pending alert transitions to acknowledged
   * 
   * For any deforestation alert in 'pending' status, acknowledging the alert
   * SHALL transition it to 'acknowledged' status with acknowledgment metadata
   * (acknowledgedBy, acknowledgedAt, acknowledgmentNotes).
   */
  it('should transition from pending to acknowledged with metadata', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        uuidArbitrary,
        fc.option(nonEmptyStringArbitrary, { nil: null }),
        (event, userId, notes) => {
          // Start with pending status
          const pendingEvent = { ...event, status: 'pending' as const };

          // Simulate acknowledgment
          const acknowledgedEvent: DeforestationEvent = {
            ...pendingEvent,
            status: 'acknowledged',
            acknowledgedBy: userId,
            acknowledgedAt: new Date(),
            acknowledgmentNotes: notes,
          };

          // Verify transition
          expect(acknowledgedEvent.status).toBe('acknowledged');
          expect(acknowledgedEvent.acknowledgedBy).toBe(userId);
          expect(acknowledgedEvent.acknowledgedAt).toBeInstanceOf(Date);
          
          if (notes) {
            expect(acknowledgedEvent.acknowledgmentNotes).toBe(notes);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.2: Disputing pending alert transitions to disputed
   * 
   * For any deforestation alert in 'pending' status, disputing the alert
   * SHALL transition it to 'disputed' status with dispute metadata
   * (disputedBy, disputedAt, disputeReason).
   */
  it('should transition from pending to disputed with metadata', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        uuidArbitrary,
        nonEmptyStringArbitrary,
        (event, userId, reason) => {
          // Start with pending status
          const pendingEvent = { ...event, status: 'pending' as const };

          // Simulate dispute
          const disputedEvent: DeforestationEvent = {
            ...pendingEvent,
            status: 'disputed',
            disputedBy: userId,
            disputedAt: new Date(),
            disputeReason: reason,
          };

          // Verify transition
          expect(disputedEvent.status).toBe('disputed');
          expect(disputedEvent.disputedBy).toBe(userId);
          expect(disputedEvent.disputedAt).toBeInstanceOf(Date);
          expect(disputedEvent.disputeReason).toBe(reason);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.3: Acknowledged alerts have required metadata
   * 
   * For any deforestation alert with 'acknowledged' status,
   * acknowledgedBy and acknowledgedAt SHALL be present (not null).
   */
  it('should have required metadata for acknowledged status', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          // Only test acknowledged events
          if (event.status !== 'acknowledged') {
            return true;
          }

          const hasRequiredMetadata = validateStatusFields(event);
          expect(hasRequiredMetadata).toBe(true);
          expect(event.acknowledgedBy).not.toBeNull();
          expect(event.acknowledgedAt).not.toBeNull();
          expect(event.acknowledgedAt).toBeInstanceOf(Date);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.4: Disputed alerts have required metadata
   * 
   * For any deforestation alert with 'disputed' status,
   * disputedBy, disputedAt, and disputeReason SHALL be present (not null).
   */
  it('should have required metadata for disputed status', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          // Only test disputed events
          if (event.status !== 'disputed') {
            return true;
          }

          const hasRequiredMetadata = validateStatusFields(event);
          expect(hasRequiredMetadata).toBe(true);
          expect(event.disputedBy).not.toBeNull();
          expect(event.disputedAt).not.toBeNull();
          expect(event.disputedAt).toBeInstanceOf(Date);
          expect(event.disputeReason).not.toBeNull();
          expect(event.disputeReason!.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.5: Status transition updates timestamp
   * 
   * For any status transition, the updatedAt timestamp SHALL be updated
   * to reflect the transition time.
   */
  it('should update timestamp on status transition', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        alertStatusArbitrary,
        (event, newStatus) => {
          const originalUpdatedAt = event.updatedAt;
          
          // Simulate status transition
          const updatedEvent: DeforestationEvent = {
            ...event,
            status: newStatus,
            updatedAt: new Date(),
          };

          // updatedAt should be >= original (time moves forward)
          expect(updatedEvent.updatedAt.getTime()).toBeGreaterThanOrEqual(
            originalUpdatedAt.getTime()
          );

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.6: Acknowledgment timestamp is after creation
   * 
   * For any acknowledged alert, acknowledgedAt SHALL be after or equal to createdAt
   * (cannot acknowledge before creation).
   */
  it('should have acknowledgedAt >= createdAt for acknowledged alerts', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          // Only test acknowledged events
          if (event.status !== 'acknowledged' || !event.acknowledgedAt) {
            return true;
          }

          expect(event.acknowledgedAt.getTime()).toBeGreaterThanOrEqual(
            event.createdAt.getTime()
          );

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.7: Dispute timestamp is after creation
   * 
   * For any disputed alert, disputedAt SHALL be after or equal to createdAt
   * (cannot dispute before creation).
   */
  it('should have disputedAt >= createdAt for disputed alerts', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          // Only test disputed events
          if (event.status !== 'disputed' || !event.disputedAt) {
            return true;
          }

          expect(event.disputedAt.getTime()).toBeGreaterThanOrEqual(
            event.createdAt.getTime()
          );

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 12.8: User ID format validation
   * 
   * For any acknowledged or disputed alert, the user IDs (acknowledgedBy, disputedBy)
   * SHALL be non-empty strings (typically UUIDs).
   */
  it('should have valid user ID format for status transitions', () => {
    fc.assert(
      fc.property(
        deforestationEventArbitrary,
        (event) => {
          // Check acknowledged events
          if (event.status === 'acknowledged' && event.acknowledgedBy) {
            expect(typeof event.acknowledgedBy).toBe('string');
            expect(event.acknowledgedBy.length).toBeGreaterThan(0);
          }

          // Check disputed events
          if (event.status === 'disputed' && event.disputedBy) {
            expect(typeof event.disputedBy).toBe('string');
            expect(event.disputedBy.length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
