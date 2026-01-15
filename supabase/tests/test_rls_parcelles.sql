-- ============================================================================
-- CocoaTrack V2 - Parcelles RLS Tests (Single Query - All Results)
-- Run this entire script to see all test results in one table
-- ============================================================================

SELECT * FROM (
  -- TEST 1: RLS enabled on parcelles
  SELECT 
    1 AS test_order,
    'TEST 1: RLS enabled on parcelles' AS test_name,
    CASE WHEN relrowsecurity THEN 'PASSED' ELSE 'FAILED' END AS result
  FROM pg_class
  WHERE relname = 'parcelles' AND relnamespace = 'public'::regnamespace

  UNION ALL

  -- TEST 2: RLS enabled on parcel_import_files
  SELECT 
    2,
    'TEST 2: RLS enabled on parcel_import_files',
    CASE WHEN relrowsecurity THEN 'PASSED' ELSE 'FAILED' END
  FROM pg_class
  WHERE relname = 'parcel_import_files' AND relnamespace = 'public'::regnamespace

  UNION ALL

  -- TEST 3: parcelles_select policy exists
  SELECT 
    3,
    'TEST 3: parcelles_select policy',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_select'

  UNION ALL

  -- TEST 4: parcelles_insert policy exists
  SELECT 
    4,
    'TEST 4: parcelles_insert policy',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_insert'

  UNION ALL

  -- TEST 5: parcelles_update policy exists
  SELECT 
    5,
    'TEST 5: parcelles_update policy',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_update'

  UNION ALL

  -- TEST 6: planteur_id is nullable
  SELECT 
    6,
    'TEST 6: planteur_id is nullable',
    CASE WHEN is_nullable = 'YES' THEN 'PASSED' ELSE 'FAILED' END
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'parcelles' AND column_name = 'planteur_id'

  UNION ALL

  -- TEST 7: code is nullable
  SELECT 
    7,
    'TEST 7: code is nullable',
    CASE WHEN is_nullable = 'YES' THEN 'PASSED' ELSE 'FAILED' END
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'parcelles' AND column_name = 'code'

  UNION ALL

  -- TEST 8: parcelles_orphan_requires_import constraint
  SELECT 
    8,
    'TEST 8: parcelles_orphan_requires_import constraint',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_constraint 
  WHERE conrelid = 'public.parcelles'::regclass AND conname = 'parcelles_orphan_requires_import'

  UNION ALL

  -- TEST 9: parcelles_code_required_when_assigned constraint
  SELECT 
    9,
    'TEST 9: parcelles_code_required_when_assigned constraint',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_constraint 
  WHERE conrelid = 'public.parcelles'::regclass AND conname = 'parcelles_code_required_when_assigned'

  UNION ALL

  -- TEST 10: parcelles_unique_code_per_planteur index
  SELECT 
    10,
    'TEST 10: parcelles_unique_code_per_planteur index',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND indexname = 'parcelles_unique_code_per_planteur'

  UNION ALL

  -- TEST 11: idx_parcelles_orphan index
  SELECT 
    11,
    'TEST 11: idx_parcelles_orphan index',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND indexname = 'idx_parcelles_orphan'

  UNION ALL

  -- TEST 12: uniq_active_parcelle_hash_assigned index
  SELECT 
    12,
    'TEST 12: uniq_active_parcelle_hash_assigned index',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND indexname = 'uniq_active_parcelle_hash_assigned'

  UNION ALL

  -- TEST 13: uniq_active_parcelle_hash_orphan index
  SELECT 
    13,
    'TEST 13: uniq_active_parcelle_hash_orphan index',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND indexname = 'uniq_active_parcelle_hash_orphan'

  UNION ALL

  -- TEST 14: planteurs.name_norm column exists and NOT NULL
  SELECT 
    14,
    'TEST 14: planteurs.name_norm column (NOT NULL)',
    CASE WHEN is_nullable = 'NO' THEN 'PASSED' ELSE 'FAILED - nullable' END
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'planteurs' AND column_name = 'name_norm'

  UNION ALL

  -- TEST 15: planteurs.auto_created column exists
  SELECT 
    15,
    'TEST 15: planteurs.auto_created column',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'planteurs' AND column_name = 'auto_created'

  UNION ALL

  -- TEST 16: planteurs.created_via_import_id column exists
  SELECT 
    16,
    'TEST 16: planteurs.created_via_import_id column',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'planteurs' AND column_name = 'created_via_import_id'

  UNION ALL

  -- TEST 17: planteurs_unique_name_norm_per_coop index
  SELECT 
    17,
    'TEST 17: planteurs_unique_name_norm_per_coop index',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'planteurs' AND indexname = 'planteurs_unique_name_norm_per_coop'

  UNION ALL

  -- TEST 18: normalize_planteur_name function exists
  SELECT 
    18,
    'TEST 18: normalize_planteur_name function',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM information_schema.routines 
  WHERE routine_schema = 'public' AND routine_name = 'normalize_planteur_name'

  UNION ALL

  -- TEST 19: planteur_name_norm_trigger exists
  SELECT 
    19,
    'TEST 19: planteur_name_norm_trigger',
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
  FROM information_schema.triggers 
  WHERE trigger_schema = 'public' AND event_object_table = 'planteurs' AND trigger_name = 'planteur_name_norm_trigger'

  UNION ALL

  -- TEST 20: unaccent extension installed
  SELECT 
    20,
    'TEST 20: unaccent extension',
    CASE WHEN COUNT(*) > 0 THEN 'INSTALLED' ELSE 'MISSING' END
  FROM pg_extension 
  WHERE extname = 'unaccent'

  UNION ALL

  -- TEST 21: normalize_planteur_name('Konan Yao')
  SELECT 
    21,
    'TEST 21: normalize(Konan Yao) = konan yao',
    CASE WHEN public.normalize_planteur_name('Konan Yao') = 'konan yao' THEN 'PASSED' ELSE 'FAILED: ' || public.normalize_planteur_name('Konan Yao') END

  UNION ALL

  -- TEST 22: normalize_planteur_name('KONAN YAO')
  SELECT 
    22,
    'TEST 22: normalize(KONAN YAO) = konan yao',
    CASE WHEN public.normalize_planteur_name('KONAN YAO') = 'konan yao' THEN 'PASSED' ELSE 'FAILED: ' || public.normalize_planteur_name('KONAN YAO') END

  UNION ALL

  -- TEST 23: normalize_planteur_name('Éric Müller')
  SELECT 
    23,
    'TEST 23: normalize(Éric Müller) = eric muller',
    CASE WHEN public.normalize_planteur_name('Éric Müller') = 'eric muller' THEN 'PASSED' ELSE 'FAILED: ' || public.normalize_planteur_name('Éric Müller') END

  UNION ALL

  -- TEST 24: parcelles_select policy handles orphans (via import_file)
  SELECT 
    24,
    'TEST 24: parcelles_select handles orphans',
    CASE 
      WHEN qual::text LIKE '%planteurs%' AND qual::text LIKE '%parcel_import_files%' THEN 'PASSED'
      WHEN qual::text LIKE '%planteurs%' THEN 'PARTIAL - only assigned'
      ELSE 'FAILED'
    END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_select'

  UNION ALL

  -- TEST 25: parcelles_insert policy handles orphans
  SELECT 
    25,
    'TEST 25: parcelles_insert handles orphans',
    CASE 
      WHEN with_check::text LIKE '%planteurs%' AND with_check::text LIKE '%parcel_import_files%' THEN 'PASSED'
      WHEN with_check::text LIKE '%planteurs%' THEN 'PARTIAL - only assigned'
      ELSE 'FAILED'
    END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_insert'

  UNION ALL

  -- TEST 26: parcelles_update policy handles orphans
  SELECT 
    26,
    'TEST 26: parcelles_update handles orphans',
    CASE 
      WHEN qual::text LIKE '%planteurs%' AND qual::text LIKE '%parcel_import_files%' THEN 'PASSED'
      WHEN qual::text LIKE '%planteurs%' THEN 'PARTIAL - only assigned'
      ELSE 'FAILED'
    END
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'parcelles' AND policyname = 'parcelles_update'

) AS all_tests
ORDER BY test_order;
