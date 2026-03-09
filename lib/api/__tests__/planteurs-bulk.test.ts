// CocoaTrack V2 - Bulk Planteur Assignment Unit Tests
// Basic unit tests for bulk assignment functionality

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.gen';
import { bulkAssignPlanteurs } from '../planteurs-bulk';
import type { BulkAssignmentRequest } from '@/types/planteur-bulk';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if no service key is available
const skipTests = !supabaseServiceKey || !supabaseUrl;

describe('Bulk Planteur Assignment - Unit Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testUserId: string;
  let testCooperativeId: string;
  let testChefPlanteurId: string;
  let testPlanteurIds: string[] = [];

  beforeAll(async () => {
    if (skipTests) {
      console.log('Skipping tests: SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }

    // Create admin client for test setup
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get or create test user
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, cooperative_id')
      .limit(1);

    if (!profiles || profiles.length === 0) {
      throw new Error('No test user found. Please seed the database first.');
    }

    testUserId = profiles[0].id;
    testCooperativeId = profiles[0].cooperative_id || '';

    if (!testCooperativeId) {
      throw new Error('Test user has no cooperative_id');
    }

    // Get or create test chef planteur
    const { data: chefPlanteurs } = await supabase
      .from('chef_planteurs')
      .select('id')
      .eq('cooperative_id', testCooperativeId)
      .limit(1);

    if (chefPlanteurs && chefPlanteurs.length > 0) {
      testChefPlanteurId = chefPlanteurs[0].id;
    } else {
      // Create a test chef planteur
      const { data: newChef } = await supabase
        .from('chef_planteurs')
        .insert({
          name: 'Test Chef Planteur',
          code: `TEST-CHEF-${Date.now()}`,
          cooperative_id: testCooperativeId,
          created_by: testUserId,
        })
        .select('id')
        .single();

      if (!newChef) {
        throw new Error('Failed to create test chef planteur');
      }
      testChefPlanteurId = newChef.id;
    }

    // Create test planteurs
    const planteurData = [
      {
        name: `Test Planteur 1 ${Date.now()}`,
        code: `TEST-PL1-${Date.now()}`,
        cooperative_id: testCooperativeId,
        created_by: testUserId,
        chef_planteur_id: testChefPlanteurId,
      },
      {
        name: `Test Planteur 2 ${Date.now()}`,
        code: `TEST-PL2-${Date.now()}`,
        cooperative_id: testCooperativeId,
        created_by: testUserId,
        chef_planteur_id: testChefPlanteurId,
      },
    ];

    const { data: planteurs } = await supabase
      .from('planteurs')
      .insert(planteurData)
      .select('id');

    if (!planteurs || planteurs.length === 0) {
      throw new Error('Failed to create test planteurs');
    }

    testPlanteurIds = planteurs.map(p => p.id);
  });

  afterAll(async () => {
    if (skipTests || !supabase) return;

    // Clean up test planteurs
    if (testPlanteurIds.length > 0) {
      await supabase
        .from('planteurs')
        .delete()
        .in('id', testPlanteurIds);
    }
  });

  it('should successfully assign chef planteur to multiple planteurs', async () => {
    if (skipTests) return;

    const request: BulkAssignmentRequest = {
      planteurIds: testPlanteurIds,
      chefPlanteurId: testChefPlanteurId,
    };

    const result = await bulkAssignPlanteurs(supabase, request);

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(testPlanteurIds.length);
    expect(result.failureCount).toBe(0);
    expect(result.errors).toBeUndefined();

    // Verify the assignments were made
    const { data: planteurs } = await supabase
      .from('planteurs')
      .select('id, chef_planteur_id')
      .in('id', testPlanteurIds);

    expect(planteurs).toBeDefined();
    expect(planteurs?.length).toBe(testPlanteurIds.length);
    planteurs?.forEach(p => {
      expect(p.chef_planteur_id).toBe(testChefPlanteurId);
    });
  });

  it('should create audit log entry for bulk assignment', async () => {
    if (skipTests) return;

    const request: BulkAssignmentRequest = {
      planteurIds: testPlanteurIds,
      chefPlanteurId: testChefPlanteurId,
    };

    await bulkAssignPlanteurs(supabase, request);

    // Check audit log was created
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'planteurs')
      .eq('row_id', 'bulk_operation')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(auditLogs).toBeDefined();
    expect(auditLogs?.length).toBeGreaterThan(0);

    const auditLog = auditLogs?.[0];
    expect(auditLog?.action).toBe('UPDATE');
    expect(auditLog?.actor_id).toBe(testUserId);

    // Verify audit metadata
    const metadata = auditLog?.new_data as any;
    expect(metadata?.operation_type).toBe('bulk_assignment');
    expect(metadata?.planteur_ids).toEqual(testPlanteurIds);
    expect(metadata?.assignments?.chef_planteur_id).toBe(testChefPlanteurId);
    expect(metadata?.success_count).toBe(testPlanteurIds.length);
    expect(metadata?.failure_count).toBe(0);
  });

  it('should reject request with invalid chef planteur ID', async () => {
    if (skipTests) return;

    const request: BulkAssignmentRequest = {
      planteurIds: testPlanteurIds,
      chefPlanteurId: '00000000-0000-0000-0000-000000000000', // Invalid ID
    };

    await expect(bulkAssignPlanteurs(supabase, request)).rejects.toThrow(
      'Invalid chef planteur ID'
    );
  });

  it('should reject request with invalid cooperative ID', async () => {
    if (skipTests) return;

    const request: BulkAssignmentRequest = {
      planteurIds: testPlanteurIds,
      cooperativeId: '00000000-0000-0000-0000-000000000000', // Invalid ID
    };

    await expect(bulkAssignPlanteurs(supabase, request)).rejects.toThrow(
      'Invalid cooperative ID'
    );
  });

  it('should reject request with no assignment fields', async () => {
    if (skipTests) return;

    const request: BulkAssignmentRequest = {
      planteurIds: testPlanteurIds,
      // No chefPlanteurId or cooperativeId
    };

    await expect(bulkAssignPlanteurs(supabase, request)).rejects.toThrow(
      'At least one assignment field must be specified'
    );
  });

  it('should clear chef planteur assignment when set to null', async () => {
    if (skipTests) return;

    // First assign a chef planteur
    await bulkAssignPlanteurs(supabase, {
      planteurIds: testPlanteurIds,
      chefPlanteurId: testChefPlanteurId,
    });

    // Then clear it
    const result = await bulkAssignPlanteurs(supabase, {
      planteurIds: testPlanteurIds,
      chefPlanteurId: null,
    });

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(testPlanteurIds.length);

    // Verify the assignments were cleared
    const { data: planteurs } = await supabase
      .from('planteurs')
      .select('id, chef_planteur_id')
      .in('id', testPlanteurIds);

    planteurs?.forEach(p => {
      expect(p.chef_planteur_id).toBeNull();
    });
  });
});
