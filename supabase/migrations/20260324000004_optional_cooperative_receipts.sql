-- ============================================================================
-- Migration: Make cooperative_id optional in collection_receipts
-- Description: Allows importing receipts without associating them to a cooperative
-- Date: 2026-03-24
-- ============================================================================

-- Drop the NOT NULL constraint on cooperative_id
ALTER TABLE public.collection_receipts 
  ALTER COLUMN cooperative_id DROP NOT NULL;

-- Drop the unique constraint that includes cooperative_id
ALTER TABLE public.collection_receipts 
  DROP CONSTRAINT IF EXISTS unique_receipt_per_cooperative;

-- Add a new unique constraint that handles NULL cooperative_id
-- This ensures receipt_number is unique within a cooperative, 
-- but allows multiple receipts with the same number if cooperative_id is NULL
CREATE UNIQUE INDEX unique_receipt_per_cooperative_idx 
  ON public.collection_receipts(cooperative_id, receipt_number)
  WHERE cooperative_id IS NOT NULL;

-- For receipts without cooperative, ensure receipt_number is still unique
CREATE UNIQUE INDEX unique_receipt_no_cooperative_idx 
  ON public.collection_receipts(receipt_number)
  WHERE cooperative_id IS NULL;

-- Update RLS policies to handle NULL cooperative_id

-- Drop existing SELECT policy
DROP POLICY IF EXISTS collection_receipts_select_policy ON public.collection_receipts;

-- Recreate SELECT policy with NULL handling
CREATE POLICY collection_receipts_select_policy ON public.collection_receipts
  FOR SELECT
  USING (
    -- Admins can see all receipts
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    -- Users can see receipts from their cooperative
    (
      cooperative_id IS NOT NULL 
      AND cooperative_id IN (
        SELECT cooperative_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
    OR
    -- Managers can see receipts without cooperative
    (
      cooperative_id IS NULL
      AND EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('manager', 'admin')
      )
    )
  );

-- Drop existing INSERT policy
DROP POLICY IF EXISTS collection_receipts_insert_policy ON public.collection_receipts;

-- Recreate INSERT policy with NULL handling
CREATE POLICY collection_receipts_insert_policy ON public.collection_receipts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
      AND (
        -- Admin can insert any receipt
        role = 'admin'
        OR
        -- Manager can insert for their cooperative
        (cooperative_id IS NOT NULL AND cooperative_id = collection_receipts.cooperative_id)
        OR
        -- Manager can insert without cooperative
        collection_receipts.cooperative_id IS NULL
      )
    )
  );

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS collection_receipts_update_policy ON public.collection_receipts;

-- Recreate UPDATE policy with NULL handling
CREATE POLICY collection_receipts_update_policy ON public.collection_receipts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
      AND (
        -- Admin can update any receipt
        role = 'admin'
        OR
        -- Manager can update receipts from their cooperative
        (cooperative_id IS NOT NULL AND cooperative_id = collection_receipts.cooperative_id)
        OR
        -- Manager can update receipts without cooperative
        collection_receipts.cooperative_id IS NULL
      )
    )
  );

-- Add comment
COMMENT ON COLUMN public.collection_receipts.cooperative_id IS 
  'Optional reference to cooperative. NULL means receipt is not associated with any cooperative.';
