-- ============================================================================
-- MES Transformation industrielle — MVP Phase 3
-- Recipes, production orders (OF), operation runs, tanks, product releases
-- Migration: 20260806160000_mes_industrial_module.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Site mode
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.factory_site_mode AS ENUM ('primary', 'industrial', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.factory_sites
  ADD COLUMN IF NOT EXISTS site_mode public.factory_site_mode NOT NULL DEFAULT 'both';

-- ---------------------------------------------------------------------------
-- Enums MES
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.production_order_status AS ENUM (
    'draft',
    'planned',
    'validated',
    'materials_reserved',
    'ready',
    'in_progress',
    'suspended',
    'completed',
    'awaiting_quality',
    'released',
    'closed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.operation_run_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'awaiting_quality',
    'validated',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recipe_step_type AS ENUM (
    'cleaning',
    'pretreatment',
    'shelling',
    'winnowing',
    'roasting',
    'cooling',
    'grinding',
    'alkalizing',
    'pressing',
    'filtration',
    'cake_milling',
    'sieving',
    'packaging',
    'transfer',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tank_status AS ENUM (
    'empty',
    'in_use',
    'quarantine',
    'blocked',
    'cleaning',
    'maintenance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tank_movement_type AS ENUM (
    'fill',
    'empty',
    'transfer',
    'blend',
    'return',
    'purge',
    'clean',
    'sample',
    'adjust'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.product_release_status AS ENUM (
    'pending',
    'released',
    'released_with_reserve',
    'blocked',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend cocoa_lot_status with released if missing
ALTER TYPE public.cocoa_lot_status ADD VALUE IF NOT EXISTS 'released';

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.production_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, code)
);

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.production_recipes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  expected_yield_pct NUMERIC(6, 2),
  mass_balance_tolerance_pct NUMERIC(6, 2) NOT NULL DEFAULT 2.0,
  notes TEXT,
  activated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_id, version)
);

CREATE TABLE IF NOT EXISTS public.recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type public.recipe_step_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tolerances_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_yield_pct NUMERIC(6, 2),
  requires_quality_check BOOLEAN NOT NULL DEFAULT false,
  equipment_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_version_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_production_recipes_site ON public.production_recipes(factory_site_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe ON public.recipe_versions(recipe_id, status);

-- ---------------------------------------------------------------------------
-- Production orders (OF)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status public.production_order_status NOT NULL DEFAULT 'draft',
  product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL,
  product_label TEXT,
  planned_quantity_kg NUMERIC(12, 2) NOT NULL CHECK (planned_quantity_kg > 0),
  actual_quantity_kg NUMERIC(12, 2),
  recipe_id UUID REFERENCES public.production_recipes(id) ON DELETE SET NULL,
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE RESTRICT,
  production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  planned_start DATE,
  planned_end DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 5,
  quality_requirements TEXT,
  variance_justification TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, order_number)
);

CREATE OR REPLACE FUNCTION public.set_production_order_number()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_factory_code('OF');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_production_order_number_trigger ON public.production_orders;
CREATE TRIGGER set_production_order_number_trigger
  BEFORE INSERT OR UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_production_order_number();

CREATE TABLE IF NOT EXISTS public.production_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  planned_qty_kg NUMERIC(12, 2) NOT NULL CHECK (planned_qty_kg > 0),
  reserved_qty_kg NUMERIC(12, 2),
  consumed_qty_kg NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'reserved', 'consumed', 'released', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_orders_site_status
  ON public.production_orders(factory_site_id, status);
CREATE INDEX IF NOT EXISTS idx_pom_order ON public.production_order_materials(production_order_id);

-- ---------------------------------------------------------------------------
-- Operation runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  recipe_step_id UUID REFERENCES public.recipe_steps(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  step_type public.recipe_step_type NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  status public.operation_run_status NOT NULL DEFAULT 'pending',
  equipment_hint TEXT,
  tank_id UUID, -- FK after tanks
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  input_qty_kg NUMERIC(12, 2),
  output_qty_kg NUMERIC(12, 2),
  loss_qty_kg NUMERIC(12, 2),
  mass_balance_ok BOOLEAN,
  variance_justification TEXT,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  product_label TEXT NOT NULL,
  output_kind TEXT NOT NULL DEFAULT 'main'
    CHECK (output_kind IN ('main', 'coproduct', 'byproduct', 'rework', 'sample', 'waste')),
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg >= 0),
  cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  product_type_id UUID REFERENCES public.product_types(id) ON DELETE SET NULL,
  tank_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  param_key TEXT NOT NULL,
  target_value NUMERIC(14, 4),
  actual_value NUMERIC(14, 4),
  unit TEXT,
  within_tolerance BOOLEAN,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_losses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  loss_kind TEXT NOT NULL DEFAULT 'process'
    CHECK (loss_kind IN ('process', 'moisture', 'waste', 'purge', 'unexplained', 'other')),
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_runs_order ON public.operation_runs(production_order_id, step_order);

