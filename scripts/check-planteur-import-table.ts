// Script to check if planteur_import_files table exists and create it if needed
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
const envFile = readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Checking if planteur_import_files table exists...');

  // Try to query the table
  const { error } = await supabase
    .from('planteur_import_files')
    .select('id')
    .limit(0);

  if (error) {
    console.log('❌ Table does not exist or is not accessible');
    console.log('Error:', error.message);
    console.log('\nYou need to run the migration:');
    console.log('v2/supabase/migrations/20260308000001_planteur_import_files.sql');
    console.log('\nYou can apply it via Supabase Dashboard > SQL Editor');
    process.exit(1);
  } else {
    console.log('✅ Table planteur_import_files exists and is accessible');
    process.exit(0);
  }
}

main();
