/**
 * Health Status Change Notifications Tests
 * 
 * Tests the automatic notification system that alerts cooperative managers
 * and planteurs when a parcelle's health status declines by 2 or more categories.
 * 
 * Requirements: Task 4.4.3
 * - Add notification trigger when health status declines by 2+ categories
 * - Send notification to cooperative manager and planteur
 * - Include health status details and recommendations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.gen';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

describe('Health Status Change Notifications', () => {
  let supabase: SupabaseClient<Database>;
  let testCooperativeId: string;
  let testManagerId: string;
  let testPlanteurUserId: string;
  let testPlanteurId: string;
  let testParcelleId: string;

  beforeAll(async () => {
    // Create Supabase client with service role key to bypass RLS
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Create test cooperative
    const { data: cooperative, error: coopError } = await supabase
      .from('cooperatives')
      .insert({
        code: 'TEST-HEALTH-NOTIF',
        name: 'Test Cooperative for Health Notifications',
        region_id: '00000000-0000-0000-0000-000000000001', // Assuming a default region exists
      })
      .select()
      .single();

    if (coopError) throw coopError;
    testCooperativeId = cooperative.id;

    // Create test manager user
    const { data: authManager, error: authManagerError } = await supabase.auth.admin.createUser({
      email: `test-manager-health-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authManagerError) throw authManagerError;
    testManagerId = authManager.user.id;

    // Create manager profile
    await supabase.from('profiles').insert({
      id: testManagerId,
      email: authManager.user.email!,
      full_name: 'Test Manager',
      role: 'manager',
      cooperative_id: testCooperativeId,
    });

    // Create test planteur user
    const { data: authPlanteur, error: authPlanteurError } = await supabase.auth.admin.createUser({
      email: `test-planteur-health-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authPlanteurError) throw authPlanteurError;
    testPlanteurUserId = authPlanteur.user.id;

    // Create planteur profile
    await supabase.from('profiles').insert({
      id: testPlanteurUserId,
      email: authPlanteur.user.email!,
      full_name: 'Test Planteur',
      role: 'planteur',
      cooperative_id: testCooperativeId,
    });

    // Create planteur record
    const { data: planteur, error: planteurError } = await supabase
      .from('planteurs')
      .insert({
        nom: 'Test',
        prenom: 'Planteur',
        telephone: '123456789',
        cooperative_id: testCooperativeId,
        user_id: testPlanteurUserId,
      })
      .select()
      .single();

    if (planteurError) throw planteurError;
    testPlanteurId = planteur.id;

    // Create test parcelle
    const { data: parcelle, error: parcelleError } = await supabase
      .from('parcelles')
      .insert({
        code: 'TEST-HEALTH-001',
        nom: 'Test Parcelle for Health Notifications',
        planteur_id: testPlanteurId,
        surface_hectares: 2.5,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [10.0, 5.0],
                [10.1, 5.0],
                [10.1, 5.1],
                [10.0, 5.1],
                [10.0, 5.0],
              ],
            ],
          ],
        },
      })
      .select()
      .single();

    if (parcelleError) throw parcelleError;
    testParcelleId = parcelle.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testParcelleId) {
      await supabase.from('parcelles').delete().eq('id', testParcelleId);
    }
    if (testPlanteurId) {
      await supabase.from('planteurs').delete().eq('id', testPlanteurId);
    }
    if (testManagerId) {
      await supabase.from('profiles').delete().eq('id', testManagerId);
      await supabase.auth.admin.deleteUser(testManagerId);
    }
    if (testPlanteurUserId) {
      await supabase.from('profiles').delete().eq('id', testPlanteurUserId);
      await supabase.auth.admin.deleteUser(testPlanteurUserId);
    }
    if (testCooperativeId) {
      await supabase.from('cooperatives').delete().eq('id', testCooperativeId);
    }
  });

  beforeEach(async () => {
    // Clear notifications before each test
    await supabase
      .from('notifications')
      .delete()
      .in('user_id', [testManagerId, testPlanteurUserId]);

    // Clear NDVI results before each test
    await supabase
      .from('ndvi_results')
      .delete()
      .eq('parcelle_id', testParcelleId);
  });

  describe('Health Status Decline Detection', () => {
    it('should create notifications when health status declines by 2 categories (Good → Poor)', async () => {
      // Step 1: Insert initial NDVI result with "good" health status
      const initialDate = new Date('2024-01-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: initialDate.toISOString(),
        mean_ndvi: 0.60, // Good status (0.55-0.65)
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      // Step 2: Insert new NDVI result with "poor" health status (2 category decline)
      const newDate = new Date('2024-02-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: newDate.toISOString(),
        mean_ndvi: 0.35, // Poor status (0.30-0.45)
        min_ndvi: 0.25,
        max_ndvi: 0.45,
        std_dev_ndvi: 0.06,
        health_status: 'poor',
      });

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify notifications were created for manager
      const { data: managerNotifications, error: managerError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline');

      expect(managerError).toBeNull();
      expect(managerNotifications).toHaveLength(1);
      expect(managerNotifications![0].title).toContain('Alerte: Déclin de santé de parcelle');
      expect(managerNotifications![0].body).toContain('Test Parcelle for Health Notifications');
      expect(managerNotifications![0].body).toContain('Bon → Faible');
      expect(managerNotifications![0].payload).toMatchObject({
        parcelle_id: testParcelleId,
        previous_status: 'good',
        current_status: 'poor',
        decline_amount: 2,
      });

      // Step 4: Verify notifications were created for planteur
      const { data: planteurNotifications, error: planteurError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testPlanteurUserId)
        .eq('type', 'health_status_decline');

      expect(planteurError).toBeNull();
      expect(planteurNotifications).toHaveLength(1);
      expect(planteurNotifications![0].title).toContain('Alerte: Déclin de santé de parcelle');
    });

    it('should create notifications when health status declines by 3 categories (Excellent → Poor)', async () => {
      // Step 1: Insert initial NDVI result with "excellent" health status
      const initialDate = new Date('2024-01-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: initialDate.toISOString(),
        mean_ndvi: 0.75, // Excellent status (0.65-1.0)
        min_ndvi: 0.70,
        max_ndvi: 0.80,
        std_dev_ndvi: 0.03,
        health_status: 'excellent',
      });

      // Step 2: Insert new NDVI result with "poor" health status (3 category decline)
      const newDate = new Date('2024-02-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: newDate.toISOString(),
        mean_ndvi: 0.35, // Poor status (0.30-0.45)
        min_ndvi: 0.25,
        max_ndvi: 0.45,
        std_dev_ndvi: 0.06,
        health_status: 'poor',
      });

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify notifications were created
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline');

      expect(error).toBeNull();
      expect(notifications).toHaveLength(1);
      expect(notifications![0].body).toContain('Excellent → Faible');
      expect(notifications![0].payload).toMatchObject({
        decline_amount: 3,
      });
    });

    it('should NOT create notifications when health status declines by only 1 category (Good → Fair)', async () => {
      // Step 1: Insert initial NDVI result with "good" health status
      const initialDate = new Date('2024-01-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: initialDate.toISOString(),
        mean_ndvi: 0.60, // Good status (0.55-0.65)
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      // Step 2: Insert new NDVI result with "fair" health status (1 category decline)
      const newDate = new Date('2024-02-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: newDate.toISOString(),
        mean_ndvi: 0.50, // Fair status (0.45-0.55)
        min_ndvi: 0.40,
        max_ndvi: 0.60,
        std_dev_ndvi: 0.05,
        health_status: 'fair',
      });

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify NO notifications were created
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline');

      expect(error).toBeNull();
      expect(notifications).toHaveLength(0);
    });

    it('should NOT create notifications when health status improves', async () => {
      // Step 1: Insert initial NDVI result with "poor" health status
      const initialDate = new Date('2024-01-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: initialDate.toISOString(),
        mean_ndvi: 0.35, // Poor status (0.30-0.45)
        min_ndvi: 0.25,
        max_ndvi: 0.45,
        std_dev_ndvi: 0.06,
        health_status: 'poor',
      });

      // Step 2: Insert new NDVI result with "good" health status (improvement)
      const newDate = new Date('2024-02-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: newDate.toISOString(),
        mean_ndvi: 0.60, // Good status (0.55-0.65)
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify NO notifications were created
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline');

      expect(error).toBeNull();
      expect(notifications).toHaveLength(0);
    });

    it('should include recommendation in notification payload', async () => {
      // Step 1: Insert initial NDVI result with "good" health status
      const initialDate = new Date('2024-01-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: initialDate.toISOString(),
        mean_ndvi: 0.60,
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      // Step 2: Insert new NDVI result with "critical" health status
      const newDate = new Date('2024-02-01');
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: newDate.toISOString(),
        mean_ndvi: 0.20, // Critical status (0.0-0.30)
        min_ndvi: 0.10,
        max_ndvi: 0.30,
        std_dev_ndvi: 0.08,
        health_status: 'critical',
      });

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify notification includes recommendation
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline');

      expect(error).toBeNull();
      expect(notifications).toHaveLength(1);
      expect(notifications![0].payload.recommendation).toBeDefined();
      expect(notifications![0].payload.recommendation).toContain('État critique');
      expect(notifications![0].payload.recommendation).toContain('Intervention immédiate requise');
      expect(notifications![0].body).toContain('Recommandation:');
    });
  });

  describe('Notification Content', () => {
    it('should include parcelle name and code in notification', async () => {
      // Insert initial and new NDVI results
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-01-01').toISOString(),
        mean_ndvi: 0.60,
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-02-01').toISOString(),
        mean_ndvi: 0.35,
        min_ndvi: 0.25,
        max_ndvi: 0.45,
        std_dev_ndvi: 0.06,
        health_status: 'poor',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline')
        .single();

      expect(notifications!.body).toContain('Test Parcelle for Health Notifications');
      expect(notifications!.body).toContain('TEST-HEALTH-001');
      expect(notifications!.payload.parcelle_name).toBe('Test Parcelle for Health Notifications');
      expect(notifications!.payload.parcelle_code).toBe('TEST-HEALTH-001');
    });

    it('should include NDVI value in notification', async () => {
      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-01-01').toISOString(),
        mean_ndvi: 0.60,
        min_ndvi: 0.50,
        max_ndvi: 0.70,
        std_dev_ndvi: 0.05,
        health_status: 'good',
      });

      await supabase.from('ndvi_results').insert({
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-02-01').toISOString(),
        mean_ndvi: 0.35,
        min_ndvi: 0.25,
        max_ndvi: 0.45,
        std_dev_ndvi: 0.06,
        health_status: 'poor',
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testManagerId)
        .eq('type', 'health_status_decline')
        .single();

      expect(notifications!.body).toContain('NDVI moyen: 0.350');
      expect(notifications!.payload.mean_ndvi).toBe(0.35);
    });
  });
});
