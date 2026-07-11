-- Add Sentinel-2 acquisition (capture) date on NDVI results
-- calculation_date = monthly reference / target window
-- acquisition_date = real satellite overpass used for the NDVI value

ALTER TABLE public.ndvi_results
  ADD COLUMN IF NOT EXISTS acquisition_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ndvi_results_acquisition_date
  ON public.ndvi_results(acquisition_date);

COMMENT ON COLUMN public.ndvi_results.calculation_date IS
  'Reference date for the NDVI period (often end of month for monthly backfill)';

COMMENT ON COLUMN public.ndvi_results.acquisition_date IS
  'Actual Sentinel-2 image acquisition date (system:time_start from GEE), when known';
