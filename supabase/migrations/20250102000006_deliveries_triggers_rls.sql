-- CocoaTrack V2 - Deliveries Triggers and RLS Policies
-- Implements triggers for data integrity and RLS policies for access control

-- ============================================================================
-- ENABLE RLS ON DELIVERIES TABLE
-- ============================================================================
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRIGGER: SYNC COOPERATIVE_ID FROM CHEF_PLANTEUR TO DELIVERY
-- Ensures deliveries always have the same cooperative_id as their chef_planteur
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_delivery_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_chef_cooperative_id UUID;
BEGIN
  -- Get the cooperative_id from the chef_planteur
  SELECT cooperative_id INTO v_chef_cooperative_id
  FROM public.chef_planteurs
  WHERE id = NEW.chef_planteur_id;
  
  -- Validate that chef_planteur exists and has a cooperative
  IF v_chef_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'Invalid chef_planteur_id: %. Chef planteur not found or has no cooperative.', NEW.chef_planteur_id;
  END IF;
  
  -- Set the cooperative_id to match the chef_planteur
  NEW.cooperative_id := v_chef_cooperative_id;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE of chef_planteur_id
CREATE TRIGGER sync_delivery_cooperative_id_trigger
  BEFORE INSERT OR UPDATE OF chef_planteur_id ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_cooperative_id();

-- ============================================================================
-- TRIGGER: CALCULATE DELIVERY TOTAL
-- Calculates total_amount = round(weight_kg * price_per_kg) as integer XAF
-- This is the source of truth for total calculation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_delivery_total()
RETURNS TRIGGER
SET search_path = public
AS $
BEGIN
  -- Calculate total_amount: round(weight_kg * price_per_kg) as integer
  NEW.total_amount := round(NEW.weight_kg * NEW.price_per_kg)::bigint;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE of weight_kg or price_per_kg
CREATE TRIGGER calculate_delivery_total_trigger
  BEFORE INSERT OR UPDATE OF weight_kg, price_per_kg ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.calculate_delivery_total();

-- ============================================================================
-- DELIVERY CODE GENERATION
-- Format: DEL-YYYYMMDD-XXXX (4 digits, daily reset)
-- Uses table-based counter with SELECT FOR UPDATE for concurrency safety
-- ============================================================================

-- Function to get next daily sequence number (atomic, concurrency-safe)
CREATE OR REPLACE FUNCTION public.next_daily_delivery_seq(p_date DATE)
RETURNS INTEGER
SET search_path = public
AS $
DECLARE
  v_seq INTEGER;
BEGIN
  -- Insert or update the counter atomically
  INSERT INTO public.delivery_code_counters (date, counter)
  VALUES (p_date, 1)
  ON CONFLICT (date) DO UPDATE 
    SET counter = public.delivery_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  
  RETURN v_seq;
END;
$ LANGUAGE plpgsql;

-- Function to generate unique delivery code
CREATE OR REPLACE FUNCTION public.generate_delivery_code()
RETURNS TEXT
SET search_path = public
AS $
DECLARE
  v_date DATE := current_date;
  v_seq INTEGER;
BEGIN
  v_seq := public.next_daily_delivery_seq(v_date);
  RETURN 'DEL-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END;
$ LANGUAGE plpgsql;

-- Trigger function to set delivery code on INSERT
CREATE OR REPLACE FUNCTION public.set_delivery_code()
RETURNS TRIGGER
SET search_path = public
AS $
BEGIN
  -- Only generate code if not provided
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_delivery_code();
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on INSERT
CREATE TRIGGER set_delivery_code_trigger
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_code();

-- ============================================================================
-- DELIVERIES RLS POLICIES
-- ============================================================================

-- SELECT: Users can view deliveries based on their role
CREATE POLICY "deliveries_select_policy" ON public.deliveries
  FOR SELECT
  USING (
    CASE
      -- Admin can see all deliveries
      WHEN public.is_admin() THEN true
      -- Others can see deliveries in their cooperative
      WHEN public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  );

