#!/usr/bin/env npx tsx
/**
 * Migration CLI Runner
 * 
 * Usage:
 *   npx tsx scripts/migration/run-migration.ts --dry-run
 *   npx tsx scripts/migration/run-migration.ts --execute
 * 
 * Environment variables required:
 *   V1_DATABASE_URL - Azure PostgreSQL connection string
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key
 */

import { MigrationService, MigrationConfig, MigrationReport } from './migrate-v1-to-v2';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '100');

  // Validate environment variables
  const v1DatabaseUrl = process.env.V1_DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!v1DatabaseUrl) {
    console.error('Error: V1_DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!supabaseUrl) {
    console.error('Error: SUPABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('Error: SUPABASE_SERVICE_KEY environment variable is required');
    process.exit(1);
  }

  const config: MigrationConfig = {
    v1DatabaseUrl,
    supabaseUrl,
    supabaseServiceKey,
    dryRun,
    batchSize,
  };

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         CocoaTrack V1 to V2 Migration Tool                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be modified');
    console.log('   Use --execute flag to perform actual migration');
  } else {
    console.log('🚀 EXECUTE MODE - Data will be migrated');
    console.log('');
    console.log('⚠️  WARNING: This will modify the V2 database!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('');

  const migrationService = new MigrationService(config);

  try {
    const report = await migrationService.migrate();
    printReport(report);

    if (report.success) {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Migration failed with exception:', error);
    process.exit(1);
  }
}

function printReport(report: MigrationReport) {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Migration Report                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const duration = report.endTime 
    ? (report.endTime.getTime() - report.startTime.getTime()) / 1000 
    : 0;
  
  console.log(`Start Time:     ${report.startTime.toISOString()}`);
  console.log(`End Time:       ${report.endTime?.toISOString() || 'N/A'}`);
  console.log(`Duration:       ${duration.toFixed(2)} seconds`);
  console.log(`Total Source:   ${report.totalSourceRows} rows`);
  console.log(`Total Migrated: ${report.totalMigratedRows} rows`);
  console.log(`Success:        ${report.success ? '✅ Yes' : '❌ No'}`);
  console.log('');
  
  console.log('┌────────────────┬────────────────┬──────────┬──────────┬────────┐');
  console.log('│ Phase          │ Table          │ Source   │ Migrated │ Errors │');
  console.log('├────────────────┼────────────────┼──────────┼──────────┼────────┤');
  
  for (const result of report.results) {
    const phase = result.phase.padEnd(14);
    const table = result.table.padEnd(14);
    const source = String(result.sourceCount).padStart(8);
    const migrated = String(result.migratedCount).padStart(8);
    const errors = String(result.errors.length).padStart(6);
    console.log(`│ ${phase} │ ${table} │ ${source} │ ${migrated} │ ${errors} │`);
  }
  
  console.log('└────────────────┴────────────────┴──────────┴──────────┴────────┘');
  
  // Print errors if any
  const allErrors = report.results.flatMap(r => r.errors);
  if (allErrors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    for (const error of allErrors.slice(0, 20)) {
      console.log(`   - ${error}`);
    }
    if (allErrors.length > 20) {
      console.log(`   ... and ${allErrors.length - 20} more errors`);
    }
  }
}

main().catch(console.error);
