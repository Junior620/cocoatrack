# CocoaTrack V1 to V2 Migration Rollback Plan

## Overview

This document outlines the rollback strategy for the CocoaTrack V1 to V2 migration. The plan ensures that we can safely revert to V1 if critical issues are discovered during or after migration.

## Pre-Migration Checklist

### 1. Create V2 Snapshot Before Migration

```bash
# Create a full backup of V2 Supabase database before migration
supabase db dump -f v2_pre_migration_backup_$(date +%Y%m%d_%H%M%S).sql

# Store backup in secure location
aws s3 cp v2_pre_migration_backup_*.sql s3://cocoatrack-backups/migration/
```

### 2. Document Current State

- [ ] Record V1 row counts for all tables
- [ ] Record V2 row counts (should be minimal/empty)
- [ ] Note current V1 database connection string
- [ ] Note current V2 Supabase project URL
- [ ] Document current DNS/domain configuration

### 3. Verify V1 Read-Only Mode

Before final migration, V1 must be in read-only mode:

```sql
-- On V1 Azure PostgreSQL
-- Revoke write permissions from application user
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM app_user;
```

## Cutover Strategy

### Planned Cutover Window

- **Date**: [TBD - Schedule during low-traffic period]
- **Time**: Saturday 02:00 - 06:00 UTC (low traffic window)
- **Duration**: 4 hours maximum
- **Rollback Decision Point**: 2 hours into cutover

### Cutover Steps

1. **T-24h**: Final V1 backup
2. **T-1h**: Enable V1 read-only mode
3. **T-0**: Start migration
4. **T+1h**: Run integrity verification
5. **T+2h**: Decision point - proceed or rollback
6. **T+3h**: DNS switch to V2 (if proceeding)
7. **T+4h**: Monitor and confirm success

## Rollback Procedures

### Scenario 1: Rollback During Migration (Before DNS Switch)

If issues are discovered before DNS switch:

```bash
# 1. Stop migration script
# Press Ctrl+C or kill the process

# 2. Clear V2 data (if partial migration occurred)
npx tsx scripts/migration/rollback.ts --clear-v2

# 3. Restore V1 write access
psql $V1_DATABASE_URL -c "GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;"

# 4. Verify V1 is operational
curl https://api-v1.cocoatrack.com/health
```

### Scenario 2: Rollback After DNS Switch (Within 24h)

If issues are discovered after DNS switch but within 24 hours:

```bash
# 1. Switch DNS back to V1
# Update DNS records to point to V1 API

# 2. Restore V1 write access
psql $V1_DATABASE_URL -c "GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;"

# 3. Sync any V2 changes back to V1 (if any)
npx tsx scripts/migration/sync-v2-to-v1.ts

# 4. Clear V2 data
npx tsx scripts/migration/rollback.ts --clear-v2

# 5. Notify users of rollback
```

### Scenario 3: Rollback After 24h (Emergency)

If critical issues are discovered after 24 hours:

```bash
# 1. Assess data changes in V2
npx tsx scripts/migration/assess-v2-changes.ts

# 2. Create V2 backup
supabase db dump -f v2_emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Switch DNS back to V1
# Update DNS records

# 4. Restore V1 write access
psql $V1_DATABASE_URL -c "GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;"

# 5. Manually migrate critical V2 changes to V1
# This requires manual review of changes made in V2

# 6. Document data loss (if any)
```

## Rollback Script

Create the rollback script:

```typescript
// scripts/migration/rollback.ts
import { createClient } from '@supabase/supabase-js';

async function rollback() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log('Starting V2 rollback...');

  // Order matters due to foreign keys
  const tables = [
    'audit_log',
    'delivery_photos',
    'deliveries',
    'planteurs',
    'chef_planteurs',
    'invoices',
    'warehouses',
    'profiles',
    'cooperatives',
    'regions',
  ];

  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`Error clearing ${table}:`, error);
    }
  }

  console.log('Rollback complete');
}

rollback().catch(console.error);
```

## Communication Plan

### Pre-Migration Communication

- [ ] Email all users 1 week before migration
- [ ] In-app banner 3 days before migration
- [ ] Final reminder 24 hours before

### During Migration

- [ ] Status page updates every 30 minutes
- [ ] Slack channel for real-time updates

### Rollback Communication

If rollback is needed:

1. **Immediate**: Update status page to "Maintenance Extended"
2. **Within 1 hour**: Email users about rollback
3. **Within 24 hours**: Post-mortem communication

## Success Criteria

Migration is considered successful when:

- [ ] All row counts match between V1 and V2
- [ ] Checksum verification passes for deliveries table
- [ ] All foreign key integrity checks pass
- [ ] Users can log in to V2
- [ ] Users can create new deliveries in V2
- [ ] Dashboard shows correct data
- [ ] No critical errors in Sentry for 2 hours

## Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| Row count mismatch > 1% | High | Rollback |
| Checksum mismatch | High | Rollback |
| FK integrity failures | High | Rollback |
| Login failures > 10% | Critical | Rollback |
| Data corruption detected | Critical | Immediate Rollback |
| Performance degradation > 50% | Medium | Investigate, consider rollback |
| Minor UI issues | Low | Continue, fix in V2 |

## Post-Migration Monitoring

After successful migration, monitor for 72 hours:

- [ ] Error rates in Sentry
- [ ] API response times
- [ ] Database query performance
- [ ] User login success rate
- [ ] Data creation success rate

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Migration Lead | [TBD] | [email] |
| Database Admin | [TBD] | [email] |
| On-Call Engineer | [TBD] | [phone] |
| Product Owner | [TBD] | [email] |

## Appendix: Useful Commands

```bash
# Check V1 database status
psql $V1_DATABASE_URL -c "SELECT COUNT(*) FROM deliveries;"

# Check V2 database status
npx supabase db dump --data-only | wc -l

# Run integrity verification
npx tsx scripts/migration/verify-integrity.ts

# Export verification report
npx tsx scripts/migration/verify-integrity.ts --export
```
