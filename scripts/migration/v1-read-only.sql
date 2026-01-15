-- CocoaTrack V1 Read-Only Mode Configuration
-- 
-- This script configures V1 Azure PostgreSQL to read-only mode
-- before final migration to V2.
--
-- Requirements: 11.8, 11.9
--
-- Usage:
--   psql $V1_DATABASE_URL -f v1-read-only.sql
--
-- To restore write access:
--   psql $V1_DATABASE_URL -f v1-restore-write.sql

-- ============================================================================
-- STEP 1: Create a read-only role if it doesn't exist
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly_user') THEN
    CREATE ROLE readonly_user;
  END IF;
END
$$;

-- ============================================================================
-- STEP 2: Revoke write permissions from application user
-- Replace 'app_user' with your actual application database user
-- ============================================================================

-- Revoke INSERT, UPDATE, DELETE on all existing tables
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM app_user;

-- Revoke INSERT, UPDATE, DELETE on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM app_user;

-- Revoke TRUNCATE permission
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_user;

-- ============================================================================
-- STEP 3: Create a trigger to block writes (defense in depth)
-- ============================================================================
CREATE OR REPLACE FUNCTION block_writes()
RETURNS TRIGGER AS $
BEGIN
  RAISE EXCEPTION 'Database is in read-only mode for migration. Please use V2.';
  RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Apply to all tables
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
    EXECUTE format('
      DROP TRIGGER IF EXISTS block_writes_trigger ON %I;
      CREATE TRIGGER block_writes_trigger
        BEFORE INSERT OR UPDATE OR DELETE ON %I
        FOR EACH ROW EXECUTE FUNCTION block_writes();
    ', tbl.tablename, tbl.tablename);
  END LOOP;
END
$$;

-- ============================================================================
-- STEP 4: Log the read-only mode activation
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'V1 database is now in READ-ONLY mode';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE 'All write operations will be blocked';
END
$$;

-- ============================================================================
-- VERIFICATION: Test that writes are blocked
-- ============================================================================
-- Uncomment to test (will fail if read-only mode is active):
-- INSERT INTO users (email, password_hash, role) VALUES ('test@test.com', 'hash', 'viewer');
