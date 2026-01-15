// CocoaTrack V2 - Parcelles Import Property Tests
// Property-based tests for parcelles import auto-create matching
//
// These tests validate the correctness properties defined in the design document
// using fast-check for property-based testing with minimum 100 iterations.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizePlanteurName } from '@/lib/api/parcelles-import';

// ============================================================================
// ARBITRARIES (Generators for random test data)
// ============================================================================

/**
 * Generate a string of whitespace characters
 */
const whitespaceArb = (minLength: number, maxLength: number) =>
  fc.array(fc.constantFrom(' ', '\t'), { minLength, maxLength })
    .map(chars => chars.join(''));

/**
 * Generate a random planteur name with various characteristics:
 * - Mixed case
 * - Leading/trailing whitespace
 * - Multiple internal spaces
 * - Accented characters (French names common in Côte d'Ivoire)
 */
const planteurNameArb = fc.oneof(
  // Simple names
  fc.string({ minLength: 1, maxLength: 50 }),
  // Names with accents (common French/African names)
  fc.constantFrom(
    'Konan Yao',
    'KONAN YAO',
    'konan yao',
    '  Konan  Yao  ',
    'Kouassi Émile',
    'KOUASSI ÉMILE',
    'kouassi émile',
    'Traoré Mamadou',
    'TRAORÉ MAMADOU',
    'traoré mamadou',
    'N\'Guessan Aimé',
    'Bédié François',
    'Côté Jean-Pierre',
    'Müller Hans',
    'Øresund Erik',
    'Çelik Ahmet',
    'Señor García',
    'Niño Pedro',
    'Ñoño Carlos',
    'Àlex Martínez',
    'Élise Dubois',
    'Ïsabelle Renée',
    'Ömer Yılmaz',
    'Ümit Kaya',
    'Ångström Lars',
    'Æther John',
    'Œuvre Marie'
  ),
  // Names with extra whitespace
  fc.tuple(
    whitespaceArb(0, 3),
    fc.string({ minLength: 1, maxLength: 30 }),
    whitespaceArb(0, 3)
  ).map(([prefix, name, suffix]) => `${prefix}${name}${suffix}`),
  // Names with multiple internal spaces
  fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 4 })
    .map(parts => parts.join('   '))
);

/**
 * Generate pairs of names that should normalize to the same value
 * These represent the same planteur with different formatting
 */
const equivalentNamePairsArb = fc.oneof(
  // Case variations
  fc.string({ minLength: 1, maxLength: 30 }).map(name => [
    name.toLowerCase(),
    name.toUpperCase()
  ] as [string, string]),
  // Whitespace variations
  fc.string({ minLength: 1, maxLength: 30 }).map(name => [
    name.trim(),
    `  ${name}  `
  ] as [string, string]),
  // Accent variations (same base characters)
  fc.constantFrom(
    ['Konan Yao', 'KONAN YAO'],
    ['Kouassi Émile', 'KOUASSI EMILE'],
    ['Traoré Mamadou', 'TRAORE MAMADOU'],
    ['Bédié François', 'BEDIE FRANCOIS'],
    ['Côté Jean', 'COTE JEAN'],
    ['Élise', 'ELISE'],
    ['Àlex', 'ALEX'],
    ['Ömer', 'OMER'],
    ['Ümit', 'UMIT'],
    ['Ångström', 'ANGSTROM'],
    ['Señor', 'SENOR'],
    ['Niño', 'NINO']
  ) as fc.Arbitrary<[string, string]>
);

/**
 * Generate pairs of names that should NOT normalize to the same value
 * These represent different planteurs
 */
const differentNamePairsArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30 }),
  fc.string({ minLength: 1, maxLength: 30 })
).filter(([a, b]) => {
  // Ensure the names are actually different after normalization
  const normA = normalizePlanteurName(a);
  const normB = normalizePlanteurName(b);
  return normA !== normB && normA.length > 0 && normB.length > 0;
});

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 3: Auto-create planteur matching by name_norm', () => {
  /**
   * Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
   * 
   * For any import using Auto_Create_Mode, planteur matching SHALL use name_norm
   * (normalized: lower, trim, unaccent). If a planteur with the same name_norm
   * exists in the same cooperative, it SHALL be reused.
   * 
   * Validates: Requirements 2.4
   */

  describe('Normalization consistency', () => {
    it('should produce consistent results for the same input', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const norm1 = normalizePlanteurName(name);
          const norm2 = normalizePlanteurName(name);
          const norm3 = normalizePlanteurName(name);
          
          // Same input should always produce same output
          expect(norm1).toBe(norm2);
          expect(norm2).toBe(norm3);
        }),
        { numRuns: 100 }
      );
    });

    it('should always produce lowercase output', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const normalized = normalizePlanteurName(name);
          
          // Result should be lowercase
          expect(normalized).toBe(normalized.toLowerCase());
        }),
        { numRuns: 100 }
      );
    });

    it('should trim leading and trailing whitespace', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const normalized = normalizePlanteurName(name);
          
          // Result should not have leading/trailing whitespace
          expect(normalized).toBe(normalized.trim());
        }),
        { numRuns: 100 }
      );
    });

    it('should normalize multiple spaces to single space', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const normalized = normalizePlanteurName(name);
          
          // Result should not have multiple consecutive spaces
          expect(normalized).not.toMatch(/\s{2,}/);
        }),
        { numRuns: 100 }
      );
    });

    it('should remove diacritics/accents', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const normalized = normalizePlanteurName(name);
          
          // Result should not contain combining diacritical marks
          // After NFD normalization and diacritic removal, no combining marks should remain
          const hasDiacritics = /[\u0300-\u036f]/.test(normalized);
          expect(hasDiacritics).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Equivalent name matching', () => {
    it('should produce same normalized value for equivalent names', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(equivalentNamePairsArb, ([name1, name2]) => {
          const norm1 = normalizePlanteurName(name1);
          const norm2 = normalizePlanteurName(name2);
          
          // Equivalent names should normalize to the same value
          expect(norm1).toBe(norm2);
        }),
        { numRuns: 100 }
      );
    });

    it('case variations should match', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 30 }), (name) => {
          const lower = normalizePlanteurName(name.toLowerCase());
          const upper = normalizePlanteurName(name.toUpperCase());
          const mixed = normalizePlanteurName(
            name.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('')
          );
          
          // All case variations should normalize to the same value
          expect(lower).toBe(upper);
          expect(upper).toBe(mixed);
        }),
        { numRuns: 100 }
      );
    });

    it('whitespace variations should match', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 30 }), (name) => {
          const trimmed = name.trim();
          if (trimmed.length === 0) return true; // Skip empty strings
          
          const norm1 = normalizePlanteurName(trimmed);
          const norm2 = normalizePlanteurName(`  ${trimmed}  `);
          const norm3 = normalizePlanteurName(`\t${trimmed}\t`);
          
          // All whitespace variations should normalize to the same value
          expect(norm1).toBe(norm2);
          expect(norm2).toBe(norm3);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Different name distinction', () => {
    it('should produce different normalized values for different names', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(differentNamePairsArb, ([name1, name2]) => {
          const norm1 = normalizePlanteurName(name1);
          const norm2 = normalizePlanteurName(name2);
          
          // Different names should normalize to different values
          expect(norm1).not.toBe(norm2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined gracefully', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      expect(normalizePlanteurName(null)).toBe('');
      expect(normalizePlanteurName(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      expect(normalizePlanteurName('')).toBe('');
    });

    it('should handle whitespace-only strings', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
            .map(chars => chars.join('')),
          (whitespace) => {
            const normalized = normalizePlanteurName(whitespace);
            expect(normalized).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence', () => {
    it('normalizing an already normalized name should produce the same result', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      fc.assert(
        fc.property(planteurNameArb, (name) => {
          const norm1 = normalizePlanteurName(name);
          const norm2 = normalizePlanteurName(norm1);
          
          // Normalizing twice should produce the same result
          expect(norm1).toBe(norm2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Specific accent handling', () => {
    it('should correctly handle common French accents', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      const testCases = [
        { input: 'Émile', expected: 'emile' },
        { input: 'François', expected: 'francois' },
        { input: 'Côté', expected: 'cote' },
        { input: 'Traoré', expected: 'traore' },
        { input: 'Bédié', expected: 'bedie' },
        { input: 'Élise', expected: 'elise' },
        { input: 'Àlex', expected: 'alex' },
        { input: 'Ömer', expected: 'omer' },
        { input: 'Ümit', expected: 'umit' },
        { input: 'Ångström', expected: 'angstrom' },
        { input: 'Señor', expected: 'senor' },
        { input: 'Niño', expected: 'nino' },
      ];

      for (const { input, expected } of testCases) {
        expect(normalizePlanteurName(input)).toBe(expected);
      }
    });

    it('should match accented and non-accented versions', () => {
      // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
      // Validates: Requirements 2.4
      const pairs = [
        ['Émile', 'Emile'],
        ['François', 'Francois'],
        ['Côté', 'Cote'],
        ['Traoré', 'Traore'],
        ['Bédié', 'Bedie'],
      ];

      for (const [accented, plain] of pairs) {
        const normAccented = normalizePlanteurName(accented);
        const normPlain = normalizePlanteurName(plain);
        expect(normAccented).toBe(normPlain);
      }
    });
  });
});

describe('Auto-create matching simulation', () => {
  /**
   * Simulates the auto-create matching logic from applyV2
   * This tests the matching behavior without requiring database access
   */

  interface SimulatedPlanteur {
    id: string;
    name: string;
    name_norm: string;
    cooperative_id: string;
  }

  /**
   * Simulate matching a name against existing planteurs
   * Returns the matched planteur or null if no match
   */
  function matchPlanteur(
    name: string,
    existingPlanteurs: SimulatedPlanteur[],
    cooperativeId: string
  ): SimulatedPlanteur | null {
    const nameNorm = normalizePlanteurName(name);
    if (!nameNorm) return null;

    return existingPlanteurs.find(
      p => p.name_norm === nameNorm && p.cooperative_id === cooperativeId
    ) || null;
  }

  /**
   * Arbitrary for generating a simulated planteur
   */
  const planteurArb = fc.record({
    id: fc.uuid(),
    name: planteurNameArb,
    cooperative_id: fc.uuid(),
  }).map(p => ({
    ...p,
    name_norm: normalizePlanteurName(p.name),
  }));

  /**
   * Arbitrary for generating a list of existing planteurs
   */
  const existingPlanteursArb = fc.array(planteurArb, { minLength: 0, maxLength: 20 });

  it('should match planteur by normalized name within same cooperative', () => {
    // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(
        existingPlanteursArb,
        fc.uuid(),
        (existingPlanteurs, cooperativeId) => {
          // Filter planteurs in the target cooperative
          const coopPlanteurs = existingPlanteurs.filter(p => p.cooperative_id === cooperativeId);
          
          if (coopPlanteurs.length === 0) return true; // Skip if no planteurs in coop
          
          // Pick a random existing planteur from the cooperative
          const targetPlanteur = coopPlanteurs[0];
          
          // Try to match with the same name (different case/whitespace)
          const variations = [
            targetPlanteur.name.toUpperCase(),
            targetPlanteur.name.toLowerCase(),
            `  ${targetPlanteur.name}  `,
          ];
          
          for (const variation of variations) {
            const matched = matchPlanteur(variation, existingPlanteurs, cooperativeId);
            expect(matched).not.toBeNull();
            expect(matched?.id).toBe(targetPlanteur.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not match planteur from different cooperative', () => {
    // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(
        planteurArb,
        fc.uuid(),
        (planteur, differentCoopId) => {
          // Ensure different cooperative
          if (planteur.cooperative_id === differentCoopId) return true;
          
          const existingPlanteurs = [planteur];
          
          // Try to match in a different cooperative
          const matched = matchPlanteur(planteur.name, existingPlanteurs, differentCoopId);
          
          // Should not match because cooperative is different
          expect(matched).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null for empty or whitespace-only names', () => {
    // Feature: parcelles-import-evolution, Property 3: Auto-create planteur matching by name_norm
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(
        existingPlanteursArb,
        fc.uuid(),
        fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 5 })
          .map(chars => chars.join('')),
        (existingPlanteurs, cooperativeId, emptyName) => {
          const matched = matchPlanteur(emptyName, existingPlanteurs, cooperativeId);
          expect(matched).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
