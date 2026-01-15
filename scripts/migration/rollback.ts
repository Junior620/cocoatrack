#!/usr/bin/env npx tsx
/**
 * CocoaTrack V2 Rollback Script
 * 
 * Clears V2 data to allow re-migration or rollback to V1.
 * 
 * Usage:
 *   npx tsx scripts/migration/rollback.ts --dry-run
 *   npx tsx scripts/migration/rollback.ts --clear-v2
 * 
 * Requirements: 11.6
 */

import { createClient } from '@supabase/supabase-js';

interface RollbackConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  dryRun: boolean;
}

async function rollback(config: RollbackConfig): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false }
  });

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           CocoaTrack V2 Rollback Script                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (config.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted');
    console.log('   Use --clear-v2 flag to perform actual rollback');
  } else {
    console.log('🚨 DANGER: This will DELETE ALL DATA in V2!');
    console.log('');
    console.log('⚠️  WARNING: This action is IRREVERSIBLE!');
    console.log('   Press Ctrl+C within 10 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log('');
  console.log('Starting rollback...');
  console.log('');

  // Tables in order of deletion (respecting foreign keys)
  const tables = [
    'audit_log',
    'sync_processed',
    'dashboard_aggregates',
    'messages',
    'conversations',
    'notifications',
    'delivery_photos',
    'deliveries',
    'invoices',
    'planteurs',
    'chef_planteurs',
    'warehouses',
    'profiles',
    'cooperatives',
    'regions',
    'delivery_code_counters',
  ];

  const results: { table: string; deleted: number; error?: string }[] = [];

  for (const table of tables) {
    try {
      // First, get count
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`  ⚠️  ${table}: Error counting - ${countError.message}`);
        results.push({ table, deleted: 0, error: countError.message });
        continue;
      }

      const rowCount = count || 0;

      if (config.dryRun) {
        console.log(`  📋 ${table}: Would delete ${rowCount} rows`);
        results.push({ table, deleted: rowCount });
      } else {
        if (rowCount === 0) {
          console.log(`  ✅ ${table}: Already empty`);
          results.push({ table, deleted: 0 });
          continue;
        }

        // Delete all rows
        // Using a filter that matches all rows
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .gte('created_at', '1970-01-01');

        if (deleteError) {
          // Try alternative delete method
          const { error: altError } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

          if (altError) {
            console.log(`  ❌ ${table}: Error deleting - ${altError.message}`);
            results.push({ table, deleted: 0, error: altError.message });
            continue;
          }
        }

        console.log(`  ✅ ${table}: Deleted ${rowCount} rows`);
        results.push({ table, deleted: rowCount });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ ${table}: Exception - ${errorMessage}`);
      results.push({ table, deleted: 0, error: errorMessage });
    }
  }

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         Summary                                ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const errors = results.filter(r => r.error);

  console.log(`Total rows ${config.dryRun ? 'to delete' : 'deleted'}: ${totalDeleted}`);
  console.log(`Tables processed: ${results.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Errors encountered:');
    for (const err of errors) {
      console.log(`  - ${err.table}: ${err.error}`);
    }
  }

  console.log('');
  if (config.dryRun) {
    console.log('✅ Dry run complete. Use --clear-v2 to perform actual rollback.');
  } else {
    console.log('✅ Rollback complete. V2 database has been cleared.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--clear-v2');

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    console.error('Error: SUPABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('Error: SUPABASE_SERVICE_KEY environment variable is required');
    process.exit(1);
  }

  const config: RollbackConfig = {
    supabaseUrl,
    supabaseServiceKey,
    dryRun,
  };

  try {
    await rollback(config);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Rollback failed with exception:', error);
    process.exit(1);
  }
}

main().catch(console.error);
