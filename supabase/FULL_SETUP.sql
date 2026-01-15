-- ============================================================================
-- CocoaTrack V2 - COMPLETE DATABASE SETUP (ALL MIGRATIONS)
-- Execute this script in Supabase SQL Editor to set up the entire database
-- This combines ALL 19 migration files into one executable script
-- ============================================================================

-- ============================================================================
-- MIGRATION 0: EXTENSIONS & ENUMS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- User roles
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'agent', 'viewer');

-- Validation status for chef_planteurs
CREATE TYPE public.validation_status AS ENUM ('pending', 'validated', 'rejected');

-- Quality grades for deliveries
CREATE TYPE public.quality_grade AS ENUM ('A', 'B', 'C');

-- Payment status for deliveries
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid');

-- Invoice status
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');

-- Conversation type for messaging
CREATE TYPE public.conversation_type AS ENUM ('direct', 'group');

-- Audit action type
CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ============================================================================
-- MIGRATION 0: CORE TABLES
-- ============================================================================

-- Regions table
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cooperatives table
CREATE TABLE public.cooperatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  region_id UUID NOT NULL REFERENCES public.regions(id),
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'viewer',
  cooperative_id UUID REFERENCES public.cooperatives(id),
  region_id UUID REFERENCES public.regions(id),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  password_reset_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  capacity_kg NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chef Planteurs (Suppliers) table
CREATE TABLE public.chef_planteurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  phone TEXT,
  cni TEXT,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  region TEXT,
  departement TEXT,
  localite TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  quantite_max_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  termination_reason TEXT,
  validation_status public.validation_status NOT NULL DEFAULT 'pending',
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Planteurs table
CREATE TABLE public.planteurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  phone TEXT,
  cni TEXT,
  chef_planteur_id UUID NOT NULL REFERENCES public.chef_planteurs(id),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery code counters (for unique code generation)
CREATE TABLE public.delivery_code_counters (
  date DATE PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  planteur_id UUID NOT NULL REFERENCES public.planteurs(id),
  chef_planteur_id UUID NOT NULL REFERENCES public.chef_planteurs(id),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  weight_kg NUMERIC(10,2) NOT NULL,
  price_per_kg NUMERIC(10,2) NOT NULL,
  total_amount BIGINT NOT NULL,
  quality_grade public.quality_grade NOT NULL DEFAULT 'B',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_amount_paid BIGINT NOT NULL DEFAULT 0,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery photos table
CREATE TABLE public.delivery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  cooperative_id UUID REFERENCES public.cooperatives(id),
  chef_planteur_id UUID REFERENCES public.chef_planteurs(id),
  planteur_id UUID REFERENCES public.planteurs(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pdf_path TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_has_target CHECK (
    cooperative_id IS NOT NULL OR chef_planteur_id IS NOT NULL OR planteur_id IS NOT NULL
  )
);

-- Invoice code counters table (monthly reset)
CREATE TABLE public.invoice_code_counters (
  month TEXT PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Invoice-Delivery link table
CREATE TABLE public.invoice_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invoice_id, delivery_id)
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type public.conversation_type NOT NULL DEFAULT 'direct',
  name TEXT,
  participants UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL,
  attachments JSONB,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id),
  actor_type TEXT NOT NULL DEFAULT 'user',
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  action public.audit_action NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth events table
CREATE TABLE public.auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync processed table (for idempotent sync operations)
CREATE TABLE public.sync_processed (
  idempotency_key UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB
);

-- Dashboard aggregates table (for fast dashboard queries)
CREATE TABLE public.dashboard_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  period_date DATE NOT NULL,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount_xaf BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cooperative_id, period_date)
);

-- Push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);


