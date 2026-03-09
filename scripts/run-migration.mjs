// Simple script to run SQL migration
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env.local');
const envFile = readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('Reading migration file...');
const migrationPath = join(__dirname, '..', 'supabase/migrations/20260308000001_planteur_import_files.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('Executing migration...');

// Split SQL into individual statements and execute them
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let successCount = 0;
let errorCount = 0;

for (const statement of statements) {
  if (statement.includes('COMMENT ON')) {
    // Skip comments for now
    continue;
  }
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
    if (error) {
      console.error(`Error executing statement: ${error.message}`);
      console.error(`Statement: ${statement.substring(0, 100)}...`);
      errorCount++;
    } else {
      successCount++;
    }
  } catch (err) {
    console.error(`Exception: ${err.message}`);
    errorCount++;
  }
}

console.log(`\nCompleted: ${successCount} successful, ${errorCount} errors`);

// Verify table exists
console.log('\nVerifying table...');
const { error: checkError } = await supabase
  .from('planteur_import_files')
  .select('id')
  .limit(0);

if (checkError) {
  console.error('❌ Table verification failed:', checkError.message);
  console.log('\n⚠️  Please apply the migration manually via Supabase Dashboard > SQL Editor');
  console.log('Copy the contents of: v2/supabase/migrations/20260308000001_planteur_import_files.sql');
  process.exit(1);
} else {
  console.log('✅ Table planteur_import_files exists and is accessible');
  process.exit(0);
}
