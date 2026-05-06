-- ============================================================================
-- Health Status Notification Testing Script
-- 
-- This script helps verify that the health status notification system
-- is working correctly by simulating health status changes.
-- 
-- Usage:
--   1. Replace 'YOUR_PARCELLE_ID' with an actual parcelle UUID
--   2. Run the script in Supabase SQL Editor or psql
--   3. Check the notifications table for new notifications
-- ============================================================================

-- ============================================================================
-- STEP 1: Find a test parcelle
-- ============================================================================
-- Uncomment and run this query to find a parcelle to test with
/*
SELECT 
  pa.id,
  pa.code,
  pa.nom,
  pl.nom || ' ' || pl.prenom as planteur_name,
  c.name as cooperative_name
FROM parcelles pa
LEFT JOIN planteurs pl ON pl.id = pa.planteur_id
LEFT JOIN cooperatives c ON c.id = pl.cooperative_id
LIMIT 10;
*/

-- ============================================================================
-- STEP 2: Set your test parcelle ID here
-- ============================================================================
\set PARCELLE_ID 'YOUR_PARCELLE_ID'

-- ============================================================================
-- STEP 3: Check current NDVI results for this parcelle
-- ============================================================================
SELECT 
  calculation_date,
  health_status,
  mean_ndvi,
  created_at
FROM ndvi_results
WHERE parcelle_id = :'PARCELLE_ID'
ORDER BY calculation_date DESC
LIMIT 5;

-- ============================================================================
-- STEP 4: Clear existing notifications (optional, for clean testing)
-- ============================================================================
-- Uncomment to clear existing health status notifications
/*
DELETE FROM notifications 
WHERE type = 'health_status_decline'
  AND payload->>'parcelle_id' = :'PARCELLE_ID';
*/

-- ============================================================================
-- STEP 5: Insert initial "good" health status
-- ============================================================================
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  :'PARCELLE_ID',
  CURRENT_DATE - INTERVAL '30 days', -- 30 days ago
  0.60, -- Good status (0.55-0.65)
  0.50,
  0.70,
  0.05,
  'good'
) ON CONFLICT (parcelle_id, calculation_date) DO UPDATE
SET 
  mean_ndvi = EXCLUDED.mean_ndvi,
  health_status = EXCLUDED.health_status;

-- ============================================================================
-- STEP 6: Insert new "poor" health status (should trigger notification)
-- ============================================================================
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  :'PARCELLE_ID',
  CURRENT_DATE, -- Today
  0.35, -- Poor status (0.30-0.45)
  0.25,
  0.45,
  0.06,
  'poor'
) ON CONFLICT (parcelle_id, calculation_date) DO UPDATE
SET 
  mean_ndvi = EXCLUDED.mean_ndvi,
  health_status = EXCLUDED.health_status;

-- ============================================================================
-- STEP 7: Wait a moment for trigger to execute
-- ============================================================================
SELECT pg_sleep(1);

-- ============================================================================
-- STEP 8: Check if notifications were created
-- ============================================================================
SELECT 
  n.id,
  n.created_at,
  p.email as recipient_email,
  p.role as recipient_role,
  n.title,
  n.body,
  n.payload->>'previous_status' as previous_status,
  n.payload->>'current_status' as current_status,
  n.payload->>'decline_amount' as decline_amount,
  n.payload->>'mean_ndvi' as mean_ndvi,
  n.read_at
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.type = 'health_status_decline'
  AND n.payload->>'parcelle_id' = :'PARCELLE_ID'
ORDER BY n.created_at DESC;

-- ============================================================================
-- STEP 9: Verify notification recipients
-- ============================================================================
-- Check who should have received notifications
SELECT 
  'Manager' as recipient_type,
  p.id,
  p.email,
  p.role,
  c.name as cooperative_name
FROM parcelles pa
JOIN planteurs pl ON pl.id = pa.planteur_id
JOIN cooperatives c ON c.id = pl.cooperative_id
JOIN profiles p ON p.cooperative_id = c.id
WHERE pa.id = :'PARCELLE_ID'
  AND p.role IN ('manager', 'admin')

UNION ALL

SELECT 
  'Planteur' as recipient_type,
  p.id,
  p.email,
  p.role,
  c.name as cooperative_name
FROM parcelles pa
JOIN planteurs pl ON pl.id = pa.planteur_id
LEFT JOIN cooperatives c ON c.id = pl.cooperative_id
LEFT JOIN profiles p ON p.id = pl.user_id
WHERE pa.id = :'PARCELLE_ID'
  AND pl.user_id IS NOT NULL;

-- ============================================================================
-- STEP 10: Test different decline scenarios
-- ============================================================================

-- Test 1: 1-category decline (should NOT trigger notification)
-- Good (4) → Fair (3) = 1 category decline
/*
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  :'PARCELLE_ID',
  CURRENT_DATE + INTERVAL '1 day',
  0.50, -- Fair status (0.45-0.55)
  0.40,
  0.60,
  0.05,
  'fair'
);
*/

-- Test 2: 3-category decline (should trigger notification)
-- Excellent (5) → Poor (2) = 3 category decline
/*
INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  :'PARCELLE_ID',
  CURRENT_DATE - INTERVAL '60 days',
  0.75, -- Excellent status (0.65-1.0)
  0.70,
  0.80,
  0.03,
  'excellent'
);

INSERT INTO ndvi_results (
  parcelle_id,
  calculation_date,
  mean_ndvi,
  min_ndvi,
  max_ndvi,
  std_dev_ndvi,
  health_status
) VALUES (
  :'PARCELLE_ID',
  CURRENT_DATE + INTERVAL '2 days',
  0.35, -- Poor status (0.30-0.45)
  0.25,
  0.45,
  0.06,
  'poor'
);
*/

-- ============================================================================
-- STEP 11: Clean up test data (optional)
-- ============================================================================
-- Uncomment to remove test NDVI results and notifications
/*
DELETE FROM ndvi_results 
WHERE parcelle_id = :'PARCELLE_ID'
  AND calculation_date >= CURRENT_DATE - INTERVAL '60 days';

DELETE FROM notifications 
WHERE type = 'health_status_decline'
  AND payload->>'parcelle_id' = :'PARCELLE_ID';
*/

-- ============================================================================
-- STEP 12: Verify trigger and functions exist
-- ============================================================================
SELECT 
  'Trigger' as object_type,
  tgname as name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_notify_health_status_decline'

UNION ALL

SELECT 
  'Function' as object_type,
  proname as name,
  'enabled' as enabled
FROM pg_proc 
WHERE proname IN (
  'notify_on_health_status_decline',
  'get_health_status_value',
  'get_health_status_recommendation',
  'get_health_status_label',
  'get_parcelle_cooperative_managers',
  'get_parcelle_planteur'
);
