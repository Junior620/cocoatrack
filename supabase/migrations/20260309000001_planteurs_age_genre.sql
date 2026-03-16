-- ============================================================================
-- CocoaTrack V2 - Add age and genre fields to planteurs
-- Supports CSV import with age and genre (F/M) columns
-- ============================================================================

ALTER TABLE public.planteurs
  ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age > 0),
  ADD COLUMN IF NOT EXISTS genre TEXT CHECK (genre IN ('F', 'M'));

COMMENT ON COLUMN public.planteurs.age IS 'Age of the planteur in years';
COMMENT ON COLUMN public.planteurs.genre IS 'Gender: F (Féminin) or M (Masculin)';