-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_profiles_cooperative ON public.profiles(cooperative_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_cooperatives_region ON public.cooperatives(region_id);
CREATE INDEX idx_warehouses_cooperative ON public.warehouses(cooperative_id);
CREATE INDEX idx_chef_planteurs_cooperative_status ON public.chef_planteurs(cooperative_id, validation_status);
CREATE INDEX idx_chef_planteurs_cooperative_created ON public.chef_planteurs(cooperative_id, created_at);
CREATE INDEX idx_chef_planteurs_location ON public.chef_planteurs(latitude, longitude);
CREATE INDEX idx_chef_planteurs_cooperative_name ON public.chef_planteurs(cooperative_id, name);
CREATE INDEX idx_planteurs_chef ON public.planteurs(chef_planteur_id);
CREATE INDEX idx_planteurs_cooperative ON public.planteurs(cooperative_id);
CREATE INDEX idx_planteurs_cooperative_created ON public.planteurs(cooperative_id, created_at);
CREATE INDEX idx_planteurs_location ON public.planteurs(latitude, longitude);
CREATE INDEX idx_planteurs_cooperative_name ON public.planteurs(cooperative_id, name);
CREATE INDEX idx_deliveries_planteur_date ON public.deliveries(planteur_id, delivered_at DESC);
CREATE INDEX idx_deliveries_chef_planteur ON public.deliveries(chef_planteur_id, delivered_at DESC);
CREATE INDEX idx_deliveries_cooperative ON public.deliveries(cooperative_id);
CREATE INDEX idx_deliveries_cooperative_created ON public.deliveries(cooperative_id, created_at);
CREATE INDEX idx_deliveries_code ON public.deliveries(code);
CREATE INDEX idx_deliveries_warehouse ON public.deliveries(warehouse_id);
CREATE INDEX idx_invoices_cooperative ON public.invoices(cooperative_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_deliveries_invoice ON public.invoice_deliveries(invoice_id);
CREATE INDEX idx_invoice_deliveries_delivery ON public.invoice_deliveries(delivery_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_audit_log_table_row ON public.audit_log(table_name, row_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_table_date ON public.audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log(action, created_at DESC);
CREATE INDEX idx_auth_events_user ON public.auth_events(user_id, created_at DESC);
CREATE INDEX idx_auth_events_type ON public.auth_events(event_type, created_at DESC);
CREATE INDEX idx_dashboard_aggregates_coop_date ON public.dashboard_aggregates(cooperative_id, period_date DESC);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX idx_conversations_participants ON public.conversations USING GIN(participants);
CREATE INDEX idx_messages_read_by ON public.messages USING GIN(read_by);

-- Trigram indexes for fuzzy search
CREATE INDEX idx_chef_planteurs_name_trgm ON public.chef_planteurs USING GIN (name gin_trgm_ops);
CREATE INDEX idx_chef_planteurs_code_trgm ON public.chef_planteurs USING GIN (code gin_trgm_ops);
CREATE INDEX idx_chef_planteurs_phone_trgm ON public.chef_planteurs USING GIN (phone gin_trgm_ops);
CREATE INDEX idx_planteurs_name_trgm ON public.planteurs USING GIN (name gin_trgm_ops);
CREATE INDEX idx_planteurs_code_trgm ON public.planteurs USING GIN (code gin_trgm_ops);
CREATE INDEX idx_planteurs_phone_trgm ON public.planteurs USING GIN (phone gin_trgm_ops);

-- ============================================================================
-- CORE FUNCTIONS
-- ============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle new user function (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer',
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log auth event function
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.auth_events (user_id, event_type, ip_address, user_agent, metadata)
  VALUES (p_user_id, p_event_type, p_ip_address, p_user_agent, p_metadata)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'viewer'::public.user_role);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_cooperative_id()
RETURNS UUID
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_cooperative_id UUID;
BEGIN
  SELECT cooperative_id INTO v_cooperative_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_cooperative_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_region_id()
RETURNS UUID
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_region_id UUID;
BEGIN
  SELECT region_id INTO v_region_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_region_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() = 'admin'::public.user_role;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin'::public.user_role, 'manager'::public.user_role);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_agent_or_above()
RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin'::public.user_role, 'manager'::public.user_role, 'agent'::public.user_role);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_access_cooperative(p_cooperative_id UUID)
RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  RETURN public.get_user_cooperative_id() = p_cooperative_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- DELIVERY & PLANTEUR FUNCTIONS
-- ============================================================================

-- Sync planteur cooperative_id from chef_planteur
CREATE OR REPLACE FUNCTION public.sync_planteur_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_chef_cooperative_id UUID;
BEGIN
  SELECT cooperative_id INTO v_chef_cooperative_id FROM public.chef_planteurs WHERE id = NEW.chef_planteur_id;
  IF v_chef_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'Chef planteur with id % does not exist', NEW.chef_planteur_id;
  END IF;
  NEW.cooperative_id := v_chef_cooperative_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync delivery cooperative_id from chef_planteur
CREATE OR REPLACE FUNCTION public.sync_delivery_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_chef_cooperative_id UUID;
BEGIN
  SELECT cooperative_id INTO v_chef_cooperative_id FROM public.chef_planteurs WHERE id = NEW.chef_planteur_id;
  IF v_chef_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'Invalid chef_planteur_id: %. Chef planteur not found or has no cooperative.', NEW.chef_planteur_id;
  END IF;
  NEW.cooperative_id := v_chef_cooperative_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate delivery total
CREATE OR REPLACE FUNCTION public.calculate_delivery_total()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.total_amount := round(NEW.weight_kg * NEW.price_per_kg)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Daily delivery sequence
CREATE OR REPLACE FUNCTION public.next_daily_delivery_seq(p_date DATE)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE v_seq INTEGER;
BEGIN
  INSERT INTO public.delivery_code_counters (date, counter)
  VALUES (p_date, 1)
  ON CONFLICT (date) DO UPDATE SET counter = public.delivery_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

-- Generate delivery code
CREATE OR REPLACE FUNCTION public.generate_delivery_code()
RETURNS TEXT
SET search_path = public
AS $$
DECLARE
  v_date DATE := current_date;
  v_seq INTEGER;
BEGIN
  v_seq := public.next_daily_delivery_seq(v_date);
  RETURN 'DEL-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Set delivery code trigger
CREATE OR REPLACE FUNCTION public.set_delivery_code()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_delivery_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lock paid delivery fields
CREATE OR REPLACE FUNCTION public.lock_paid_delivery_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_user_role public.user_role;
BEGIN
  IF OLD.payment_status = 'paid' THEN
    v_user_role := public.get_user_role();
    IF v_user_role IN ('admin', 'manager') THEN RETURN NEW; END IF;
    IF NEW.weight_kg IS DISTINCT FROM OLD.weight_kg THEN
      RAISE EXCEPTION 'Cannot modify weight_kg on paid delivery. Contact a manager.';
    END IF;
    IF NEW.price_per_kg IS DISTINCT FROM OLD.price_per_kg THEN
      RAISE EXCEPTION 'Cannot modify price_per_kg on paid delivery. Contact a manager.';
    END IF;
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION 'Cannot modify total_amount on paid delivery. Contact a manager.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INVOICE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.next_monthly_invoice_seq(p_month TEXT)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE v_seq INTEGER;
BEGIN
  INSERT INTO public.invoice_code_counters (month, counter)
  VALUES (p_month, 1)
  ON CONFLICT (month) DO UPDATE SET counter = public.invoice_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_invoice_code()
RETURNS TEXT
SET search_path = public
AS $$
DECLARE
  v_month TEXT := to_char(current_date, 'YYYYMM');
  v_seq INTEGER;
BEGIN
  v_seq := public.next_monthly_invoice_seq(v_month);
  RETURN 'INV-' || v_month || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_invoice_code()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_invoice_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Lock invoiced delivery fields
CREATE OR REPLACE FUNCTION public.lock_invoiced_delivery_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_invoiced BOOLEAN;
  v_user_role TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.invoice_deliveries id
    JOIN public.invoices i ON i.id = id.invoice_id
    WHERE id.delivery_id = OLD.id AND i.status != 'draft'
  ) INTO v_is_invoiced;
  
  IF NOT v_is_invoiced THEN RETURN NEW; END IF;
  
  v_user_role := public.get_user_role();
  IF v_user_role = 'admin' THEN RETURN NEW; END IF;
  
  IF NEW.weight_kg != OLD.weight_kg OR NEW.price_per_kg != OLD.price_per_kg 
     OR NEW.total_amount != OLD.total_amount OR NEW.planteur_id != OLD.planteur_id
     OR NEW.chef_planteur_id != OLD.chef_planteur_id OR NEW.delivered_at != OLD.delivered_at THEN
    RAISE EXCEPTION 'Cannot modify critical fields on invoiced delivery. Contact an administrator.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.prevent_invoiced_delivery_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_invoiced BOOLEAN;
  v_user_role TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.invoice_deliveries WHERE delivery_id = OLD.id) INTO v_is_invoiced;
  IF NOT v_is_invoiced THEN RETURN OLD; END IF;
  v_user_role := public.get_user_role();
  IF v_user_role = 'admin' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Cannot delete invoiced delivery. Contact an administrator.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_delivery_invoiced(p_delivery_id UUID)
RETURNS BOOLEAN
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.invoice_deliveries WHERE delivery_id = p_delivery_id);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_delivery_invoice_id(p_delivery_id UUID)
RETURNS UUID
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT invoice_id FROM public.invoice_deliveries WHERE delivery_id = p_delivery_id LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- CHEF PLANTEUR VALIDATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_chef_planteur(
  p_chef_planteur_id UUID,
  p_validated_by UUID DEFAULT NULL
)
RETURNS public.chef_planteurs
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result public.chef_planteurs;
  v_validator_id UUID;
BEGIN
  v_validator_id := COALESCE(p_validated_by, auth.uid());
  IF NOT public.is_manager_or_above() THEN
    RAISE EXCEPTION 'Only managers and admins can validate chef_planteurs';
  END IF;
  UPDATE public.chef_planteurs
  SET validation_status = 'validated', validated_by = v_validator_id, validated_at = NOW(), rejection_reason = NULL
  WHERE id = p_chef_planteur_id
    AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id())
  RETURNING * INTO v_result;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Chef planteur not found or access denied';
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reject_chef_planteur(
  p_chef_planteur_id UUID,
  p_rejection_reason TEXT,
  p_rejected_by UUID DEFAULT NULL
)
RETURNS public.chef_planteurs
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result public.chef_planteurs;
  v_rejector_id UUID;
