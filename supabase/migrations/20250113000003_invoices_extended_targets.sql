-- Migration: Add chef_planteur_id and planteur_id to invoices table
-- This allows generating invoices by Fournisseur (Chef Planteur) or Planteur
-- in addition to the existing Cooperative-based invoicing

-- Add chef_planteur_id column (nullable, for fournisseur invoices)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS chef_planteur_id UUID REFERENCES public.chef_planteurs(id);

-- Add planteur_id column (nullable, for planteur invoices)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS planteur_id UUID REFERENCES public.planteurs(id);

-- Make cooperative_id nullable (for invoices that are not cooperative-based)
ALTER TABLE public.invoices
ALTER COLUMN cooperative_id DROP NOT NULL;

-- Add index for chef_planteur_id
CREATE INDEX IF NOT EXISTS idx_invoices_chef_planteur_id ON public.invoices(chef_planteur_id);

-- Add index for planteur_id
CREATE INDEX IF NOT EXISTS idx_invoices_planteur_id ON public.invoices(planteur_id);

-- Add check constraint to ensure at least one target is specified
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_has_target CHECK (
  cooperative_id IS NOT NULL OR chef_planteur_id IS NOT NULL OR planteur_id IS NOT NULL
);

-- Update RLS policies to include chef_planteur and planteur access
-- Drop existing policies first
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

-- Recreate policies with extended access
CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT USING (
    -- Admin can see all
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Manager can see invoices for their cooperative
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
      AND (
        cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
        OR cooperative_id IS NULL
      )
    )
    OR
    -- Agent can see invoices they created
    created_by = auth.uid()
  );

CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT WITH CHECK (
    -- Admin can create any invoice
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Manager can create invoices for their cooperative or without cooperative
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
      AND (
        cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
        OR cooperative_id IS NULL
      )
    )
  );

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE USING (
    -- Admin can update any invoice
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Manager can update invoices for their cooperative
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
      AND (
        cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
        OR cooperative_id IS NULL
      )
    )
  );

CREATE POLICY "invoices_delete_policy" ON public.invoices
  FOR DELETE USING (
    -- Only admin can delete invoices
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMENT ON COLUMN public.invoices.chef_planteur_id IS 'Reference to chef_planteur for fournisseur-based invoices';
COMMENT ON COLUMN public.invoices.planteur_id IS 'Reference to planteur for individual planteur invoices';
