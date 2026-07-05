-- ============================================================================
-- Migration: CocoaTrack Factory Module
-- Transformation cacao, stock usine, rendement
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.factory_receipt_status AS ENUM (
    'pending_qc', 'accepted', 'accepted_with_reserve', 'rejected', 'stored'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quality_decision AS ENUM (
    'conforme', 'non_conforme', 'a_retraiter', 'rejete', 'accepted_with_reserve'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_item_status AS ENUM (
    'available', 'blocked', 'quarantine', 'depleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM (
    'entry', 'exit', 'transfer', 'adjustment', 'transformation', 'loss', 'block', 'unblock'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transformation_order_status AS ENUM (
    'draft', 'planned', 'in_progress', 'completed', 'validated', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transformation_type AS ENUM (
    'cleaning', 'roasting', 'shelling', 'grinding', 'pressing',
    'cocoa_butter', 'cocoa_powder', 'cocoa_mass', 'chocolate', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.loss_type AS ENUM (
    'waste', 'evaporation', 'rejected_beans', 'breakage', 'unexplained', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS factory_site_id UUID,
  ADD COLUMN IF NOT EXISTS preferred_module TEXT;

-- Factory sites
CREATE TABLE IF NOT EXISTS public.factory_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT,
  cooperative_id UUID REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_factory_site_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_factory_site_id_fkey
  FOREIGN KEY (factory_site_id) REFERENCES public.factory_sites(id) ON DELETE SET NULL;

-- Extend warehouses
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS site_type TEXT NOT NULL DEFAULT 'cooperative';
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS factory_site_id UUID REFERENCES public.factory_sites(id) ON DELETE SET NULL;

-- Code counters
CREATE TABLE IF NOT EXISTS public.factory_code_counters (
  prefix TEXT NOT NULL,
  date DATE NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, date)
);

CREATE OR REPLACE FUNCTION public.next_factory_seq(p_prefix TEXT, p_date DATE)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE v_seq INTEGER;
BEGIN
  INSERT INTO public.factory_code_counters (prefix, date, counter)
  VALUES (p_prefix, p_date, 1)
  ON CONFLICT (prefix, date) DO UPDATE
    SET counter = public.factory_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_factory_code(p_prefix TEXT)
RETURNS TEXT
SET search_path = public
AS $$
DECLARE
  v_date DATE := current_date;
  v_seq INTEGER;
BEGIN
  v_seq := public.next_factory_seq(p_prefix, v_date);
  RETURN p_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Product types
CREATE TABLE IF NOT EXISTS public.product_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'raw',
  unit TEXT NOT NULL DEFAULT 'kg',
  is_raw_material BOOLEAN NOT NULL DEFAULT false,
  is_finished_product BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(factory_site_id, name)
);

-- Production lines
CREATE TABLE IF NOT EXISTS public.production_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity_kg_per_day NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(factory_site_id, name)
);

-- Yield standards
CREATE TABLE IF NOT EXISTS public.yield_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  transformation_type public.transformation_type NOT NULL,
  input_product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL,
  output_product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL,
  expected_yield_rate NUMERIC(6, 2) NOT NULL,
  tolerance_rate NUMERIC(6, 2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Factory receipts
CREATE TABLE IF NOT EXISTS public.factory_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  cooperative_id UUID REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  waybill_id UUID REFERENCES public.delivery_waybills(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  upstream_lot_number TEXT,
  supplier_name TEXT,
  transport_document_number TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  declared_weight_kg NUMERIC(12, 2),
  received_weight_kg NUMERIC(12, 2) NOT NULL,
  bag_count INTEGER,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status public.factory_receipt_status NOT NULL DEFAULT 'pending_qc',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(factory_site_id, receipt_number)
);

CREATE OR REPLACE FUNCTION public.set_factory_receipt_number()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := public.generate_factory_code('REC');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_factory_receipt_number_trigger ON public.factory_receipts;
CREATE TRIGGER set_factory_receipt_number_trigger
  BEFORE INSERT ON public.factory_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_factory_receipt_number();

-- Quality controls
CREATE TABLE IF NOT EXISTS public.quality_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.factory_receipts(id) ON DELETE CASCADE,
  control_date DATE NOT NULL DEFAULT CURRENT_DATE,
  moisture_rate NUMERIC(6, 2),
  impurity_rate NUMERIC(6, 2),
  mold_rate NUMERIC(6, 2),
  flat_beans_rate NUMERIC(6, 2),
  broken_beans_rate NUMERIC(6, 2),
  defective_beans_rate NUMERIC(6, 2),
  grade public.quality_grade,
  decision public.quality_decision,
  observations TEXT,
  controlled_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock items
CREATE TABLE IF NOT EXISTS public.stock_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  product_type_id UUID NOT NULL REFERENCES public.product_types(id) ON DELETE RESTRICT,
  lot_reference TEXT NOT NULL,
  quantity_kg NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity_kg >= 0),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  source_receipt_id UUID REFERENCES public.factory_receipts(id) ON DELETE SET NULL,
  source_lot_reference TEXT,
  transformation_order_id UUID,
  status public.stock_item_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  movement_type public.stock_movement_type NOT NULL,
  quantity_kg NUMERIC(12, 2) NOT NULL,
  source_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id UUID,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transformation orders
CREATE TABLE IF NOT EXISTS public.transformation_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  transformation_type public.transformation_type NOT NULL DEFAULT 'other',
  production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
  planned_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  input_quantity_kg NUMERIC(12, 2),
  theoretical_yield_rate NUMERIC(6, 2),
  actual_yield_rate NUMERIC(6, 2),
  loss_rate NUMERIC(6, 2),
  status public.transformation_order_status NOT NULL DEFAULT 'draft',
  operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(factory_site_id, order_number)
);

ALTER TABLE public.stock_items
  DROP CONSTRAINT IF EXISTS stock_items_transformation_order_id_fkey;
ALTER TABLE public.stock_items
  ADD CONSTRAINT stock_items_transformation_order_id_fkey
  FOREIGN KEY (transformation_order_id) REFERENCES public.transformation_orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_transformation_order_number()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_factory_code('OT');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transformation_order_number_trigger ON public.transformation_orders;
CREATE TRIGGER set_transformation_order_number_trigger
  BEFORE INSERT ON public.transformation_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_transformation_order_number();

-- Transformation inputs/outputs/losses
CREATE TABLE IF NOT EXISTS public.transformation_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transformation_order_id UUID NOT NULL REFERENCES public.transformation_orders(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  source_lot_reference TEXT,
  quantity_used_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_used_kg > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transformation_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transformation_order_id UUID NOT NULL REFERENCES public.transformation_orders(id) ON DELETE CASCADE,
  product_type_id UUID NOT NULL REFERENCES public.product_types(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  output_lot_number TEXT NOT NULL,
  quantity_produced_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_produced_kg >= 0),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transformation_losses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transformation_order_id UUID NOT NULL REFERENCES public.transformation_orders(id) ON DELETE CASCADE,
  loss_type public.loss_type NOT NULL DEFAULT 'other',
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factory_receipts_site ON public.factory_receipts(factory_site_id);
CREATE INDEX IF NOT EXISTS idx_factory_receipts_status ON public.factory_receipts(status);
CREATE INDEX IF NOT EXISTS idx_stock_items_site ON public.stock_items(factory_site_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_lot ON public.stock_items(lot_reference);
CREATE INDEX IF NOT EXISTS idx_transformation_orders_site ON public.transformation_orders(factory_site_id);
CREATE INDEX IF NOT EXISTS idx_transformation_orders_status ON public.transformation_orders(status);

-- RLS helpers
CREATE OR REPLACE FUNCTION public.get_user_factory_site_id()
RETURNS UUID STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id UUID;
BEGIN
  SELECT factory_site_id INTO v_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_access_factory_site(p_site_id UUID)
RETURNS BOOLEAN STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  RETURN p_site_id = public.get_user_factory_site_id();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_agent_or_above_factory()
RETURNS BOOLEAN STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin', 'manager', 'agent');
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.factory_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yield_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformation_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformation_losses ENABLE ROW LEVEL SECURITY;

-- Policies (read for authenticated with site access)
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'product_types','production_lines','yield_standards',
    'factory_receipts','quality_controls','stock_items','stock_movements',
    'transformation_orders'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS factory_select_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY factory_select_%s ON public.%I FOR SELECT TO authenticated USING (public.can_access_factory_site(factory_site_id) OR public.is_admin())',
      t, t
    );
  END LOOP;
END $$;

-- factory_sites uses id, not factory_site_id
DROP POLICY IF EXISTS factory_select_factory_sites ON public.factory_sites;
CREATE POLICY factory_select_factory_sites ON public.factory_sites
  FOR SELECT TO authenticated USING (public.can_access_factory_site(id) OR public.is_admin());

DROP POLICY IF EXISTS factory_write_factory_sites ON public.factory_sites;
CREATE POLICY factory_write_factory_sites ON public.factory_sites
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS factory_write_receipts ON public.factory_receipts;
CREATE POLICY factory_write_receipts ON public.factory_receipts
  FOR ALL TO authenticated
  USING (public.can_access_factory_site(factory_site_id))
  WITH CHECK (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory());

-- Similar write for agent+ on main tables
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'quality_controls','stock_items','stock_movements','transformation_orders',
    'product_types','production_lines','yield_standards'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS factory_write_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY factory_write_%s ON public.%I FOR ALL TO authenticated USING (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()) WITH CHECK (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory())',
      t, t
    );
  END LOOP;
END $$;

-- Child tables via order join
DROP POLICY IF EXISTS factory_select_inputs ON public.transformation_inputs;
CREATE POLICY factory_select_inputs ON public.transformation_inputs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND (public.can_access_factory_site(o.factory_site_id) OR public.is_admin())));

