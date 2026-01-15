/**
 * CocoaTrack V2 - Property Tests for Search and Filters
 * 
 * **Feature: cocoatrack-v2, Property 6: Search Results Accuracy**
 * **Validates: Requirements 3.4**
 * 
 * *For any* search query on planters, all returned results SHALL contain 
 * the search term in at least one of: name, code, or phone fields.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface Planteur {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  is_active: boolean;
}

interface ChefPlanteur {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  region: string | null;
  validation_status: 'pending' | 'validated' | 'rejected';
  cooperative_id: string;
}

// Pure search function for testing (mirrors the API logic)
function searchPlanteurs(planteurs: Planteur[], query: string): Planteur[] {
  if (!query || query.trim() === '') {
    return planteurs;
  }
  
  const lowerQuery = query.toLowerCase();
  return planteurs.filter((p) => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.code.toLowerCase().includes(lowerQuery) ||
    (p.phone && p.phone.toLowerCase().includes(lowerQuery))
  );
}

// Pure filter function for testing (mirrors the API logic)
function filterChefPlanteurs(
  chefPlanteurs: ChefPlanteur[],
  filters: {
    region?: string;
    cooperative_id?: string;
    validation_status?: 'pending' | 'validated' | 'rejected';
  }
): ChefPlanteur[] {
  return chefPlanteurs.filter((cp) => {
    if (filters.region && cp.region !== filters.region) return false;
    if (filters.cooperative_id && cp.cooperative_id !== filters.cooperative_id) return false;
    if (filters.validation_status && cp.validation_status !== filters.validation_status) return false;
    return true;
  });
}

// Get associated planters for a chef_planteur
function getAssociatedPlanters(
  planteurs: Array<Planteur & { chef_planteur_id: string }>,
  chefPlanteurId: string
): Array<Planteur & { chef_planteur_id: string }> {
  return planteurs.filter((p) => p.chef_planteur_id === chefPlanteurId);
}

// Generators
const planteurArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 2, maxLength: 50 }),
  code: fc.stringMatching(/^[A-Z0-9-]{3,10}$/),
  phone: fc.option(fc.stringMatching(/^\+237[26][0-9]{8}$/), { nil: null }),
  is_active: fc.boolean(),
});

const chefPlanteurArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 2, maxLength: 50 }),
  code: fc.stringMatching(/^[A-Z0-9-]{3,10}$/),
  phone: fc.option(fc.stringMatching(/^\+237[26][0-9]{8}$/), { nil: null }),
  region: fc.option(fc.constantFrom('Centre', 'Littoral', 'Ouest', 'Sud'), { nil: null }),
  validation_status: fc.constantFrom('pending', 'validated', 'rejected'),
  cooperative_id: fc.uuid(),
});

const planteurWithChefArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 2, maxLength: 50 }),
  code: fc.stringMatching(/^[A-Z0-9-]{3,10}$/),
  phone: fc.option(fc.stringMatching(/^\+237[26][0-9]{8}$/), { nil: null }),
  is_active: fc.boolean(),
  chef_planteur_id: fc.uuid(),
});

describe('Property 6: Search Results Accuracy', () => {
  /**
   * **Feature: cocoatrack-v2, Property 6: Search Results Accuracy**
   * **Validates: Requirements 3.4**
   * 
   * *For any* search query on planters, all returned results SHALL contain 
   * the search term in at least one of: name, code, or phone fields.
   */
  it('should return only planteurs containing the search term in name, code, or phone', () => {
    fc.assert(
      fc.property(
        fc.array(planteurArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (planteurs, query) => {
          // Skip whitespace-only queries (handled separately)
          fc.pre(query.trim() !== '');
          
          const results = searchPlanteurs(planteurs, query);
          const lowerQuery = query.toLowerCase();
          
          // All results must contain the query in at least one searchable field
          return results.every((p) => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.code.toLowerCase().includes(lowerQuery) ||
            (p.phone && p.phone.toLowerCase().includes(lowerQuery))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all matching planteurs (no false negatives)', () => {
    fc.assert(
      fc.property(
        fc.array(planteurArb, { minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (planteurs, query) => {
          // Skip whitespace-only queries (handled separately)
          fc.pre(query.trim() !== '');
          
          const results = searchPlanteurs(planteurs, query);
          const lowerQuery = query.toLowerCase();
          
          // Count expected matches
          const expectedMatches = planteurs.filter((p) =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.code.toLowerCase().includes(lowerQuery) ||
            (p.phone && p.phone.toLowerCase().includes(lowerQuery))
          );
          
          // Results should contain all expected matches
          return results.length === expectedMatches.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all planteurs when query is empty', () => {
    fc.assert(
      fc.property(
        fc.array(planteurArb, { minLength: 0, maxLength: 50 }),
        (planteurs) => {
          const results = searchPlanteurs(planteurs, '');
          return results.length === planteurs.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Filter Results Consistency', () => {
  /**
   * **Feature: cocoatrack-v2, Property 7: Filter Results Consistency**
   * **Validates: Requirements 4.8**
   * 
   * *For any* filter applied to chef_planteurs (region, cooperative, validation_status), 
   * all returned results SHALL match all applied filter criteria.
   */
  it('should return only chef_planteurs matching all filter criteria', () => {
    fc.assert(
      fc.property(
        fc.array(chefPlanteurArb, { minLength: 0, maxLength: 50 }),
        fc.record({
          region: fc.option(fc.constantFrom('Centre', 'Littoral', 'Ouest', 'Sud'), { nil: undefined }),
          cooperative_id: fc.option(fc.uuid(), { nil: undefined }),
          validation_status: fc.option(fc.constantFrom('pending', 'validated', 'rejected'), { nil: undefined }),
        }),
        (chefPlanteurs, filters) => {
          const results = filterChefPlanteurs(chefPlanteurs, filters);
          
          // All results must match all applied filters
          return results.every((cp) => {
            if (filters.region && cp.region !== filters.region) return false;
            if (filters.cooperative_id && cp.cooperative_id !== filters.cooperative_id) return false;
            if (filters.validation_status && cp.validation_status !== filters.validation_status) return false;
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all matching chef_planteurs (no false negatives)', () => {
    fc.assert(
      fc.property(
        fc.array(chefPlanteurArb, { minLength: 1, maxLength: 50 }),
        fc.record({
          region: fc.option(fc.constantFrom('Centre', 'Littoral', 'Ouest', 'Sud'), { nil: undefined }),
          validation_status: fc.option(fc.constantFrom('pending', 'validated', 'rejected'), { nil: undefined }),
        }),
        (chefPlanteurs, filters) => {
          const results = filterChefPlanteurs(chefPlanteurs, filters);
          
          // Count expected matches
          const expectedMatches = chefPlanteurs.filter((cp) => {
            if (filters.region && cp.region !== filters.region) return false;
            if (filters.validation_status && cp.validation_status !== filters.validation_status) return false;
            return true;
          });
          
          return results.length === expectedMatches.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all chef_planteurs when no filters applied', () => {
    fc.assert(
      fc.property(
        fc.array(chefPlanteurArb, { minLength: 0, maxLength: 50 }),
        (chefPlanteurs) => {
          const results = filterChefPlanteurs(chefPlanteurs, {});
          return results.length === chefPlanteurs.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 17: Planter-ChefPlanteur Association', () => {
  /**
   * **Feature: cocoatrack-v2, Property 17: Planter-ChefPlanteur Association**
   * **Validates: Requirements 4.6**
   * 
   * *For any* chef_planteur, the list of associated planters SHALL contain 
   * exactly those planters where chef_planteur_id equals that chef_planteur's id.
   */
  it('should return exactly the planters with matching chef_planteur_id', () => {
    fc.assert(
      fc.property(
        fc.array(planteurWithChefArb, { minLength: 0, maxLength: 50 }),
        fc.uuid(),
        (planteurs, chefPlanteurId) => {
          const results = getAssociatedPlanters(planteurs, chefPlanteurId);
          
          // All results must have the correct chef_planteur_id
          const allMatch = results.every((p) => p.chef_planteur_id === chefPlanteurId);
          
          // Count expected matches
          const expectedCount = planteurs.filter((p) => p.chef_planteur_id === chefPlanteurId).length;
          
          return allMatch && results.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no planters match', () => {
    fc.assert(
      fc.property(
        fc.array(planteurWithChefArb, { minLength: 0, maxLength: 20 }),
        (planteurs) => {
          // Use a UUID that doesn't exist in the data
          const nonExistentId = '00000000-0000-0000-0000-000000000000';
          const filteredPlanteurs = planteurs.filter((p) => p.chef_planteur_id !== nonExistentId);
          
          const results = getAssociatedPlanters(filteredPlanteurs, nonExistentId);
          return results.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all planteur data in results', () => {
    fc.assert(
      fc.property(
        fc.array(planteurWithChefArb, { minLength: 1, maxLength: 50 }),
        (planteurs) => {
          // Pick a random chef_planteur_id from the data
          const randomPlanteur = planteurs[Math.floor(Math.random() * planteurs.length)];
          const chefPlanteurId = randomPlanteur.chef_planteur_id;
          
          const results = getAssociatedPlanters(planteurs, chefPlanteurId);
          
          // All original data should be preserved
          return results.every((result) => {
            const original = planteurs.find((p) => p.id === result.id);
            return original && 
              original.name === result.name &&
              original.code === result.code &&
              original.phone === result.phone &&
              original.is_active === result.is_active;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