BEGIN
  v_rejector_id := COALESCE(p_rejected_by, auth.uid());
  IF NOT public.is_manager_or_above() THEN
    RAISE EXCEPTION 'Only managers and admins can reject chef_planteurs';
  END IF;
  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  UPDATE public.chef_planteurs
  SET validation_status = 'rejected', validated_by = v_rejector_id, validated_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_chef_planteur_id
    AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id())
  RETURNING * INTO v_result;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Chef planteur not found or access denied';
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DASHBOARD AGGREGATES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_dashboard_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_old_day DATE;
  v_new_day DATE;
  v_old_coop_id UUID;
  v_new_coop_id UUID;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_day := OLD.delivered_at::date;
    v_old_coop_id := OLD.cooperative_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_day := NEW.delivered_at::date;
    v_new_coop_id := NEW.cooperative_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries - 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
      updated_at = NOW();
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries + 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
      updated_at = NOW();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_day != v_new_day OR v_old_coop_id != v_new_coop_id THEN
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries - 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
        updated_at = NOW();
      
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries + 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
        updated_at = NOW();
    ELSE
      UPDATE public.dashboard_aggregates SET
        total_weight_kg = total_weight_kg + (NEW.weight_kg - OLD.weight_kg),
        total_amount_xaf = total_amount_xaf + (NEW.total_amount - OLD.total_amount),
        updated_at = NOW()
      WHERE cooperative_id = v_new_coop_id AND period_date = v_new_day;
      
      IF NOT FOUND THEN
        INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
        VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.backfill_dashboard_aggregates()
RETURNS TABLE (
  cooperative_id UUID,
  period_date DATE,
  total_deliveries BIGINT,
  total_weight_kg NUMERIC,
  total_amount_xaf BIGINT
) AS $$
BEGIN
  DELETE FROM public.dashboard_aggregates;
  
  INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
  SELECT 
    d.cooperative_id,
    d.delivered_at::date AS period_date,
    COUNT(*)::integer AS total_deliveries,
    COALESCE(SUM(d.weight_kg), 0) AS total_weight_kg,
    COALESCE(SUM(d.total_amount), 0) AS total_amount_xaf
  FROM public.deliveries d
  GROUP BY d.cooperative_id, d.delivered_at::date
  ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    total_weight_kg = EXCLUDED.total_weight_kg,
    total_amount_xaf = EXCLUDED.total_amount_xaf,
    updated_at = NOW();
  
  RETURN QUERY
  SELECT da.cooperative_id, da.period_date, da.total_deliveries::bigint, da.total_weight_kg, da.total_amount_xaf
  FROM public.dashboard_aggregates da
  ORDER BY da.cooperative_id, da.period_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SYNC OPERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_operation(
  p_idempotency_key UUID,
  p_table TEXT,
  p_operation TEXT,
  p_record_id UUID,
  p_data JSONB
)
RETURNS JSONB
SET search_path = public, auth
AS $$
DECLARE
  v_existing RECORD;
  v_allowed_tables TEXT[] := ARRAY['deliveries', 'planteurs', 'chef_planteurs'];
  v_allowed_ops TEXT[] := ARRAY['CREATE', 'UPDATE', 'DELETE'];
  v_result JSONB;
  v_chef_planteur_coop_id UUID;
