-- Migration: Add NDMI (Normalized Difference Moisture Index) to ndvi_results
-- Formula: NDMI = (NIR - SWIR) / (NIR + SWIR)
-- Sentinel-2 bands: B8A (NIR 20m), B11 (SWIR 20m)
-- Columns nullable so existing NDVI/EVI rows remain valid until recalculated.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS mean_ndmi DECIMAL(5,4) CHECK (mean_ndmi IS NULL OR (mean_ndmi >= -1 AND mean_ndmi <= 1)),
  ADD COLUMN IF NOT EXISTS min_ndmi DECIMAL(5,4) CHECK (min_ndmi IS NULL OR (min_ndmi >= -1 AND min_ndmi <= 1)),
  ADD COLUMN IF NOT EXISTS max_ndmi DECIMAL(5,4) CHECK (max_ndmi IS NULL OR (max_ndmi >= -1 AND max_ndmi <= 1)),
  ADD COLUMN IF NOT EXISTS std_dev_ndmi DECIMAL(5,4) CHECK (std_dev_ndmi IS NULL OR std_dev_ndmi >= 0);

COMMENT ON COLUMN public.ndvi_results.mean_ndmi IS 'Mean NDMI (-1 to 1). Moisture index (B8A-B11)/(B8A+B11). Nullable until recalculated.';
COMMENT ON COLUMN public.ndvi_results.min_ndmi IS 'Minimum NDMI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.max_ndmi IS 'Maximum NDMI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.std_dev_ndmi IS 'Standard deviation of NDMI values';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_ndmi
  ON public.ndvi_results(mean_ndmi)
  WHERE mean_ndmi IS NOT NULL;
