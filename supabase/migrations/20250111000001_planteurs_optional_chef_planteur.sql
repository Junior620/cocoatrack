-- Migration: Make chef_planteur_id optional for planteurs
-- This allows creating planteurs without assigning them to a chef planteur (supplier)
-- Required for the auto_create import mode where planteurs can be created without a supplier

-- Step 1: Drop the NOT NULL constraint on chef_planteur_id
ALTER TABLE public.planteurs
ALTER COLUMN chef_planteur_id DROP NOT NULL;

-- Step 2: Add a comment explaining the change
COMMENT ON COLUMN public.planteurs.chef_planteur_id IS 
  'Optional reference to chef_planteur (supplier). Can be NULL for planteurs created via import without supplier assignment.';

-- Note: The foreign key constraint remains, so if a value is provided, it must reference a valid chef_planteur