BEGIN
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'INVALID_TABLE', 'message', format('Table "%s" is not allowed', p_table));
  END IF;
  
  IF NOT (p_operation = ANY(v_allowed_ops)) THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'INVALID_OPERATION', 'message', format('Operation "%s" is not allowed', p_operation));
  END IF;
  
  SELECT * INTO v_existing FROM public.sync_processed WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already_processed', 'code', 'ALREADY_PROCESSED', 'result', v_existing.result);
  END IF;
  
  CASE p_table
    WHEN 'deliveries' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          INSERT INTO public.deliveries (id, planteur_id, chef_planteur_id, warehouse_id, weight_kg, price_per_kg, quality_grade, notes, delivered_at, created_by)
          VALUES (p_record_id, (p_data->>'planteur_id')::uuid, (p_data->>'chef_planteur_id')::uuid, (p_data->>'warehouse_id')::uuid, (p_data->>'weight_kg')::numeric, (p_data->>'price_per_kg')::numeric, COALESCE((p_data->>'quality_grade')::public.quality_grade, 'B'), p_data->>'notes', COALESCE((p_data->>'delivered_at')::timestamptz, NOW()), auth.uid());
        WHEN 'UPDATE' THEN
          UPDATE public.deliveries SET weight_kg = COALESCE((p_data->>'weight_kg')::numeric, weight_kg), price_per_kg = COALESCE((p_data->>'price_per_kg')::numeric, price_per_kg), quality_grade = COALESCE((p_data->>'quality_grade')::public.quality_grade, quality_grade), notes = COALESCE(p_data->>'notes', notes), delivered_at = COALESCE((p_data->>'delivered_at')::timestamptz, delivered_at), updated_at = NOW() WHERE id = p_record_id;
        WHEN 'DELETE' THEN
          DELETE FROM public.deliveries WHERE id = p_record_id;
      END CASE;
    WHEN 'planteurs' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          SELECT cooperative_id INTO v_chef_planteur_coop_id FROM public.chef_planteurs WHERE id = (p_data->>'chef_planteur_id')::uuid;
          IF v_chef_planteur_coop_id IS NULL THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE', 'message', 'Chef planteur not found');
          END IF;
          INSERT INTO public.planteurs (id, name, code, phone, cni, chef_planteur_id, cooperative_id, latitude, longitude, is_active, created_by)
          VALUES (p_record_id, p_data->>'name', p_data->>'code', p_data->>'phone', p_data->>'cni', (p_data->>'chef_planteur_id')::uuid, v_chef_planteur_coop_id, (p_data->>'latitude')::float, (p_data->>'longitude')::float, COALESCE((p_data->>'is_active')::boolean, true), auth.uid());
        WHEN 'UPDATE' THEN
          UPDATE public.planteurs SET name = COALESCE(p_data->>'name', name), code = COALESCE(p_data->>'code', code), phone = COALESCE(p_data->>'phone', phone), cni = COALESCE(p_data->>'cni', cni), latitude = COALESCE((p_data->>'latitude')::float, latitude), longitude = COALESCE((p_data->>'longitude')::float, longitude), is_active = COALESCE((p_data->>'is_active')::boolean, is_active), updated_at = NOW() WHERE id = p_record_id;
        WHEN 'DELETE' THEN
          UPDATE public.planteurs SET is_active = false, updated_at = NOW() WHERE id = p_record_id;
      END CASE;
    WHEN 'chef_planteurs' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          INSERT INTO public.chef_planteurs (id, name, code, phone, cni, cooperative_id, region, departement, localite, latitude, longitude, quantite_max_kg, validation_status, created_by)
          VALUES (p_record_id, p_data->>'name', p_data->>'code', p_data->>'phone', p_data->>'cni', (p_data->>'cooperative_id')::uuid, p_data->>'region', p_data->>'departement', p_data->>'localite', (p_data->>'latitude')::float, (p_data->>'longitude')::float, COALESCE((p_data->>'quantite_max_kg')::numeric, 0), COALESCE((p_data->>'validation_status')::public.validation_status, 'pending'), auth.uid());
        WHEN 'UPDATE' THEN
          UPDATE public.chef_planteurs SET name = COALESCE(p_data->>'name', name), code = COALESCE(p_data->>'code', code), phone = COALESCE(p_data->>'phone', phone), cni = COALESCE(p_data->>'cni', cni), region = COALESCE(p_data->>'region', region), departement = COALESCE(p_data->>'departement', departement), localite = COALESCE(p_data->>'localite', localite), latitude = COALESCE((p_data->>'latitude')::float, latitude), longitude = COALESCE((p_data->>'longitude')::float, longitude), quantite_max_kg = COALESCE((p_data->>'quantite_max_kg')::numeric, quantite_max_kg), updated_at = NOW() WHERE id = p_record_id;
        WHEN 'DELETE' THEN
          DELETE FROM public.chef_planteurs WHERE id = p_record_id;
      END CASE;
  END CASE;
  
  v_result := jsonb_build_object('status', 'success');
  INSERT INTO public.sync_processed (idempotency_key, result) VALUES (p_idempotency_key, v_result);
  RETURN v_result;

