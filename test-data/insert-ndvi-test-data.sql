-- ============================================================================
-- INSERT NDVI TEST DATA FOR TEMPORAL ANALYSIS
-- ============================================================================
-- This script inserts 13 months of realistic NDVI data for your test parcelles
-- so that the temporal analysis, trend charts, and deforestation detection work.
--
-- Usage:
--   1. Open Supabase SQL Editor
--   2. Paste and run this script
--   3. Then open any parcelle and click "Analyse temporelle"
-- ============================================================================

DO $$
DECLARE
  -- We'll find the parcelle IDs dynamically
  v_parcelle_id UUID;
  v_parcelle_ids UUID[];
  v_pid UUID;
  
  -- Base date: 13 months ago
  v_base_date TIMESTAMPTZ;
  
  -- NDVI values for each scenario
  v_mean_ndvi DECIMAL(5,4);
  v_min_ndvi  DECIMAL(5,4);
  v_max_ndvi  DECIMAL(5,4);
  v_std_dev   DECIMAL(5,4);
  v_status    TEXT;
  v_month     INT;
  
BEGIN
  v_base_date := NOW() - INTERVAL '13 months';
  
  -- ============================================================================
  -- Get all test parcelles (codes starting with PAR-BR, PAR-EC, PAR-ES, PAR-IT, PAR-ID)
  -- Also include any parcelle that has no NDVI data yet
  -- ============================================================================
  
  SELECT ARRAY_AGG(id) INTO v_parcelle_ids
  FROM parcelles
  WHERE code LIKE 'PAR-%-TEST' OR code LIKE 'PAR-BR-%' OR code LIKE 'PAR-EC-%' 
     OR code LIKE 'PAR-ES-%' OR code LIKE 'PAR-IT-%' OR code LIKE 'PAR-ID-%';
  
  -- If no test parcelles found, use the first 3 parcelles in the database
  IF v_parcelle_ids IS NULL OR array_length(v_parcelle_ids, 1) = 0 THEN
    SELECT ARRAY_AGG(id) INTO v_parcelle_ids
    FROM (SELECT id FROM parcelles ORDER BY created_at DESC LIMIT 3) sub;
    RAISE NOTICE 'No TEST parcelles found, using 3 most recent parcelles';
  END IF;
  
  IF v_parcelle_ids IS NULL OR array_length(v_parcelle_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No parcelles found in database. Please create parcelles first.';
  END IF;
  
  RAISE NOTICE 'Inserting NDVI data for % parcelles', array_length(v_parcelle_ids, 1);
  
  -- ============================================================================
  -- Loop over each parcelle and insert 13 months of NDVI data
  -- ============================================================================
  
  FOREACH v_pid IN ARRAY v_parcelle_ids
  LOOP
    RAISE NOTICE 'Processing parcelle: %', v_pid;
    
    -- Insert one NDVI record per month for the past 13 months
    FOR v_month IN 0..12
    LOOP
      -- Generate realistic NDVI values with seasonal variation
      -- Pattern: starts moderate, dips in dry season (months 3-5), recovers
      CASE
        WHEN v_month = 0  THEN v_mean_ndvi := 0.62; -- May 2025
        WHEN v_month = 1  THEN v_mean_ndvi := 0.65; -- Jun 2025
        WHEN v_month = 2  THEN v_mean_ndvi := 0.68; -- Jul 2025
        WHEN v_month = 3  THEN v_mean_ndvi := 0.71; -- Aug 2025 (peak)
        WHEN v_month = 4  THEN v_mean_ndvi := 0.69; -- Sep 2025
        WHEN v_month = 5  THEN v_mean_ndvi := 0.64; -- Oct 2025
        WHEN v_month = 6  THEN v_mean_ndvi := 0.55; -- Nov 2025 (dry season starts)
        WHEN v_month = 7  THEN v_mean_ndvi := 0.48; -- Dec 2025 (dry season)
        WHEN v_month = 8  THEN v_mean_ndvi := 0.44; -- Jan 2026 (dry season)
        WHEN v_month = 9  THEN v_mean_ndvi := 0.46; -- Feb 2026
        WHEN v_month = 10 THEN v_mean_ndvi := 0.52; -- Mar 2026 (recovery)
        WHEN v_month = 11 THEN v_mean_ndvi := 0.59; -- Apr 2026
        WHEN v_month = 12 THEN v_mean_ndvi := 0.63; -- May 2026 (current)
        ELSE v_mean_ndvi := 0.60;
      END CASE;
      
      -- Add slight variation per parcelle based on its ID hash
      -- This makes each parcelle slightly different
      v_mean_ndvi := GREATEST(-0.9999, LEAST(0.9999, 
        v_mean_ndvi + (('x' || substr(v_pid::text, 1, 8))::bit(32)::int % 10 - 5) * 0.01
      ));
      
      -- Calculate min/max/stddev from mean
      v_min_ndvi  := GREATEST(-0.9999, v_mean_ndvi - 0.15);
      v_max_ndvi  := LEAST(0.9999, v_mean_ndvi + 0.12);
      v_std_dev   := 0.08;
      
      -- Determine health status from mean NDVI
      v_status := CASE
        WHEN v_mean_ndvi >= 0.70 THEN 'excellent'
        WHEN v_mean_ndvi >= 0.60 THEN 'good'
        WHEN v_mean_ndvi >= 0.50 THEN 'fair'
        WHEN v_mean_ndvi >= 0.30 THEN 'poor'
        ELSE 'critical'
      END;
      
      -- Insert the NDVI record (skip if already exists)
      INSERT INTO ndvi_results (
        parcelle_id,
        calculation_date,
        mean_ndvi,
        min_ndvi,
        max_ndvi,
        std_dev_ndvi,
        health_status
      )
      VALUES (
        v_pid,
        v_base_date + (v_month || ' months')::INTERVAL,
        v_mean_ndvi,
        v_min_ndvi,
        v_max_ndvi,
        v_std_dev,
        v_status
      )
      ON CONFLICT (parcelle_id, calculation_date) DO NOTHING;
      
    END LOOP;
    
    RAISE NOTICE '  ✅ Inserted 13 months of NDVI data for parcelle %', v_pid;
  END LOOP;
  
  -- ============================================================================
  -- Also insert for the specific parcelle from the logs if it exists
  -- parcelleId: 2309c3d8-2c10-4a7a-b740-8bfa064d0260
  -- ============================================================================
  
  SELECT id INTO v_parcelle_id
  FROM parcelles
  WHERE id = '2309c3d8-2c10-4a7a-b740-8bfa064d0260';
  
  IF v_parcelle_id IS NOT NULL THEN
    RAISE NOTICE 'Also inserting for specific parcelle from logs: %', v_parcelle_id;
    
    FOR v_month IN 0..12
    LOOP
      CASE
        WHEN v_month = 0  THEN v_mean_ndvi := 0.62;
        WHEN v_month = 1  THEN v_mean_ndvi := 0.65;
        WHEN v_month = 2  THEN v_mean_ndvi := 0.68;
        WHEN v_month = 3  THEN v_mean_ndvi := 0.71;
        WHEN v_month = 4  THEN v_mean_ndvi := 0.69;
        WHEN v_month = 5  THEN v_mean_ndvi := 0.64;
        WHEN v_month = 6  THEN v_mean_ndvi := 0.55;
        WHEN v_month = 7  THEN v_mean_ndvi := 0.48;
        WHEN v_month = 8  THEN v_mean_ndvi := 0.44;
        WHEN v_month = 9  THEN v_mean_ndvi := 0.46;
        WHEN v_month = 10 THEN v_mean_ndvi := 0.52;
        WHEN v_month = 11 THEN v_mean_ndvi := 0.59;
        WHEN v_month = 12 THEN v_mean_ndvi := 0.63;
        ELSE v_mean_ndvi := 0.60;
      END CASE;
      
      v_min_ndvi := GREATEST(-0.9999, v_mean_ndvi - 0.15);
      v_max_ndvi := LEAST(0.9999, v_mean_ndvi + 0.12);
      v_std_dev  := 0.08;
      
      v_status := CASE
        WHEN v_mean_ndvi >= 0.70 THEN 'excellent'
        WHEN v_mean_ndvi >= 0.60 THEN 'good'
        WHEN v_mean_ndvi >= 0.50 THEN 'fair'
        WHEN v_mean_ndvi >= 0.30 THEN 'poor'
        ELSE 'critical'
      END;
      
      INSERT INTO ndvi_results (
        parcelle_id,
        calculation_date,
        mean_ndvi,
        min_ndvi,
        max_ndvi,
        std_dev_ndvi,
        health_status
      )
      VALUES (
        v_parcelle_id,
        v_base_date + (v_month || ' months')::INTERVAL,
        v_mean_ndvi,
        v_min_ndvi,
        v_max_ndvi,
        v_std_dev,
        v_status
      )
      ON CONFLICT (parcelle_id, calculation_date) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '  ✅ Inserted NDVI data for parcelle from logs';
  END IF;
  
  -- ============================================================================
  -- Summary
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ NDVI test data insertion complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Data inserted:';
  RAISE NOTICE '  - 13 months of NDVI data per parcelle (May 2025 → May 2026)';
  RAISE NOTICE '  - Seasonal pattern: peak in Aug 2025, dip in Jan 2026, recovery in May 2026';
  RAISE NOTICE '  - Health statuses: excellent → good → fair → poor → fair → good';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify with:';
  RAISE NOTICE '  SELECT parcelle_id, COUNT(*), MIN(calculation_date), MAX(calculation_date)';
  RAISE NOTICE '  FROM ndvi_results GROUP BY parcelle_id;';
  RAISE NOTICE '';
  RAISE NOTICE 'Now open any parcelle and click "Analyse temporelle" — it should work!';
  
END $$;

-- ============================================================================
-- Quick verification query
-- ============================================================================
SELECT 
  p.code,
  p.label,
  COUNT(n.id) AS ndvi_count,
  MIN(n.calculation_date)::date AS first_date,
  MAX(n.calculation_date)::date AS last_date,
  ROUND(AVG(n.mean_ndvi)::numeric, 3) AS avg_ndvi,
  MODE() WITHIN GROUP (ORDER BY n.health_status) AS most_common_status
FROM parcelles p
JOIN ndvi_results n ON n.parcelle_id = p.id
GROUP BY p.id, p.code, p.label
ORDER BY p.code;
