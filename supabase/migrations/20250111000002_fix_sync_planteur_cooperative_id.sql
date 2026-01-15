-- Migration: Fix sync_planteur_cooperative_id to handle NULL chef_planteur_id
-- This allows creating planteurs without a chef_planteur (supplier)
-- Required for the auto_create import mode where planteurs can be created without a supplier

-- ============================================================================
-- Update the sync_planteur_cooperative_id function to handle NULL chef_planteur_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_planteur_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chef_cooperative_id UUID;
BEGIN
  -- If chef_planteur_id is NULL, use the cooperative_id provided in the INSERT/UPDATE
  -- This allows creating planteurs without a chef_planteur assignment
  IF NEW.chef_planteur_id IS NULL THEN
    -- For INSERT: use the cooperative_id provided in the INSERT statement (NEW.cooperative_id)
    -- For UPDATE: keep the existing cooperative_id if not explicitly changed
    IF TG_OP = 'UPDATE' AND NEW.cooperative_id IS NULL THEN
      NEW.cooperative_id := OLD.cooperative_id;
    END IF;
    -- NEW.cooperative_id is already set from the INSERT/UPDATE statement
    RETURN NEW;
  END IF;

  -- Get the cooperative_id from the chef_planteur
  SELECT cooperative_id INTO v_chef_cooperative_id
  FROM public.chef_planteurs
  WHERE id = NEW.chef_planteur_id;
  
  -- Validate that chef_planteur exists (only if chef_planteur_id is provided)
  IF v_chef_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'Chef planteur with id % does not exist', NEW.chef_planteur_id;
  END IF;
  
  -- Set the cooperative_id to match the chef_planteur
  NEW.cooperative_id := v_chef_cooperative_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Update comment
-- ============================================================================

COMMENT ON FUNCTION public.sync_planteur_cooperative_id() IS 
  'Automatically syncs cooperative_id from chef_planteur to planteur. If chef_planteur_id is NULL, keeps existing cooperative_id (for updates) or allows explicit cooperative_id (for inserts).';
