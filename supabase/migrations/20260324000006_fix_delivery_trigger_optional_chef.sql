-- ============================================================================
-- Migration: Fix sync_delivery_cooperative_id trigger to allow NULL chef_planteur_id
-- Description: When chef_planteur_id is NULL (manual entry), derive cooperative_id
--              from the planteur instead, or leave it as provided.
-- Date: 2026-03-24
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_delivery_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cooperative_id UUID;
BEGIN
  -- If chef_planteur_id is provided, derive cooperative from chef_planteur
  IF NEW.chef_planteur_id IS NOT NULL THEN
    SELECT cooperative_id INTO v_cooperative_id
    FROM public.chef_planteurs
    WHERE id = NEW.chef_planteur_id;

    IF v_cooperative_id IS NULL THEN
      RAISE EXCEPTION 'Invalid chef_planteur_id: %. Chef planteur not found or has no cooperative.', NEW.chef_planteur_id;
    END IF;

    NEW.cooperative_id := v_cooperative_id;

  ELSE
    -- No chef_planteur: try to derive cooperative from planteur
    IF NEW.planteur_id IS NOT NULL AND NEW.cooperative_id IS NULL THEN
      SELECT cooperative_id INTO v_cooperative_id
      FROM public.planteurs
      WHERE id = NEW.planteur_id;

      IF v_cooperative_id IS NOT NULL THEN
        NEW.cooperative_id := v_cooperative_id;
      END IF;
    END IF;
    -- If cooperative_id is already set (passed explicitly), keep it as-is
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
