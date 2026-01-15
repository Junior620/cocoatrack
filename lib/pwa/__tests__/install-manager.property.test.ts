/**
 * CocoaTrack V2 - Property Tests for PWA Install Manager
 *
 * Tests for PWA & Offline Improvements
 *
 * Properties tested:
 * - Property 1: Install Prompt Logic
 *
 * **Feature: pwa-offline-improvements, Property 1: Install Prompt Logic**
 * **Validates: Requirements REQ-PWA-001, REQ-PWA-005**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  shouldShowPromptPure,
  detectPlatformFromUserAgent,
  type Platform,
} from '../install-manager';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MIN_VISITS = 3;

// ============================================================================
// GENERATORS
// ============================================================================

const platformArb = fc.constantFrom('ios', 'android', 'desktop', 'unknown') as fc.Arbitrary<Platform>;

const visitsCountArb = fc.integer({ min: 0, max: 100 });

// Generate ISO date strings for dismissed_until
const dismissedUntilArb = fc.option(
  fc.integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 in ms
    .map(ts => new Date(ts).toISOString()),
  { nil: null }
);

const booleanArb = fc.boolean();

// User agent generators for platform detection
const iosUserAgentArb = fc.constantFrom(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
);

const androidUserAgentArb = fc.constantFrom(
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G960F) AppleWebKit/537.36'
);

const desktopUserAgentArb = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Property 1: Install Prompt Logic', () => {
  /**
   * **Feature: pwa-offline-improvements, Property 1: Install Prompt Logic**
   * **Validates: Requirements REQ-PWA-001, REQ-PWA-005**
   *
   * *For any* combination of visits_count, install_dismissed_until, is_installed, and platform,
   * the shouldShowPrompt() function should return true only when:
   * - visits_count >= 3
   * - install_dismissed_until is null or in the past
   * - is_installed is false
   * - platform is 'android' or 'desktop' (not 'ios')
   */

  it('should return false when visits_count < minVisits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // Less than default minVisits (3)
        dismissedUntilArb,
        booleanArb,
        fc.constantFrom('android', 'desktop') as fc.Arbitrary<Platform>,
        (visits_count, dismissed_until, is_installed, platform) => {
          // Even with all other conditions met, low visit count should return false
          fc.pre(!is_installed);
          fc.pre(dismissed_until === null || new Date(dismissed_until) <= new Date());

          const result = shouldShowPromptPure(
            visits_count,
            dismissed_until,
            is_installed,
            platform,
            DEFAULT_MIN_VISITS
          );

          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when dismissed recently (within 7 days)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        fc.integer({ min: 1, max: 7 }), // Days in future
        fc.constantFrom('android', 'desktop') as fc.Arbitrary<Platform>,
        (visits_count, daysInFuture, platform) => {
          // Create a future dismissal date
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + daysInFuture);
          const dismissed_until = futureDate.toISOString();

          const result = shouldShowPromptPure(
            visits_count,
            dismissed_until,
            false, // Not installed
            platform,
            DEFAULT_MIN_VISITS
          );

          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when already installed (standalone mode)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        fc.constantFrom('android', 'desktop') as fc.Arbitrary<Platform>,
        (visits_count, platform) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            true, // Already installed
            platform,
            DEFAULT_MIN_VISITS
          );

          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when platform is iOS', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        (visits_count) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            false, // Not installed
            'ios', // iOS platform
            DEFAULT_MIN_VISITS
          );

          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true when all conditions are met (Android)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        (visits_count) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            false, // Not installed
            'android', // Android platform
            DEFAULT_MIN_VISITS
          );

          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true when all conditions are met (Desktop)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        (visits_count) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            false, // Not installed
            'desktop', // Desktop platform
            DEFAULT_MIN_VISITS
          );

          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true when dismissal date is in the past', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        fc.integer({ min: 1, max: 365 }), // Days in past
        fc.constantFrom('android', 'desktop') as fc.Arbitrary<Platform>,
        (visits_count, daysInPast, platform) => {
          // Create a past dismissal date
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - daysInPast);
          const dismissed_until = pastDate.toISOString();

          const result = shouldShowPromptPure(
            visits_count,
            dismissed_until,
            false, // Not installed
            platform,
            DEFAULT_MIN_VISITS
          );

          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle unknown platform (should show prompt)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }), // Sufficient visits
        (visits_count) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            false, // Not installed
            'unknown', // Unknown platform
            DEFAULT_MIN_VISITS
          );

          // Unknown platform should still show prompt (not iOS)
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect custom minVisits parameter', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Custom minVisits
        fc.integer({ min: 0, max: 20 }), // Visits count
        fc.constantFrom('android', 'desktop') as fc.Arbitrary<Platform>,
        (minVisits, visits_count, platform) => {
          const result = shouldShowPromptPure(
            visits_count,
            null, // Not dismissed
            false, // Not installed
            platform,
            minVisits
          );

          // Should return true only if visits >= minVisits
          const expected = visits_count >= minVisits;
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly combine all conditions', () => {
    fc.assert(
      fc.property(
        visitsCountArb,
        dismissedUntilArb,
        booleanArb,
        platformArb,
        (visits_count, dismissed_until, is_installed, platform) => {
          const result = shouldShowPromptPure(
            visits_count,
            dismissed_until,
            is_installed,
            platform,
            DEFAULT_MIN_VISITS
          );

          // Calculate expected result based on all conditions
          const hasEnoughVisits = visits_count >= DEFAULT_MIN_VISITS;
          const notDismissedRecently = dismissed_until === null || new Date(dismissed_until) <= new Date();
          const notInstalled = !is_installed;
          const notIOS = platform !== 'ios';

          const expected = hasEnoughVisits && notDismissedRecently && notInstalled && notIOS;

          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Platform Detection', () => {
  /**
   * Tests for platform detection from user agent
   * REQ-PWA-005: Detect platform (iOS, Android, Desktop)
   */

  it('should detect iOS from user agent', () => {
    fc.assert(
      fc.property(iosUserAgentArb, (userAgent) => {
        const platform = detectPlatformFromUserAgent(userAgent);
        return platform === 'ios';
      }),
      { numRuns: 100 }
    );
  });

  it('should detect Android from user agent', () => {
    fc.assert(
      fc.property(androidUserAgentArb, (userAgent) => {
        const platform = detectPlatformFromUserAgent(userAgent);
        return platform === 'android';
      }),
      { numRuns: 100 }
    );
  });

  it('should detect Desktop from user agent', () => {
    fc.assert(
      fc.property(desktopUserAgentArb, (userAgent) => {
        const platform = detectPlatformFromUserAgent(userAgent);
        return platform === 'desktop';
      }),
      { numRuns: 100 }
    );
  });

  it('should return unknown for unrecognized user agents', () => {
    const unknownUserAgents = [
      '',
      'Unknown Browser',
      'CustomBot/1.0',
    ];

    for (const ua of unknownUserAgents) {
      const platform = detectPlatformFromUserAgent(ua);
      expect(platform).toBe('unknown');
    }
  });
});