-- ---------------------------------------------------------------------------
-- Tanks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity_kg NUMERIC(12, 2) NOT NULL CHECK (capacity_kg > 0),
  current_qty_kg NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_qty_kg >= 0),
  allowed_product_label TEXT,
  status public.tank_status NOT NULL DEFAULT 'empty',
  temperature_c NUMERIC(6, 2),
  last_cleaned_at TIMESTAMPTZ,
  quality_status TEXT NOT NULL DEFAULT 'ok'
    CHECK (quality_status IN ('ok', 'quarantine', 'blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, code),
  CHECK (current_qty_kg <= capacity_kg)
);

CREATE TABLE IF NOT EXISTS public.tank_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES public.tanks(id) ON DELETE CASCADE,
  cocoa_lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  contribution_percent NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  tank_id UUID NOT NULL REFERENCES public.tanks(id) ON DELETE CASCADE,
  movement_type public.tank_movement_type NOT NULL,
  quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  from_tank_id UUID REFERENCES public.tanks(id) ON DELETE SET NULL,
  to_tank_id UUID REFERENCES public.tanks(id) ON DELETE SET NULL,
  operation_run_id UUID REFERENCES public.operation_runs(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operation_runs
  DROP CONSTRAINT IF EXISTS operation_runs_tank_id_fkey;
ALTER TABLE public.operation_runs
  ADD CONSTRAINT operation_runs_tank_id_fkey
  FOREIGN KEY (tank_id) REFERENCES public.tanks(id) ON DELETE SET NULL;

ALTER TABLE public.operation_outputs
  DROP CONSTRAINT IF EXISTS operation_outputs_tank_id_fkey;
ALTER TABLE public.operation_outputs
  ADD CONSTRAINT operation_outputs_tank_id_fkey
  FOREIGN KEY (tank_id) REFERENCES public.tanks(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Product releases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  cocoa_lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL,
  status public.product_release_status NOT NULL DEFAULT 'pending',
  decision_notes TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_releases_lot ON public.product_releases(cocoa_lot_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.production_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tank_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_releases ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'production_recipes', 'production_orders', 'operation_runs',
    'tanks', 'tank_movements', 'product_releases'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.is_admin() OR public.can_access_factory_site(factory_site_id))',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I_write ON public.%I FOR ALL TO authenticated USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory())) WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Child tables via parent
DO $$ BEGIN
  CREATE POLICY recipe_versions_select ON public.recipe_versions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.production_recipes r WHERE r.id = recipe_id AND (public.is_admin() OR public.can_access_factory_site(r.factory_site_id))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY recipe_versions_write ON public.recipe_versions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.production_recipes r WHERE r.id = recipe_id AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory()))))
    WITH CHECK (EXISTS (SELECT 1 FROM public.production_recipes r WHERE r.id = recipe_id AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory()))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY recipe_steps_select ON public.recipe_steps FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.recipe_versions v
      JOIN public.production_recipes r ON r.id = v.recipe_id
      WHERE v.id = recipe_version_id AND (public.is_admin() OR public.can_access_factory_site(r.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY recipe_steps_write ON public.recipe_steps FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.recipe_versions v
      JOIN public.production_recipes r ON r.id = v.recipe_id
      WHERE v.id = recipe_version_id AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.recipe_versions v
      JOIN public.production_recipes r ON r.id = v.recipe_id
      WHERE v.id = recipe_version_id AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY pom_select ON public.production_order_materials FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND (public.is_admin() OR public.can_access_factory_site(o.factory_site_id))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY pom_write ON public.production_order_materials FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND (public.is_admin() OR (public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()))))
    WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND (public.is_admin() OR (public.can_access_factory_site(o.factory_site_id) AND public.is_agent_or_above_factory()))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE
  child TEXT;
  parent_col TEXT := 'operation_run_id';
BEGIN
  FOREACH child IN ARRAY ARRAY['operation_inputs', 'operation_outputs', 'operation_parameters', 'operation_losses']
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.operation_runs r WHERE r.id = %I AND (public.is_admin() OR public.can_access_factory_site(r.factory_site_id))))',
        child, child, parent_col
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I_write ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.operation_runs r WHERE r.id = %I AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory())))) WITH CHECK (EXISTS (SELECT 1 FROM public.operation_runs r WHERE r.id = %I AND (public.is_admin() OR (public.can_access_factory_site(r.factory_site_id) AND public.is_agent_or_above_factory()))))',
        child, child, parent_col, parent_col
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$ BEGIN
  CREATE POLICY tank_contents_select ON public.tank_contents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tanks t WHERE t.id = tank_id AND (public.is_admin() OR public.can_access_factory_site(t.factory_site_id))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY tank_contents_write ON public.tank_contents FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.tanks t WHERE t.id = tank_id AND (public.is_admin() OR (public.can_access_factory_site(t.factory_site_id) AND public.is_agent_or_above_factory()))))
    WITH CHECK (EXISTS (SELECT 1 FROM public.tanks t WHERE t.id = tank_id AND (public.is_admin() OR (public.can_access_factory_site(t.factory_site_id) AND public.is_agent_or_above_factory()))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.production_orders IS 'Ordres de fabrication MES (OF)';
COMMENT ON TABLE public.operation_runs IS 'Exécution d''une étape de recette / OF';
COMMENT ON TABLE public.tanks IS 'Cuves process (masse, beurre, etc.)';