EXCEPTION
  WHEN insufficient_privilege THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'FORBIDDEN', 'message', 'Access denied.');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'DUPLICATE', 'message', 'Record already exists.');
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'INVALID_REFERENCE', 'message', 'Referenced record not found.');
  WHEN check_violation THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'VALIDATION_ERROR', 'message', 'Data validation failed.');
  WHEN raise_exception THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'VALIDATION_ERROR', 'message', SQLERRM);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'INTERNAL_ERROR', 'message', 'An unexpected error occurred.');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.purge_sync_processed(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.sync_processed WHERE processed_at < NOW() - (p_days_to_keep || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sync_operation(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_sync_processed(INTEGER) TO authenticated;


-- ============================================================================
-- NOTIFICATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (p_user_id, p_type, p_title, p_body, p_payload)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.notifications SET read_at = NOW() WHERE id = p_notification_id AND user_id = auth.uid() AND read_at IS NULL;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notifications SET read_at = NOW() WHERE user_id = auth.uid() AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM public.notifications WHERE user_id = auth.uid() AND read_at IS NULL);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_cooperative_managers(p_cooperative_id UUID)
RETURNS UUID[]
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_managers UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO v_managers
  FROM public.profiles
  WHERE ((role = 'manager' AND cooperative_id = p_cooperative_id) OR role = 'admin') AND is_active = true;
  RETURN COALESCE(v_managers, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MESSAGING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation_id UUID;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_current_user_id = p_other_user_id THEN RAISE EXCEPTION 'Cannot create conversation with yourself'; END IF;
  
  SELECT id INTO v_conversation_id FROM public.conversations
  WHERE type = 'direct' AND participants @> ARRAY[v_current_user_id, p_other_user_id] AND array_length(participants, 1) = 2 LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (type, participants, created_by)
    VALUES ('direct', ARRAY[v_current_user_id, p_other_user_id], v_current_user_id)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_group_conversation(p_name TEXT, p_participant_ids UUID[])
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation_id UUID;
  v_current_user_id UUID;
  v_all_participants UUID[];
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  IF NOT v_current_user_id = ANY(p_participant_ids) THEN
    v_all_participants := array_append(p_participant_ids, v_current_user_id);
  ELSE
    v_all_participants := p_participant_ids;
  END IF;
  
  INSERT INTO public.conversations (type, name, participants, created_by)
  VALUES ('group', p_name, v_all_participants, v_current_user_id)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_conversation_id AND v_current_user_id = ANY(participants)) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  UPDATE public.messages SET read_by = array_append(read_by, v_current_user_id)
  WHERE conversation_id = p_conversation_id AND NOT v_current_user_id = ANY(read_by) AND sender_id != v_current_user_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- NOTIFICATION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_delivery_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_managers UUID[];
  v_manager_id UUID;
  v_planteur_name TEXT;
  v_chef_planteur_name TEXT;
BEGIN
  SELECT p.name, cp.name INTO v_planteur_name, v_chef_planteur_name
  FROM public.planteurs p JOIN public.chef_planteurs cp ON p.chef_planteur_id = cp.id WHERE p.id = NEW.planteur_id;
  
  v_managers := public.get_cooperative_managers(NEW.cooperative_id);
  
  FOREACH v_manager_id IN ARRAY v_managers LOOP
    IF v_manager_id != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, type, title, body, payload)
      VALUES (v_manager_id, 'delivery_created', 'Nouvelle livraison enregistrée',
        format('Livraison de %s kg par %s (%s)', NEW.weight_kg::TEXT, COALESCE(v_planteur_name, 'Planteur inconnu'), COALESCE(v_chef_planteur_name, 'Chef planteur inconnu')),
        jsonb_build_object('delivery_id', NEW.id, 'delivery_code', NEW.code, 'planteur_id', NEW.planteur_id, 'chef_planteur_id', NEW.chef_planteur_id, 'weight_kg', NEW.weight_kg, 'total_amount', NEW.total_amount));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_on_chef_planteur_validation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF OLD.validation_status = NEW.validation_status THEN RETURN NEW; END IF;
  IF NEW.validation_status NOT IN ('validated', 'rejected') THEN RETURN NEW; END IF;
  
  IF NEW.validation_status = 'validated' THEN
    v_notification_type := 'chef_planteur_validated';
    v_title := 'Chef planteur validé';
    v_body := format('Le chef planteur "%s" a été validé.', NEW.name);
  ELSE
    v_notification_type := 'chef_planteur_rejected';
    v_title := 'Chef planteur rejeté';
    v_body := format('Le chef planteur "%s" a été rejeté. Raison: %s', NEW.name, COALESCE(NEW.rejection_reason, 'Non spécifiée'));
  END IF;
  
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (NEW.created_by, v_notification_type, v_title, v_body,
    jsonb_build_object('chef_planteur_id', NEW.id, 'chef_planteur_name', NEW.name, 'chef_planteur_code', NEW.code, 'validation_status', NEW.validation_status, 'validated_by', NEW.validated_by, 'rejection_reason', NEW.rejection_reason));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_on_invoice_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_managers UUID[];
  v_manager_id UUID;
  v_cooperative_name TEXT;
BEGIN
  SELECT name INTO v_cooperative_name FROM public.cooperatives WHERE id = NEW.cooperative_id;
  v_managers := public.get_cooperative_managers(NEW.cooperative_id);
  
  FOREACH v_manager_id IN ARRAY v_managers LOOP
    IF v_manager_id != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, type, title, body, payload)
      VALUES (v_manager_id, 'invoice_generated', 'Nouvelle facture générée',
        format('Facture %s pour %s - Montant: %s XAF', NEW.code, COALESCE(v_cooperative_name, 'Coopérative'), NEW.total_amount::TEXT),
        jsonb_build_object('invoice_id', NEW.id, 'invoice_code', NEW.code, 'cooperative_id', NEW.cooperative_id, 'total_amount', NEW.total_amount, 'period_start', NEW.period_start, 'period_end', NEW.period_end));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_on_message_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
  v_participant_id UUID;
  v_sender_name TEXT;
BEGIN
  SELECT * INTO v_conversation FROM public.conversations WHERE id = NEW.conversation_id;
  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  
  FOREACH v_participant_id IN ARRAY v_conversation.participants LOOP
    IF v_participant_id != NEW.sender_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, payload)
      VALUES (v_participant_id, 'message_received',
        CASE WHEN v_conversation.type = 'group' THEN format('Nouveau message dans %s', COALESCE(v_conversation.name, 'Groupe')) ELSE format('Message de %s', COALESCE(v_sender_name, 'Utilisateur')) END,
        LEFT(NEW.body, 100) || CASE WHEN LENGTH(NEW.body) > 100 THEN '...' ELSE '' END,
        jsonb_build_object('message_id', NEW.id, 'conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id, 'sender_name', v_sender_name, 'conversation_type', v_conversation.type, 'conversation_name', v_conversation.name));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_type TEXT;
  v_ip_address TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_row_id UUID;
BEGIN
  v_actor_id := auth.uid();
  v_actor_type := CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END;
  
  BEGIN
    v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF v_ip_address IS NOT NULL AND position(',' in v_ip_address) > 0 THEN
      v_ip_address := split_part(v_ip_address, ',', 1);
    END IF;
    v_ip_address := trim(v_ip_address);
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;
  
  CASE TG_OP
    WHEN 'INSERT' THEN v_row_id := NEW.id; v_old_data := NULL; v_new_data := to_jsonb(NEW);
    WHEN 'UPDATE' THEN v_row_id := NEW.id; v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    WHEN 'DELETE' THEN v_row_id := OLD.id; v_old_data := to_jsonb(OLD); v_new_data := NULL;
  END CASE;
  
  INSERT INTO public.audit_log (actor_id, actor_type, table_name, row_id, action, old_data, new_data, ip_address, created_at)
  VALUES (v_actor_id, v_actor_type, TG_TABLE_NAME, v_row_id, TG_OP::public.audit_action, v_old_data, v_new_data, v_ip_address, NOW());
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- ALL TRIGGERS
-- ============================================================================

-- Auth trigger
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_cooperatives_updated_at BEFORE UPDATE ON public.cooperatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chef_planteurs_updated_at BEFORE UPDATE ON public.chef_planteurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planteurs_updated_at BEFORE UPDATE ON public.planteurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dashboard_aggregates_updated_at BEFORE UPDATE ON public.dashboard_aggregates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Planteur/Delivery sync triggers
CREATE TRIGGER sync_planteur_cooperative_id_trigger BEFORE INSERT OR UPDATE OF chef_planteur_id ON public.planteurs FOR EACH ROW EXECUTE FUNCTION public.sync_planteur_cooperative_id();
CREATE TRIGGER sync_delivery_cooperative_id_trigger BEFORE INSERT OR UPDATE OF chef_planteur_id ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_cooperative_id();

-- Delivery triggers
CREATE TRIGGER calculate_delivery_total_trigger BEFORE INSERT OR UPDATE OF weight_kg, price_per_kg ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.calculate_delivery_total();
CREATE TRIGGER set_delivery_code_trigger BEFORE INSERT ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.set_delivery_code();
CREATE TRIGGER a_lock_paid_delivery_fields_trigger BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.lock_paid_delivery_fields();
CREATE TRIGGER lock_invoiced_delivery_fields_trigger BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.lock_invoiced_delivery_fields();
CREATE TRIGGER prevent_invoiced_delivery_delete_trigger BEFORE DELETE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.prevent_invoiced_delivery_delete();

-- Invoice triggers
CREATE TRIGGER set_invoice_code_trigger BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_code();

-- Dashboard aggregates trigger
CREATE TRIGGER delivery_update_aggregates AFTER INSERT OR UPDATE OR DELETE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_dashboard_aggregates();

-- Notification triggers
CREATE TRIGGER trigger_notify_delivery_created AFTER INSERT ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.notify_on_delivery_created();
CREATE TRIGGER trigger_notify_chef_planteur_validation AFTER UPDATE ON public.chef_planteurs FOR EACH ROW EXECUTE FUNCTION public.notify_on_chef_planteur_validation();
CREATE TRIGGER trigger_notify_invoice_created AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.notify_on_invoice_created();
CREATE TRIGGER trigger_notify_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_message_created();

-- Audit triggers
CREATE TRIGGER audit_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_planteurs AFTER INSERT OR UPDATE OR DELETE ON public.planteurs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_chef_planteurs AFTER INSERT OR UPDATE OR DELETE ON public.chef_planteurs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_warehouses AFTER INSERT OR UPDATE OR DELETE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_cooperatives AFTER INSERT OR UPDATE OR DELETE ON public.cooperatives FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;


-- ============================================================================
-- RLS POLICIES - PROFILES
-- ============================================================================
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (
  CASE WHEN public.is_admin() THEN true WHEN id = auth.uid() THEN true
  WHEN cooperative_id IS NOT NULL AND cooperative_id = public.get_user_cooperative_id() THEN true
  WHEN cooperative_id IS NULL AND auth.uid() IS NOT NULL THEN true ELSE false END);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own_policy" ON public.profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND (public.is_admin() OR (
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND cooperative_id IS NOT DISTINCT FROM (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
    AND region_id IS NOT DISTINCT FROM (SELECT region_id FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()))));
