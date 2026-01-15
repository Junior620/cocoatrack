-- ============================================================================
-- CocoaTrack V2 - Verification Script for Parcelles Orphan Migrations
-- Run this in Supabase SQL Editor to verify migrations are correctly applied
-- ============================================================================

-- ============================================================================
-- 1. VERIFY TABLE STRUCTURE
-- ============================================================================

-- Check parcelles table columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'parcelles'
  AND column_name IN ('planteur_id', 'code', 'import_file_id')
ORDER BY column_name;

-- Expected: planteur_id and code should be nullable (YES)

-- Check planteurs table new columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'planteurs'
  AND column_name IN ('name_norm', 'auto_created', 'created_via_import_id')
ORDER BY column_name;

-- Expected: name_norm (NOT NULL), auto_created (NOT NULL, default false), created_via_import_id (nullable)

-- ============================================================================
-- 2. VERIFY CONSTRAINTS
-- ============================================================================

-- List all constraints on parcelles table
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.parcelles'::regclass
  AND conname IN ('parcelles_orphan_requires_import', 'parcelles_code_required_when_assigned')
ORDER BY conname;

-- Expected: Both constraints should exist

-- ============================================================================
-- 3. VERIFY INDEXES
-- ============================================================================

-- List relevant indexes on parcelles
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'parcelles'
  AND indexname IN (
    'parcelles_unique_code_per_planteur',
    'idx_parcelles_orphan',
    'uniq_active_parcelle_hash_assigned',
    'uniq_active_parcelle_hash_orphan'
  )
ORDER BY indexname;

-- List relevant indexes on planteurs
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'planteurs'
  AND indexname IN (
    'planteurs_unique_name_norm_per_coop',
    'idx_planteurs_name_norm',
    'idx_planteurs_auto_created'
  )
ORDER BY indexname;

-- ============================================================================
-- 4. VERIFY RLS POLICIES
-- ============================================================================

-- List RLS policies on parcelles
SELECT 
  policyname,
  cmd,
  qual IS NOT NULL AS has_using_clause,
  with_check IS NOT NULL AS has_with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'parcelles'
ORDER BY policyname;

-- Expected: parcelles_select, parcelles_insert, parcelles_update

-- ============================================================================
-- 5. VERIFY FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Check normalize_planteur_name function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'normalize_planteur_name';

-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND event_object_table = 'planteurs'
  AND trigger_name = 'planteur_name_norm_trigger';

-- ============================================================================
-- 6. VERIFY EXTENSION
-- ============================================================================

-- Check unaccent extension is installed
SELECT 
  extname,
  extversion
FROM pg_extension 
WHERE extname = 'unaccent';

-- ============================================================================
-- 7. TEST NORMALIZATION FUNCTION
-- ============================================================================

-- Test normalize_planteur_name function
SELECT 
  'Konan Yao' AS input,
  public.normalize_planteur_name('Konan Yao') AS normalized
UNION ALL
SELECT 
  'KONAN YAO',
  public.normalize_planteur_name('KONAN YAO')
UNION ALL
SELECT 
  '  konan  yao  ',
  public.normalize_planteur_name('  konan  yao  ')
UNION ALL
SELECT 
  'Éric Müller',
  public.normalize_planteur_name('Éric Müller')
UNION ALL
SELECT 
  NULL,
  public.normalize_planteur_name(NULL);

-- Expected: All variations of "Konan Yao" should normalize to "konan yao"
-- "Éric Müller" should normalize to "eric muller"
-- NULL should return ''

-- ============================================================================
-- 8. TEST CONSTRAINTS (These should FAIL - run individually)
-- ============================================================================

-- Test 1: Orphan parcelle without import_file_id should FAIL
-- Uncomment to test:
-- INSERT INTO public.parcelles (id, planteur_id, import_file_id, code, label, geometry, is_active)
-- VALUES (gen_random_uuid(), NULL, NULL, NULL, 'Test', ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326), true);
-- Expected error: violates check constraint "parcelles_orphan_requires_import"

-- Test 2: Assigned parcelle without code should FAIL
-- Uncomment to test (replace with valid planteur_id):
-- INSERT INTO public.parcelles (id, planteur_id, import_file_id, code, label, geometry, is_active)
-- VALUES (gen_random_uuid(), 'valid-planteur-uuid', NULL, NULL, 'Test', ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326), true);
-- Expected error: violates check constraint "parcelles_code_required_when_assigned"

-- ============================================================================
-- 9. VERIFY ALL PLANTEURS HAVE name_norm POPULATED
-- ============================================================================

SELECT 
  COUNT(*) AS total_planteurs,
  COUNT(name_norm) AS with_name_norm,
  COUNT(*) FILTER (WHERE name_norm = '') AS empty_name_norm
FROM public.planteurs;

-- Expected: total_planteurs = with_name_norm, empty_name_norm should be 0 or match planteurs with empty names

-- ============================================================================
-- SUMMARY: All checks should pass for migrations to be considered complete
-- ============================================================================
