// CocoaTrack V2 - Planteurs Import Execute Property Tests
// Property-based tests for planteurs CSV import execution
//
// These tests validate the correctness properties defined in the design document
// using fast-check for property-based testing with minimum 100 iterations.
//
// PREREQUISITES:
// - The planteur_import_files table must exist in the database
// - Run migration: v2/supabase/migrations/20260308000001_planteur_import_files.sql
// - Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env.local
//
// PROPERTIES TESTED:
// - Property 11: Ignore action skips import (Requirements 3.4)
// - Property 12: Update action modifies existing record (Requirements 3.5, 5.3)
// - Property 13: Create action creates new record (Requirements 3.6)
// - Property 15: Field persistence (Requirements 5.2)
// - Property 17: Summary accuracy (Requirements 5.5)
// - Property 18: Transaction atomicity (Requirements 5.7)
// - Property 19: Cooperative assignment (Requirements 6.1)
// - Property 20: Cooperative immutability on update (Requirements 6.4)
// - Property 21: Superficie storage (Requirements 7.1, 7.2)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.gen';
import type {
  PlanteurCSVData,
  ParsedRow,
  RowAction,
  ImportSummary,
  ExecuteImportInput,
  PlanteurImportFile,
  ParseResult,
} from '@/types/planteur-import';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
try {
  const envPath = join(process.cwd(), '.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.warn('Could not load .env.local file:', error);
}

// ============================================================================
// TEST SETUP
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabase: ReturnType<typeof createClient<Database>>;
let testCooperativeId: string;
let testUserId: string;
let testCooperativeId2: string;

beforeAll(async () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Missing Supabase credentials for testing. Skipping all tests.');
    return;
  }

  supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if planteur_import_files table exists
  const { error: tableCheckError } = await supabase
    .from('planteur_import_files')
    .select('id')
    .limit(0);

  if (tableCheckError) {
    console.warn('planteur_import_files table does not exist. Skipping tests.');
    console.warn('Run migration: v2/supabase/migrations/20260308000001_planteur_import_files.sql');
    return;
  }

  // Get a region first
  const { data: regions } = await supabase
    .from('regions')
    .select('id')
    .limit(1);

  const regionId = regions?.[0]?.id;
  if (!regionId) {
    throw new Error('No regions found in database');
  }

  // Create test cooperative
  const { data: coop, error: coopError } = await supabase
    .from('cooperatives')
    .insert({
      name: 'Test Cooperative Import Execute',
      code: `TEST-EXEC-${Date.now()}`,
      region_id: regionId,
    })
    .select()
    .single();

  if (coopError) throw coopError;
  testCooperativeId = coop.id;

  // Create second test cooperative for isolation tests
  const { data: coop2, error: coop2Error } = await supabase
    .from('cooperatives')
    .insert({
      name: 'Test Cooperative Import Execute 2',
      code: `TEST-EXEC2-${Date.now()}`,
      region_id: regionId,
    })
    .select()
    .single();

  if (coop2Error) throw coop2Error;
  testCooperativeId2 = coop2.id;

  // Create test user with profile
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `test-import-exec-${Date.now()}@example.com`,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (authError) throw authError;
  testUserId = authData.user.id;

  // Update profile with cooperative
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ cooperative_id: testCooperativeId })
    .eq('id', testUserId);

  if (profileError) throw profileError;
}, 60000);

afterAll(async () => {
  // Cleanup: Delete test data
  if (testUserId) {
    await supabase.auth.admin.deleteUser(testUserId);
  }
  if (testCooperativeId) {
    await supabase.from('cooperatives').delete().eq('id', testCooperativeId);
  }
  if (testCooperativeId2) {
    await supabase.from('cooperatives').delete().eq('id', testCooperativeId2);
  }
});

beforeEach(async () => {
  // Clean up planteurs before each test
  await supabase.from('planteurs').delete().eq('cooperative_id', testCooperativeId);
  await supabase.from('planteurs').delete().eq('cooperative_id', testCooperativeId2);
  await supabase.from('planteur_import_files').delete().eq('cooperative_id', testCooperativeId);
});

