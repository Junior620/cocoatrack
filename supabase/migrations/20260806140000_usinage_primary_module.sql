-- ============================================================================
-- Usinage primaire CDC — Phase A/B/C foundations
-- Extends factory module: genealogy, grades ONCC, WMS light, packaging, departments
-- Migration: 20260806140000_usinage_primary_module.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.cocoa_lot_status AS ENUM (
    'draft',
    'received',
    'quarantine',
    'qc_in_progress',
    'accepted',
    'to_clean',
    'to_dry',
    'in_processing',
    'packaged',
    'stored',
    'reserved',
    'dispatched',
    'blocked',
    'downgraded',
    'rejected',
    'under_investigation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.oncc_grade AS ENUM (
    'grade_i',
    'grade_ii',
    'hors_standard',
    'rebut'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.factory_department AS ENUM (
    'direction',
    'approvisionnement',
    'reception',
    'qualite',
    'tracabilite',
    'usinage',
    'magasin',
    'logistique',
    'maintenance',
    'qhse',
    'commercial',
    'finance',
    'informatique',
    'audit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.packaging_unit_type AS ENUM (
    'bag',
    'big_bag',
    'pallet',
    'bulk'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_status AS ENUM (
    'draft',
    'preparing',
    'ready',
    'loading',
    'shipped',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend transformation_type with primary processing ops
DO $$ BEGIN
  ALTER TYPE public.transformation_type ADD VALUE IF NOT EXISTS 'drying';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.transformation_type ADD VALUE IF NOT EXISTS 'sorting';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.transformation_type ADD VALUE IF NOT EXISTS 'blending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.transformation_type ADD VALUE IF NOT EXISTS 'packaging';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Profiles: department + segregation of duties flag
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS factory_department public.factory_department,
  ADD COLUMN IF NOT EXISTS can_solo_validate_lot BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Phase A: delivery ↔ parcelle shares (multi-parcelle + poids)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_parcelle_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  parcelle_id UUID NOT NULL REFERENCES public.parcelles(id) ON DELETE RESTRICT,
  weight_kg NUMERIC(12, 2) NOT NULL CHECK (weight_kg > 0),
  share_percent NUMERIC(6, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (delivery_id, parcelle_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_parcelle_shares_delivery
  ON public.delivery_parcelle_shares(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_parcelle_shares_parcelle
  ON public.delivery_parcelle_shares(parcelle_id);

COMMENT ON TABLE public.delivery_parcelle_shares IS
  'Contribution parcelle → livraison (poids) pour traçabilité EUDR / généalogie';

-- ---------------------------------------------------------------------------
-- Cocoa lots (unified lot entity over receipt / stock / output)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cocoa_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  status public.cocoa_lot_status NOT NULL DEFAULT 'draft',
  oncc_grade public.oncc_grade,
  campaign_year INTEGER,
  net_weight_kg NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (net_weight_kg >= 0),
  gross_weight_kg NUMERIC(12, 2),
  tare_kg NUMERIC(12, 2),
  bag_count INTEGER,
  moisture_pct NUMERIC(6, 2),
  source_receipt_id UUID REFERENCES public.factory_receipts(id) ON DELETE SET NULL,
  source_stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  source_output_id UUID REFERENCES public.transformation_outputs(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  storage_location_id UUID, -- FK added after storage_locations
  blocked_reason TEXT,
  eudr_ready BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_cocoa_lots_site_status
  ON public.cocoa_lots(factory_site_id, status);
CREATE INDEX IF NOT EXISTS idx_cocoa_lots_receipt
  ON public.cocoa_lots(source_receipt_id);

CREATE OR REPLACE FUNCTION public.set_cocoa_lot_number()
RETURNS TRIGGER SET search_path = public AS $$
DECLARE
  v_site_code TEXT;
BEGIN
  IF NEW.lot_number IS NULL OR NEW.lot_number = '' THEN
    SELECT code INTO v_site_code FROM public.factory_sites WHERE id = NEW.factory_site_id;
    NEW.lot_number := public.generate_factory_code('CM-' || COALESCE(v_site_code, 'SITE'));
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_cocoa_lot_number_trigger ON public.cocoa_lots;
CREATE TRIGGER set_cocoa_lot_number_trigger
  BEFORE INSERT OR UPDATE ON public.cocoa_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_cocoa_lot_number();

-- Lot status history (immutable audit of status changes)
CREATE TABLE IF NOT EXISTS public.lot_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE CASCADE,
  from_status public.cocoa_lot_status,
  to_status public.cocoa_lot_status NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lot_status_history_lot
  ON public.lot_status_history(lot_id, changed_at DESC);

-- Lot relationships (genealogy parent → child)
CREATE TABLE IF NOT EXISTS public.lot_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  child_lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  transformation_order_id UUID REFERENCES public.transformation_orders(id) ON DELETE SET NULL,
  weight_kg NUMERIC(12, 2) NOT NULL CHECK (weight_kg > 0),
  contribution_percent NUMERIC(6, 2),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_lot_id <> child_lot_id),
  UNIQUE (parent_lot_id, child_lot_id, transformation_order_id)
);

CREATE INDEX IF NOT EXISTS idx_lot_relationships_parent
  ON public.lot_relationships(parent_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_relationships_child
  ON public.lot_relationships(child_lot_id);

-- Lot sources (link lot → deliveries / planteurs / parcelles)
CREATE TABLE IF NOT EXISTS public.lot_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  planteur_id UUID REFERENCES public.planteurs(id) ON DELETE SET NULL,
  parcelle_id UUID REFERENCES public.parcelles(id) ON DELETE SET NULL,
  weight_kg NUMERIC(12, 2) NOT NULL CHECK (weight_kg > 0),
  contribution_percent NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lot_sources_lot ON public.lot_sources(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_sources_parcelle ON public.lot_sources(parcelle_id);

-- ---------------------------------------------------------------------------
-- Grade rules (paramétrables / versionnées)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grade_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_year INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  moisture_target_max NUMERIC(6, 2) NOT NULL DEFAULT 7.5,
  moisture_alert_max NUMERIC(6, 2) NOT NULL DEFAULT 8.0,
  moisture_block_above NUMERIC(6, 2) NOT NULL DEFAULT 8.0,
  mold_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 3,
  slate_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 8,
  insect_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 2,
  foreign_matter_max_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.5,
  mass_balance_tolerance_pct NUMERIC(6, 2) NOT NULL DEFAULT 2.0,
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, name, version)
);

-- Quality decision audit
CREATE TABLE IF NOT EXISTS public.quality_decision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_control_id UUID NOT NULL REFERENCES public.quality_controls(id) ON DELETE CASCADE,
  from_decision public.quality_decision,
  to_decision public.quality_decision NOT NULL,
  justification TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Extend quality_controls with cut-test fields
ALTER TABLE public.quality_controls
  ADD COLUMN IF NOT EXISTS sample_id TEXT,
  ADD COLUMN IF NOT EXISTS seal_number TEXT,
  ADD COLUMN IF NOT EXISTS slate_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS germinated_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS insect_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS underfermented_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS overfermented_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS foreign_matter_rate NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS smoke_odor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mold_odor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chemical_odor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS oncc_grade public.oncc_grade,
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL;

-- Stock items: link to cocoa_lots + location
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oncc_grade public.oncc_grade;

-- Factory receipts: campaign + tare
ALTER TABLE public.factory_receipts
  ADD COLUMN IF NOT EXISTS campaign_year INTEGER,
  ADD COLUMN IF NOT EXISTS tare_kg NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cocoa_lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- WMS light: zones + locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'general'
    CHECK (zone_type IN (
      'reception', 'quarantine', 'drying', 'compliant', 'blocked',
      'shipping', 'general'
    )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, code)
);

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.storage_zones(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  aisle TEXT,
  row_label TEXT,
  bin TEXT,
  qr_code TEXT,
  capacity_kg NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, code)
);

ALTER TABLE public.cocoa_lots
  DROP CONSTRAINT IF EXISTS cocoa_lots_storage_location_id_fkey;
ALTER TABLE public.cocoa_lots
  ADD CONSTRAINT cocoa_lots_storage_location_id_fkey
  FOREIGN KEY (storage_location_id) REFERENCES public.storage_locations(id) ON DELETE SET NULL;

ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS from_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Packaging units (bags / pallets)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.packaging_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  unit_type public.packaging_unit_type NOT NULL DEFAULT 'bag',
  unit_number TEXT NOT NULL,
  qr_code TEXT,
  parent_unit_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL,
  gross_weight_kg NUMERIC(12, 2),
  tare_kg NUMERIC(12, 2),
  net_weight_kg NUMERIC(12, 2) NOT NULL CHECK (net_weight_kg >= 0),
  oncc_grade public.oncc_grade,
  campaign_year INTEGER,
  storage_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reserved', 'dispatched', 'damaged', 'destroyed')),
  packaged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  packaged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_packaging_units_lot ON public.packaging_units(lot_id);
CREATE INDEX IF NOT EXISTS idx_packaging_units_qr ON public.packaging_units(qr_code)
  WHERE qr_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Dispatches (expédition)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.factory_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  dispatch_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  client_shipment_id UUID REFERENCES public.client_shipments(id) ON DELETE SET NULL,
  status public.dispatch_status NOT NULL DEFAULT 'draft',
  destination TEXT,
  product_label TEXT,
  requested_grade public.oncc_grade,
  requested_weight_kg NUMERIC(12, 2),
  container_number TEXT,
  seal_number TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  port TEXT,
  departure_date DATE,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_moisture_pct NUMERIC(6, 2),
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_site_id, dispatch_number)
);

CREATE OR REPLACE FUNCTION public.set_factory_dispatch_number()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
  IF NEW.dispatch_number IS NULL OR NEW.dispatch_number = '' THEN
    NEW.dispatch_number := public.generate_factory_code('EXP');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_factory_dispatch_number_trigger ON public.factory_dispatches;
CREATE TRIGGER set_factory_dispatch_number_trigger
  BEFORE INSERT OR UPDATE ON public.factory_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.set_factory_dispatch_number();

CREATE TABLE IF NOT EXISTS public.dispatch_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.factory_dispatches(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.cocoa_lots(id) ON DELETE RESTRICT,
  packaging_unit_id UUID REFERENCES public.packaging_units(id) ON DELETE SET NULL,
  weight_kg NUMERIC(12, 2) NOT NULL CHECK (weight_kg > 0),
  bag_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dispatch_id, lot_id, packaging_unit_id)
);

