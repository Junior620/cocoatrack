-- Test script for health status change notifications
-- This script tests the notification system by simulating health status changes

-- Test data setup (run this first to create test scenario)
DO $$
DECLARE
  v_test_parcelle_id UUID;
  v_test_planteur_id UUID;
  v_test_cooperative_id UUID;
  v_manager_profile_id UUID;
  v_planteur_profile_id UUID;
BEGIN
  -- Create test cooperative if not exists
  INSERT INTO cooperatives (nom, region, created_at)
  VALUES ('Test Cooperative Notifications', 'Centre', NOW())
  ON CONFLICT (nom) DO NOTHING
  RETURNING id INTO v_test_cooperative_id;
  
  -- Get cooperative ID if it already exists
  IF v_test_cooperative_id IS NULL THEN
    SELECT id INTO v_test_cooperative_id 
    FROM cooperatives 
    WHERE nom = 'Test Cooperative Notifications';
  END IF;
  
  -- Create test planteur if not exists
  INSERT INTO planteurs (nom, prenom, telephone, cooperative_id, created_at)
  VALUES ('Test', 'Planteur Notifications', '+237600000001', v_test_cooperative_id, NOW())
  ON CONFLICT (telephone) DO NOTHING
  RETURNING id INTO v_test_planteur_id;
  
  -- Get planteur ID if it already exists
  IF v_test_planteur_id IS NULL THEN
    SELECT id INTO v_test_planteur_id 
    FROM planteurs 
    WHERE telephone = '+237600000001';
  END IF;
  
  -- Create test parcelle if not exists
  INSERT INTO parcelles (
    nom, 
    planteur_id, 
    surface_hectares, 
    geometry,
    created_at
  )
  VALUES (
    'Test Parcelle Notifications',
    v_test_planteur_id,
    2.5,
    ST_GeomFromText('POLYGON((10 10, 10 11, 11 11, 11 10, 10 10))', 4326),
    NOW()
  )
  ON CONFLICT (nom, planteur_id) DO NOTHING
  RETURNING id INTO v_test_parcelle_id;
  
  -- Get parcelle ID if it already exists
  IF v_test_parcelle_id IS NULL THEN
    SELECT id INTO v_test_parcelle_id 
    FROM parcelles 
    WHERE nom = 'Test Parcelle Notifications' AND planteur_id = v_test_planteur_id;
  END IF;
  
  -- Create test profiles for notifications
  INSERT INTO profiles (
    id,
    user_id,
    role,
    cooperative_id,
    created_at
  )
  VALUES (
    uuid_generate_v4(),
    uuid_generate_v4(),
    'cooperative_manager',
    v_test_cooperative_id,
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_manager_profile_id;
  
  INSERT INTO profiles (
    id,
    user_id,
    role,
    created_at
  )
  VALUES (
    v_test_planteur_id,
    uuid_generate_v4(),
    'planteur',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_planteur_profile_id;
  
  RAISE NOTICE 'Test data created:';
  RAISE NOTICE 'Parcelle ID: %', v_test_parcelle_id;
  RAISE NOTICE 'Planteur ID: %', v_test_planteur_id;
  RAISE NOTICE 'Cooperative ID: %', v_test_cooperative_id;
  RAISE NOTICE 'Manager Profile ID: %', v_manager_profile_id;
END $$;

-- Test 1: Insert initial "excellent" health status (no notification expected)
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
)
SELECT 
  p.id,
  NOW() - INTERVAL '7 days',
  0.8,
  0.7,
  0.9,
  0.05,
  'excellent'
FROM parcelles p 
WHERE p.nom = 'Test Parcelle Notifications'
LIMIT 1;

-- Test 2: Insert "poor" health status (should trigger notification - decline from excellent to poor = 3 categories)
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
)
SELECT 
  p.id,
  NOW(),
  0.4,
  0.3,
  0.5,
  0.08,
  'poor'
FROM parcelles p 
WHERE p.nom = 'Test Parcelle Notifications'
LIMIT 1;

-- Check if notifications were created
SELECT 
  n.id,
  n.type,
  n.title,
  n.body,
  n.payload->>'parcelle_name' as parcelle_name,
  n.payload->>'old_status' as old_status,
  n.payload->>'new_status' as new_status,
  n.payload->>'decline_categories' as decline_categories,
  n.created_at,
  p.role as recipient_role
FROM notifications n
JOIN profiles p ON n.user_id = p.user_id
WHERE n.type = 'health_status_decline'
  AND n.payload->>'parcelle_name' = 'Test Parcelle Notifications'
ORDER BY n.created_at DESC;

-- Test 3: Insert "fair" health status (should NOT trigger notification - decline from poor to fair = improvement)
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
)
SELECT 
  p.id,
  NOW() + INTERVAL '1 day',
  0.55,
  0.45,
  0.65,
  0.06,
  'fair'
FROM parcelles p 
WHERE p.nom = 'Test Parcelle Notifications'
LIMIT 1;

-- Test 4: Insert "critical" health status (should trigger notification - decline from fair to critical = 2 categories)
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
)
SELECT 
  p.id,
  NOW() + INTERVAL '2 days',
  0.25,
  0.15,
  0.35,
  0.12,
  'critical'
FROM parcelles p 
WHERE p.nom = 'Test Parcelle Notifications'
LIMIT 1;

-- Final check: Count total notifications created
SELECT 
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN p.role = 'cooperative_manager' THEN 1 END) as manager_notifications,
  COUNT(CASE WHEN p.role = 'planteur' THEN 1 END) as planteur_notifications
FROM notifications n
JOIN profiles p ON n.user_id = p.user_id
WHERE n.type = 'health_status_decline'
  AND n.payload->>'parcelle_name' = 'Test Parcelle Notifications';

-- Show all health status changes for the test parcelle
SELECT 
  calculation_date,
  health_status,
  mean_ndvi,
  get_health_status_level(health_status) as status_level
FROM ndvi_results nr
JOIN parcelles p ON nr.parcelle_id = p.id
WHERE p.nom = 'Test Parcelle Notifications'
ORDER BY calculation_date;

-- Cleanup (uncomment to remove test data)
/*
DELETE FROM notifications 
WHERE type = 'health_status_decline' 
  AND payload->>'parcelle_name' = 'Test Parcelle Notifications';

DELETE FROM ndvi_results 
WHERE parcelle_id IN (
  SELECT id FROM parcelles WHERE nom = 'Test Parcelle Notifications'
);

DELETE FROM parcelles WHERE nom = 'Test Parcelle Notifications';
DELETE FROM planteurs WHERE telephone = '+237600000001';
DELETE FROM cooperatives WHERE nom = 'Test Cooperative Notifications';
*/