-- INSERT: Agents and above can create deliveries
CREATE POLICY "deliveries_insert_policy" ON public.deliveries
  FOR INSERT
  WITH CHECK (
    -- Must be agent or above
    public.is_agent_or_above()
    -- Must set created_by to current user
    AND created_by = auth.uid()
    -- The chef_planteur must be in user's cooperative (or admin)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chef_planteurs cp
        WHERE cp.id = chef_planteur_id
        AND cp.cooperative_id = public.get_user_cooperative_id()
      )
    )
  );

-- UPDATE: Users can update deliveries with restrictions
CREATE POLICY "deliveries_update_policy" ON public.deliveries
  FOR UPDATE
  USING (
    CASE
      -- Admin can update any delivery
      WHEN public.is_admin() THEN true
      -- Manager can update deliveries in their cooperative
      WHEN public.get_user_role() = 'manager' 
        AND public.can_access_cooperative(cooperative_id) THEN true
      -- Agent can update deliveries they created (in their cooperative) if not paid
      WHEN public.get_user_role() = 'agent' 
        AND public.can_access_cooperative(cooperative_id)
        AND created_by = auth.uid()
        AND payment_status != 'paid' THEN true
      ELSE false
    END
  )
  WITH CHECK (
    -- Ensure the delivery stays in user's scope
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.get_user_role() IN ('manager', 'agent') THEN
        EXISTS (
          SELECT 1 FROM public.chef_planteurs cp
          WHERE cp.id = chef_planteur_id
          AND public.can_access_cooperative(cp.cooperative_id)
        )
      ELSE false
    END
  );

-- DELETE: Only admin can delete deliveries
CREATE POLICY "deliveries_delete_policy" ON public.deliveries
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- DELIVERY_PHOTOS RLS POLICIES
-- ============================================================================

-- SELECT: Users can view photos for deliveries they can access
CREATE POLICY "delivery_photos_select_policy" ON public.delivery_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(d.cooperative_id)
      )
    )
  );

-- INSERT: Agents and above can add photos to deliveries they can access
CREATE POLICY "delivery_photos_insert_policy" ON public.delivery_photos
  FOR INSERT
  WITH CHECK (
    public.is_agent_or_above()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(d.cooperative_id)
      )
    )
  );

-- DELETE: Managers and above can delete photos
CREATE POLICY "delivery_photos_delete_policy" ON public.delivery_photos
  FOR DELETE
  USING (
    public.is_manager_or_above()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(d.cooperative_id)
      )
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_delivery_cooperative_id() IS 
  'Automatically syncs cooperative_id from chef_planteur to delivery';

COMMENT ON FUNCTION public.calculate_delivery_total() IS 
  'Calculates total_amount = round(weight_kg * price_per_kg) as integer XAF';

COMMENT ON FUNCTION public.next_daily_delivery_seq(DATE) IS 
  'Returns the next sequence number for delivery codes on a given date (atomic, concurrency-safe)';

COMMENT ON FUNCTION public.generate_delivery_code() IS 
  'Generates a unique delivery code in format DEL-YYYYMMDD-XXXX';

COMMENT ON FUNCTION public.set_delivery_code() IS 
  'Trigger function to auto-generate delivery code on INSERT';

COMMENT ON POLICY "deliveries_select_policy" ON public.deliveries IS 
  'Users can view deliveries in their scope: admin sees all, others see own cooperative';

COMMENT ON POLICY "deliveries_insert_policy" ON public.deliveries IS 
  'Agents and above can create deliveries for chef_planteurs in their cooperative';

COMMENT ON POLICY "deliveries_update_policy" ON public.deliveries IS 
  'Admin can update any, manager can update own coop, agent can update own created (if not paid)';

COMMENT ON POLICY "deliveries_delete_policy" ON public.deliveries IS 
  'Only admin can delete deliveries';

COMMENT ON POLICY "delivery_photos_select_policy" ON public.delivery_photos IS 
  'Users can view photos for deliveries they can access';

COMMENT ON POLICY "delivery_photos_insert_policy" ON public.delivery_photos IS 
  'Agents and above can add photos to deliveries they can access';

COMMENT ON POLICY "delivery_photos_delete_policy" ON public.delivery_photos IS 
  'Managers and above can delete photos for deliveries they can access';
