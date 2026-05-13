-- Migration: Optimize satellite database queries
-- Description: Add missing indexes, create materialized views, and optimize complex queries
-- Date: 2026-05-10

SET search_path = public;

-- ============================================================================
-- PART 1: Add Missing Composite Indexes for Common Query Patterns
-- ============================================================================

-- Composite index for temporal queries (parcelle + date range)
CREATE INDEX IF NOT EXISTS idx_ndvi_results_parcelle_date_composite 
  ON ndvi_results(parcelle_id, calculation_date DESC);

-- Composite index for filtering by health status and date
CREATE INDEX IF NOT EXISTS idx_ndvi_results_health_date_composite 
  ON ndvi_results(health_status, calculation_date DESC);

-- Composite index for satellite imagery queries (parcelle + date + cloud cover)
CREATE INDEX IF NOT EXISTS idx_satellite_imagery_parcelle_date_cloud 
  ON satellite_imagery(parcelle_id, acquisition_date DESC, cloud_cover_percent);

-- Composite index for deforestation events by status and date
CREATE INDEX IF NOT EXISTS idx_deforestation_events_status_date 
  ON deforestation_events(status, detection_date DESC);

-- Composite index for deforestation events by parcelle and status
CREATE INDEX IF NOT EXISTS idx_deforestation_events_parcelle_status 
  ON deforestation_events(parcelle_id, status);

-- Composite index for audit logs (user + event type + date)
CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_composite 
  ON satellite_audit_logs(user_id, event_type, created_at DESC);