DROP POLICY IF EXISTS factory_write_inputs ON public.transformation_inputs;
CREATE POLICY factory_write_inputs ON public.transformation_inputs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()));

DROP POLICY IF EXISTS factory_select_outputs ON public.transformation_outputs;
CREATE POLICY factory_select_outputs ON public.transformation_outputs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND (public.can_access_factory_site(o.factory_site_id) OR public.is_admin())));

DROP POLICY IF EXISTS factory_write_outputs ON public.transformation_outputs;
CREATE POLICY factory_write_outputs ON public.transformation_outputs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()));

DROP POLICY IF EXISTS factory_select_losses ON public.transformation_losses;
CREATE POLICY factory_select_losses ON public.transformation_losses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND (public.can_access_factory_site(o.factory_site_id) OR public.is_admin())));

DROP POLICY IF EXISTS factory_write_losses ON public.transformation_losses;
CREATE POLICY factory_write_losses ON public.transformation_losses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transformation_orders o WHERE o.id = transformation_order_id AND public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()));

-- Audit triggers
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'factory_receipts','quality_controls','stock_items','transformation_orders'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()', t, t);
  END LOOP;
END $$;

-- Seed demo site (idempotent)
INSERT INTO public.factory_sites (id, name, code, location, is_active)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Usine démo CocoaTrack', 'USINE-DEMO', 'Douala, Cameroun', true)
ON CONFLICT (code) DO NOTHING;

