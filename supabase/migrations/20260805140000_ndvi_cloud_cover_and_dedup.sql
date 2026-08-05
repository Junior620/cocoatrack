-- Cloud cover / imagery quality on ndvi_results + same-month deduplication.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS cloud_cover DECIMAL(5,2)
    CHECK (cloud_cover IS NULL OR (cloud_cover >= 0 AND cloud_cover <= 100)),
  ADD COLUMN IF NOT EXISTS imagery_quality TEXT
    CHECK (imagery_quality IS NULL OR imagery_quality IN ('good', 'acceptable', 'degraded'));

COMMENT ON COLUMN public.ndvi_results.cloud_cover IS
  'Sentinel-2 CLOUDY_PIXEL_PERCENTAGE (0–100) for the image used.';
COMMENT ON COLUMN public.ndvi_results.imagery_quality IS
  'good: cloud < 80%; acceptable: 80–95% fallback; degraded: cloud >= 95% or unknown high.';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_cloud_cover
  ON public.ndvi_results(cloud_cover)
  WHERE cloud_cover IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dedupe_ndvi_results_by_month(
  p_parcelle_id UUID DEFAULT NULL
)
RETURNS TABLE(parcelle_id UUID, months_cleaned INT, rows_deleted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_month TIMESTAMPTZ;
  v_keeper_id UUID;
  v_donor_mean NUMERIC;
  v_donor_min NUMERIC;
  v_donor_max NUMERIC;
  v_donor_std NUMERIC;
  v_donor_cloud NUMERIC;
  v_donor_quality TEXT;
  v_del INT;
  v_months INT;
  v_deleted INT;
BEGIN
  FOR r IN
    SELECT DISTINCT nr.parcelle_id AS pid
    FROM public.ndvi_results nr
    WHERE p_parcelle_id IS NULL OR nr.parcelle_id = p_parcelle_id
  LOOP
    v_months := 0;
    v_deleted := 0;

    FOR v_month IN
      SELECT date_trunc('month', calculation_date AT TIME ZONE 'UTC') AS m
      FROM public.ndvi_results
      WHERE public.ndvi_results.parcelle_id = r.pid
      GROUP BY 1
      HAVING COUNT(*) > 1
    LOOP
      v_months := v_months + 1;

      SELECT id INTO v_keeper_id
      FROM public.ndvi_results
      WHERE public.ndvi_results.parcelle_id = r.pid
        AND date_trunc('month', calculation_date AT TIME ZONE 'UTC') = v_month
      ORDER BY
        (mean_evi IS NOT NULL) DESC,
        (acquisition_date IS NOT NULL) DESC,
        calculation_date DESC
      LIMIT 1;

      SELECT mean_evi, min_evi, max_evi, std_dev_evi, cloud_cover, imagery_quality
      INTO v_donor_mean, v_donor_min, v_donor_max, v_donor_std, v_donor_cloud, v_donor_quality
      FROM public.ndvi_results
      WHERE public.ndvi_results.parcelle_id = r.pid
        AND date_trunc('month', calculation_date AT TIME ZONE 'UTC') = v_month
        AND mean_evi IS NOT NULL
      ORDER BY (acquisition_date IS NOT NULL) DESC, calculation_date DESC
      LIMIT 1;

      IF v_donor_mean IS NOT NULL THEN
        UPDATE public.ndvi_results
        SET
          mean_evi = COALESCE(mean_evi, v_donor_mean),
          min_evi = COALESCE(min_evi, v_donor_min, v_donor_mean),
          max_evi = COALESCE(max_evi, v_donor_max, v_donor_mean),
          std_dev_evi = COALESCE(std_dev_evi, v_donor_std, 0),
          cloud_cover = COALESCE(cloud_cover, v_donor_cloud),
          imagery_quality = COALESCE(imagery_quality, v_donor_quality)
        WHERE id = v_keeper_id;
      END IF;

      DELETE FROM public.ndvi_results
      WHERE public.ndvi_results.parcelle_id = r.pid
        AND id <> v_keeper_id
        AND date_trunc('month', calculation_date AT TIME ZONE 'UTC') = v_month;

      GET DIAGNOSTICS v_del = ROW_COUNT;
      v_deleted := v_deleted + v_del;
    END LOOP;

    parcelle_id := r.pid;
    months_cleaned := v_months;
    rows_deleted := v_deleted;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.dedupe_ndvi_results_by_month(UUID) IS
  'Keeps one ndvi_results row per UTC month per parcelle; merges EVI/cloud onto keeper; deletes siblings.';

GRANT EXECUTE ON FUNCTION public.dedupe_ndvi_results_by_month(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dedupe_ndvi_results_by_month(UUID) TO service_role;