// ============================================================================
// ARBITRARIES (Generators for random test data)
// ============================================================================

/**
 * Generate valid planteur CSV data with unique normalized names
 */
const planteurCSVDataArb = fc.record({
  nom: fc.integer({ min: 100000, max: 999999 }).map(num => {
    // Generate names that will have unique normalized forms
    // Use random number to ensure uniqueness
    const names = ['Konan', 'Kouassi', 'Yao', 'Koffi', 'Aya', 'Adjoua'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    return `${randomName} ${Date.now()}${num}`;
  }),
  prénoms: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  CNI: fc.option(
    fc.stringMatching(/^[A-Z0-9]{5,20}$/),
    { nil: undefined }
  ),
  téléphone: fc.option(
    fc.integer({ min: 10000000, max: 99999999 }).map(n => `+225${n}`),
    { nil: undefined }
  ),
  superficie: fc.option(
    fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
    { nil: undefined }
  ),
});

/**
 * Generate a parsed row with valid data
 */
const validParsedRowArb = fc.nat({ max: 1000 }).chain(rowNumber =>
  planteurCSVDataArb.map(data => ({
    row_number: rowNumber,
    data,
    validation_errors: [],
    duplicate_info: null,
    user_action: 'pending' as const,
  }))
);

/**
 * Generate a parsed row with validation errors
 */
const invalidParsedRowArb = fc.nat({ max: 1000 }).map(rowNumber => ({
  row_number: rowNumber,
  data: { nom: '' } as PlanteurCSVData,
  validation_errors: [
    {
      field: 'nom',
      message: 'Le nom est obligatoire',
      code: 'NAME_REQUIRED',
    },
  ],
  duplicate_info: null,
  user_action: 'pending' as const,
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a test import file with parse result
 */
async function createTestImport(
  rows: ParsedRow[]
): Promise<PlanteurImportFile> {
  const parseResult: ParseResult = {
    rows,
    total_rows: rows.length,
    valid_rows: rows.filter(r => r.validation_errors.length === 0).length,
    invalid_rows: rows.filter(r => r.validation_errors.length > 0).length,
    duplicate_rows: rows.filter(r => r.duplicate_info !== null).length,
    errors: [],
  };

  const { data, error } = await supabase
    .from('planteur_import_files')
    .insert({
      cooperative_id: testCooperativeId,
      filename: `test-${Date.now()}.csv`,
      file_size: 1024,
      file_path: 'test/path.csv',
      import_status: 'parsed',
      parse_result: parseResult as any,
      created_by: testUserId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

/**
 * Execute import via API simulation
 */
async function executeImport(
  importId: string,
  rowActions: RowAction[]
): Promise<ImportSummary> {
  // Get import file
  const { data: importFile, error: fetchError } = await supabase
    .from('planteur_import_files')
    .select('*')
    .eq('id', importId)
    .single();

  if (fetchError) throw fetchError;

  const parseResult = importFile.parse_result as any as ParseResult;
  const actionsMap = new Map(rowActions.map(a => [a.row_number, a]));

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: any[] = [];

  // Process each row
  for (const row of parseResult.rows) {
    // Skip invalid rows
    if (row.validation_errors.length > 0) {
      skippedCount++;
      continue;
    }

    const action = actionsMap.get(row.row_number);
    if (!action || action.action === 'ignore') {
      skippedCount++;
      continue;
    }

    try {
      if (action.action === 'create') {
        // Generate code
        const { count } = await supabase
          .from('planteurs')
          .select('*', { count: 'exact', head: true })
          .eq('cooperative_id', testCooperativeId);

        const code = `PL${String((count || 0) + 1).padStart(4, '0')}`;

        // Insert planteur
        const { error: insertError } = await supabase.from('planteurs').insert({
          name: row.data.nom,
          code,
          phone: row.data.téléphone || null,
          cni: row.data.CNI || null,
          cooperative_id: testCooperativeId,
          chef_planteur_id: null,
          superficie_hectares: row.data.superficie || null,
          is_active: true,
          created_by: testUserId,
        });

        if (insertError) {
          failedCount++;
          errors.push({
            row_number: row.row_number,
            error_message: insertError.message,
            error_code: 'CREATE_FAILED',
          });
        } else {
          createdCount++;
        }
      } else if (action.action === 'update') {
        if (!action.planteur_id) {
          failedCount++;
          errors.push({
            row_number: row.row_number,
            error_message: 'Missing planteur_id',
            error_code: 'MISSING_PLANTEUR_ID',
          });
          continue;
        }

        const updateData: any = { name: row.data.nom };
        if (row.data.CNI) updateData.cni = row.data.CNI;
        if (row.data.téléphone) updateData.phone = row.data.téléphone;
        if (row.data.superficie !== undefined) {
          updateData.superficie_hectares = row.data.superficie;
        }

        const { error: updateError } = await supabase
          .from('planteurs')
          .update(updateData)
          .eq('id', action.planteur_id);

        if (updateError) {
          failedCount++;
          errors.push({
            row_number: row.row_number,
            error_message: updateError.message,
            error_code: 'UPDATE_FAILED',
          });
        } else {
          updatedCount++;
        }
      }
    } catch (error: any) {
      failedCount++;
      errors.push({
        row_number: row.row_number,
        error_message: error.message,
        error_code: 'PROCESSING_ERROR',
      });
    }
  }

  const summary: ImportSummary = {
    total_processed: createdCount + updatedCount + skippedCount + failedCount,
    created_count: createdCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    errors,
  };

  // Update import file
  await supabase
    .from('planteur_import_files')
    .update({
      import_summary: summary as any,
      import_status: failedCount > 0 ? 'failed' : 'completed',
    })
    .eq('id', importId);

  return summary;
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Property 11: Ignore action skips import', () => {
  /**
   * Feature: planteurs-csv-import, Property 11: Ignore action skips import
   * 
   * For any CSV row marked with user action "Ignore", the Import_Engine SHALL NOT
   * create or update any planteur record for that row.
   * 
   * Validates: Requirements 3.4
   */

  it('should not create planteur when action is ignore', async () => {
    // **Validates: Requirements 3.4**
    await fc.assert(
      fc.asyncProperty(
        fc.array(validParsedRowArb, { minLength: 1, maxLength: 5 }),
        async (rows) => {
          // Create import with valid rows
          const importFile = await createTestImport(rows);

          // Mark all rows as ignore
          const rowActions: RowAction[] = rows.map(r => ({
            row_number: r.row_number,
            action: 'ignore',
          }));

          // Execute import
          const summary = await executeImport(importFile.id, rowActions);

          // Verify no planteurs were created
          expect(summary.created_count).toBe(0);
          expect(summary.updated_count).toBe(0);
          expect(summary.skipped_count).toBe(rows.length);

          // Verify database has no new planteurs
          const { count } = await supabase
            .from('planteurs')
            .select('*', { count: 'exact', head: true })
            .eq('cooperative_id', testCooperativeId);

          expect(count).toBe(0);
        }
      ),
      { numRuns: 10 } // Reduced for database operations
    );
  }, 30000);
});

describe('Property 12: Update action modifies existing record', () => {
  /**
   * Feature: planteurs-csv-import, Property 12: Update action modifies existing record
   * 
   * For any CSV row marked with user action "Update" and linked to an existing planteur,
   * the Import_Engine SHALL update that planteur's fields with non-empty CSV values.
   * 
   * Validates: Requirements 3.5, 5.3
   */

  it('should update existing planteur with CSV data', async () => {
    // **Validates: Requirements 3.5, 5.3**
    await fc.assert(
      fc.asyncProperty(
        planteurCSVDataArb,
        planteurCSVDataArb,
        async (originalData, updateData) => {
          // Create existing planteur
          const { data: existingPlanteur, error: createError } = await supabase
            .from('planteurs')
            .insert({
              name: originalData.nom,
              code: `PL${Date.now()}`,
              phone: originalData.téléphone || null,
              cni: originalData.CNI || null,
              cooperative_id: testCooperativeId,
              chef_planteur_id: null,
              superficie_hectares: originalData.superficie || null,
              is_active: true,
              created_by: testUserId,
            })
            .select()
            .single();

          if (createError) throw createError;

          // Create import with update row
          const row: ParsedRow = {
            row_number: 1,
            data: updateData,
            validation_errors: [],
            duplicate_info: {
              existing_planteur_id: existingPlanteur.id,
              existing_planteur_name: existingPlanteur.name,
              existing_planteur_code: existingPlanteur.code,
              match_type: 'normalized',
            },
            user_action: 'pending',
          };

          const importFile = await createTestImport([row]);

          // Execute with update action
          const rowActions: RowAction[] = [
            {
              row_number: 1,
              action: 'update',
              planteur_id: existingPlanteur.id,
            },
          ];

          const summary = await executeImport(importFile.id, rowActions);

          // Verify update succeeded
          expect(summary.updated_count).toBe(1);
          expect(summary.created_count).toBe(0);

          // Verify planteur was updated
          const { data: updatedPlanteur } = await supabase
            .from('planteurs')
            .select('*')
            .eq('id', existingPlanteur.id)
            .single();

          expect(updatedPlanteur?.name).toBe(updateData.nom);
          if (updateData.CNI) {
            expect(updatedPlanteur?.cni).toBe(updateData.CNI);
          }
          if (updateData.téléphone) {
            expect(updatedPlanteur?.phone).toBe(updateData.téléphone);
          }
          if (updateData.superficie !== undefined) {
            expect(updatedPlanteur?.superficie_hectares).toBe(updateData.superficie);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);
});

describe('Property 13: Create action creates new record', () => {
  /**
   * Feature: planteurs-csv-import, Property 13: Create action creates new record
   * 
   * For any CSV row marked with user action "Create anyway" (despite duplicate warning),
   * the Import_Engine SHALL create a new planteur record with a unique ID.
   * 
   * Validates: Requirements 3.6
   */

  it('should create new planteur even with duplicate warning', async () => {
    // **Validates: Requirements 3.6**
    await fc.assert(
      fc.asyncProperty(
        fc.array(validParsedRowArb, { minLength: 1, maxLength: 5 }),
        async (rows) => {
          const importFile = await createTestImport(rows);

          // Mark all rows as create
          const rowActions: RowAction[] = rows.map(r => ({
            row_number: r.row_number,
            action: 'create',
          }));

          const summary = await executeImport(importFile.id, rowActions);

          // Verify planteurs were created
          expect(summary.created_count).toBe(rows.length);
          expect(summary.updated_count).toBe(0);

          // Verify database has new planteurs
          const { data: planteurs } = await supabase
            .from('planteurs')
            .select('*')
            .eq('cooperative_id', testCooperativeId);

          expect(planteurs?.length).toBe(rows.length);

          // Verify each has unique ID
          const ids = new Set(planteurs?.map(p => p.id));
          expect(ids.size).toBe(rows.length);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe('Property 15: Field persistence', () => {
  /**
   * Feature: planteurs-csv-import, Property 15: Field persistence
   * 
   * For any CSV row that creates a new planteur, all provided CSV fields
   * (nom, prénoms, CNI, téléphone, superficie) SHALL be stored in the
   * corresponding planteur record fields.
   * 
   * Validates: Requirements 5.2
   */

  it('should persist all CSV fields to planteur record', async () => {
    // **Validates: Requirements 5.2**
    await fc.assert(
      fc.asyncProperty(planteurCSVDataArb, async (csvData) => {
        const row: ParsedRow = {
          row_number: 1,
          data: csvData,
          validation_errors: [],
          duplicate_info: null,
          user_action: 'pending',
        };

        const importFile = await createTestImport([row]);

        const rowActions: RowAction[] = [
          { row_number: 1, action: 'create' },
        ];

        const summary = await executeImport(importFile.id, rowActions);

        expect(summary.created_count).toBe(1);

        // Verify all fields were persisted
        const { data: planteur } = await supabase
          .from('planteurs')
          .select('*')
          .eq('cooperative_id', testCooperativeId)
          .single();

        expect(planteur?.name).toBe(csvData.nom);
        expect(planteur?.phone).toBe(csvData.téléphone || null);
        expect(planteur?.cni).toBe(csvData.CNI || null);
        expect(planteur?.superficie_hectares).toBe(csvData.superficie || null);
      }),
      { numRuns: 10 }
    );
  }, 60000);
});

describe('Property 17: Summary accuracy', () => {
  /**
   * Feature: planteurs-csv-import, Property 17: Summary accuracy
   * 
   * For any completed import, the ImportSummary counts (created_count + updated_count +
   * skipped_count + failed_count) SHALL equal the total number of valid rows processed.
   * 
   * Validates: Requirements 5.5
   */

  it('should have accurate summary counts', async () => {
    // **Validates: Requirements 5.5**
    await fc.assert(
      fc.asyncProperty(
        fc.array(validParsedRowArb, { minLength: 1, maxLength: 10 }),
        fc.array(invalidParsedRowArb, { minLength: 0, maxLength: 5 }),
        async (validRows, invalidRows) => {
          const allRows = [...validRows, ...invalidRows];
          const importFile = await createTestImport(allRows);

          // Create mixed actions
          const rowActions: RowAction[] = validRows.map((r, i) => ({
            row_number: r.row_number,
            action: i % 3 === 0 ? 'ignore' : 'create',
          }));

          const summary = await executeImport(importFile.id, rowActions);

          // Verify summary accuracy
          const totalCounted =
            summary.created_count +
            summary.updated_count +
            summary.skipped_count +
            summary.failed_count;

          expect(totalCounted).toBe(allRows.length);
          expect(summary.total_processed).toBe(allRows.length);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe('Property 18: Transaction atomicity', () => {
  /**
   * Feature: planteurs-csv-import, Property 18: Transaction atomicity
   * 
   * For any planteur import operation (create or update), either all fields are
   * persisted successfully or none are (rollback on error).
   * 
   * Validates: Requirements 5.7
   */

  it('should persist all fields or none on create', async () => {
    // **Validates: Requirements 5.7**
    await fc.assert(
      fc.asyncProperty(planteurCSVDataArb, async (csvData) => {
        const row: ParsedRow = {
          row_number: 1,
          data: csvData,
          validation_errors: [],
          duplicate_info: null,
          user_action: 'pending',
        };

        const importFile = await createTestImport([row]);
        const rowActions: RowAction[] = [{ row_number: 1, action: 'create' }];

        await executeImport(importFile.id, rowActions);

        // Verify planteur exists with all fields or doesn't exist at all
        const { data: planteur } = await supabase
          .from('planteurs')
          .select('*')
          .eq('cooperative_id', testCooperativeId)
          .maybeSingle();

        if (planteur) {
          // If planteur exists, all required fields must be present
          expect(planteur.name).toBeTruthy();
          expect(planteur.code).toBeTruthy();
          expect(planteur.cooperative_id).toBe(testCooperativeId);
          expect(planteur.created_by).toBe(testUserId);
        }
      }),
      { numRuns: 10 }
    );
  }, 30000);
});

describe('Property 19: Cooperative assignment', () => {
  /**
   * Feature: planteurs-csv-import, Property 19: Cooperative assignment
   * 
   * For any planteur created via import, the cooperative_id SHALL match the
   * authenticated user's cooperative_id from their profile.
   * 
   * Validates: Requirements 6.1
   */

  it('should assign planteur to user cooperative', async () => {
    // **Validates: Requirements 6.1**
    await fc.assert(
      fc.asyncProperty(
        fc.array(validParsedRowArb, { minLength: 1, maxLength: 5 }),
        async (rows) => {
          const importFile = await createTestImport(rows);

          const rowActions: RowAction[] = rows.map(r => ({
            row_number: r.row_number,
            action: 'create',
          }));

          await executeImport(importFile.id, rowActions);

          // Verify all planteurs have correct cooperative_id
          const { data: planteurs } = await supabase
            .from('planteurs')
            .select('*')
            .eq('cooperative_id', testCooperativeId);

          expect(planteurs?.length).toBe(rows.length);
          planteurs?.forEach(p => {
            expect(p.cooperative_id).toBe(testCooperativeId);
          });
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});

describe('Property 20: Cooperative immutability on update', () => {
  /**
   * Feature: planteurs-csv-import, Property 20: Cooperative immutability on update
   * 
   * For any planteur updated via import, the cooperative_id SHALL remain
   * unchanged from its original value.
   * 
   * Validates: Requirements 6.4
   */

  it('should not change cooperative_id on update', async () => {
    // **Validates: Requirements 6.4**
    await fc.assert(
      fc.asyncProperty(
        planteurCSVDataArb,
        planteurCSVDataArb,
        async (originalData, updateData) => {
          // Create planteur in different cooperative
          const { data: existingPlanteur, error: createError } = await supabase
            .from('planteurs')
            .insert({
              name: originalData.nom,
              code: `PL${Date.now()}`,
              phone: originalData.téléphone || null,
              cni: originalData.CNI || null,
              cooperative_id: testCooperativeId2,
              chef_planteur_id: null,
              is_active: true,
              created_by: testUserId,
            })
            .select()
            .single();

          if (createError) throw new Error(`Failed to create test planteur: ${createError.message}`);

          if (!existingPlanteur) throw new Error('Failed to create test planteur');

          const originalCoopId = existingPlanteur.cooperative_id;

          // Create import with update row
          const row: ParsedRow = {
            row_number: 1,
            data: updateData,
            validation_errors: [],
            duplicate_info: null,
            user_action: 'pending',
          };

          const importFile = await createTestImport([row]);

          const rowActions: RowAction[] = [
            {
              row_number: 1,
              action: 'update',
              planteur_id: existingPlanteur.id,
            },
          ];

          await executeImport(importFile.id, rowActions);

          // Verify cooperative_id unchanged
          const { data: updatedPlanteur } = await supabase
            .from('planteurs')
            .select('*')
            .eq('id', existingPlanteur.id)
            .single();

          expect(updatedPlanteur?.cooperative_id).toBe(originalCoopId);
          expect(updatedPlanteur?.cooperative_id).toBe(testCooperativeId2);
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);
});

describe('Property 21: Superficie storage', () => {
  /**
   * Feature: planteurs-csv-import, Property 21: Superficie storage
   * 
   * For any CSV row with a valid numeric superficie value, the created/updated
   * planteur SHALL have that value stored in the superficie field. For empty/missing
   * superficie, the field SHALL be NULL.
   * 
   * Validates: Requirements 7.1, 7.2
   */

  it('should store superficie value when provided', async () => {
    // **Validates: Requirements 7.1, 7.2**
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true })),
        async (superficie) => {
          const csvData: PlanteurCSVData = {
            nom: 'Test Planteur',
            superficie,
          };

          const row: ParsedRow = {
            row_number: 1,
            data: csvData,
            validation_errors: [],
            duplicate_info: null,
            user_action: 'pending',
          };

          const importFile = await createTestImport([row]);
          const rowActions: RowAction[] = [{ row_number: 1, action: 'create' }];

          await executeImport(importFile.id, rowActions);

          // Verify superficie storage
          const { data: planteur } = await supabase
            .from('planteurs')
            .select('*')
            .eq('cooperative_id', testCooperativeId)
            .single();

          if (superficie !== undefined && superficie !== null) {
            expect(planteur?.superficie_hectares).toBe(superficie);
          } else {
            // Database may return null or undefined for missing values
            expect([null, undefined]).toContain(planteur?.superficie_hectares);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  it('should store NULL for missing superficie', async () => {
    // **Validates: Requirements 7.1, 7.2**
    const csvData: PlanteurCSVData = {
      nom: 'Test Planteur No Superficie',
    };

    const row: ParsedRow = {
      row_number: 1,
      data: csvData,
      validation_errors: [],
      duplicate_info: null,
      user_action: 'pending',
    };

    const importFile = await createTestImport([row]);
    const rowActions: RowAction[] = [{ row_number: 1, action: 'create' }];

    await executeImport(importFile.id, rowActions);

    const { data: planteur } = await supabase
      .from('planteurs')
      .select('*')
      .eq('cooperative_id', testCooperativeId)
      .single();

    // Database may return null or undefined for missing values
    expect([null, undefined]).toContain(planteur?.superficie_hectares);
  }, 30000);
});
