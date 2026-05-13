-- ============================================================================
-- TEST DATA FOR SATELLITE IMAGERY ANALYSIS
-- ============================================================================
-- Purpose: Create test planteurs and parcelles in regions with excellent
--          satellite coverage for testing NDVI, temporal analysis, and
--          deforestation detection features.
--
-- Regions covered:
--   - Brazil (Amazon region) - for deforestation testing
--   - Ecuador (cocoa growing region)
--   - Spain (agricultural areas)
--   - Italy (agricultural areas)
--   - Indonesia (palm oil/cocoa region)
--
-- Usage:
--   1. Ensure you have a valid user_id and cooperative_id
--   2. Replace the placeholder UUIDs below with actual values from your database
--   3. Run this script in your Supabase SQL editor
--
-- Note: This script assumes you have:
--   - A cooperative (cooperative_id)
--   - A chef_planteur (chef_planteur_id)
--   - A user profile (created_by)
-- ============================================================================

-- ============================================================================
-- STEP 1: Set up variables (REPLACE THESE WITH YOUR ACTUAL IDs)
-- ============================================================================

DO $$
DECLARE
  v_cooperative_id UUID;
  v_chef_planteur_id UUID;
  v_created_by UUID;
  
  -- Planteur IDs (will be generated)
  v_planteur_1 UUID;
  v_planteur_2 UUID;
  v_planteur_3 UUID;
  v_planteur_4 UUID;
  v_planteur_5 UUID;
  v_planteur_6 UUID;
  v_planteur_7 UUID;
  v_planteur_8 UUID;
  v_planteur_9 UUID;
  v_planteur_10 UUID;
  
