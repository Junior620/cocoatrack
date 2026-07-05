/**
 * Seed demo data for factory module.
 * Run after migration 20260707120000_factory_module.sql
 * Usage: npx tsx scripts/seed-factory-demo.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 */

import { createClient } from '@supabase/supabase-js';

const SITE_ID = 'a0000000-0000-4000-8000-000000000001';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const userId = admin?.id;
  if (!userId) {
    console.error('No admin profile found');
    process.exit(1);
  }

  const { data: rawType } = await supabase
    .from('product_types')
    .select('id')
    .eq('factory_site_id', SITE_ID)
    .eq('is_raw_material', true)
    .single();

  const { data: butterType } = await supabase
    .from('product_types')
    .select('id')
    .eq('factory_site_id', SITE_ID)
    .ilike('name', '%beurre%')
    .single();

  const { data: powderType } = await supabase
    .from('product_types')
    .select('id')
    .eq('factory_site_id', SITE_ID)
    .ilike('name', '%poudre%')
    .single();

  if (!rawType || !butterType || !powderType) {
    console.error('Product types not seeded, run migration first');
    process.exit(1);
  }

  console.log('Factory demo seed: ensure migration applied. Manual demo flow:');
  console.log('1. Create reception via /factory/receipts/new');
  console.log('2. Quality control via /factory/quality');
  console.log('3. Create transformation order via /factory/orders/new');
  console.log('4. Production entry and validate');
  console.log('Site ID:', SITE_ID);
  console.log('Admin user:', userId);
}

main().catch(console.error);
