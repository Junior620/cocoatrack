-- Migration: Add NDRE (Normalized Difference Red Edge) to ndvi_results
-- Formula: NDRE = (B8A - B5) / (B8A + B5) at 20 m
-- Chlorophyll / nutritional stress under dense canopy.

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS mean_ndre DECIMAL(5,4) CHECK (mean_ndre IS NULL OR (mean_ndre >= -1 AND mean_ndre <= 1)),
  ADD COLUMN IF NOT EXISTS min_ndre DECIMAL(5,4) CHECK (min_ndre IS NULL OR (min_ndre >= -1 AND min_ndre <= 1)),
  ADD COLUMN IF NOT EXISTS max_ndre DECIMAL(5,4) CHECK (max_ndre IS NULL OR (max_ndre >= -1 AND max_ndre <= 1)),
  ADD COLUMN IF NOT EXISTS std_dev_ndre DECIMAL(5,4) CHECK (std_dev_ndre IS NULL OR std_dev_ndre >= 0);

COMMENT ON COLUMN public.ndvi_results.mean_ndre IS 'Mean NDRE (-1 to 1). (B8A-B5)/(B8A+B5). Chlorophyll / red-edge. Nullable until recalculated.';
COMMENT ON COLUMN public.ndvi_results.min_ndre IS 'Minimum NDRE for the parcelle';
COMMENT ON COLUMN public.ndvi_results.max_ndre IS 'Maximum NDRE for the parcelle';
COMMENT ON COLUMN public.ndvi_results.std_dev_ndre IS 'Standard deviation of NDRE values';

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_ndre
  ON public.ndvi_results(mean_ndre)
  WHERE mean_ndre IS NOT NULL;
