-- Simplified test script for health status change notifications
-- This script uses existing data instead of creating test data

-- Step 1: Check if we have existing parcelles to test with
SELECT 
  p.id as parcelle_id,
  p.nom as parcelle_name,
  pl.nom as planteur_nom,
  pl.prenom as planteur_prenom
FROM parcelles p
LEFT JOIN planteurs pl ON p.planteur_id = pl.id
LIMIT 5;

-- Step 2: Check if we have any existing NDVI results
SELECT 
  nr.parcelle_id,
  p.nom as parcelle_name,
  nr.health_status,
  nr.mean_ndvi,
  nr.calculation_date
FROM ndvi_results nr
LEFT JOIN parcelles p ON nr.parcelle_id = p.id
ORDER BY nr.calculation_date DESC
LIMIT 10;

-- Step 3: Test the notification system with a real parcelle
-- First, let's get a parcelle ID to work with
DO $$
DECLARE
  v_test_parcelle_id UUID;
  v_test_parcelle_name TEXT;
BEGIN
  -- Get the first available parcelle
  SELECT id, nom INTO v_test_parcelle_id, v_test_parcelle_name
  FROM parcelles 
  LIMIT 1;
  
  IF v_test_parcelle_id IS NULL THEN
    RAISE NOTICE 'No parcelles found in database. Cannot test notifications.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing with parcelle: % (ID: %)', v_test_parcelle_name, v_test_parcelle_id;
  
  -- Insert initial "excellent" health status
  INSERT INTO ndvi_results (
    parcelle_id,
    calculation_date,
    mean_ndvi,
    min_ndvi,
    max_ndvi,
    std_dev_ndvi,
    health_status
  ) VALUES (
    v_test_parcelle_id,
    NOW() - INTERVAL '1 hour',
    0.8,
    0.7,
    0.9,
    0.05,
    'excellent'
  );
  
  RAISE NOTICE 'Inserted excellent health status';
  
  -- Insert "poor" health status (should trigger notification - decline from excellent to poor = 3 categories)
  INSERT INTO ndvi_results (
    parcelle_id,
    calculation_date,
    mean_ndvi,
    min_ndvi,
    max_ndvi,
    std_dev_ndvi,
    health_status
  ) VALUES (
    v_test_parcelle_id,
    NOW(),
    0.4,
    0.3,
    0.5,
    0.08,
    'poor'
  );
  
  RAISE NOTICE 'Inserted poor health status - should trigger notification';
  
END $$;

-- Step 4: Check if notifications were created
SELECT 
  n.id,
  n.type,
  n.title,
  n.body,
  n.payload->>'parcelle_name' as parcelle_name,
  n.payload->>'old_status' as old_status,
  n.payload->>'new_status' as new_status,
  n.payload->>'decline_categories' as decline_categories,
  n.created_at
FROM notifications n
WHERE n.type = 'health_status_decline'
  AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;

-- Step 5: Count notifications created in the last hour
SELECT 
  COUNT(*) as total_notifications_created
FROM notifications n
WHERE n.type = 'health_status_decline'
  AND n.created_at > NOW() - INTERVAL '1 hour';

-- Step 6: Check the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'trigger_health_status_change';

-- Step 7: Check if the trigger exists on ndvi_results table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'ndvi_results'
  AND trigger_name LIKE '%health%';

-- Cleanup: Remove test data (uncomment to clean up)
/*
DELETE FROM ndvi_results 
WHERE calculation_date > NOW() - INTERVAL '2 hours'
  AND health_status IN ('excellent', 'poor');

DELETE FROM notifications 
WHERE type = 'health_status_decline' 
  AND created_at > NOW() - INTERVAL '1 hour';
*/