CREATE POLICY "profiles_update_admin_policy" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES - REGIONS & COOPERATIVES
-- ============================================================================
CREATE POLICY "regions_select_policy" ON public.regions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "regions_insert_policy" ON public.regions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "regions_update_policy" ON public.regions FOR UPDATE USING (public.is_admin());
CREATE POLICY "regions_delete_policy" ON public.regions FOR DELETE USING (public.is_admin());

CREATE POLICY "cooperatives_select_policy" ON public.cooperatives FOR SELECT USING (public.is_admin() OR id = public.get_user_cooperative_id());
CREATE POLICY "cooperatives_insert_policy" ON public.cooperatives FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cooperatives_update_policy" ON public.cooperatives FOR UPDATE USING (public.is_admin());
CREATE POLICY "cooperatives_delete_policy" ON public.cooperatives FOR DELETE USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES - WAREHOUSES
-- ============================================================================
CREATE POLICY "warehouses_select_policy" ON public.warehouses FOR SELECT USING (public.can_access_cooperative(cooperative_id));
CREATE POLICY "warehouses_insert_policy" ON public.warehouses FOR INSERT WITH CHECK (public.is_admin() OR (public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)));
CREATE POLICY "warehouses_update_policy" ON public.warehouses FOR UPDATE USING (public.is_admin() OR (public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)));
CREATE POLICY "warehouses_delete_policy" ON public.warehouses FOR DELETE USING (public.is_admin());


-- ============================================================================
-- RLS POLICIES - CHEF PLANTEURS & PLANTEURS
-- ============================================================================
CREATE POLICY "chef_planteurs_select_policy" ON public.chef_planteurs FOR SELECT USING (
  CASE WHEN public.is_admin() THEN true WHEN public.can_access_cooperative(cooperative_id) THEN true ELSE false END);
CREATE POLICY "chef_planteurs_insert_policy" ON public.chef_planteurs FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND created_by = auth.uid() AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id()));
CREATE POLICY "chef_planteurs_update_policy" ON public.chef_planteurs FOR UPDATE USING (
  CASE WHEN public.is_admin() THEN true
  WHEN public.get_user_role() = 'manager' AND public.can_access_cooperative(cooperative_id) THEN true
  WHEN public.get_user_role() = 'agent' AND public.can_access_cooperative(cooperative_id) AND created_by = auth.uid() THEN true ELSE false END)
  WITH CHECK (CASE WHEN public.is_admin() THEN true WHEN public.get_user_role() IN ('manager', 'agent') AND public.can_access_cooperative(cooperative_id) THEN true ELSE false END);
CREATE POLICY "chef_planteurs_delete_policy" ON public.chef_planteurs FOR DELETE USING (public.is_admin());

CREATE POLICY "planteurs_select_policy" ON public.planteurs FOR SELECT USING (
  CASE WHEN public.is_admin() THEN true WHEN public.can_access_cooperative(cooperative_id) THEN true ELSE false END);
CREATE POLICY "planteurs_insert_policy" ON public.planteurs FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND created_by = auth.uid() AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.chef_planteurs cp WHERE cp.id = chef_planteur_id AND cp.cooperative_id = public.get_user_cooperative_id())));
CREATE POLICY "planteurs_update_policy" ON public.planteurs FOR UPDATE USING (
  CASE WHEN public.is_admin() THEN true
  WHEN public.get_user_role() = 'manager' AND public.can_access_cooperative(cooperative_id) THEN true
  WHEN public.get_user_role() = 'agent' AND public.can_access_cooperative(cooperative_id) AND created_by = auth.uid() THEN true ELSE false END)
  WITH CHECK (CASE WHEN public.is_admin() THEN true WHEN public.get_user_role() IN ('manager', 'agent') THEN EXISTS (SELECT 1 FROM public.chef_planteurs cp WHERE cp.id = chef_planteur_id AND public.can_access_cooperative(cp.cooperative_id)) ELSE false END);
CREATE POLICY "planteurs_delete_policy" ON public.planteurs FOR DELETE USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES - DELIVERIES & PHOTOS
-- ============================================================================
CREATE POLICY "deliveries_select_policy" ON public.deliveries FOR SELECT USING (
  CASE WHEN public.is_admin() THEN true WHEN public.can_access_cooperative(cooperative_id) THEN true ELSE false END);
