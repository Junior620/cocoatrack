-- CocoaTrack V1 Restore Write Access
-- 
-- This script restores write access to V1 Azure PostgreSQL
-- in case of rollback from V2 migration.
--
-- Requirements: 11.6 (Rollback)
--
-- Usage:
--   psql $V1_DATABASE_URL -f v1-restore-write.sql

-- ============================================================================
-- STEP 1: Remove write-blocking triggers
-- ============================================================================
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS block_writes_trigger ON %I;', tbl.tablename);
  END LOOP;
END
$$;

-- Drop the blocking function
DROP FUNCTION IF EXISTS block_writes();

-- ============================================================================
-- STEP 2: Restore write permissions to application user
-- Replace 'app_user' with your actual application database user
-- ============================================================================

-- Grant INSERT, UPDATE, DELETE on all existing tables
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Grant INSERT, UPDATE, DELETE on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Grant TRUNCATE permission
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO app_user;

-- Grant usage on sequences (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- STEP 3: Log the write access restoration
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'V1 database write access has been RESTORED';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE 'All write operations are now allowed';
END
$$;

-- ============================================================================
-- VERIFICATION: Test that writes work
-- ============================================================================
-- Uncomment to test (should succeed if write access is restored):
-- BEGIN;
-- INSERT INTO users (email, password_hash, role) VALUES ('test_restore@test.com', 'hash', 'viewer');
-- ROLLBACK;