-- Partial index for pending deforestation alerts (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_deforestation_events_pending 
  ON deforestation_events(parcelle_id, detection_date DESC) 
  WHERE status = 'pending';

-- Partial index for recent NDVI results (last 90 days - most frequently accessed)
CREATE INDEX IF NOT EXISTS idx_ndvi_results_recent 
  ON ndvi_results(parcelle_id, calculation_date DESC) 
  WHERE calculation_date > NOW() - INTERVAL '90 days';

-- Partial index for critical health status (requires immediate attention)
CREATE INDEX IF NOT EXISTS idx_ndvi_results_critical 
  ON ndvi_results(parcelle_id, calculation_date DESC) 
  WHERE health_status = 'critical';

-- ============================================================================
-- PART 2: Create Materialized Views for Complex Aggregations
-- ============================================================================

-- Materialized view: Latest NDVI results per parcelle
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_latest_ndvi_per_parcelle AS
SELECT DISTINCT ON (parcelle_id)
  parcelle_id,
  calculation_date,
  mean_ndvi,
  health_status,
  ndvi_raster_url,
  created_at
FROM ndvi_results
ORDER BY parcelle_id, calculation_date DESC;

-- Create unique index on materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_latest_ndvi_parcelle 
  ON mv_latest_ndvi_per_parcelle(parcelle_id);

-- Create index on health status for filtering
CREATE INDEX IF NOT EXISTS idx_mv_latest_ndvi_health_status 
  ON mv_latest_ndvi_per_parcelle(health_status);

-- Materialized view: Parcelle health summary with statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_parcelle_health_summary AS
SELECT 
  p.id AS parcelle_id,
  p.nom AS parcelle_nom,
  p.cooperative_id,
  p.planteur_id,
  ln.mean_ndvi AS latest_mean_ndvi,
  ln.health_status AS latest_health_status,
  ln.calculation_date AS latest_calculation_date,
  COUNT(DISTINCT nr.id) AS total_ndvi_calculations,
  AVG(nr.mean_ndvi) AS avg_ndvi_all_time,
  MIN(nr.mean_ndvi) AS min_ndvi_all_time,
  MAX(nr.mean_ndvi) AS max_ndvi_all_time,
  COUNT(DISTINCT de.id) FILTER (WHERE de.status = 'pending') AS pending_deforestation_alerts,
  COUNT(DISTINCT de.id) AS total_deforestation_events
FROM parcelles p
LEFT JOIN mv_latest_ndvi_per_parcelle ln ON ln.parcelle_id = p.id
LEFT JOIN ndvi_results nr ON nr.parcelle_id = p.id
LEFT JOIN deforestation_events de ON de.parcelle_id = p.id
GROUP BY p.id, p.nom, p.cooperative_id, p.planteur_id, ln.mean_ndvi, ln.health_status, ln.calculation_date;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_parcelle_health_summary_parcelle 
  ON mv_parcelle_health_summary(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_mv_parcelle_health_summary_cooperative 
  ON mv_parcelle_health_summary(cooperative_id);

CREATE INDEX IF NOT EXISTS idx_mv_parcelle_health_summary_planteur 
  ON mv_parcelle_health_summary(planteur_id);

CREATE INDEX IF NOT EXISTS idx_mv_parcelle_health_summary_health_status 
  ON mv_parcelle_health_summary(latest_health_status);

-- Materialized view: Deforestation alerts summary by cooperative
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deforestation_alerts_by_cooperative AS
SELECT 
  p.cooperative_id,
  COUNT(DISTINCT de.id) FILTER (WHERE de.status = 'pending') AS pending_alerts,
  COUNT(DISTINCT de.id) FILTER (WHERE de.status = 'acknowledged') AS acknowledged_alerts,
  COUNT(DISTINCT de.id) FILTER (WHERE de.status = 'disputed') AS disputed_alerts,
  COUNT(DISTINCT de.id) FILTER (WHERE de.status = 'resolved') AS resolved_alerts,
  COUNT(DISTINCT de.id) AS total_alerts,
  SUM(de.affected_area_hectares) AS total_affected_area_hectares,
  AVG(de.affected_area_percent) AS avg_affected_area_percent,
  MAX(de.detection_date) AS latest_detection_date
FROM deforestation_events de
JOIN parcelles p ON p.id = de.parcelle_id
GROUP BY p.cooperative_id;

-- Create indexes on deforestation alerts materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_deforestation_alerts_cooperative 
  ON mv_deforestation_alerts_by_cooperative(cooperative_id);

-- ============================================================================
-- PART 3: Create Functions for Efficient Queries
-- ============================================================================

-- Function: Get latest NDVI for a parcelle (uses materialized view)
CREATE OR REPLACE FUNCTION get_latest_ndvi(p_parcelle_id UUID)
RETURNS TABLE (
  calculation_date TIMESTAMPTZ,
  mean_ndvi DECIMAL,
  health_status TEXT,
  ndvi_raster_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mv.calculation_date,
    mv.mean_ndvi,
    mv.health_status,
    mv.ndvi_raster_url
  FROM mv_latest_ndvi_per_parcelle mv
  WHERE mv.parcelle_id = p_parcelle_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get NDVI trend for a parcelle (optimized with date range)
CREATE OR REPLACE FUNCTION get_ndvi_trend(
  p_parcelle_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '3 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  calculation_date TIMESTAMPTZ,
  mean_ndvi DECIMAL,
  health_status TEXT,
  change_from_previous DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH ndvi_with_lag AS (
    SELECT 
      nr.calculation_date,
      nr.mean_ndvi,
      nr.health_status,
      LAG(nr.mean_ndvi) OVER (ORDER BY nr.calculation_date) AS previous_ndvi
    FROM ndvi_results nr
    WHERE nr.parcelle_id = p_parcelle_id
      AND nr.calculation_date BETWEEN p_start_date AND p_end_date
    ORDER BY nr.calculation_date
  )
  SELECT 
    nwl.calculation_date,
    nwl.mean_ndvi,
    nwl.health_status,
    CASE 
      WHEN nwl.previous_ndvi IS NOT NULL 
      THEN nwl.mean_ndvi - nwl.previous_ndvi
      ELSE NULL
    END AS change_from_previous
  FROM ndvi_with_lag nwl;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get parcelles by health status with pagination
CREATE OR REPLACE FUNCTION get_parcelles_by_health_status(
  p_health_status TEXT,
  p_cooperative_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  parcelle_id UUID,
  parcelle_nom TEXT,
  cooperative_id UUID,
  planteur_id UUID,
  latest_mean_ndvi DECIMAL,
  latest_health_status TEXT,
  latest_calculation_date TIMESTAMPTZ,
  total_ndvi_calculations BIGINT,
  pending_deforestation_alerts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    phs.parcelle_id,
    phs.parcelle_nom,
    phs.cooperative_id,
    phs.planteur_id,
    phs.latest_mean_ndvi,
    phs.latest_health_status,
    phs.latest_calculation_date,
    phs.total_ndvi_calculations,
    phs.pending_deforestation_alerts
  FROM mv_parcelle_health_summary phs
  WHERE phs.latest_health_status = p_health_status
    AND (p_cooperative_id IS NULL OR phs.cooperative_id = p_cooperative_id)
  ORDER BY phs.latest_calculation_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get pending deforestation alerts with pagination
CREATE OR REPLACE FUNCTION get_pending_deforestation_alerts(
  p_cooperative_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  alert_id UUID,
  parcelle_id UUID,
  detection_date TIMESTAMPTZ,
  baseline_ndvi DECIMAL,
  current_ndvi DECIMAL,
  ndvi_change DECIMAL,
  affected_area_hectares DECIMAL,
  affected_area_percent DECIMAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id AS alert_id,
    de.parcelle_id,
    de.detection_date,
    de.baseline_ndvi,
    de.current_ndvi,
    de.ndvi_change,
    de.affected_area_hectares,
    de.affected_area_percent,
    de.created_at
  FROM deforestation_events de
  JOIN parcelles p ON p.id = de.parcelle_id
  WHERE de.status = 'pending'
    AND (p_cooperative_id IS NULL OR p.cooperative_id = p_cooperative_id)
  ORDER BY de.detection_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get temporal NDVI data with monthly aggregation
CREATE OR REPLACE FUNCTION get_temporal_ndvi_monthly(
  p_parcelle_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  month DATE,
  avg_mean_ndvi DECIMAL,
  min_mean_ndvi DECIMAL,
  max_mean_ndvi DECIMAL,
  data_points INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', nr.calculation_date)::DATE AS month,
    AVG(nr.mean_ndvi)::DECIMAL(5,4) AS avg_mean_ndvi,
    MIN(nr.mean_ndvi)::DECIMAL(5,4) AS min_mean_ndvi,
    MAX(nr.mean_ndvi)::DECIMAL(5,4) AS max_mean_ndvi,
    COUNT(*)::INT AS data_points
  FROM ndvi_results nr
  WHERE nr.parcelle_id = p_parcelle_id
    AND nr.calculation_date BETWEEN p_start_date AND p_end_date
  GROUP BY DATE_TRUNC('month', nr.calculation_date)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 4: Create Triggers for Automatic Materialized View Refresh
-- ============================================================================

-- Function to refresh latest NDVI materialized view
CREATE OR REPLACE FUNCTION refresh_mv_latest_ndvi()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_ndvi_per_parcelle;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on NDVI insert/update
CREATE TRIGGER trigger_refresh_mv_latest_ndvi_on_insert
  AFTER INSERT OR UPDATE ON ndvi_results
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_mv_latest_ndvi();

-- Function to refresh parcelle health summary materialized view
CREATE OR REPLACE FUNCTION refresh_mv_parcelle_health_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_parcelle_health_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on NDVI changes
CREATE TRIGGER trigger_refresh_mv_parcelle_health_on_ndvi
  AFTER INSERT OR UPDATE OR DELETE ON ndvi_results
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_mv_parcelle_health_summary();

-- Trigger to refresh on deforestation event changes
CREATE TRIGGER trigger_refresh_mv_parcelle_health_on_deforestation
  AFTER INSERT OR UPDATE OR DELETE ON deforestation_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_mv_parcelle_health_summary();

-- Function to refresh deforestation alerts materialized view
CREATE OR REPLACE FUNCTION refresh_mv_deforestation_alerts()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deforestation_alerts_by_cooperative;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on deforestation event changes
CREATE TRIGGER trigger_refresh_mv_deforestation_alerts
  AFTER INSERT OR UPDATE OR DELETE ON deforestation_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_mv_deforestation_alerts();

-- ============================================================================
-- PART 5: Add Query Result Caching Table
-- ============================================================================

-- Create table for caching expensive query results
CREATE TABLE IF NOT EXISTS satellite_query_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL UNIQUE,
  query_type TEXT NOT NULL CHECK (query_type IN (
    'temporal_ndvi',
    'health_summary',
    'deforestation_summary',
    'cooperative_stats',
    'parcelle_trend'
  )),
  result_data JSONB NOT NULL,
  parameters JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INT NOT NULL DEFAULT 1
);

-- Create indexes for cache lookups
CREATE INDEX IF NOT EXISTS idx_satellite_query_cache_key 
  ON satellite_query_cache(cache_key);

CREATE INDEX IF NOT EXISTS idx_satellite_query_cache_type 
  ON satellite_query_cache(query_type);

CREATE INDEX IF NOT EXISTS idx_satellite_query_cache_expires 
  ON satellite_query_cache(expires_at);

-- Function to get or set cached query result
CREATE OR REPLACE FUNCTION get_cached_query_result(
  p_cache_key TEXT,
  p_query_type TEXT,
  p_ttl_seconds INT DEFAULT 3600
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Try to get cached result
  SELECT result_data, expires_at INTO v_result, v_expires_at
  FROM satellite_query_cache
  WHERE cache_key = p_cache_key
    AND expires_at > NOW();
  
  -- Update access statistics if found
  IF FOUND THEN
    UPDATE satellite_query_cache
    SET last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE cache_key = p_cache_key;
    
    RETURN v_result;
  END IF;
  
  -- Return NULL if not found or expired
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to set cached query result
CREATE OR REPLACE FUNCTION set_cached_query_result(
  p_cache_key TEXT,
  p_query_type TEXT,
  p_result_data JSONB,
  p_parameters JSONB,
  p_ttl_seconds INT DEFAULT 3600
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO satellite_query_cache (
    cache_key,
    query_type,
    result_data,
    parameters,
    expires_at
  ) VALUES (
    p_cache_key,
    p_query_type,
    p_result_data,
    p_parameters,
    NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
  )
  ON CONFLICT (cache_key) DO UPDATE
  SET result_data = EXCLUDED.result_data,
      parameters = EXCLUDED.parameters,
      expires_at = EXCLUDED.expires_at,
      last_accessed_at = NOW(),
      access_count = satellite_query_cache.access_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache by pattern
CREATE OR REPLACE FUNCTION invalidate_query_cache(
  p_query_type TEXT DEFAULT NULL,
  p_cache_key_pattern TEXT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM satellite_query_cache
  WHERE (p_query_type IS NULL OR query_type = p_query_type)
    AND (p_cache_key_pattern IS NULL OR cache_key LIKE p_cache_key_pattern);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: Add Table Statistics and Analyze
-- ============================================================================

-- Update table statistics for query planner
ANALYZE satellite_imagery;
ANALYZE ndvi_results;
ANALYZE deforestation_events;
ANALYZE yield_predictions;
ANALYZE satellite_cache_metadata;
ANALYZE satellite_audit_logs;

-- ============================================================================
-- PART 7: Add Comments for Documentation
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_latest_ndvi_per_parcelle IS 
  'Materialized view containing the most recent NDVI result for each parcelle. Refreshed automatically on NDVI insert/update.';

COMMENT ON MATERIALIZED VIEW mv_parcelle_health_summary IS 
  'Materialized view containing comprehensive health statistics for each parcelle including latest NDVI, historical averages, and deforestation alerts. Refreshed automatically on NDVI or deforestation event changes.';

COMMENT ON MATERIALIZED VIEW mv_deforestation_alerts_by_cooperative IS 
  'Materialized view containing deforestation alert statistics aggregated by cooperative. Refreshed automatically on deforestation event changes.';

COMMENT ON TABLE satellite_query_cache IS 
  'Cache table for storing expensive query results with TTL-based expiration and access tracking.';

COMMENT ON FUNCTION get_latest_ndvi(UUID) IS 
  'Efficiently retrieves the latest NDVI result for a parcelle using materialized view.';

COMMENT ON FUNCTION get_ndvi_trend(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Retrieves NDVI trend data with change calculations for a parcelle within a date range.';

COMMENT ON FUNCTION get_parcelles_by_health_status(TEXT, UUID, INT, INT) IS 
  'Retrieves parcelles filtered by health status with pagination support. Uses materialized view for performance.';

COMMENT ON FUNCTION get_pending_deforestation_alerts(UUID, INT, INT) IS 
  'Retrieves pending deforestation alerts with pagination support. Uses partial index for performance.';

COMMENT ON FUNCTION get_temporal_ndvi_monthly(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Retrieves NDVI data aggregated by month for temporal analysis.';

COMMENT ON FUNCTION get_cached_query_result(TEXT, TEXT, INT) IS 
  'Retrieves cached query result if available and not expired. Updates access statistics.';

COMMENT ON FUNCTION set_cached_query_result(TEXT, TEXT, JSONB, JSONB, INT) IS 
  'Stores query result in cache with TTL-based expiration.';

COMMENT ON FUNCTION invalidate_query_cache(TEXT, TEXT) IS 
  'Invalidates cached query results by query type or cache key pattern.';