-- ---------------------------------------------------------------------------
-- Traceability events (EPCIS-style light journal)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.traceability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_site_id UUID NOT NULL REFERENCES public.factory_sites(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  lot_id UUID REFERENCES public.cocoa_lots(id) ON DELETE SET NULL,
  what_ref TEXT,
  when_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  where_location_id UUID REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  why_biz_step TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traceability_events_lot
  ON public.traceability_events(lot_id, when_at DESC);

-- ---------------------------------------------------------------------------
-- Guards: blocked lots cannot be used in transformation inputs / dispatch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_lot_operable(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_status public.cocoa_lot_status;
BEGIN
  SELECT status INTO v_status FROM public.cocoa_lots WHERE id = p_lot_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'LOT_NOT_FOUND: %', p_lot_id;
  END IF;
  IF v_status IN ('blocked', 'rejected', 'under_investigation', 'draft') THEN
    RAISE EXCEPTION 'LOT_NOT_OPERABLE: status=%', v_status;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_stock_item_operable(p_stock_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_status public.stock_item_status;
  v_lot_id UUID;
BEGIN
  SELECT status, cocoa_lot_id INTO v_status, v_lot_id
  FROM public.stock_items WHERE id = p_stock_item_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'STOCK_NOT_FOUND: %', p_stock_item_id;
  END IF;
  IF v_status IN ('blocked', 'quarantine', 'depleted') THEN
    RAISE EXCEPTION 'STOCK_NOT_OPERABLE: status=%', v_status;
  END IF;
  IF v_lot_id IS NOT NULL THEN
    PERFORM public.assert_lot_operable(v_lot_id);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Mass balance helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_mass_balance(
  p_input_kg NUMERIC,
  p_output_kg NUMERIC,
  p_waste_kg NUMERIC,
  p_tolerance_pct NUMERIC DEFAULT 2.0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_delta NUMERIC;
  v_allowed NUMERIC;
BEGIN
  IF p_input_kg IS NULL OR p_input_kg <= 0 THEN
    RETURN false;
  END IF;
  v_delta := ABS(p_input_kg - (COALESCE(p_output_kg, 0) + COALESCE(p_waste_kg, 0)));
  v_allowed := p_input_kg * (COALESCE(p_tolerance_pct, 2.0) / 100.0);
  RETURN v_delta <= v_allowed;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.delivery_parcelle_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cocoa_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_decision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traceability_events ENABLE ROW LEVEL SECURITY;

-- Reuse factory site access pattern
DO $$ BEGIN
  CREATE POLICY delivery_parcelle_shares_select ON public.delivery_parcelle_shares
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY delivery_parcelle_shares_write ON public.delivery_parcelle_shares
    FOR ALL TO authenticated
    USING (public.is_manager_or_above() OR public.is_admin())
    WITH CHECK (public.is_manager_or_above() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cocoa_lots_select ON public.cocoa_lots
    FOR SELECT TO authenticated
    USING (
      public.is_admin()
      OR factory_site_id = public.get_user_factory_site_id()
      OR public.can_access_factory_site(factory_site_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY cocoa_lots_write ON public.cocoa_lots
    FOR ALL TO authenticated
    USING (
      public.is_admin()
      OR (
        factory_site_id = public.get_user_factory_site_id()
        AND public.is_manager_or_above()
      )
    )
    WITH CHECK (
      public.is_admin()
      OR (
        factory_site_id = public.get_user_factory_site_id()
        AND public.is_manager_or_above()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Site-scoped tables
DO $$ BEGIN
  CREATE POLICY grade_rules_select ON public.grade_rules FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id) OR factory_site_id = public.get_user_factory_site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY grade_rules_write ON public.grade_rules FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY storage_zones_select ON public.storage_zones FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY storage_zones_write ON public.storage_zones FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY storage_locations_select ON public.storage_locations FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY storage_locations_write ON public.storage_locations FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY packaging_units_select ON public.packaging_units FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY packaging_units_write ON public.packaging_units FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY factory_dispatches_select ON public.factory_dispatches FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY factory_dispatches_write ON public.factory_dispatches FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY traceability_events_select ON public.traceability_events FOR SELECT TO authenticated
    USING (public.is_admin() OR public.can_access_factory_site(factory_site_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY traceability_events_write ON public.traceability_events FOR ALL TO authenticated
    USING (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()))
    WITH CHECK (public.is_admin() OR (public.can_access_factory_site(factory_site_id) AND public.is_agent_or_above_factory()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Child tables (join via parent)
DO $$ BEGIN
  CREATE POLICY lot_status_history_select ON public.lot_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR public.can_access_factory_site(l.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY lot_status_history_write ON public.lot_status_history FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY lot_relationships_select ON public.lot_relationships FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = parent_lot_id AND (public.is_admin() OR public.can_access_factory_site(l.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY lot_relationships_write ON public.lot_relationships FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = parent_lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = parent_lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY lot_sources_select ON public.lot_sources FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR public.can_access_factory_site(l.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY lot_sources_write ON public.lot_sources FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.cocoa_lots l
      WHERE l.id = lot_id AND (public.is_admin() OR (public.can_access_factory_site(l.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY quality_decision_history_select ON public.quality_decision_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.quality_controls qc
      WHERE qc.id = quality_control_id AND (public.is_admin() OR public.can_access_factory_site(qc.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY quality_decision_history_write ON public.quality_decision_history FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.quality_controls qc
      WHERE qc.id = quality_control_id AND (public.is_admin() OR (public.can_access_factory_site(qc.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.quality_controls qc
      WHERE qc.id = quality_control_id AND (public.is_admin() OR (public.can_access_factory_site(qc.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dispatch_lots_select ON public.dispatch_lots FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.factory_dispatches d
      WHERE d.id = dispatch_id AND (public.is_admin() OR public.can_access_factory_site(d.factory_site_id))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY dispatch_lots_write ON public.dispatch_lots FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.factory_dispatches d
      WHERE d.id = dispatch_id AND (public.is_admin() OR (public.can_access_factory_site(d.factory_site_id) AND public.is_agent_or_above_factory()))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.factory_dispatches d
      WHERE d.id = dispatch_id AND (public.is_admin() OR (public.can_access_factory_site(d.factory_site_id) AND public.is_agent_or_above_factory()))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.cocoa_lots IS 'Lot cacao unifié (réception / usinage / stock / expédition)';
COMMENT ON TABLE public.lot_relationships IS 'Généalogie parent→enfant avec poids de contribution';
COMMENT ON TABLE public.grade_rules IS 'Règles qualité ONCC paramétrables / versionnées par campagne';
