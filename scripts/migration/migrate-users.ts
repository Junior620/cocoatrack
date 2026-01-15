#!/usr/bin/env npx tsx
/**
 * CocoaTrack User Migration Script
 * 
 * Migrates users from V1 to Supabase Auth with password reset requirement.
 * 
 * Requirements: 2.7, 11.4
 * 
 * Usage:
 *   npx tsx scripts/migration/migrate-users.ts --dry-run
 *   npx tsx scripts/migration/migrate-users.ts --execute
 *   npx tsx scripts/migration/migrate-users.ts --execute --send-emails
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

interface UserMigrationConfig {
  v1DatabaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  dryRun: boolean;
  sendEmails: boolean;
  appUrl: string;
}

interface V1User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  zone: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: { email: string; error: string }[];
}

class UserMigrationService {
  private v1Client: pg.Client;
  private supabase: ReturnType<typeof createClient>;
  private config: UserMigrationConfig;

  constructor(config: UserMigrationConfig) {
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

  async migrateUsers(): Promise<MigrationResult> {
    await this.connect();

    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get all users from V1
      const { rows: users } = await this.v1Client.query<V1User>(
        'SELECT * FROM users ORDER BY created_at'
      );

      result.total = users.length;
      console.log(`Found ${users.length} users to migrate`);

      // Get default cooperative ID from V2
      const { data: cooperatives } = await this.supabase
        .from('cooperatives')
        .select('id')
        .limit(1);
      
      const defaultCooperativeId = cooperatives?.[0]?.id;

      for (const user of users) {
        try {
          console.log(`\nProcessing user: ${user.email}`);

          // Check if user already exists in Supabase Auth
          const { data: existingUsers } = await this.supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === user.email);

          if (existingUser) {
            console.log(`  ⏭️  User already exists in Supabase Auth`);
            result.skipped++;
            continue;
          }

          if (this.config.dryRun) {
            console.log(`  📋 Would create user with password reset requirement`);
            result.migrated++;
            continue;
          }

          // Create user in Supabase Auth
          // Note: We create with a random password and require reset
          const tempPassword = this.generateTempPassword();
          
          const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
            email: user.email,
            password: tempPassword,
            email_confirm: true, // Auto-confirm email since they were already verified in V1
            user_metadata: {
              v1_user_id: user.id,
              migrated_from_v1: true,
              migration_date: new Date().toISOString(),
              password_reset_required: true,
            },
          });

          if (authError) {
            console.log(`  ❌ Failed to create auth user: ${authError.message}`);
            result.errors.push({ email: user.email, error: authError.message });
            continue;
          }

          if (!authUser.user) {
            console.log(`  ❌ No user returned from auth creation`);
            result.errors.push({ email: user.email, error: 'No user returned' });
            continue;
          }

          // Create profile in V2
          const role = this.mapRole(user.role);
          const { error: profileError } = await this.supabase
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              email: user.email,
              full_name: user.email.split('@')[0], // Default name from email
              role: role,
              cooperative_id: defaultCooperativeId,
              is_active: user.is_active,
              created_at: user.created_at,
              updated_at: new Date().toISOString(),
            });

          if (profileError) {
            console.log(`  ⚠️  Profile creation failed: ${profileError.message}`);
            // Don't fail the migration, profile can be created later
          }

          // Send password reset email if configured
          if (this.config.sendEmails) {
            const { error: resetError } = await this.supabase.auth.resetPasswordForEmail(
              user.email,
              {
                redirectTo: `${this.config.appUrl}/auth/callback?type=recovery`,
              }
            );

            if (resetError) {
              console.log(`  ⚠️  Failed to send reset email: ${resetError.message}`);
            } else {
              console.log(`  📧 Password reset email sent`);
            }
          }

          console.log(`  ✅ User migrated successfully`);
          result.migrated++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`  ❌ Exception: ${errorMessage}`);
          result.errors.push({ email: user.email, error: errorMessage });
        }
      }

    } finally {
      await this.disconnect();
    }

    return result;
  }

  private mapRole(v1Role: string): 'admin' | 'manager' | 'agent' | 'viewer' {
    const roleMap: Record<string, 'admin' | 'manager' | 'agent' | 'viewer'> = {
      superadmin: 'admin',
      admin: 'admin',
      manager: 'manager',
      agent: 'agent',
      viewer: 'viewer',
    };
    return roleMap[v1Role.toLowerCase()] || 'viewer';
  }

  private generateTempPassword(): string {
    // Generate a secure random password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 24; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

function printReport(result: MigrationResult): void {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              User Migration Report                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Total users:     ${result.total}`);
  console.log(`Migrated:        ${result.migrated}`);
  console.log(`Skipped:         ${result.skipped}`);
  console.log(`Errors:          ${result.errors.length}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('Errors:');
    for (const err of result.errors) {
      console.log(`  - ${err.email}: ${err.error}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const sendEmails = args.includes('--send-emails');

  // Validate environment variables
  const v1DatabaseUrl = process.env.V1_DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cocoatrack.app';

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

  const config: UserMigrationConfig = {
    v1DatabaseUrl,
    supabaseUrl,
    supabaseServiceKey,
    dryRun,
    sendEmails,
    appUrl,
  };

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         CocoaTrack User Migration Tool                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No users will be created');
    console.log('   Use --execute flag to perform actual migration');
  } else {
    console.log('🚀 EXECUTE MODE - Users will be migrated');
    if (sendEmails) {
      console.log('📧 Password reset emails will be sent');
    } else {
      console.log('📧 Password reset emails will NOT be sent (use --send-emails to enable)');
    }
    console.log('');
    console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('');

  const service = new UserMigrationService(config);

  try {
    const result = await service.migrateUsers();
    printReport(result);

    if (result.errors.length === 0) {
      console.log('\n✅ User migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  User migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Migration failed with exception:', error);
    process.exit(1);
  }
}

main().catch(console.error);
