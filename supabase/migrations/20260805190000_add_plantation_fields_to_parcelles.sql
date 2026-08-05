-- Add plantation age and stand density for SAVI / visit context
-- Migration: 20260805190000_add_plantation_fields_to_parcelles.sql

ALTER TABLE public.parcelles
  ADD COLUMN IF NOT EXISTS annee_plantation INTEGER
    CHECK (annee_plantation IS NULL OR (annee_plantation >= 1900 AND annee_plantation <= 2100)),
  ADD COLUMN IF NOT EXISTS densite_arbres_ha DECIMAL(8, 2)
    CHECK (densite_arbres_ha IS NULL OR densite_arbres_ha > 0);

COMMENT ON COLUMN public.parcelles.annee_plantation IS 'Year cocoa was planted (calendar year). Used for SAVI relevance (young stands).';
COMMENT ON COLUMN public.parcelles.densite_arbres_ha IS 'Planting density (trees per hectare). Low density → soil-biased indices / SAVI.';

CREATE INDEX IF NOT EXISTS idx_parcelles_annee_plantation
  ON public.parcelles(annee_plantation)
  WHERE annee_plantation IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parcelles_densite_arbres_ha
  ON public.parcelles(densite_arbres_ha)
  WHERE densite_arbres_ha IS NOT NULL;
