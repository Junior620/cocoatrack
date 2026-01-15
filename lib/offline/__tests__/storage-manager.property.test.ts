/**
 * CocoaTrack V2 - Property Tests for Storage Manager
 *
 * Tests for PWA & Offline Improvements
 *
 * Properties tested:
 * - Property 2: Storage Quota State Machine
 * - Property 3: Eviction Policy Invariant
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  getStorageStateFromPercent,
  assignDeliveryTier,
  STORAGE_THRESHOLDS,
  type StorageState,
} from '../storage-manager';

// ============================================================================
// PROPERTY 2: STORAGE QUOTA STATE MACHINE
// ============================================================================

describe('Property 2: Storage Quota State Machine', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 2: Storage Quota State Machine**
   * **Validates: Requirements REQ-OFF-004, REQ-OFF-011**
   *
   * *For any* storage percentage value, the system should transition to the correct state:
   * - 0-79%: 'normal'
   * - 80-89%: 'warning'
   * - 90-94%: 'purging' (Tier_3)
   * - 95-97%: 'purging' (Tier_2) + block downloads Tier_2/3
   * - 98-100%: 'emergency' + read_only (block all writes)
   *
   * Note: queue_pressure (>50 ops) triggers a warning but does NOT trigger read_only mode.
   */

  it('should return "normal" state for percentages 0-79', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 79 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          return state === 'normal';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return "warning" state for percentages 80-89', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 89 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          return state === 'warning';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return "purging" state for percentages 90-97', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 90, max: 97 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          return state === 'purging';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return "emergency" state for percentages 98-100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 98, max: 100 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          return state === 'emergency';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle any valid percentage (0-100) and return a valid state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          const validStates: StorageState[] = ['normal', 'warning', 'purging', 'emergency'];
          return validStates.includes(state);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should transition states monotonically as percentage increases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (percent) => {
          const currentState = getStorageStateFromPercent(percent);
          const nextState = getStorageStateFromPercent(percent + 1);
          
          const stateOrder: Record<StorageState, number> = {
            'normal': 0,
            'warning': 1,
            'purging': 2,
            'emergency': 3,
          };
          
          // State should either stay the same or increase (never decrease)
          return stateOrder[nextState] >= stateOrder[currentState];
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect exact threshold boundaries', () => {
    // Test exact boundary values
    expect(getStorageStateFromPercent(79)).toBe('normal');
    expect(getStorageStateFromPercent(80)).toBe('warning');
    expect(getStorageStateFromPercent(89)).toBe('warning');
    expect(getStorageStateFromPercent(90)).toBe('purging');
    expect(getStorageStateFromPercent(97)).toBe('purging');
    expect(getStorageStateFromPercent(98)).toBe('emergency');
    expect(getStorageStateFromPercent(100)).toBe('emergency');
  });

  it('should handle edge cases (negative and >100 percentages)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: -1 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          // Negative percentages should be treated as normal
          return state === 'normal';
        }
      ),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 200 }),
        (percent) => {
          const state = getStorageStateFromPercent(percent);
          // >100% should be treated as emergency
          return state === 'emergency';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify threshold constants are correctly ordered', () => {
    expect(STORAGE_THRESHOLDS.WARNING).toBeLessThan(STORAGE_THRESHOLDS.PURGE_TIER3);
    expect(STORAGE_THRESHOLDS.PURGE_TIER3).toBeLessThan(STORAGE_THRESHOLDS.PURGE_TIER2);
    expect(STORAGE_THRESHOLDS.PURGE_TIER2).toBeLessThan(STORAGE_THRESHOLDS.EMERGENCY);
  });
});

// ============================================================================
// DATA TIER CLASSIFICATION TESTS
// ============================================================================

