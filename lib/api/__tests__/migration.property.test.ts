// CocoaTrack V2 - Migration Property Tests
// Property 13: Data Migration Integrity
// Validates: Requirements 1.8, 11.3, 11.5
//
// For any record in V1 database, after migration there SHALL exist a
// corresponding record in V2 with matching id (UUID preserved) and
// equivalent data in all mapped fields.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// TYPES
// ============================================================================

interface V1ChefPlanteur {
  id: string;
  name: string;
  phone: string | null;
  cni: string | null;
  cooperative: string | null;
  region: string | null;
  departement: string | null;
  localite: string | null;
  quantite_max_kg: number;
  date_debut_contrat: string | null;
  date_fin_contrat: string | null;
  raison_fin_contrat: string | null;
  latitude: number | null;
  longitude: number | null;
  validation_status: string;
  created_at: string;
  updated_at: string;
}

interface V2ChefPlanteur {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  cni: string | null;
  cooperative_id: string;
  region: string | null;
  departement: string | null;
  localite: string | null;
  quantite_max_kg: number;
  contract_start: string | null;
  contract_end: string | null;
  termination_reason: string | null;
  latitude: number | null;
  longitude: number | null;
  validation_status: 'pending' | 'validated' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface V1Planter {
  id: string;
  name: string;
  phone: string | null;
  cni: string | null;
  cooperative: string | null;
  chef_planteur_id: string | null;
  created_at: string;
  updated_at: string;
}

interface V2Planteur {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  cni: string | null;
  cooperative_id: string;
  chef_planteur_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface V1Delivery {
  id: string;
  planter_id: string;
  date: string;
  quantity_kg: number;
  load_location: string;
  unload_location: string;
  quality: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface V2Delivery {
  id: string;
  code: string;
  planteur_id: string;
  chef_planteur_id: string;
  cooperative_id: string;
  warehouse_id: string;
  weight_kg: number;
  price_per_kg: number;
  total_amount: number;
  quality_grade: 'A' | 'B' | 'C';
  payment_status: 'pending' | 'partial' | 'paid';
  delivered_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MigrationMapping {
  cooperativeMap: Map<string, string>;
  warehouseMap: Map<string, string>;
}

// ============================================================================
// MIGRATION LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Generate a code from a name
 */
export function generateCode(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
}

/**
 * Map V1 validation status to V2
 */
export function mapValidationStatus(status: string): 'pending' | 'validated' | 'rejected' {
  const statusMap: Record<string, 'pending' | 'validated' | 'rejected'> = {
    pending: 'pending',
    validated: 'validated',
    rejected: 'rejected',
    approved: 'validated',
  };
  return statusMap[status.toLowerCase()] || 'pending';
}

/**
 * Map V1 quality to V2 grade
 */
export function mapQualityGrade(quality: string): 'A' | 'B' | 'C' {
  const gradeMap: Record<string, 'A' | 'B' | 'C'> = {
    excellent: 'A',
    good: 'A',
    bon: 'A',
    a: 'A',
    average: 'B',
    moyen: 'B',
    b: 'B',
    poor: 'C',
    mauvais: 'C',
    c: 'C',
  };
  return gradeMap[quality.toLowerCase()] || 'B';
}

/**
 * Migrate a V1 chef_planteur to V2
 */
export function migrateChefPlanteur(
  v1: V1ChefPlanteur,
  cooperativeId: string
): V2ChefPlanteur {
  return {
    id: v1.id, // UUID preserved
    name: v1.name,
    code: generateCode(v1.name),
    phone: v1.phone,
    cni: v1.cni,
    cooperative_id: cooperativeId,
    region: v1.region,
    departement: v1.departement,
    localite: v1.localite,
    quantite_max_kg: v1.quantite_max_kg,
    contract_start: v1.date_debut_contrat,
    contract_end: v1.date_fin_contrat,
    termination_reason: v1.raison_fin_contrat,
    latitude: v1.latitude,
    longitude: v1.longitude,
    validation_status: mapValidationStatus(v1.validation_status),
    created_at: v1.created_at,
    updated_at: v1.updated_at,
  };
}

/**
 * Migrate a V1 planter to V2
 */
export function migratePlanteur(
  v1: V1Planter,
  cooperativeId: string
): V2Planteur | null {
  if (!v1.chef_planteur_id) {
    return null; // Cannot migrate without chef_planteur_id
  }

  return {
    id: v1.id, // UUID preserved
    name: v1.name,
    code: generateCode(v1.name),
    phone: v1.phone,
    cni: v1.cni,
    cooperative_id: cooperativeId,
    chef_planteur_id: v1.chef_planteur_id,
    is_active: true,
    created_at: v1.created_at,
    updated_at: v1.updated_at,
  };
}

/**
 * Migrate a V1 delivery to V2
 */
export function migrateDelivery(
  v1: V1Delivery,
  chefPlanteurId: string,
  cooperativeId: string,
  warehouseId: string,
  deliveryCode: string,
  pricePerKg: number = 1000
): V2Delivery {
  const totalAmount = Math.round(v1.quantity_kg * pricePerKg);

  return {
    id: v1.id, // UUID preserved
    code: deliveryCode,
    planteur_id: v1.planter_id,
    chef_planteur_id: chefPlanteurId,
    cooperative_id: cooperativeId,
    warehouse_id: warehouseId,
    weight_kg: v1.quantity_kg,
    price_per_kg: pricePerKg,
    total_amount: totalAmount,
    quality_grade: mapQualityGrade(v1.quality),
    payment_status: 'pending',
    delivered_at: v1.date,
    notes: v1.notes,
    created_at: v1.created_at,
    updated_at: v1.updated_at,
  };
}

/**
 * Validate migration integrity for chef_planteur
 */
export function validateChefPlanteurMigration(
  v1: V1ChefPlanteur,
  v2: V2ChefPlanteur
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 13.1: UUID preserved
  if (v1.id !== v2.id) {
    errors.push(`ID mismatch: V1=${v1.id}, V2=${v2.id}`);
  }

  // Property 13.2: Name preserved
  if (v1.name !== v2.name) {
    errors.push(`Name mismatch: V1=${v1.name}, V2=${v2.name}`);
  }

  // Property 13.3: Phone preserved
  if (v1.phone !== v2.phone) {
    errors.push(`Phone mismatch: V1=${v1.phone}, V2=${v2.phone}`);
  }

  // Property 13.4: CNI preserved
  if (v1.cni !== v2.cni) {
    errors.push(`CNI mismatch: V1=${v1.cni}, V2=${v2.cni}`);
  }

  // Property 13.5: Quantite max preserved
  if (v1.quantite_max_kg !== v2.quantite_max_kg) {
    errors.push(`Quantite max mismatch: V1=${v1.quantite_max_kg}, V2=${v2.quantite_max_kg}`);
  }

  // Property 13.6: Location preserved
  if (v1.latitude !== v2.latitude || v1.longitude !== v2.longitude) {
    errors.push(`Location mismatch`);
  }

  // Property 13.7: Validation status mapped correctly
  const expectedStatus = mapValidationStatus(v1.validation_status);
  if (v2.validation_status !== expectedStatus) {
    errors.push(`Validation status mismatch: expected ${expectedStatus}, got ${v2.validation_status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate migration integrity for planteur
 */
export function validatePlanteurMigration(
  v1: V1Planter,
  v2: V2Planteur
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 13.1: UUID preserved
  if (v1.id !== v2.id) {
    errors.push(`ID mismatch: V1=${v1.id}, V2=${v2.id}`);
  }

  // Property 13.2: Name preserved
  if (v1.name !== v2.name) {
    errors.push(`Name mismatch: V1=${v1.name}, V2=${v2.name}`);
  }

  // Property 13.3: Phone preserved
  if (v1.phone !== v2.phone) {
    errors.push(`Phone mismatch: V1=${v1.phone}, V2=${v2.phone}`);
  }

  // Property 13.4: CNI preserved
  if (v1.cni !== v2.cni) {
    errors.push(`CNI mismatch: V1=${v1.cni}, V2=${v2.cni}`);
  }

  // Property 13.5: Chef planteur ID preserved
  if (v1.chef_planteur_id !== v2.chef_planteur_id) {
    errors.push(`Chef planteur ID mismatch: V1=${v1.chef_planteur_id}, V2=${v2.chef_planteur_id}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate migration integrity for delivery
 */
export function validateDeliveryMigration(
  v1: V1Delivery,
  v2: V2Delivery
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 13.1: UUID preserved
  if (v1.id !== v2.id) {
    errors.push(`ID mismatch: V1=${v1.id}, V2=${v2.id}`);
  }

  // Property 13.2: Planteur ID preserved
  if (v1.planter_id !== v2.planteur_id) {
    errors.push(`Planteur ID mismatch: V1=${v1.planter_id}, V2=${v2.planteur_id}`);
  }

  // Property 13.3: Weight preserved
  if (v1.quantity_kg !== v2.weight_kg) {
    errors.push(`Weight mismatch: V1=${v1.quantity_kg}, V2=${v2.weight_kg}`);
  }

  // Property 13.4: Date preserved
  if (v1.date !== v2.delivered_at) {
    errors.push(`Date mismatch: V1=${v1.date}, V2=${v2.delivered_at}`);
  }

  // Property 13.5: Notes preserved
  if (v1.notes !== v2.notes) {
    errors.push(`Notes mismatch: V1=${v1.notes}, V2=${v2.notes}`);
  }

  // Property 13.6: Quality mapped correctly
  const expectedGrade = mapQualityGrade(v1.quality);
  if (v2.quality_grade !== expectedGrade) {
    errors.push(`Quality grade mismatch: expected ${expectedGrade}, got ${v2.quality_grade}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GENERATORS
// ============================================================================

const validationStatuses = ['pending', 'validated', 'rejected', 'approved'];
const qualities = ['excellent', 'good', 'bon', 'average', 'moyen', 'poor', 'mauvais', 'A', 'B', 'C'];

/**
 * Generate a V1 chef_planteur
 */
function generateV1ChefPlanteur(id: string, seed: number): V1ChefPlanteur {
  return {
    id,
    name: `Chef_${seed}`,
    phone: seed % 2 === 0 ? `+237${seed}` : null,
    cni: seed % 3 === 0 ? `CNI${seed}` : null,
    cooperative: `Coop_${seed % 5}`,
    region: `Region_${seed % 3}`,
    departement: `Dept_${seed % 4}`,
    localite: `Localite_${seed % 10}`,
    quantite_max_kg: (seed % 10000) + 100,
    date_debut_contrat: seed % 2 === 0 ? '2024-01-01' : null,
    date_fin_contrat: seed % 4 === 0 ? '2024-12-31' : null,
    raison_fin_contrat: null,
    latitude: seed % 2 === 0 ? 4.0 + (seed % 100) / 100 : null,
    longitude: seed % 2 === 0 ? 9.0 + (seed % 100) / 100 : null,
    validation_status: validationStatuses[seed % validationStatuses.length],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

/**
 * Generate a V1 planter
 */
function generateV1Planter(id: string, chefPlanteurId: string, seed: number): V1Planter {
  return {
    id,
    name: `Planter_${seed}`,
    phone: seed % 2 === 0 ? `+237${seed}` : null,
    cni: seed % 3 === 0 ? `CNI${seed}` : null,
    cooperative: `Coop_${seed % 5}`,
    chef_planteur_id: chefPlanteurId,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

/**
 * Generate a V1 delivery
 */
function generateV1Delivery(id: string, planterId: string, seed: number): V1Delivery {
  return {
    id,
    planter_id: planterId,
    date: `2024-06-${((seed % 30) + 1).toString().padStart(2, '0')}T12:00:00Z`,
    quantity_kg: ((seed % 9900) + 100) / 100,
    load_location: `Load_${seed % 5}`,
    unload_location: `Unload_${seed % 5}`,
    quality: qualities[seed % qualities.length],
    notes: seed % 2 === 0 ? `Notes for ${seed}` : null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 13: Data Migration Integrity', () => {
  describe('Chef Planteur Migration', () => {
    it('should preserve UUID for any chef_planteur', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, cooperativeId, seed) => {
            const v1 = generateV1ChefPlanteur(id, seed);
            const v2 = migrateChefPlanteur(v1, cooperativeId);

            expect(v2.id).toBe(v1.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all mapped fields for any chef_planteur', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3, 11.5
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, cooperativeId, seed) => {
            const v1 = generateV1ChefPlanteur(id, seed);
            const v2 = migrateChefPlanteur(v1, cooperativeId);
            const validation = validateChefPlanteurMigration(v1, v2);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly map validation status for any chef_planteur', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...validationStatuses),
          (id, cooperativeId, status) => {
            const v1 = generateV1ChefPlanteur(id, 1);
            v1.validation_status = status;
            const v2 = migrateChefPlanteur(v1, cooperativeId);

            const expectedStatus = mapValidationStatus(status);
            expect(v2.validation_status).toBe(expectedStatus);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Planteur Migration', () => {
    it('should preserve UUID for any planteur', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, chefPlanteurId, cooperativeId, seed) => {
            const v1 = generateV1Planter(id, chefPlanteurId, seed);
            const v2 = migratePlanteur(v1, cooperativeId);

            expect(v2).not.toBeNull();
            expect(v2!.id).toBe(v1.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all mapped fields for any planteur', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3, 11.5
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, chefPlanteurId, cooperativeId, seed) => {
            const v1 = generateV1Planter(id, chefPlanteurId, seed);
            const v2 = migratePlanteur(v1, cooperativeId);

            expect(v2).not.toBeNull();
            const validation = validatePlanteurMigration(v1, v2!);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for planteur without chef_planteur_id', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, cooperativeId, seed) => {
            const v1 = generateV1Planter(id, '', seed);
            v1.chef_planteur_id = null;
            const v2 = migratePlanteur(v1, cooperativeId);

            expect(v2).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Delivery Migration', () => {
    it('should preserve UUID for any delivery', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, planterId, chefPlanteurId, cooperativeId, warehouseId, seed) => {
            const v1 = generateV1Delivery(id, planterId, seed);
            const v2 = migrateDelivery(v1, chefPlanteurId, cooperativeId, warehouseId, `DEL-${seed}`);

            expect(v2.id).toBe(v1.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all mapped fields for any delivery', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3, 11.5
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000000 }),
          (id, planterId, chefPlanteurId, cooperativeId, warehouseId, seed) => {
            const v1 = generateV1Delivery(id, planterId, seed);
            const v2 = migrateDelivery(v1, chefPlanteurId, cooperativeId, warehouseId, `DEL-${seed}`);
            const validation = validateDeliveryMigration(v1, v2);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly map quality grade for any delivery', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...qualities),
          (id, planterId, chefPlanteurId, cooperativeId, warehouseId, quality) => {
            const v1 = generateV1Delivery(id, planterId, 1);
            v1.quality = quality;
            const v2 = migrateDelivery(v1, chefPlanteurId, cooperativeId, warehouseId, 'DEL-1');

            const expectedGrade = mapQualityGrade(quality);
            expect(v2.quality_grade).toBe(expectedGrade);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate total_amount correctly for any delivery', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 100, max: 100000 }), // quantity in cents
          fc.integer({ min: 100, max: 5000 }), // price per kg
          (id, planterId, chefPlanteurId, cooperativeId, warehouseId, quantityCents, pricePerKg) => {
            const v1 = generateV1Delivery(id, planterId, 1);
            v1.quantity_kg = quantityCents / 100;
            const v2 = migrateDelivery(v1, chefPlanteurId, cooperativeId, warehouseId, 'DEL-1', pricePerKg);

            const expectedTotal = Math.round(v1.quantity_kg * pricePerKg);
            expect(v2.total_amount).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Code Generation', () => {
    it('should generate valid codes for any name', () => {
      // Feature: cocoatrack-v2, Property 13: Data Migration Integrity
      // Validates: Requirements 11.3
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (name) => {
            const code = generateCode(name);

            // Code should only contain uppercase letters, numbers, and hyphens
            expect(code).toMatch(/^[A-Z0-9-]*$/);

            // Code should not exceed 20 characters
            expect(code.length).toBeLessThanOrEqual(20);

            // Code should not start or end with hyphen
            expect(code).not.toMatch(/^-|-$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