BEGIN
  -- ============================================================================
  -- Get existing IDs from database
  -- ============================================================================
  
  -- Get first cooperative
  SELECT id INTO v_cooperative_id 
  FROM cooperatives 
  LIMIT 1;
  
  -- Get first chef_planteur
  SELECT id INTO v_chef_planteur_id 
  FROM chef_planteurs 
  LIMIT 1;
  
  -- Get first user profile
  SELECT id INTO v_created_by 
  FROM profiles 
  LIMIT 1;
  
  -- Check if we have required data
  IF v_cooperative_id IS NULL OR v_chef_planteur_id IS NULL OR v_created_by IS NULL THEN
    RAISE EXCEPTION 'Missing required data: cooperative, chef_planteur, or user profile';
  END IF;
  
  RAISE NOTICE 'Using cooperative_id: %', v_cooperative_id;
  RAISE NOTICE 'Using chef_planteur_id: %', v_chef_planteur_id;
  RAISE NOTICE 'Using created_by: %', v_created_by;
  
  -- ============================================================================
  -- STEP 2: Create Test Planteurs
  -- ============================================================================
  
  -- Planteur 1: Brazil - Amazon Region (Deforestation risk area)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'João Silva',
    'TEST-BR-001',
    '+55 92 98765-4321',
    'BR123456789',
    v_chef_planteur_id,
    v_cooperative_id,
    -3.1190,  -- Manaus region
    -60.0217,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_1;
  
  -- Planteur 2: Brazil - Pará State (High deforestation monitoring)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Maria Santos',
    'TEST-BR-002',
    '+55 91 98765-1234',
    'BR987654321',
    v_chef_planteur_id,
    v_cooperative_id,
    -2.5297,  -- Santarém region
    -54.7089,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_2;
  
  -- Planteur 3: Ecuador - Esmeraldas (Cocoa growing region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Carlos Mendoza',
    'TEST-EC-001',
    '+593 98 765 4321',
    'EC123456789',
    v_chef_planteur_id,
    v_cooperative_id,
    0.9681,  -- Esmeraldas
    -79.6518,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_3;
  
  -- Planteur 4: Ecuador - Los Ríos (Major cocoa region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Ana Rodríguez',
    'TEST-EC-002',
    '+593 98 123 4567',
    'EC987654321',
    v_chef_planteur_id,
    v_cooperative_id,
    -1.0569,  -- Quevedo
    -79.4608,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_4;
  
  -- Planteur 5: Spain - Andalusia (Agricultural region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Miguel García',
    'TEST-ES-001',
    '+34 654 321 987',
    'ES12345678A',
    v_chef_planteur_id,
    v_cooperative_id,
    37.3891,  -- Córdoba
    -5.9845,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_5;
  
  -- Planteur 6: Spain - Valencia (Citrus and agriculture)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Carmen López',
    'TEST-ES-002',
    '+34 612 345 678',
    'ES87654321B',
    v_chef_planteur_id,
    v_cooperative_id,
    39.4699,  -- Valencia
    -0.3763,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_6;
  
  -- Planteur 7: Italy - Sicily (Agricultural region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Giuseppe Rossi',
    'TEST-IT-001',
    '+39 320 123 4567',
    'IT123456789',
    v_chef_planteur_id,
    v_cooperative_id,
    37.5079,  -- Catania
    15.0830,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_7;
  
  -- Planteur 8: Italy - Tuscany (Agricultural region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Francesca Bianchi',
    'TEST-IT-002',
    '+39 345 678 9012',
    'IT987654321',
    v_chef_planteur_id,
    v_cooperative_id,
    43.7696,  -- Florence
    11.2558,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_8;
  
  -- Planteur 9: Indonesia - Sulawesi (Cocoa region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Budi Santoso',
    'TEST-ID-001',
    '+62 812 3456 7890',
    'ID123456789',
    v_chef_planteur_id,
    v_cooperative_id,
    -0.8917,  -- Palu
    119.8707,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_9;
  
  -- Planteur 10: Indonesia - Sumatra (Agricultural region)
  INSERT INTO planteurs (name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
  VALUES (
    'Siti Nurhaliza',
    'TEST-ID-002',
    '+62 813 9876 5432',
    'ID987654321',
    v_chef_planteur_id,
    v_cooperative_id,
    -0.9471,  -- Padang
    100.4172,
    true,
    v_created_by
  )
  RETURNING id INTO v_planteur_10;
  
  RAISE NOTICE 'Created 10 test planteurs';
  
  -- ============================================================================
  -- STEP 3: Create Test Parcelles with realistic geometries
  -- ============================================================================
  
  -- Parcelle 1: Brazil Amazon - Dense forest (for deforestation testing)
  -- Location: Near Manaus, ~5 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_1,
    'PAR-BR-001',
    'Fazenda Floresta',
    'Manaus',
    ST_Multi(ST_GeomFromText('POLYGON((-60.0217 -3.1190, -60.0207 -3.1190, -60.0207 -3.1180, -60.0217 -3.1180, -60.0217 -3.1190))', 4326)),
    5.2,
    ARRAY['organic'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 2: Brazil Amazon - Mixed vegetation
  -- Location: Near Manaus, ~3 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_1,
    'PAR-BR-002',
    'Fazenda Verde',
    'Manaus',
    ST_Multi(ST_GeomFromText('POLYGON((-60.0300 -3.1250, -60.0290 -3.1250, -60.0290 -3.1240, -60.0300 -3.1240, -60.0300 -3.1250))', 4326)),
    3.1,
    ARRAY['rainforest_alliance'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 3: Brazil Pará - Deforestation risk area
  -- Location: Santarém region, ~8 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_2,
    'PAR-BR-003',
    'Sítio Esperança',
    'Santarém',
    ST_Multi(ST_GeomFromText('POLYGON((-54.7089 -2.5297, -54.7079 -2.5297, -54.7079 -2.5285, -54.7089 -2.5285, -54.7089 -2.5297))', 4326)),
    8.5,
    ARRAY['fairtrade'],
    'en_cours',
    'manual',
    v_created_by
  );
  
  -- Parcelle 4: Ecuador - Cocoa plantation
  -- Location: Esmeraldas, ~4 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_3,
    'PAR-EC-001',
    'Finca Cacao Fino',
    'Esmeraldas',
    ST_Multi(ST_GeomFromText('POLYGON((-79.6518 0.9681, -79.6508 0.9681, -79.6508 0.9691, -79.6518 0.9691, -79.6518 0.9681))', 4326)),
    4.2,
    ARRAY['organic', 'fairtrade'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 5: Ecuador - Young cocoa plantation
  -- Location: Los Ríos, ~6 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_4,
    'PAR-EC-002',
    'Hacienda Arriba',
    'Quevedo',
    ST_Multi(ST_GeomFromText('POLYGON((-79.4608 -1.0569, -79.4598 -1.0569, -79.4598 -1.0557, -79.4608 -1.0557, -79.4608 -1.0569))', 4326)),
    6.3,
    ARRAY['rainforest_alliance'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 6: Spain - Olive grove (for comparison)
  -- Location: Córdoba, ~10 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_5,
    'PAR-ES-001',
    'Olivar del Sol',
    'Córdoba',
    ST_Multi(ST_GeomFromText('POLYGON((-5.9845 37.3891, -5.9835 37.3891, -5.9835 37.3901, -5.9845 37.3901, -5.9845 37.3891))', 4326)),
    10.5,
    ARRAY['organic'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 7: Spain - Citrus grove
  -- Location: Valencia, ~7 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_6,
    'PAR-ES-002',
    'Naranjal Valencia',
    'Valencia',
    ST_Multi(ST_GeomFromText('POLYGON((-0.3763 39.4699, -0.3753 39.4699, -0.3753 39.4709, -0.3763 39.4709, -0.3763 39.4699))', 4326)),
    7.8,
    ARRAY['bio'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 8: Italy - Vineyard
  -- Location: Sicily, ~5 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_7,
    'PAR-IT-001',
    'Vigneto Etna',
    'Catania',
    ST_Multi(ST_GeomFromText('POLYGON((15.0830 37.5079, 15.0840 37.5079, 15.0840 37.5089, 15.0830 37.5089, 15.0830 37.5079))', 4326)),
    5.6,
    ARRAY['organic'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 9: Italy - Agricultural land
  -- Location: Tuscany, ~12 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_8,
    'PAR-IT-002',
    'Podere Toscano',
    'Florence',
    ST_Multi(ST_GeomFromText('POLYGON((11.2558 43.7696, 11.2568 43.7696, 11.2568 43.7706, 11.2558 43.7706, 11.2558 43.7696))', 4326)),
    12.3,
    ARRAY['bio'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 10: Indonesia - Cocoa plantation
  -- Location: Sulawesi, ~4 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_9,
    'PAR-ID-001',
    'Kebun Kakao',
    'Palu',
    ST_Multi(ST_GeomFromText('POLYGON((119.8707 -0.8917, 119.8717 -0.8917, 119.8717 -0.8907, 119.8707 -0.8907, 119.8707 -0.8917))', 4326)),
    4.5,
    ARRAY['rainforest_alliance'],
    'conforme',
    'manual',
    v_created_by
  );
  
  -- Parcelle 11: Indonesia - Palm oil/cocoa mix
  -- Location: Sumatra, ~9 hectares
  INSERT INTO parcelles (
    planteur_id, code, label, village, geometry, surface_hectares, 
    certifications, conformity_status, source, created_by
  )
  VALUES (
    v_planteur_10,
    'PAR-ID-002',
    'Perkebunan Hijau',
    'Padang',
    ST_Multi(ST_GeomFromText('POLYGON((100.4172 -0.9471, 100.4182 -0.9471, 100.4182 -0.9461, 100.4172 -0.9461, 100.4172 -0.9471))', 4326)),
    9.2,
    ARRAY['fairtrade'],
    'conforme',
    'manual',
    v_created_by
  );
  
  RAISE NOTICE 'Created 11 test parcelles across different regions';
  RAISE NOTICE '✅ Test data creation complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - 10 planteurs created';
  RAISE NOTICE '  - 11 parcelles created';
  RAISE NOTICE '  - Regions: Brazil (3), Ecuador (2), Spain (2), Italy (2), Indonesia (2)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Navigate to the parcelles page in CocoaTrack';
  RAISE NOTICE '  2. Search for codes starting with "TEST-"';
  RAISE NOTICE '  3. Click on any parcelle to view satellite imagery';
  RAISE NOTICE '  4. Test NDVI calculation, temporal analysis, and deforestation detection';
  
END $$;
