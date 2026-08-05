-- Migration: Add EVI (Enhanced Vegetation Index) columns to ndvi_results
-- Formula (NASA MODIS / USGS): EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
-- Sentinel-2 bands: B8 (NIR), B4 (Red), B2 (Blue)
-- Columns are nullable so existing NDVI rows remain valid until recalculated.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS mean_evi DECIMAL(5,4) CHECK (mean_evi IS NULL OR (mean_evi >= -1 AND mean_evi <= 1)),
  ADD COLUMN IF NOT EXISTS min_evi DECIMAL(5,4) CHECK (min_evi IS NULL OR (min_evi >= -1 AND min_evi <= 1)),
  ADD COLUMN IF NOT EXISTS max_evi DECIMAL(5,4) CHECK (max_evi IS NULL OR (max_evi >= -1 AND max_evi <= 1)),
  ADD COLUMN IF NOT EXISTS std_dev_evi DECIMAL(5,4) CHECK (std_dev_evi IS NULL OR std_dev_evi >= 0);

COMMENT ON COLUMN public.ndvi_results.mean_evi IS 'Mean EVI (-1 to 1). NASA coeffs G=2.5, C1=6, C2=7.5, L=1. Nullable until recalculated.';
COMMENT ON COLUMN public.ndvi_results.min_evi IS 'Minimum EVI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.max_evi IS 'Maximum EVI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.std_dev_evi IS 'Standard deviation of EVI values';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_evi
  ON public.ndvi_results(mean_evi)
  WHERE mean_evi IS NOT NULL;
