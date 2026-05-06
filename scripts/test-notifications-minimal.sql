-- Ultra-minimal test script for health status change notifications
-- This script only tests the core notification functionality

-- Step 1: Check parcelles table structure first
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'parcelles' 
ORDER BY ordinal_position;

-- Step 2: Get any existing parcelle ID (without assuming column names)
SELECT id as parcelle_id
FROM parcelles 
LIMIT 1;

-- Step 3: Test the notification system with minimal data
-- Use a hardcoded parcelle ID or get one dynamically
DO $$
DECLARE
  v_test_parcelle_id UUID;
BEGIN
  -- Get the first available parcelle ID
  SELECT id INTO v_test_parcelle_id
  FROM parcelles 
  LIMIT 1;
  
  IF v_test_parcelle_id IS NULL THEN
    RAISE NOTICE 'No parcelles found in database. Cannot test notifications.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing with parcelle ID: %', v_test_parcelle_id;
  
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

-- Step 4: Check if notifications were created (basic check)
SELECT 
  COUNT(*) as total_notifications_created
FROM notifications 
WHERE type = 'health_status_decline'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Step 5: Show notification details if any were created
SELECT 
  id,
  type,
  title,
  body,
  created_at
FROM notifications 
WHERE type = 'health_status_decline'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Step 6: Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'ndvi_results'
  AND trigger_name LIKE '%health%';

-- Step 7: Check if the notification functions exist
SELECT 
  proname as function_name
FROM pg_proc 
WHERE proname IN ('notify_on_health_status_decline', 'trigger_health_status_change', 'send_health_status_notification');

-- Cleanup: Remove test data (uncomment to clean up)
/*
DELETE FROM ndvi_results 
WHERE calculation_date > NOW() - INTERVAL '2 hours'
  AND health_status IN ('excellent', 'poor');

DELETE FROM notifications 
WHERE type = 'health_status_decline' 
  AND created_at > NOW() - INTERVAL '1 hour';
*/