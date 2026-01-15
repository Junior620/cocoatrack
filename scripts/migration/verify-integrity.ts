#!/usr/bin/env npx tsx
/**
 * Migration Integrity Verification Script
 * 
 * Verifies data integrity after migration by:
 * - Comparing row counts between V1 and V2
 * - Computing checksums on critical tables (deliveries)
 * - Checking foreign key integrity
 * - Generating a verification report
 * 
 * Requirements: 11.5, 11.7
 * 
 * Usage:
 *   npx tsx scripts/migration/verify-integrity.ts
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import crypto from 'crypto';

interface VerificationConfig {
  v1DatabaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

interface TableCount {
  table: string;
  v1Count: number;
  v2Count: number;
  match: boolean;
  difference: number;
}

interface ChecksumResult {
  table: string;
  v1Checksum: string;
  v2Checksum: string;
  match: boolean;
  sampleSize: number;
}

interface FKIntegrityResult {
  table: string;
  foreignKey: string;
  referencedTable: string;
  orphanCount: number;
  valid: boolean;
}

interface VerificationReport {
  timestamp: Date;
  rowCounts: TableCount[];
  checksums: ChecksumResult[];
  fkIntegrity: FKIntegrityResult[];
  overallSuccess: boolean;
  summary: {
    totalTables: number;
    matchingCounts: number;
    validChecksums: number;
    validFKs: number;
  };
}

class IntegrityVerifier {
  private v1Client: pg.Client;
  private supabase: ReturnType<typeof createClient>;
  private config: VerificationConfig;

  constructor(config: VerificationConfig) {
    this.config = config;
    this.v1Client = new pg.Client({ connectionString: config.v1DatabaseUrl });
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false }
    });
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
   * Run full integrity verification
   */
  async verify(): Promise<VerificationReport> {
    await this.connect();

    console.log('\n=== Starting Integrity Verification ===\n');

    const report: VerificationReport = {
      timestamp: new Date(),
      rowCounts: [],
      checksums: [],
      fkIntegrity: [],
      overallSuccess: false,
      summary: {
        totalTables: 0,
        matchingCounts: 0,
        validChecksums: 0,
        validFKs: 0,
      },
    };

    try {
      // Step 1: Row count comparison
      console.log('--- Step 1: Row Count Comparison ---');
      report.rowCounts = await this.compareRowCounts();
      
      // Step 2: Checksum verification on critical tables
      console.log('\n--- Step 2: Checksum Verification ---');
      report.checksums = await this.verifyChecksums();
      
      // Step 3: Foreign key integrity
      console.log('\n--- Step 3: Foreign Key Integrity ---');
      report.fkIntegrity = await this.verifyForeignKeys();

      // Calculate summary
      report.summary.totalTables = report.rowCounts.length;
      report.summary.matchingCounts = report.rowCounts.filter(r => r.match).length;
      report.summary.validChecksums = report.checksums.filter(r => r.match).length;
      report.summary.validFKs = report.fkIntegrity.filter(r => r.valid).length;

      report.overallSuccess = 
        report.summary.matchingCounts === report.summary.totalTables &&
        report.summary.validChecksums === report.checksums.length &&
        report.summary.validFKs === report.fkIntegrity.length;

    } finally {
      await this.disconnect();
    }

    return report;
  }

  /**
   * Compare row counts between V1 and V2
   */
  private async compareRowCounts(): Promise<TableCount[]> {
    const tableMappings = [
      { v1: 'users', v2: 'profiles' },
      { v1: 'chef_planteurs', v2: 'chef_planteurs' },
      { v1: 'planters', v2: 'planteurs' },
      { v1: 'deliveries', v2: 'deliveries' },
    ];

    const results: TableCount[] = [];

    for (const mapping of tableMappings) {
      try {
        // Get V1 count
        const { rows: v1Rows } = await this.v1Client.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM ${mapping.v1}`
        );
        const v1Count = parseInt(v1Rows[0].count);

        // Get V2 count
        const { count: v2Count, error } = await this.supabase
          .from(mapping.v2)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.error(`Error counting ${mapping.v2}:`, error);
          continue;
        }

        const result: TableCount = {
          table: mapping.v2,
          v1Count,
          v2Count: v2Count || 0,
          match: v1Count === (v2Count || 0),
          difference: Math.abs(v1Count - (v2Count || 0)),
        };

        results.push(result);
        
        const status = result.match ? '✅' : '❌';
        console.log(`  ${status} ${mapping.v2}: V1=${v1Count}, V2=${v2Count || 0}, Diff=${result.difference}`);
      } catch (error) {
        console.error(`Error comparing ${mapping.v1}:`, error);
      }
    }

    return results;
  }

  /**
   * Verify checksums on critical tables
   */
  private async verifyChecksums(): Promise<ChecksumResult[]> {
    const results: ChecksumResult[] = [];

    // Verify deliveries checksum (critical table)
    try {
      const deliveriesChecksum = await this.computeDeliveriesChecksum();
      results.push(deliveriesChecksum);
      
      const status = deliveriesChecksum.match ? '✅' : '❌';
      console.log(`  ${status} deliveries: V1=${deliveriesChecksum.v1Checksum.substring(0, 16)}..., V2=${deliveriesChecksum.v2Checksum.substring(0, 16)}...`);
    } catch (error) {
      console.error('Error computing deliveries checksum:', error);
    }

    return results;
  }

  /**
   * Compute checksum for deliveries table
   */
  private async computeDeliveriesChecksum(): Promise<ChecksumResult> {
    const sampleSize = 1000;

    // Get V1 deliveries (sample)
    const { rows: v1Rows } = await this.v1Client.query(
      `SELECT id, planter_id, quantity_kg, date 
       FROM deliveries 
       ORDER BY created_at 
       LIMIT $1`,
      [sampleSize]
    );

    // Get V2 deliveries (sample)
    const { data: v2Rows, error } = await this.supabase
      .from('deliveries')
      .select('id, planteur_id, weight_kg, delivered_at')
      .order('created_at')
      .limit(sampleSize);

    if (error) {
      throw new Error(`Failed to fetch V2 deliveries: ${error.message}`);
    }

    // Compute checksums
    const v1Data = v1Rows.map(r => `${r.id}:${r.planter_id}:${r.quantity_kg}`).sort().join('|');
    const v2Data = (v2Rows || []).map(r => `${r.id}:${r.planteur_id}:${r.weight_kg}`).sort().join('|');

    const v1Checksum = crypto.createHash('sha256').update(v1Data).digest('hex');
    const v2Checksum = crypto.createHash('sha256').update(v2Data).digest('hex');

    return {
      table: 'deliveries',
      v1Checksum,
      v2Checksum,
      match: v1Checksum === v2Checksum,
      sampleSize: Math.min(v1Rows.length, v2Rows?.length || 0),
    };
  }

  /**
   * Verify foreign key integrity in V2
   */
  private async verifyForeignKeys(): Promise<FKIntegrityResult[]> {
    const fkChecks = [
      {
        table: 'planteurs',
        foreignKey: 'chef_planteur_id',
        referencedTable: 'chef_planteurs',
      },
      {
        table: 'planteurs',
        foreignKey: 'cooperative_id',
        referencedTable: 'cooperatives',
      },
      {
        table: 'deliveries',
        foreignKey: 'planteur_id',
        referencedTable: 'planteurs',
      },
      {
        table: 'deliveries',
        foreignKey: 'chef_planteur_id',
        referencedTable: 'chef_planteurs',
      },
      {
        table: 'deliveries',
        foreignKey: 'warehouse_id',
        referencedTable: 'warehouses',
      },
      {
        table: 'chef_planteurs',
        foreignKey: 'cooperative_id',
        referencedTable: 'cooperatives',
      },
    ];

    const results: FKIntegrityResult[] = [];

    for (const check of fkChecks) {
      try {
        // Use RPC to check orphan records
        const { data, error } = await this.supabase.rpc('check_fk_integrity', {
          p_table: check.table,
          p_fk_column: check.foreignKey,
          p_ref_table: check.referencedTable,
        });

        // If RPC doesn't exist, do a manual check
        if (error && error.code === 'PGRST202') {
          // Manual check - get count of orphan records
          const { count: orphanCount } = await this.supabase
            .from(check.table)
            .select('*', { count: 'exact', head: true })
            .not(check.foreignKey, 'is', null)
            .filter(check.foreignKey, 'not.in', `(SELECT id FROM ${check.referencedTable})`);

          const result: FKIntegrityResult = {
            table: check.table,
            foreignKey: check.foreignKey,
            referencedTable: check.referencedTable,
            orphanCount: orphanCount || 0,
            valid: (orphanCount || 0) === 0,
          };

          results.push(result);
        } else {
          const result: FKIntegrityResult = {
            table: check.table,
            foreignKey: check.foreignKey,
            referencedTable: check.referencedTable,
            orphanCount: data?.orphan_count || 0,
            valid: (data?.orphan_count || 0) === 0,
          };

          results.push(result);
        }

        const lastResult = results[results.length - 1];
        const status = lastResult.valid ? '✅' : '❌';
        console.log(`  ${status} ${check.table}.${check.foreignKey} → ${check.referencedTable}: ${lastResult.orphanCount} orphans`);
      } catch (error) {
        console.error(`Error checking FK ${check.table}.${check.foreignKey}:`, error);
        
        // Add as failed check
        results.push({
          table: check.table,
          foreignKey: check.foreignKey,
          referencedTable: check.referencedTable,
          orphanCount: -1,
          valid: false,
        });
      }
    }

    return results;
  }
}

/**
 * Print verification report
 */
function printReport(report: VerificationReport): void {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Integrity Verification Report                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log(`Timestamp:        ${report.timestamp.toISOString()}`);
  console.log(`Overall Status:   ${report.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('');
  
  console.log('Summary:');
  console.log(`  Tables Checked:     ${report.summary.totalTables}`);
  console.log(`  Matching Counts:    ${report.summary.matchingCounts}/${report.summary.totalTables}`);
  console.log(`  Valid Checksums:    ${report.summary.validChecksums}/${report.checksums.length}`);
  console.log(`  Valid Foreign Keys: ${report.summary.validFKs}/${report.fkIntegrity.length}`);
  console.log('');

  // Row counts table
  console.log('Row Counts:');
  console.log('┌────────────────┬──────────┬──────────┬────────────┬────────┐');
  console.log('│ Table          │ V1 Count │ V2 Count │ Difference │ Status │');
  console.log('├────────────────┼──────────┼──────────┼────────────┼────────┤');
  
  for (const row of report.rowCounts) {
    const table = row.table.padEnd(14);
    const v1 = String(row.v1Count).padStart(8);
    const v2 = String(row.v2Count).padStart(8);
    const diff = String(row.difference).padStart(10);
    const status = row.match ? '  ✅  ' : '  ❌  ';
    console.log(`│ ${table} │ ${v1} │ ${v2} │ ${diff} │${status}│`);
  }
  
  console.log('└────────────────┴──────────┴──────────┴────────────┴────────┘');
  console.log('');

  // FK integrity issues
  const fkIssues = report.fkIntegrity.filter(r => !r.valid);
  if (fkIssues.length > 0) {
    console.log('⚠️  Foreign Key Issues:');
    for (const issue of fkIssues) {
      console.log(`   - ${issue.table}.${issue.foreignKey} → ${issue.referencedTable}: ${issue.orphanCount} orphan records`);
    }
    console.log('');
  }

  // Checksum mismatches
  const checksumIssues = report.checksums.filter(r => !r.match);
  if (checksumIssues.length > 0) {
    console.log('⚠️  Checksum Mismatches:');
    for (const issue of checksumIssues) {
      console.log(`   - ${issue.table}: Data differs between V1 and V2`);
    }
    console.log('');
  }
}

/**
 * Export report to JSON file
 */
function exportReport(report: VerificationReport): void {
  const filename = `integrity-report-${report.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
  const fs = require('fs');
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`Report exported to: ${filename}`);
}

async function main() {
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

  const config: VerificationConfig = {
    v1DatabaseUrl,
    supabaseUrl,
    supabaseServiceKey,
  };

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       CocoaTrack Migration Integrity Verification          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const verifier = new IntegrityVerifier(config);

  try {
    const report = await verifier.verify();
    printReport(report);
    
    // Export report
    if (process.argv.includes('--export')) {
      exportReport(report);
    }

    process.exit(report.overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Verification failed with exception:', error);
    process.exit(1);
  }
}

main().catch(console.error);

export { IntegrityVerifier, VerificationReport };