-- Seed product types for demo site
INSERT INTO public.product_types (factory_site_id, name, category, is_raw_material, is_finished_product)
SELECT fs.id, pt.name, pt.category, pt.is_raw, pt.is_finished
FROM public.factory_sites fs
CROSS JOIN (VALUES
  ('Fèves de cacao', 'raw', true, false),
  ('Beurre de cacao', 'derivative', false, true),
  ('Poudre de cacao', 'derivative', false, true),
  ('Tourteaux', 'derivative', false, true),
  ('Masse de cacao', 'derivative', false, true)
) AS pt(name, category, is_raw, is_finished)
WHERE fs.code = 'USINE-DEMO'
ON CONFLICT (factory_site_id, name) DO NOTHING;

INSERT INTO public.production_lines (factory_site_id, name, description, capacity_kg_per_day)
SELECT fs.id, ln.name, ln.description, ln.capacity
FROM public.factory_sites fs
CROSS JOIN (VALUES
  ('Ligne 1, Pressage', 'Pressage beurre et poudre', 5000),
  ('Ligne 2, Broyage', 'Broyage et masse', 3000)
) AS ln(name, description, capacity)
WHERE fs.code = 'USINE-DEMO'
ON CONFLICT (factory_site_id, name) DO NOTHING;

INSERT INTO public.yield_standards (factory_site_id, transformation_type, expected_yield_rate, tolerance_rate)
SELECT fs.id, 'pressing'::public.transformation_type, 78, 5
FROM public.factory_sites fs WHERE fs.code = 'USINE-DEMO'
  AND NOT EXISTS (SELECT 1 FROM public.yield_standards ys WHERE ys.factory_site_id = fs.id LIMIT 1);
