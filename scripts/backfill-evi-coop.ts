#!/usr/bin/env npx tsx
/**
 * CLI: EVI backfill (all parcelles / no-coop / coop)
 *
 * Usage:
 *   # Toutes les parcelles actives (recommandé si pas de coop)
 *   npx tsx scripts/backfill-evi-coop.ts --all --months 12 --limit 50
 *
 *   # Planteurs sans cooperative_id
 *   npx tsx scripts/backfill-evi-coop.ts --no-coop --months 12
 *
 *   # Une coopérative précise
 *   npx tsx scripts/backfill-evi-coop.ts --coop 123e4567-e89b-12d3-a456-426614174000 --months 12
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 * and GEE credentials.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // fallback .env

// Alias used by some scripts / dashboards
if (!process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

import {
  runEviBackfill,
  type EviBackfillScope,
} from '../lib/satellite/jobs/evi-backfill.job';

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local'
    );
    process.exit(1);
  }

  const months = Number(arg('--months') || process.env.MONTHS || 12);
  const limit = Number(arg('--limit') || process.env.LIMIT || 50);
  const cooperativeId =
    arg('--coop') || process.env.COOPERATIVE_ID || process.env.COOP_ID;

  let scope: EviBackfillScope;
  if (hasFlag('--all')) {
    scope = 'all';
  } else if (hasFlag('--no-coop')) {
    scope = 'no-coop';
  } else if (cooperativeId) {
    scope = 'coop';
  } else {
    // Défaut: toutes les parcelles (plus adapté sans coop)
    scope = 'all';
    console.log(
      '[CLI] Aucun --coop / --no-coop : scope=all (toutes les parcelles)'
    );
  }

  if (scope === 'coop' && !cooperativeId) {
    console.error('Missing --coop <uuid> for scope=coop');
    process.exit(1);
  }

  console.log(
    `[CLI] EVI backfill scope=${scope}` +
      (cooperativeId ? ` coop=${cooperativeId}` : '') +
      ` months=${months} limit=${limit}`
  );

  const result = await runEviBackfill({
    scope,
    cooperativeId,
    months,
    limit,
    onProgress: (event) => {
      const pct =
        event.total > 0
          ? Math.round((event.current / event.total) * 100)
          : 0;
      console.log(
        `[progress ${pct}%] ${event.type}` +
          (event.parcelleId ? ` ${event.parcelleId.slice(0, 8)}…` : '') +
          (event.message ? ` — ${event.message}` : '')
      );
    },
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(
    `[CLI] Done: ${result.totalCalculated} calculated, ${result.totalSkipped} skipped, ${result.totalFailed} failed across ${result.parcellesProcessed} parcelles`
  );
  if (result.failureReport.parcellesWithErrors > 0) {
    console.log(
      `[CLI] Failure report: ${result.failureReport.parcellesWithErrors} parcelles with errors, ` +
        `${result.failureReport.monthFailures.length} month failures`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
