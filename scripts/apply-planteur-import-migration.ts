// Script to apply planteur_import_files migration
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
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' }
  });

  console.log('Applying planteur_import_files migration...');

  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260308000001_planteur_import_files.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Execute migration
  const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

  if (error) {
    console.error('❌ Migration failed:', error);
    
    // Try alternative approach - execute via REST API
    console.log('\nTrying alternative approach...');
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      console.error('❌ Alternative approach also failed');
      console.error('Response:', await response.text());
      console.log('\n⚠️  Please apply the migration manually via Supabase Dashboard > SQL Editor');
      console.log('Migration file: v2/supabase/migrations/20260308000001_planteur_import_files.sql');
      process.exit(1);
    }
  }

  console.log('✅ Migration applied successfully');
  
  // Verify table exists
  const { error: checkError } = await supabase
    .from('planteur_import_files')
    .select('id')
    .limit(0);

  if (checkError) {
    console.error('❌ Table verification failed:', checkError);
    process.exit(1);
  }

  console.log('✅ Table planteur_import_files verified');
  process.exit(0);
}

main();