CREATE POLICY "deliveries_insert_policy" ON public.deliveries FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND created_by = auth.uid() AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.chef_planteurs cp WHERE cp.id = chef_planteur_id AND cp.cooperative_id = public.get_user_cooperative_id())));
CREATE POLICY "deliveries_update_policy" ON public.deliveries FOR UPDATE USING (
  CASE WHEN public.is_admin() THEN true
  WHEN public.get_user_role() = 'manager' AND public.can_access_cooperative(cooperative_id) THEN true
  WHEN public.get_user_role() = 'agent' AND public.can_access_cooperative(cooperative_id) AND created_by = auth.uid() AND payment_status != 'paid' THEN true ELSE false END)
  WITH CHECK (CASE WHEN public.is_admin() THEN true WHEN public.get_user_role() IN ('manager', 'agent') THEN EXISTS (SELECT 1 FROM public.chef_planteurs cp WHERE cp.id = chef_planteur_id AND public.can_access_cooperative(cp.cooperative_id)) ELSE false END);
CREATE POLICY "deliveries_delete_policy" ON public.deliveries FOR DELETE USING (public.is_admin());

CREATE POLICY "delivery_photos_select_policy" ON public.delivery_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND (public.is_admin() OR public.can_access_cooperative(d.cooperative_id))));
CREATE POLICY "delivery_photos_insert_policy" ON public.delivery_photos FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND (public.is_admin() OR public.can_access_cooperative(d.cooperative_id))));
CREATE POLICY "delivery_photos_delete_policy" ON public.delivery_photos FOR DELETE USING (
  public.is_manager_or_above() AND EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND (public.is_admin() OR public.can_access_cooperative(d.cooperative_id))));


-- ============================================================================
-- RLS POLICIES - INVOICES
-- ============================================================================
CREATE POLICY "invoices_select_policy" ON public.invoices FOR SELECT USING (
  CASE WHEN public.is_admin() THEN true WHEN public.is_manager_or_above() AND public.can_access_cooperative(cooperative_id) THEN true ELSE false END);
CREATE POLICY "invoices_insert_policy" ON public.invoices FOR INSERT WITH CHECK (
  public.is_manager_or_above() AND created_by = auth.uid() AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id()));
CREATE POLICY "invoices_update_policy" ON public.invoices FOR UPDATE USING (
  CASE WHEN public.is_admin() THEN true WHEN public.is_manager_or_above() AND public.can_access_cooperative(cooperative_id) THEN true ELSE false END)
  WITH CHECK (CASE WHEN public.is_admin() THEN true WHEN public.is_manager_or_above() THEN cooperative_id = public.get_user_cooperative_id() ELSE false END);
CREATE POLICY "invoices_delete_policy" ON public.invoices FOR DELETE USING (public.is_admin());

CREATE POLICY "invoice_deliveries_select_policy" ON public.invoice_deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (public.is_admin() OR (public.is_manager_or_above() AND public.can_access_cooperative(i.cooperative_id)))));
CREATE POLICY "invoice_deliveries_insert_policy" ON public.invoice_deliveries FOR INSERT WITH CHECK (
  public.is_manager_or_above() AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (public.is_admin() OR public.can_access_cooperative(i.cooperative_id))));
CREATE POLICY "invoice_deliveries_delete_policy" ON public.invoice_deliveries FOR DELETE USING (
  public.is_admin() OR (public.is_manager_or_above() AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_access_cooperative(i.cooperative_id) AND i.status = 'draft')));

-- ============================================================================
-- RLS POLICIES - NOTIFICATIONS & MESSAGING
-- ============================================================================
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view their conversations" ON public.conversations FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by AND auth.uid() = ANY(participants));
CREATE POLICY "Conversation creator or admin can update" ON public.conversations FOR UPDATE USING (created_by = auth.uid() OR public.is_admin()) WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "Only admin can delete conversations" ON public.conversations FOR DELETE USING (public.is_admin());

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants)));
CREATE POLICY "Users can send messages to their conversations" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants)));
CREATE POLICY "Users can update messages" ON public.messages FOR UPDATE USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants))) WITH CHECK (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants)));
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE USING (sender_id = auth.uid());

CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());


-- ============================================================================
-- RLS POLICIES - AUDIT LOG & DASHBOARD
-- ============================================================================
CREATE POLICY "Deny all inserts on audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny all updates on audit_log" ON public.audit_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny all deletes on audit_log" ON public.audit_log FOR DELETE TO authenticated USING (false);
CREATE POLICY "Admin can view all audit logs" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Manager can view own cooperative audit logs" ON public.audit_log FOR SELECT TO authenticated USING (
  public.get_user_role() = 'manager'::public.user_role AND (
    (table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses', 'profiles') AND (new_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
    OR (table_name = 'cooperatives' AND row_id = public.get_user_cooperative_id())
    OR (new_data IS NULL AND old_data IS NOT NULL AND (
      (table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses', 'profiles') AND (old_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
      OR (table_name = 'cooperatives' AND row_id = public.get_user_cooperative_id())))));

CREATE POLICY "Admins can view all dashboard aggregates" ON public.dashboard_aggregates FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Users can view own cooperative dashboard aggregates" ON public.dashboard_aggregates FOR SELECT USING (
  public.get_user_role() IN ('manager', 'agent', 'viewer') AND cooperative_id = public.get_user_cooperative_id());

-- ============================================================================
-- SEED DATA - Default Region and Cooperative
-- ============================================================================
INSERT INTO public.regions (id, name, code) VALUES ('00000000-0000-0000-0000-000000000001', 'Côte d''Ivoire', 'CI') ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cooperatives (id, name, code, region_id, address) VALUES (
  '00000000-0000-0000-0000-000000000002', 'Coopérative Principale', 'COOP-001', 
  '00000000-0000-0000-0000-000000000001', 'Abidjan, Côte d''Ivoire') ON CONFLICT (code) DO NOTHING;

INSERT INTO public.warehouses (id, name, code, cooperative_id, is_active) VALUES (
  '00000000-0000-0000-0000-000000000003', 'Entrepôt Principal', 'WH-001',
  '00000000-0000-0000-0000-000000000002', true) ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- MIGRATION: ADD V1 FIELDS (superficie, statut_plantation, weight_loaded)
-- ============================================================================

