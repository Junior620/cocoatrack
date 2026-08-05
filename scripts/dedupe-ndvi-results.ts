#!/usr/bin/env npx tsx
/**
 * Deduplicate ndvi_results (one row per UTC calendar month per parcelle).
 *
 * Usage:
 *   npx tsx scripts/dedupe-ndvi-results.ts
 *   npx tsx scripts/dedupe-ndvi-results.ts --parcelle <uuid>
 *
 * Requires migration 20260805140000 (function dedupe_ndvi_results_by_month)
 * and SUPABASE_SERVICE_KEY in .env.local.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

if (!process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

import { createClient } from '@supabase/supabase-js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const parcelleId = arg('--parcelle') || null;
  const sb = createClient(url, key);

  console.log(
    `[dedupe] Running dedupe_ndvi_results_by_month(${parcelleId ?? 'ALL'})…`
  );

  const { data, error } = await sb.rpc('dedupe_ndvi_results_by_month', {
    p_parcelle_id: parcelleId,
  });

  if (error) {
    console.error('[dedupe] Failed:', error.message);
    console.error(
      'Apply migration supabase/migrations/20260805140000_ndvi_cloud_cover_and_dedup.sql first.'
    );
    process.exit(1);
  }

  const rows = (data ?? []) as Array<{
    parcelle_id: string;
    months_cleaned: number;
    rows_deleted: number;
  }>;
  const cleaned = rows.filter((r) => r.months_cleaned > 0 || r.rows_deleted > 0);
  console.log(`[dedupe] Parcelles touched: ${cleaned.length}/${rows.length}`);
  for (const r of cleaned.slice(0, 30)) {
    console.log(
      `  ${r.parcelle_id}: ${r.months_cleaned} months cleaned, ${r.rows_deleted} rows deleted`
    );
  }
  if (cleaned.length > 30) console.log(`  … +${cleaned.length - 30} more`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
