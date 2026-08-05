-- Migration: Add NDWI (Normalized Difference Water Index, McFeeters) to ndvi_results
-- Formula: NDWI = (Green - NIR) / (Green + NIR)
-- Sentinel-2 bands: B3 (Green 10m), B8 (NIR 10m)
-- Complements NDMI (foliar moisture): NDWI ≈ surface water / wet areas.
-- Columns nullable so existing rows remain valid until recalculated.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS mean_ndwi DECIMAL(5,4) CHECK (mean_ndwi IS NULL OR (mean_ndwi >= -1 AND mean_ndwi <= 1)),
  ADD COLUMN IF NOT EXISTS min_ndwi DECIMAL(5,4) CHECK (min_ndwi IS NULL OR (min_ndwi >= -1 AND min_ndwi <= 1)),
  ADD COLUMN IF NOT EXISTS max_ndwi DECIMAL(5,4) CHECK (max_ndwi IS NULL OR (max_ndwi >= -1 AND max_ndwi <= 1)),
  ADD COLUMN IF NOT EXISTS std_dev_ndwi DECIMAL(5,4) CHECK (std_dev_ndwi IS NULL OR std_dev_ndwi >= 0);

COMMENT ON COLUMN public.ndvi_results.mean_ndwi IS 'Mean NDWI McFeeters (-1 to 1). (B3-B8)/(B3+B8). Surface water / wetness. Nullable until recalculated.';
COMMENT ON COLUMN public.ndvi_results.min_ndwi IS 'Minimum NDWI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.max_ndwi IS 'Maximum NDWI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.std_dev_ndwi IS 'Standard deviation of NDWI values';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_ndwi
  ON public.ndvi_results(mean_ndwi)
  WHERE mean_ndwi IS NOT NULL;
