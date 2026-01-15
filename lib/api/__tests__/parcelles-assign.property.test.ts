// CocoaTrack V2 - Parcelles Assignment Property Tests
// Property 8: Assignment Integrity
// Validates: Requirements 5.4
//
// For any assignment operation on orphan parcelles, after completion,
// all specified parcelle_ids SHALL have their planteur_id set to the target planteur.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// TYPES (Simplified for testing pure logic)
// ============================================================================

interface OrphanParcelle {
  id: string;
  planteur_id: null;
  code: string | null;
  label: string | null;
  import_file_id: string;
}

interface AssignedParcelle {
  id: string;
  planteur_id: string;
  code: string;
  label: string | null;
  import_file_id: string | null;
}

interface Planteur {
  id: string;
  name: string;
  code: string;
  cooperative_id: string;
}

interface AssignmentResult {
  updated_count: number;
  assigned_ids: string[];
  parcelles: AssignedParcelle[];
}

// ============================================================================
// ASSIGNMENT LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Generate a unique code for a parcelle
 * Format: PARC-XXXX where XXXX is a zero-padded number
 */
export function generateParcelleCode(existingCount: number): string {
  const nextNumber = existingCount + 1;
  return `PARC-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Check if a parcelle is orphan (planteur_id is null)
 */
export function isOrphanParcelle(parcelle: { planteur_id: string | null }): boolean {
  return parcelle.planteur_id === null;
}

/**
 * Validate that all parcelles are orphan (for non-admin users)
 * Returns list of non-orphan parcelle IDs
 */
export function validateAllOrphan(
  parcelles: Array<{ id: string; planteur_id: string | null }>
): string[] {
  return parcelles
    .filter((p) => p.planteur_id !== null)
    .map((p) => p.id);
}

/**
 * Assign parcelles to a planteur (pure function)
 * This simulates the assignment logic without database calls
 * 
 * @param orphanParcelles - Array of orphan parcelles to assign
 * @param planteurId - Target planteur ID
 * @param existingParcelleCount - Number of existing parcelles for the planteur (for code generation)
 * @returns AssignmentResult with updated parcelles
 */
export function assignParcellesToPlanteur(
  orphanParcelles: OrphanParcelle[],
  planteurId: string,
  existingParcelleCount: number
): AssignmentResult {
  const assignedParcelles: AssignedParcelle[] = [];
  const assignedIds: string[] = [];
  let codeCounter = existingParcelleCount;

  for (const parcelle of orphanParcelles) {
    // Generate code if null
    const code = parcelle.code || generateParcelleCode(codeCounter++);

    // Create assigned parcelle
    const assignedParcelle: AssignedParcelle = {
      id: parcelle.id,
      planteur_id: planteurId,
      code: code,
      label: parcelle.label,
      import_file_id: parcelle.import_file_id,
    };

    assignedParcelles.push(assignedParcelle);
    assignedIds.push(parcelle.id);
  }

  return {
    updated_count: assignedParcelles.length,
    assigned_ids: assignedIds,
    parcelles: assignedParcelles,
  };
}

/**
 * Validate assignment result integrity
 * Checks that all specified parcelle_ids have planteur_id set to target
 */
export function validateAssignmentIntegrity(
  originalIds: string[],
  result: AssignmentResult,
  targetPlanteurId: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 8.1: All specified parcelle_ids should be in assigned_ids
  const missingIds = originalIds.filter((id) => !result.assigned_ids.includes(id));
  if (missingIds.length > 0) {
    errors.push(`Missing parcelle IDs in result: ${missingIds.join(', ')}`);
  }

  // Property 8.2: updated_count should equal number of input parcelles
  if (result.updated_count !== originalIds.length) {
    errors.push(
      `Updated count (${result.updated_count}) does not match input count (${originalIds.length})`
    );
  }

  // Property 8.3: All assigned parcelles should have the target planteur_id
  const wrongPlanteurParcelles = result.parcelles.filter(
    (p) => p.planteur_id !== targetPlanteurId
  );
  if (wrongPlanteurParcelles.length > 0) {
    errors.push(
      `Parcelles with wrong planteur_id: ${wrongPlanteurParcelles.map((p) => p.id).join(', ')}`
    );
  }

  // Property 8.4: All assigned parcelles should have a non-null code
  const nullCodeParcelles = result.parcelles.filter((p) => p.code === null);
  if (nullCodeParcelles.length > 0) {
    errors.push(
      `Parcelles with null code after assignment: ${nullCodeParcelles.map((p) => p.id).join(', ')}`
    );
  }

  // Property 8.5: assigned_ids should match parcelles array
  if (result.assigned_ids.length !== result.parcelles.length) {
    errors.push(
      `assigned_ids length (${result.assigned_ids.length}) does not match parcelles length (${result.parcelles.length})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GENERATORS
// ============================================================================

/**
 * Generate an orphan parcelle with deterministic values
 */
function generateOrphanParcelle(
  index: number,
  seed: number,
  importFileId: string,
  hasCode: boolean
): OrphanParcelle {
  return {
    id: `parcelle-${seed}-${index}`,
    planteur_id: null,
    code: hasCode ? `CODE-${seed}-${index}` : null,
    label: `Label ${index}`,
    import_file_id: importFileId,
  };
}

/**
 * Generate a list of orphan parcelles
 */
function generateOrphanParcelles(
  count: number,
  seed: number,
  importFileId: string,
  codeRatio: number // 0-1, ratio of parcelles with existing codes
): OrphanParcelle[] {
  const parcelles: OrphanParcelle[] = [];
  for (let i = 0; i < count; i++) {
    const hasCode = (seed * (i + 1)) % 100 < codeRatio * 100;
    parcelles.push(generateOrphanParcelle(i, seed, importFileId, hasCode));
  }
  return parcelles;
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 8: Assignment Integrity', () => {
  it('should assign all parcelles to the target planteur', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(), // planteurId
        fc.uuid(), // importFileId
        fc.integer({ min: 1, max: 50 }), // count
        fc.integer({ min: 1, max: 1000000 }), // seed
        fc.float({ min: 0, max: 1 }), // codeRatio
        fc.integer({ min: 0, max: 100 }), // existingParcelleCount
        (planteurId, importFileId, count, seed, codeRatio, existingCount) => {
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, codeRatio);
          const originalIds = orphanParcelles.map((p) => p.id);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, existingCount);

          // Core property: All parcelles should have planteur_id set to target
          result.parcelles.forEach((p) => {
            expect(p.planteur_id).toBe(planteurId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all specified parcelle_ids in the result', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        (planteurId, importFileId, count, seed) => {
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, 0.5);
          const originalIds = orphanParcelles.map((p) => p.id);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, 0);

          // Core property: All original IDs should be in assigned_ids
          originalIds.forEach((id) => {
            expect(result.assigned_ids).toContain(id);
          });
          expect(result.assigned_ids.length).toBe(originalIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set updated_count equal to number of input parcelles', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 1000000 }),
        (planteurId, importFileId, count, seed) => {
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, 0.5);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, 0);

          // Core property: updated_count equals input count
          expect(result.updated_count).toBe(count);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate codes for parcelles without existing codes', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 0, max: 100 }),
        (planteurId, importFileId, count, seed, existingCount) => {
          // All parcelles without codes
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, 0);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, existingCount);

          // Core property: All parcelles should have non-null codes after assignment
          result.parcelles.forEach((p) => {
            expect(p.code).not.toBeNull();
            expect(p.code.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve existing codes when present', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        (planteurId, importFileId, count, seed) => {
          // All parcelles with existing codes
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, 1);
          const originalCodes = new Map(orphanParcelles.map((p) => [p.id, p.code]));

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, 0);

          // Core property: Existing codes should be preserved
          result.parcelles.forEach((p) => {
            const originalCode = originalCodes.get(p.id);
            if (originalCode !== null) {
              expect(p.code).toBe(originalCode);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should pass full validation for any assignment', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        fc.float({ min: 0, max: 1 }),
        fc.integer({ min: 0, max: 100 }),
        (planteurId, importFileId, count, seed, codeRatio, existingCount) => {
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, codeRatio);
          const originalIds = orphanParcelles.map((p) => p.id);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, existingCount);
          const validation = validateAssignmentIntegrity(originalIds, result, planteurId);

          // All validation rules should pass
          expect(validation.valid).toBe(true);
          expect(validation.errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty parcelle list correctly', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(fc.uuid(), (planteurId) => {
        const result = assignParcellesToPlanteur([], planteurId, 0);

        expect(result.updated_count).toBe(0);
        expect(result.assigned_ids).toEqual([]);
        expect(result.parcelles).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate unique codes for parcelles without existing codes', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 2, max: 50 }),
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 0, max: 100 }),
        (planteurId, importFileId, count, seed, existingCount) => {
          // All parcelles without codes
          const orphanParcelles = generateOrphanParcelles(count, seed, importFileId, 0);

          const result = assignParcellesToPlanteur(orphanParcelles, planteurId, existingCount);

          // Core property: All generated codes should be unique
          const codes = result.parcelles.map((p) => p.code);
          const uniqueCodes = new Set(codes);
          expect(uniqueCodes.size).toBe(codes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify orphan parcelles', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.oneof(fc.constant(null), fc.uuid()),
        (id, planteurId) => {
          const parcelle = { id, planteur_id: planteurId };

          // Core property: isOrphanParcelle returns true iff planteur_id is null
          expect(isOrphanParcelle(parcelle)).toBe(planteurId === null);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly validate all orphan parcelles', () => {
    // Feature: parcelles-import-evolution, Property 8: Assignment Integrity
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            planteur_id: fc.oneof(fc.constant(null), fc.uuid()),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (parcelles) => {
          const nonOrphanIds = validateAllOrphan(parcelles);
          const expectedNonOrphan = parcelles
            .filter((p) => p.planteur_id !== null)
            .map((p) => p.id);

          // Core property: validateAllOrphan returns exactly the non-orphan IDs
          expect(nonOrphanIds.sort()).toEqual(expectedNonOrphan.sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});
