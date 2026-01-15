-- Migration: Make cooperative_id optional for planteurs
-- This allows creating planteurs without assigning them to a cooperative
-- Required for the auto_create import mode where planteurs can be created without a cooperative
-- The cooperative can be assigned later manually

-- Step 1: Drop the NOT NULL constraint on cooperative_id
ALTER TABLE public.planteurs
ALTER COLUMN cooperative_id DROP NOT NULL;

-- Step 2: Add a comment explaining the change
COMMENT ON COLUMN public.planteurs.cooperative_id IS 
  'Optional reference to cooperative. Can be NULL for planteurs created via import without cooperative assignment. Can be assigned later.';