-- Add missing fields to planteurs
ALTER TABLE public.planteurs ADD COLUMN IF NOT EXISTS superficie_hectares NUMERIC(10,2);
ALTER TABLE public.planteurs ADD COLUMN IF NOT EXISTS statut_plantation TEXT;
ALTER TABLE public.planteurs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.planteurs ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE public.planteurs ADD COLUMN IF NOT EXISTS localite TEXT;

-- Add weight_loaded_kg to deliveries for loss calculation
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS weight_loaded_kg NUMERIC(10,2);

-- Copy existing weight_kg to weight_loaded_kg for existing records
UPDATE public.deliveries SET weight_loaded_kg = weight_kg WHERE weight_loaded_kg IS NULL;

-- Function to calculate planteur production limit
CREATE OR REPLACE FUNCTION public.get_planteur_production_limit(p_planteur_id UUID)
RETURNS NUMERIC STABLE SET search_path = public AS $$
DECLARE v_superficie NUMERIC;
BEGIN
  SELECT superficie_hectares INTO v_superficie FROM public.planteurs WHERE id = p_planteur_id;
  IF v_superficie IS NULL THEN RETURN NULL; END IF;
  RETURN v_superficie * 1000;
END;
$$ LANGUAGE plpgsql;

-- Function to get planteur delivery stats
CREATE OR REPLACE FUNCTION public.get_planteur_stats(p_planteur_id UUID)
RETURNS TABLE (
  total_loaded_kg NUMERIC, total_delivered_kg NUMERIC, total_losses_kg NUMERIC,
  loss_percentage NUMERIC, production_limit_kg NUMERIC, remaining_kg NUMERIC, usage_percentage NUMERIC
) STABLE SET search_path = public AS $$
DECLARE v_superficie NUMERIC; v_limit NUMERIC; v_loaded NUMERIC; v_delivered NUMERIC; v_losses NUMERIC;
BEGIN
  SELECT superficie_hectares INTO v_superficie FROM public.planteurs WHERE id = p_planteur_id;
  v_limit := COALESCE(v_superficie * 1000, 0);
  SELECT COALESCE(SUM(COALESCE(weight_loaded_kg, weight_kg)), 0), COALESCE(SUM(weight_kg), 0)
  INTO v_loaded, v_delivered FROM public.deliveries WHERE planteur_id = p_planteur_id;
  v_losses := v_loaded - v_delivered;
  RETURN QUERY SELECT v_loaded, v_delivered, v_losses,
    CASE WHEN v_loaded > 0 THEN ROUND((v_losses / v_loaded) * 100, 2) ELSE 0 END,
    v_limit, CASE WHEN v_limit > 0 THEN v_limit - v_delivered ELSE NULL END,
    CASE WHEN v_limit > 0 THEN ROUND((v_delivered / v_limit) * 100, 2) ELSE NULL END;
END;
$$ LANGUAGE plpgsql;

-- Function to get chef_planteur stats
CREATE OR REPLACE FUNCTION public.get_chef_planteur_stats(p_chef_planteur_id UUID)
RETURNS TABLE (
  total_delivered_kg NUMERIC, total_planteurs INTEGER, total_planteurs_limit_kg NUMERIC,
  quantite_max_kg NUMERIC, remaining_kg NUMERIC, usage_percentage NUMERIC, is_exploited BOOLEAN
) STABLE SET search_path = public AS $$
DECLARE v_max NUMERIC; v_delivered NUMERIC; v_planteurs_count INTEGER; v_planteurs_limit NUMERIC;
BEGIN
  SELECT cp.quantite_max_kg INTO v_max FROM public.chef_planteurs cp WHERE cp.id = p_chef_planteur_id;
  SELECT COALESCE(SUM(d.weight_kg), 0) INTO v_delivered FROM public.deliveries d WHERE d.chef_planteur_id = p_chef_planteur_id;
  SELECT COUNT(*), COALESCE(SUM(COALESCE(p.superficie_hectares, 0) * 1000), 0)
  INTO v_planteurs_count, v_planteurs_limit FROM public.planteurs p WHERE p.chef_planteur_id = p_chef_planteur_id;
  RETURN QUERY SELECT v_delivered, v_planteurs_count, v_planteurs_limit, v_max, v_max - v_delivered,
    CASE WHEN v_max > 0 THEN ROUND((v_delivered / v_max) * 100, 2) ELSE 0 END, v_delivered > 0;
END;
$$ LANGUAGE plpgsql;

-- View for planteurs with stats
CREATE OR REPLACE VIEW public.planteurs_with_stats AS
SELECT p.*, COALESCE(p.superficie_hectares * 1000, 0) AS limite_production_kg,
  COALESCE(stats.total_loaded_kg, 0) AS total_charge_kg, COALESCE(stats.total_delivered_kg, 0) AS total_decharge_kg,
  COALESCE(stats.total_losses_kg, 0) AS pertes_kg, COALESCE(stats.loss_percentage, 0) AS pourcentage_pertes,
  stats.remaining_kg AS restant_kg, stats.usage_percentage AS pourcentage_utilise,
  cp.name AS chef_planteur_name, cp.code AS chef_planteur_code
FROM public.planteurs p
LEFT JOIN LATERAL public.get_planteur_stats(p.id) stats ON true
LEFT JOIN public.chef_planteurs cp ON cp.id = p.chef_planteur_id;

-- View for chef_planteurs with stats
CREATE OR REPLACE VIEW public.chef_planteurs_with_stats AS
SELECT cp.*, COALESCE(stats.total_delivered_kg, 0) AS total_livre_kg,
  COALESCE(stats.total_planteurs, 0) AS nombre_planteurs,
  COALESCE(stats.total_planteurs_limit_kg, 0) AS total_limite_planteurs_kg,
  COALESCE(stats.remaining_kg, cp.quantite_max_kg) AS restant_kg,
  COALESCE(stats.usage_percentage, 0) AS pourcentage_utilise,
  COALESCE(stats.is_exploited, false) AS est_exploite
FROM public.chef_planteurs cp
LEFT JOIN LATERAL public.get_chef_planteur_stats(cp.id) stats ON true;

-- Grant permissions
GRANT SELECT ON public.planteurs_with_stats TO authenticated;
GRANT SELECT ON public.chef_planteurs_with_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planteur_production_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planteur_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chef_planteur_stats(UUID) TO authenticated;

-- ============================================================================
-- DONE! 
-- Now create your admin user via Authentication > Users in Supabase Dashboard
-- Then run the promote_to_admin.sql script
-- ============================================================================
