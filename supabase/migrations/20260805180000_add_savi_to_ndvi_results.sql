-- Migration: Add SAVI (Soil-Adjusted Vegetation Index, Huete) to ndvi_results
-- Formula: SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
-- Sentinel-2 bands: B8 (NIR 10m), B4 (Red 10m) — same as NDVI
-- Useful for sparse canopy / young plants where soil biases NDVI.
-- Columns nullable so existing rows remain valid until recalculated.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS mean_savi DECIMAL(5,4) CHECK (mean_savi IS NULL OR (mean_savi >= -1 AND mean_savi <= 1)),
  ADD COLUMN IF NOT EXISTS min_savi DECIMAL(5,4) CHECK (min_savi IS NULL OR (min_savi >= -1 AND min_savi <= 1)),
  ADD COLUMN IF NOT EXISTS max_savi DECIMAL(5,4) CHECK (max_savi IS NULL OR (max_savi >= -1 AND max_savi <= 1)),
  ADD COLUMN IF NOT EXISTS std_dev_savi DECIMAL(5,4) CHECK (std_dev_savi IS NULL OR std_dev_savi >= 0);

COMMENT ON COLUMN public.ndvi_results.mean_savi IS 'Mean SAVI Huete (-1 to 1). ((B8-B4)/(B8+B4+L))*(1+L), L=0.5. Soil-adjusted veg. Nullable until recalculated.';
COMMENT ON COLUMN public.ndvi_results.min_savi IS 'Minimum SAVI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.max_savi IS 'Maximum SAVI for the parcelle';
COMMENT ON COLUMN public.ndvi_results.std_dev_savi IS 'Standard deviation of SAVI values';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_savi
  ON public.ndvi_results(mean_savi)
  WHERE mean_savi IS NOT NULL;
