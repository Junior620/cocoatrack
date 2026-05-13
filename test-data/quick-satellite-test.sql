-- ============================================================================
-- QUICK SATELLITE TEST DATA - Simplified Version
-- ============================================================================
-- This is a simplified version that creates just 3 test parcelles in regions
-- with excellent satellite coverage for quick testing.
--
-- Usage: Copy and paste this entire script into Supabase SQL Editor and run.
-- ============================================================================

DO $$
DECLARE
  v_cooperative_id UUID;
  v_chef_planteur_id UUID;
  v_created_by UUID;
  v_planteur_brazil UUID;
  v_planteur_ecuador UUID;
  v_planteur_spain UUID;
BEGIN
  -- Get existing IDs
  SELECT id INTO v_cooperative_id FROM cooperatives LIMIT 1;
  SELECT id INTO v_chef_planteur_id FROM chef_planteurs LIMIT 1;
  SELECT id INTO v_created_by FROM profiles LIMIT 1;
  
  IF v_cooperative_id IS NULL OR v_chef_planteur_id IS NULL OR v_created_by IS NULL THEN
    RAISE EXCEPTION 'Missing required data. Please create a cooperative, chef_planteur, and user profile first.';
  END IF;
  
  -- Create 3 test planteurs
  
  -- 1. Brazil (Amazon) - for deforestation testing
  INSERT INTO planteurs (name, code, phone, chef_planteur_id, cooperative_id, latitude, longitude, created_by)
  VALUES ('João Silva (TEST)', 'TEST-BR-001', '+55 92 98765-4321', v_chef_planteur_id, v_cooperative_id, -3.1190, -60.0217, v_created_by)
  RETURNING id INTO v_planteur_brazil;
  
  -- 2. Ecuador - for cocoa NDVI testing
  INSERT INTO planteurs (name, code, phone, chef_planteur_id, cooperative_id, latitude, longitude, created_by)
  VALUES ('Carlos Mendoza (TEST)', 'TEST-EC-001', '+593 98 765 4321', v_chef_planteur_id, v_cooperative_id, 0.9681, -79.6518, v_created_by)
  RETURNING id INTO v_planteur_ecuador;
  
  -- 3. Spain - for clear imagery testing
  INSERT INTO planteurs (name, code, phone, chef_planteur_id, cooperative_id, latitude, longitude, created_by)
  VALUES ('Miguel García (TEST)', 'TEST-ES-001', '+34 654 321 987', v_chef_planteur_id, v_cooperative_id, 37.3891, -5.9845, v_created_by)
  RETURNING id INTO v_planteur_spain;
  
  -- Create 3 test parcelles
  
  -- Parcelle 1: Brazil Amazon - Dense forest (~5 ha)
  INSERT INTO parcelles (planteur_id, code, label, village, geometry, surface_hectares, certifications, conformity_status, source, created_by)
  VALUES (
    v_planteur_brazil,
    'PAR-BR-TEST',
    'Fazenda Floresta (TEST)',
    'Manaus',
    ST_Multi(ST_GeomFromText('POLYGON((-60.0217 -3.1190, -60.0207 -3.1190, -60.0207 -3.1180, -60.0217 -3.1180, -60.0217 -3.1190))', 4326)),
    5.2,
    ARRAY['organic'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 2: Ecuador - Cocoa plantation (~4 ha)
  INSERT INTO parcelles (planteur_id, code, label, village, geometry, surface_hectares, certifications, conformity_status, source, created_by)
  VALUES (
    v_planteur_ecuador,
    'PAR-EC-TEST',
    'Finca Cacao Fino (TEST)',
    'Esmeraldas',
    ST_Multi(ST_GeomFromText('POLYGON((-79.6518 0.9681, -79.6508 0.9681, -79.6508 0.9691, -79.6518 0.9691, -79.6518 0.9681))', 4326)),
    4.2,
    ARRAY['organic', 'fairtrade'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 3: Spain - Agricultural land (~10 ha)
  INSERT INTO parcelles (planteur_id, code, label, village, geometry, surface_hectares, certifications, conformity_status, source, created_by)
  VALUES (
    v_planteur_spain,
    'PAR-ES-TEST',
    'Olivar del Sol (TEST)',
    'Córdoba',
    ST_Multi(ST_GeomFromText('POLYGON((-5.9845 37.3891, -5.9835 37.3891, -5.9835 37.3901, -5.9845 37.3901, -5.9845 37.3891))', 4326)),
    10.5,
    ARRAY['organic'],
    'conforme',
    'manual',
    v_created_by
  );
  
  RAISE NOTICE '✅ Quick test data created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 3 test planteurs (Brazil, Ecuador, Spain)';
  RAISE NOTICE '  - 3 test parcelles';
  RAISE NOTICE '';
  RAISE NOTICE 'Test parcelles:';
  RAISE NOTICE '  🇧🇷 PAR-BR-TEST - Amazon forest (deforestation testing)';
  RAISE NOTICE '  🇪🇨 PAR-EC-TEST - Cocoa plantation (NDVI testing)';
  RAISE NOTICE '  🇪🇸 PAR-ES-TEST - Agricultural land (clear imagery)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Search for "TEST" in the parcelles page to find them!';
END $$;
