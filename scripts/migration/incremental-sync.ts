#!/usr/bin/env npx tsx
/**
 * CocoaTrack V1 to V2 Incremental Sync
 * 
 * Syncs new/updated records from V1 to V2 during the transition period.
 * This is a one-way sync (V1 → V2) for records created/updated after
 * the initial migration.
 * 
 * Requirements: 11.9
 * 
 * Usage:
 *   npx tsx scripts/migration/incremental-sync.ts --since "2024-01-01T00:00:00Z"
 *   npx tsx scripts/migration/incremental-sync.ts --last-24h
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

interface SyncConfig {
  v1DatabaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  since: Date;
  dryRun: boolean;
}

interface SyncResult {
  table: string;
  inserted: number;
  updated: number;
  errors: string[];
}

class IncrementalSync {
  private v1Client: pg.Client;
  private supabase: ReturnType<typeof createClient>;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.v1Client = new pg.Client({ connectionString: config.v1DatabaseUrl });
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  async connect(): Promise<void> {
    await this.v1Client.connect();
    console.log('Connected to V1 database');
  }

  async disconnect(): Promise<void> {
    await this.v1Client.end();
    console.log('Disconnected from V1 database');
  }

  async sync(): Promise<SyncResult[]> {
    await this.connect();

    console.log('\n=== Starting Incremental Sync ===');
    console.log(`Syncing records updated since: ${this.config.since.toISOString()}`);
    console.log(`Dry run: ${this.config.dryRun}\n`);

    const results: SyncResult[] = [];

    try {
      // Sync in order of dependencies
      results.push(await this.syncChefPlanteurs());
      results.push(await this.syncPlanteurs());
      results.push(await this.syncDeliveries());
    } finally {
      await this.disconnect();
    }

    return results;
  }

  private async syncChefPlanteurs(): Promise<SyncResult> {
    const result: SyncResult = {
      table: 'chef_planteurs',
      inserted: 0,
      updated: 0,
      errors: [],
    };

    try {
      const { rows } = await this.v1Client.query(
        `SELECT * FROM chef_planteurs WHERE updated_at > $1 ORDER BY updated_at`,
        [this.config.since]
      );

      console.log(`Found ${rows.length} chef_planteurs to sync`);

      if (!this.config.dryRun) {
        for (const row of rows) {
          // Check if exists in V2
          const { data: existing } = await this.supabase
            .from('chef_planteurs')
            .select('id, updated_at')
            .eq('id', row.id)
            .single();

          if (existing) {
            // Update if V1 is newer
            if (new Date(row.updated_at) > new Date(existing.updated_at)) {
              const { error } = await this.supabase
                .from('chef_planteurs')
                .update({
                  name: row.name,
                  phone: row.phone,
                  cni: row.cni,
                  region: row.region,
                  departement: row.departement,
                  localite: row.localite,
                  quantite_max_kg: row.quantite_max_kg,
                  latitude: row.latitude,
                  longitude: row.longitude,
                  validation_status: row.validation_status,
                  updated_at: row.updated_at,
                })
                .eq('id', row.id);

              if (error) {
                result.errors.push(`Update ${row.id}: ${error.message}`);
              } else {
                result.updated++;
              }
            }
          } else {
            // Insert new record
            // Note: This requires cooperative_id mapping which should be done during initial migration
            result.errors.push(`New record ${row.id}: Cannot insert without cooperative_id mapping`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync chef_planteurs: ${error}`);
    }

    console.log(`  chef_planteurs: ${result.updated} updated, ${result.errors.length} errors`);
    return result;
  }

  private async syncPlanteurs(): Promise<SyncResult> {
    const result: SyncResult = {
      table: 'planteurs',
      inserted: 0,
      updated: 0,
      errors: [],
    };

    try {
      const { rows } = await this.v1Client.query(
        `SELECT * FROM planters WHERE updated_at > $1 ORDER BY updated_at`,
        [this.config.since]
      );

      console.log(`Found ${rows.length} planteurs to sync`);

      if (!this.config.dryRun) {
        for (const row of rows) {
          // Check if exists in V2
          const { data: existing } = await this.supabase
            .from('planteurs')
            .select('id, updated_at')
            .eq('id', row.id)
            .single();

          if (existing) {
            // Update if V1 is newer
            if (new Date(row.updated_at) > new Date(existing.updated_at)) {
              const { error } = await this.supabase
                .from('planteurs')
                .update({
                  name: row.name,
                  phone: row.phone,
                  cni: row.cni,
                  chef_planteur_id: row.chef_planteur_id,
                  updated_at: row.updated_at,
                })
                .eq('id', row.id);

              if (error) {
                result.errors.push(`Update ${row.id}: ${error.message}`);
              } else {
                result.updated++;
              }
            }
          } else {
            result.errors.push(`New record ${row.id}: Cannot insert without cooperative_id mapping`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync planteurs: ${error}`);
    }

    console.log(`  planteurs: ${result.updated} updated, ${result.errors.length} errors`);
    return result;
  }

  private async syncDeliveries(): Promise<SyncResult> {
    const result: SyncResult = {
      table: 'deliveries',
      inserted: 0,
      updated: 0,
      errors: [],
    };

    try {
      const { rows } = await this.v1Client.query(
        `SELECT d.*, p.chef_planteur_id 
         FROM deliveries d 
         JOIN planters p ON d.planter_id = p.id 
         WHERE d.updated_at > $1 
         ORDER BY d.updated_at`,
        [this.config.since]
      );

      console.log(`Found ${rows.length} deliveries to sync`);

      if (!this.config.dryRun) {
        for (const row of rows) {
          // Check if exists in V2
          const { data: existing } = await this.supabase
            .from('deliveries')
            .select('id, updated_at')
            .eq('id', row.id)
            .single();

          if (existing) {
            // Update if V1 is newer
            if (new Date(row.updated_at) > new Date(existing.updated_at)) {
              const { error } = await this.supabase
                .from('deliveries')
                .update({
                  weight_kg: row.quantity_kg,
                  notes: row.notes,
                  updated_at: row.updated_at,
                })
                .eq('id', row.id);

              if (error) {
                result.errors.push(`Update ${row.id}: ${error.message}`);
              } else {
                result.updated++;
              }
            }
          } else {
            result.errors.push(`New record ${row.id}: Cannot insert without full mapping`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to sync deliveries: ${error}`);
    }

    console.log(`  deliveries: ${result.updated} updated, ${result.errors.length} errors`);
    return result;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  // Parse since date
  let since: Date;
  const sinceArg = args.find(a => a.startsWith('--since='));
  const last24h = args.includes('--last-24h');
  
  if (sinceArg) {
    since = new Date(sinceArg.split('=')[1]);
  } else if (last24h) {
    since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else {
    console.error('Error: Must specify --since="YYYY-MM-DDTHH:mm:ssZ" or --last-24h');
    process.exit(1);
  }

  // Validate environment variables
  const v1DatabaseUrl = process.env.V1_DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!v1DatabaseUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Required environment variables not set');
    process.exit(1);
  }

  const config: SyncConfig = {
    v1DatabaseUrl,
    supabaseUrl,
    supabaseServiceKey,
    since,
    dryRun,
  };

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         CocoaTrack V1 to V2 Incremental Sync               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const sync = new IncrementalSync(config);

  try {
    const results = await sync.sync();
    
    console.log('\n=== Sync Summary ===');
    for (const result of results) {
      console.log(`${result.table}: ${result.updated} updated, ${result.errors.length} errors`);
    }

    const hasErrors = results.some(r => r.errors.length > 0);
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Sync failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