describe('Data Tier Classification', () => {
  /**
   * Tests for assignDeliveryTier() function
   * - Tier 1: delivered within last 7 days
   * - Tier 2: delivered 8-30 days ago
   * - Tier 3: delivered more than 30 days ago
   */

  it('should assign Tier 1 for deliveries within last 7 days', () => {
    fc.assert(
      fc.property(
        // Use 0-6 to avoid boundary issues with floating point at exactly 7 days
        // The exact boundary (7 days) is tested separately in "should handle exact boundary dates correctly"
        fc.integer({ min: 0, max: 6 }),
        (daysAgo) => {
          const deliveredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
          const tier = assignDeliveryTier(deliveredAt);
          return tier === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should assign Tier 2 for deliveries 8-30 days ago', () => {
    fc.assert(
      fc.property(
        // Use 8-29 to avoid boundary issues with floating point
        fc.integer({ min: 8, max: 29 }),
        (daysAgo) => {
          const deliveredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
          const tier = assignDeliveryTier(deliveredAt);
          return tier === 2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should assign Tier 3 for deliveries more than 30 days ago', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 31, max: 365 }),
        (daysAgo) => {
          const deliveredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
          const tier = assignDeliveryTier(deliveredAt);
          return tier === 3;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid tier (1, 2, or 3) for any date', () => {
    fc.assert(
      fc.property(
        // Use integer timestamps to avoid Invalid Date issues
        fc.integer({ min: 1577836800000, max: Date.now() }), // 2020-01-01 to now
        (timestamp) => {
          const tier = assignDeliveryTier(new Date(timestamp).toISOString());
          return tier === 1 || tier === 2 || tier === 3;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle future dates as Tier 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }),
        (daysInFuture) => {
          const deliveredAt = new Date(Date.now() + daysInFuture * 24 * 60 * 60 * 1000).toISOString();
          const tier = assignDeliveryTier(deliveredAt);
          // Future dates should be Tier 1 (daysAgo will be negative, so <= 7)
          return tier === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle exact boundary dates correctly', () => {
    const now = Date.now();
    
    // Exactly 7 days ago should be Tier 1
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(assignDeliveryTier(sevenDaysAgo)).toBe(1);
    
    // 8 days ago should be Tier 2
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(assignDeliveryTier(eightDaysAgo)).toBe(2);
    
    // 31 days ago should be Tier 3
    const thirtyOneDaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(assignDeliveryTier(thirtyOneDaysAgo)).toBe(3);
  });
});


// ============================================================================
// PROPERTY 3: EVICTION POLICY INVARIANT
// ============================================================================

import {
  PROTECTED_STORES,
  isProtectedStore,
  canEvictDelivery,
  validateEvictionSafety,
  DATA_TIERS,
  type CachedDelivery,
} from '../storage-manager';

describe('Property 3: Eviction Policy Invariant', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 3: Eviction Policy Invariant**
   * **Validates: Requirements REQ-OFF-007, REQ-IDB-001**
   *
   * *For any* eviction operation (purgeTier3, purgeTier2, forceCleanup), the following must remain true after execution:
   * - ops_queue count is unchanged (NEVER deleted, even partially)
   * - Tier_1 data (planteurs actifs, livraisons ≤7j) is unchanged (NEVER deleted by eviction)
   * - Only Tier_3 or Tier_2 data is removed
   * - No record marked as "pending_sync" is ever deleted by eviction
   */

  // Generator for CachedDelivery using string dates to avoid Invalid time value errors
  const isoDateArb = fc.integer({ min: 1704067200000, max: Date.now() }).map(ts => new Date(ts).toISOString());
  
  const cachedDeliveryArb: fc.Arbitrary<CachedDelivery> = fc.record({
    id: fc.uuid(),
    client_id: fc.uuid(),
    server_id: fc.option(fc.uuid(), { nil: null }),
    data: fc.record({
      weight_kg: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
      price_per_kg: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
    }),
    tier: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    status: fc.constantFrom('synced', 'pending_sync', 'conflict') as fc.Arbitrary<'synced' | 'pending_sync' | 'conflict'>,
    cached_at: isoDateArb,
    delivered_at: isoDateArb,
    updated_at: isoDateArb,
  });

  it('should identify ops_queue as a protected store', () => {
    expect(isProtectedStore('ops_queue')).toBe(true);
  });

  it('should identify all Tier 1 stores as protected', () => {
    for (const store of DATA_TIERS[1].idb_stores) {
      expect(isProtectedStore(store)).toBe(true);
    }
  });

  it('should NOT identify Tier 2/3 stores as protected', () => {
    // Tier 2 stores (except those also in Tier 1)
    const tier2OnlyStores = DATA_TIERS[2].idb_stores.filter(
      s => !DATA_TIERS[1].idb_stores.includes(s)
    );
    for (const store of tier2OnlyStores) {
      expect(isProtectedStore(store)).toBe(false);
    }

    // Tier 3 stores
    for (const store of DATA_TIERS[3].idb_stores) {
      expect(isProtectedStore(store)).toBe(false);
    }
  });

  it('should NEVER allow eviction of pending_sync deliveries regardless of tier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
        fc.uuid(),
        (tier, id) => {
          const pendingSyncDelivery: CachedDelivery = {
            id,
            client_id: id,
            server_id: null,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier,
            status: 'pending_sync',
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Should never be evictable
          return canEvictDelivery(pendingSyncDelivery) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NEVER allow eviction of Tier 1 deliveries regardless of status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('synced', 'pending_sync', 'conflict') as fc.Arbitrary<'synced' | 'pending_sync' | 'conflict'>,
        fc.uuid(),
        (status, id) => {
          const tier1Delivery: CachedDelivery = {
            id,
            client_id: id,
            server_id: null,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier: 1,
            status,
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Should never be evictable
          return canEvictDelivery(tier1Delivery) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow eviction of Tier 2/3 synced deliveries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        fc.uuid(),
        (tier, id) => {
          const syncedDelivery: CachedDelivery = {
            id,
            client_id: id,
            server_id: id,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier,
            status: 'synced',
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Should be evictable
          return canEvictDelivery(syncedDelivery) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate eviction safety correctly for protected stores', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PROTECTED_STORES), { minLength: 1, maxLength: 5 }),
        (protectedStores) => {
          const result = validateEvictionSafety({
            storesToClear: protectedStores,
            deliveriesToDelete: [],
          });
          
          // Should NOT be safe
          return result.safe === false && result.violations.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate eviction safety correctly for pending_sync deliveries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          // Create pending_sync deliveries
          const pendingSyncDeliveries: CachedDelivery[] = Array.from({ length: count }, (_, i) => ({
            id: `delivery-${i}`,
            client_id: `client-${i}`,
            server_id: null,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier: 2 as const,
            status: 'pending_sync' as const,
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          
          const result = validateEvictionSafety({
            storesToClear: [],
            deliveriesToDelete: pendingSyncDeliveries,
          });
          
          // Should NOT be safe, with one violation per delivery
          return result.safe === false && result.violations.length === count;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate eviction safety correctly for Tier 1 deliveries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          // Create Tier 1 synced deliveries
          const tier1Deliveries: CachedDelivery[] = Array.from({ length: count }, (_, i) => ({
            id: `delivery-${i}`,
            client_id: `client-${i}`,
            server_id: `server-${i}`,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier: 1 as const,
            status: 'synced' as const,
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          
          const result = validateEvictionSafety({
            storesToClear: [],
            deliveriesToDelete: tier1Deliveries,
          });
          
          // Should NOT be safe, with one violation per delivery
          return result.safe === false && result.violations.length === count;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate eviction safety correctly for safe evictions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        (count, tier) => {
          // Create Tier 2/3 synced deliveries (safe to evict)
          const safeDeliveries: CachedDelivery[] = Array.from({ length: count }, (_, i) => ({
            id: `delivery-${i}`,
            client_id: `client-${i}`,
            server_id: `server-${i}`,
            data: { weight_kg: 100, price_per_kg: 1000 },
            tier,
            status: 'synced' as const,
            cached_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          
          const result = validateEvictionSafety({
            storesToClear: ['exports_cache', 'dashboards_cache'], // Non-protected stores
            deliveriesToDelete: safeDeliveries,
          });
          
          // Should be safe
          return result.safe === true && result.violations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure PROTECTED_STORES contains all critical stores', () => {
    const criticalStores = ['ops_queue', 'planteurs', 'chef_planteurs', 'warehouses', 'sync_metadata'];
    
    for (const store of criticalStores) {
      expect(PROTECTED_STORES).toContain(store);
    }
  });

  it('should ensure ops_queue is in Tier 1 stores', () => {
    expect(DATA_TIERS[1].idb_stores).toContain('ops_queue');
  });
});
