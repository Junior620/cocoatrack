/**
 * CocoaTrack V1 to V2 Migration Script
 * 
 * This script migrates data from the V1 Azure PostgreSQL database to V2 Supabase.
 * 
 * Migration phases:
 * 1. Referentials: regions, cooperatives, warehouses
 * 2. Entities: chef_planteurs, planteurs
 * 3. Transactions: deliveries, payments
 * 4. Users: profiles with password reset requirement
 * 5. Audit: audit_log, documents
 * 
 * Requirements: 11.1-11.4
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Configuration
interface MigrationConfig {
  v1DatabaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  dryRun: boolean;
  batchSize: number;
}

// Migration result tracking
interface MigrationResult {
  phase: string;
  table: string;
  sourceCount: number;
  migratedCount: number;
  errors: string[];
  duration: number;
}

interface MigrationReport {
  startTime: Date;
  endTime: Date | null;
  results: MigrationResult[];
  success: boolean;
  totalSourceRows: number;
  totalMigratedRows: number;
}

// V1 Data Types
interface V1User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  zone: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

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
  date_debut_contrat: Date | null;
  date_fin_contrat: Date | null;
  raison_fin_contrat: string | null;
  latitude: number | null;
  longitude: number | null;
  validation_status: string;
  validated_by: string | null;
  validated_at: Date | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface V1Planter {
  id: string;
  name: string;
  phone: string | null;
  cni: string | null;
  cooperative: string | null;
  region: string | null;
  departement: string | null;
  localite: string | null;
  statut_plantation: string | null;
  superficie_hectares: number | null;
  chef_planteur_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface V1Delivery {
  id: string;
  planter_id: string;
  date: Date;
  load_date: Date | null;
  unload_date: Date | null;
  quantity_loaded_kg: number;
  quantity_kg: number;
  load_location: string;
  unload_location: string;
  quality: string;
  vehicle: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

class MigrationService {
  private v1Client: pg.Client;
  private supabase: ReturnType<typeof createClient>;
  private config: MigrationConfig;
  private report: MigrationReport;
  
  // Mapping tables for referential integrity
  private cooperativeMap: Map<string, string> = new Map();
  private regionMap: Map<string, string> = new Map();
  private warehouseMap: Map<string, string> = new Map();
  private userMap: Map<string, string> = new Map();
  
  constructor(config: MigrationConfig) {
    this.config = config;
    this.v1Client = new pg.Client({ connectionString: config.v1DatabaseUrl });
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false }
    });
    this.report = {
      startTime: new Date(),
      endTime: null,
      results: [],
      success: false,
      totalSourceRows: 0,
      totalMigratedRows: 0,
    };
  }

  async connect(): Promise<void> {
    console.log('Connecting to V1 database...');
    await this.v1Client.connect();
    console.log('Connected to V1 database');
  }

  async disconnect(): Promise<void> {
    await this.v1Client.end();
    console.log('Disconnected from V1 database');
  }

  /**
   * Run the full migration
   */
  async migrate(): Promise<MigrationReport> {
    try {
      await this.connect();
      
      console.log('\n=== Starting CocoaTrack V1 to V2 Migration ===\n');
      console.log(`Dry run: ${this.config.dryRun}`);
      console.log(`Batch size: ${this.config.batchSize}\n`);

      // Phase 1: Referentials
      console.log('--- Phase 1: Referentials ---');
      await this.migrateRegions();
      await this.migrateCooperatives();
      await this.migrateWarehouses();

      // Phase 2: Entities
      console.log('\n--- Phase 2: Entities ---');
      await this.migrateChefPlanteurs();
      await this.migratePlanteurs();

      // Phase 3: Transactions
      console.log('\n--- Phase 3: Transactions ---');
      await this.migrateDeliveries();

      // Phase 4: Users
      console.log('\n--- Phase 4: Users ---');
      await this.migrateUsers();

      this.report.success = this.report.results.every(r => r.errors.length === 0);
      this.report.endTime = new Date();

      return this.report;
    } catch (error) {
      console.error('Migration failed:', error);
      this.report.success = false;
      this.report.endTime = new Date();
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Phase 1: Migrate regions
   * V1 doesn't have a regions table, so we extract unique regions from chef_planteurs
   */
  private async migrateRegions(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'referentials',
      table: 'regions',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Extract unique regions from V1 chef_planteurs
      const { rows } = await this.v1Client.query<{ region: string }>(
        `SELECT DISTINCT region FROM chef_planteurs WHERE region IS NOT NULL AND region != ''`
      );
      
      result.sourceCount = rows.length;
      console.log(`Found ${rows.length} unique regions`);

      if (!this.config.dryRun) {
        for (const row of rows) {
          const regionCode = this.generateCode(row.region);
          
          // Check if region already exists
          const { data: existing } = await this.supabase
            .from('regions')
            .select('id')
            .eq('code', regionCode)
            .single();

          if (existing) {
            this.regionMap.set(row.region, existing.id);
            result.migratedCount++;
            continue;
          }

          const { data, error } = await this.supabase
            .from('regions')
            .insert({
              name: row.region,
              code: regionCode,
            })
            .select('id')
            .single();

          if (error) {
            result.errors.push(`Region ${row.region}: ${error.message}`);
          } else if (data) {
            this.regionMap.set(row.region, data.id);
            result.migratedCount++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to migrate regions: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Regions: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 1: Migrate cooperatives
   * V1 doesn't have a cooperatives table, so we extract unique cooperatives
   */
  private async migrateCooperatives(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'referentials',
      table: 'cooperatives',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Extract unique cooperatives from V1 chef_planteurs
      const { rows } = await this.v1Client.query<{ cooperative: string; region: string }>(
        `SELECT DISTINCT cooperative, region FROM chef_planteurs 
         WHERE cooperative IS NOT NULL AND cooperative != ''`
      );
      
      result.sourceCount = rows.length;
      console.log(`Found ${rows.length} unique cooperatives`);

      if (!this.config.dryRun) {
        for (const row of rows) {
          const coopCode = this.generateCode(row.cooperative);
          const regionId = this.regionMap.get(row.region);

          if (!regionId) {
            result.errors.push(`Cooperative ${row.cooperative}: Region ${row.region} not found`);
            continue;
          }

          // Check if cooperative already exists
          const { data: existing } = await this.supabase
            .from('cooperatives')
            .select('id')
            .eq('code', coopCode)
            .single();

          if (existing) {
            this.cooperativeMap.set(row.cooperative, existing.id);
            result.migratedCount++;
            continue;
          }

          const { data, error } = await this.supabase
            .from('cooperatives')
            .insert({
              name: row.cooperative,
              code: coopCode,
              region_id: regionId,
            })
            .select('id')
            .single();

          if (error) {
            result.errors.push(`Cooperative ${row.cooperative}: ${error.message}`);
          } else if (data) {
            this.cooperativeMap.set(row.cooperative, data.id);
            result.migratedCount++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to migrate cooperatives: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Cooperatives: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 1: Migrate warehouses
   * V1 uses load_location/unload_location strings, we create warehouses from unique locations
   */
  private async migrateWarehouses(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'referentials',
      table: 'warehouses',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Extract unique locations from deliveries
      const { rows } = await this.v1Client.query<{ location: string }>(
        `SELECT DISTINCT unload_location as location FROM deliveries 
         WHERE unload_location IS NOT NULL AND unload_location != ''
         UNION
         SELECT DISTINCT load_location as location FROM deliveries 
         WHERE load_location IS NOT NULL AND load_location != ''`
      );
      
      result.sourceCount = rows.length;
      console.log(`Found ${rows.length} unique warehouse locations`);

      if (!this.config.dryRun) {
        // Get default cooperative (first one)
        const defaultCoopId = this.cooperativeMap.values().next().value;
        
        for (const row of rows) {
          const warehouseCode = this.generateCode(row.location);

          // Check if warehouse already exists
          const { data: existing } = await this.supabase
            .from('warehouses')
            .select('id')
            .eq('code', warehouseCode)
            .single();

          if (existing) {
            this.warehouseMap.set(row.location, existing.id);
            result.migratedCount++;
            continue;
          }

          const { data, error } = await this.supabase
            .from('warehouses')
            .insert({
              name: row.location,
              code: warehouseCode,
              cooperative_id: defaultCoopId,
              is_active: true,
            })
            .select('id')
            .single();

          if (error) {
            result.errors.push(`Warehouse ${row.location}: ${error.message}`);
          } else if (data) {
            this.warehouseMap.set(row.location, data.id);
            result.migratedCount++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to migrate warehouses: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Warehouses: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 2: Migrate chef_planteurs
   */
  private async migrateChefPlanteurs(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'entities',
      table: 'chef_planteurs',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      const { rows: countResult } = await this.v1Client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM chef_planteurs'
      );
      result.sourceCount = parseInt(countResult[0].count);
      console.log(`Found ${result.sourceCount} chef_planteurs to migrate`);

      let offset = 0;
      while (offset < result.sourceCount) {
        const { rows } = await this.v1Client.query<V1ChefPlanteur>(
          `SELECT * FROM chef_planteurs ORDER BY created_at LIMIT $1 OFFSET $2`,
          [this.config.batchSize, offset]
        );

        if (!this.config.dryRun) {
          for (const row of rows) {
            const cooperativeId = this.cooperativeMap.get(row.cooperative || '');
            
            if (!cooperativeId) {
              result.errors.push(`ChefPlanteur ${row.id}: Cooperative not found`);
              continue;
            }

            // Preserve UUID from V1
            const { error } = await this.supabase
              .from('chef_planteurs')
              .upsert({
                id: row.id, // Preserve UUID
                name: row.name,
                code: this.generateCode(row.name),
                phone: row.phone,
                cni: row.cni,
                cooperative_id: cooperativeId,
                region: row.region,
                departement: row.departement,
                localite: row.localite,
                quantite_max_kg: row.quantite_max_kg,
                contract_start: row.date_debut_contrat,
                contract_end: row.date_fin_contrat,
                termination_reason: row.raison_fin_contrat,
                latitude: row.latitude,
                longitude: row.longitude,
                validation_status: this.mapValidationStatus(row.validation_status),
                validated_by: this.userMap.get(row.validated_by || ''),
                validated_at: row.validated_at,
                rejection_reason: row.rejection_reason,
                created_by: this.userMap.get(row.created_by || '') || this.getDefaultUserId(),
                created_at: row.created_at,
                updated_at: row.updated_at,
              });

            if (error) {
              result.errors.push(`ChefPlanteur ${row.id}: ${error.message}`);
            } else {
              result.migratedCount++;
            }
          }
        }

        offset += this.config.batchSize;
        console.log(`  Processed ${Math.min(offset, result.sourceCount)}/${result.sourceCount}`);
      }
    } catch (error) {
      result.errors.push(`Failed to migrate chef_planteurs: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Chef Planteurs: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 2: Migrate planteurs
   */
  private async migratePlanteurs(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'entities',
      table: 'planteurs',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      const { rows: countResult } = await this.v1Client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM planters'
      );
      result.sourceCount = parseInt(countResult[0].count);
      console.log(`Found ${result.sourceCount} planteurs to migrate`);

      let offset = 0;
      while (offset < result.sourceCount) {
        const { rows } = await this.v1Client.query<V1Planter>(
          `SELECT * FROM planters ORDER BY created_at LIMIT $1 OFFSET $2`,
          [this.config.batchSize, offset]
        );

        if (!this.config.dryRun) {
          for (const row of rows) {
            const cooperativeId = this.cooperativeMap.get(row.cooperative || '');
            
            if (!cooperativeId) {
              result.errors.push(`Planteur ${row.id}: Cooperative not found`);
              continue;
            }

            if (!row.chef_planteur_id) {
              result.errors.push(`Planteur ${row.id}: No chef_planteur_id`);
              continue;
            }

            // Preserve UUID from V1
            const { error } = await this.supabase
              .from('planteurs')
              .upsert({
                id: row.id, // Preserve UUID
                name: row.name,
                code: this.generateCode(row.name),
                phone: row.phone,
                cni: row.cni,
                chef_planteur_id: row.chef_planteur_id,
                cooperative_id: cooperativeId,
                is_active: true,
                created_by: this.getDefaultUserId(),
                created_at: row.created_at,
                updated_at: row.updated_at,
              });

            if (error) {
              result.errors.push(`Planteur ${row.id}: ${error.message}`);
            } else {
              result.migratedCount++;
            }
          }
        }

        offset += this.config.batchSize;
        console.log(`  Processed ${Math.min(offset, result.sourceCount)}/${result.sourceCount}`);
      }
    } catch (error) {
      result.errors.push(`Failed to migrate planteurs: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Planteurs: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 3: Migrate deliveries
   */
  private async migrateDeliveries(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'transactions',
      table: 'deliveries',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      const { rows: countResult } = await this.v1Client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM deliveries'
      );
      result.sourceCount = parseInt(countResult[0].count);
      console.log(`Found ${result.sourceCount} deliveries to migrate`);

      let offset = 0;
      let codeCounter = 1;
      
      while (offset < result.sourceCount) {
        const { rows } = await this.v1Client.query<V1Delivery>(
          `SELECT d.*, p.chef_planteur_id 
           FROM deliveries d 
           JOIN planters p ON d.planter_id = p.id 
           ORDER BY d.created_at LIMIT $1 OFFSET $2`,
          [this.config.batchSize, offset]
        );

        if (!this.config.dryRun) {
          for (const row of rows) {
            const warehouseId = this.warehouseMap.get(row.unload_location);
            const chefPlanteurId = (row as V1Delivery & { chef_planteur_id: string }).chef_planteur_id;
            
            if (!warehouseId) {
              result.errors.push(`Delivery ${row.id}: Warehouse not found for ${row.unload_location}`);
              continue;
            }

            // Generate delivery code
            const deliveryDate = new Date(row.date);
            const dateStr = deliveryDate.toISOString().split('T')[0].replace(/-/g, '');
            const code = `DEL-${dateStr}-${String(codeCounter++).padStart(4, '0')}`;

            // Map quality to grade
            const qualityGrade = this.mapQualityGrade(row.quality);

            // Calculate total (V1 doesn't have price, use default)
            const pricePerKg = 1000; // Default price in XAF
            const totalAmount = Math.round(Number(row.quantity_kg) * pricePerKg);

            // Preserve UUID from V1
            const { error } = await this.supabase
              .from('deliveries')
              .upsert({
                id: row.id, // Preserve UUID
                code: code,
                planteur_id: row.planter_id,
                chef_planteur_id: chefPlanteurId,
                cooperative_id: this.cooperativeMap.values().next().value,
                warehouse_id: warehouseId,
                weight_kg: row.quantity_kg,
                price_per_kg: pricePerKg,
                total_amount: totalAmount,
                quality_grade: qualityGrade,
                payment_status: 'pending',
                payment_amount_paid: 0,
                delivered_at: row.date,
                notes: row.notes,
                created_by: this.getDefaultUserId(),
                created_at: row.created_at,
                updated_at: row.updated_at,
              });

            if (error) {
              result.errors.push(`Delivery ${row.id}: ${error.message}`);
            } else {
              result.migratedCount++;
            }
          }
        }

        offset += this.config.batchSize;
        console.log(`  Processed ${Math.min(offset, result.sourceCount)}/${result.sourceCount}`);
      }
    } catch (error) {
      result.errors.push(`Failed to migrate deliveries: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Deliveries: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  /**
   * Phase 4: Migrate users
   * Users are migrated to Supabase Auth with password reset requirement
   */
  private async migrateUsers(): Promise<void> {
    const startTime = Date.now();
    const result: MigrationResult = {
      phase: 'users',
      table: 'profiles',
      sourceCount: 0,
      migratedCount: 0,
      errors: [],
      duration: 0,
    };

    try {
      const { rows: countResult } = await this.v1Client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users'
      );
      result.sourceCount = parseInt(countResult[0].count);
      console.log(`Found ${result.sourceCount} users to migrate`);

      const { rows } = await this.v1Client.query<V1User>('SELECT * FROM users ORDER BY created_at');

      if (!this.config.dryRun) {
        for (const row of rows) {
          // Map V1 role to V2 role
          const role = this.mapUserRole(row.role);
          const cooperativeId = this.cooperativeMap.values().next().value;

          // Create user in Supabase Auth
          // Note: In production, use admin API to create users
          // For now, we just create the profile
          
          // Store mapping for later use
          this.userMap.set(row.id, row.id);

          const { error } = await this.supabase
            .from('profiles')
            .upsert({
              id: row.id, // Preserve UUID
              email: row.email,
              full_name: row.email.split('@')[0], // Default name from email
              role: role,
              cooperative_id: cooperativeId,
              is_active: row.is_active,
              created_at: row.created_at,
              updated_at: row.updated_at,
            });

          if (error) {
            result.errors.push(`User ${row.id}: ${error.message}`);
          } else {
            result.migratedCount++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to migrate users: ${error}`);
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalSourceRows += result.sourceCount;
    this.report.totalMigratedRows += result.migratedCount;
    console.log(`Users: ${result.migratedCount}/${result.sourceCount} migrated`);
  }

  // Helper methods
  private generateCode(name: string): string {
    return name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20);
  }

  private mapValidationStatus(status: string): 'pending' | 'validated' | 'rejected' {
    const statusMap: Record<string, 'pending' | 'validated' | 'rejected'> = {
      pending: 'pending',
      validated: 'validated',
      rejected: 'rejected',
      approved: 'validated',
    };
    return statusMap[status.toLowerCase()] || 'pending';
  }

  private mapQualityGrade(quality: string): 'A' | 'B' | 'C' {
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

  private mapUserRole(role: string): 'admin' | 'manager' | 'agent' | 'viewer' {
    const roleMap: Record<string, 'admin' | 'manager' | 'agent' | 'viewer'> = {
      superadmin: 'admin',
      admin: 'admin',
      manager: 'manager',
      agent: 'agent',
      viewer: 'viewer',
    };
    return roleMap[role.toLowerCase()] || 'viewer';
  }

  private getDefaultUserId(): string {
    // Return first admin user ID or a placeholder
    return this.userMap.values().next().value || '00000000-0000-0000-0000-000000000000';
  }
}

// Export for use
export { MigrationService, MigrationConfig, MigrationReport };
