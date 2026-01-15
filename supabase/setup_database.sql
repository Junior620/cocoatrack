-- ============================================================================
-- CocoaTrack V2 - COMPLETE DATABASE SETUP
-- Execute this script in Supabase SQL Editor to set up the entire database
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 2: ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'agent', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.validation_status AS ENUM ('pending', 'validated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quality_grade AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_type AS ENUM ('direct', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 3: TABLES
-- ============================================================================

-- Regions table
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cooperatives table
CREATE TABLE IF NOT EXISTS public.cooperatives (
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
CREATE TABLE IF NOT EXISTS public.profiles (
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
CREATE TABLE IF NOT EXISTS public.warehouses (
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

-- Chef Planteurs table
CREATE TABLE IF NOT EXISTS public.chef_planteurs (
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
CREATE TABLE IF NOT EXISTS public.planteurs (
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

-- Delivery code counters
CREATE TABLE IF NOT EXISTS public.delivery_code_counters (
  date DATE PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS public.deliveries (
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
CREATE TABLE IF NOT EXISTS public.delivery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
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

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
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
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type public.conversation_type NOT NULL DEFAULT 'direct',
  name TEXT,
  participants UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL,
  attachments JSONB,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
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
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync processed table
CREATE TABLE IF NOT EXISTS public.sync_processed (
  idempotency_key UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB
);

-- Dashboard aggregates table
CREATE TABLE IF NOT EXISTS public.dashboard_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  period_date DATE NOT NULL,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount_xaf BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cooperative_id, period_date)
);

-- ============================================================================
-- PART 4: INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_cooperative ON public.profiles(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_cooperatives_region ON public.cooperatives(region_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_cooperative ON public.warehouses(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_chef_planteurs_cooperative_status ON public.chef_planteurs(cooperative_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_planteurs_chef ON public.planteurs(chef_planteur_id);
CREATE INDEX IF NOT EXISTS idx_planteurs_cooperative ON public.planteurs(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_planteur_date ON public.deliveries(planteur_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_cooperative ON public.deliveries(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cooperative ON public.invoices(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON public.audit_log(table_name, row_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON public.auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_aggregates_coop_date ON public.dashboard_aggregates(cooperative_id, period_date DESC);

-- ============================================================================
-- PART 5: FUNCTIONS
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
  INSERT INTO public.profiles (
    id, email, full_name, role, is_active, created_at, updated_at
  )
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

-- RLS Helper functions
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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() = 'admin'::public.user_role;
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

-- ============================================================================
-- PART 6: TRIGGERS
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_cooperatives_updated_at ON public.cooperatives;
DROP TRIGGER IF EXISTS update_warehouses_updated_at ON public.warehouses;
DROP TRIGGER IF EXISTS update_chef_planteurs_updated_at ON public.chef_planteurs;
DROP TRIGGER IF EXISTS update_planteurs_updated_at ON public.planteurs;
DROP TRIGGER IF EXISTS update_deliveries_updated_at ON public.deliveries;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cooperatives_updated_at
  BEFORE UPDATE ON public.cooperatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chef_planteurs_updated_at
  BEFORE UPDATE ON public.chef_planteurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planteurs_updated_at
  BEFORE UPDATE ON public.planteurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART 7: RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_aggregates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (
  public.is_admin() OR id = auth.uid() OR 
  (cooperative_id IS NOT NULL AND cooperative_id = public.get_user_cooperative_id()) OR
  (cooperative_id IS NULL AND auth.uid() IS NOT NULL)
);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (
  id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (
  id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (public.is_admin());

-- Regions policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "regions_select_policy" ON public.regions;
CREATE POLICY "regions_select_policy" ON public.regions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "regions_insert_policy" ON public.regions;
CREATE POLICY "regions_insert_policy" ON public.regions FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "regions_update_policy" ON public.regions;
CREATE POLICY "regions_update_policy" ON public.regions FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "regions_delete_policy" ON public.regions;
CREATE POLICY "regions_delete_policy" ON public.regions FOR DELETE USING (public.is_admin());

-- Cooperatives policies
DROP POLICY IF EXISTS "cooperatives_select_policy" ON public.cooperatives;
CREATE POLICY "cooperatives_select_policy" ON public.cooperatives FOR SELECT USING (
  public.is_admin() OR id = public.get_user_cooperative_id()
);

DROP POLICY IF EXISTS "cooperatives_insert_policy" ON public.cooperatives;
CREATE POLICY "cooperatives_insert_policy" ON public.cooperatives FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cooperatives_update_policy" ON public.cooperatives;
CREATE POLICY "cooperatives_update_policy" ON public.cooperatives FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "cooperatives_delete_policy" ON public.cooperatives;
CREATE POLICY "cooperatives_delete_policy" ON public.cooperatives FOR DELETE USING (public.is_admin());

-- Warehouses policies
DROP POLICY IF EXISTS "warehouses_select_policy" ON public.warehouses;
CREATE POLICY "warehouses_select_policy" ON public.warehouses FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "warehouses_insert_policy" ON public.warehouses;
CREATE POLICY "warehouses_insert_policy" ON public.warehouses FOR INSERT WITH CHECK (
  public.is_admin() OR (public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id))
);

DROP POLICY IF EXISTS "warehouses_update_policy" ON public.warehouses;
CREATE POLICY "warehouses_update_policy" ON public.warehouses FOR UPDATE USING (
  public.is_admin() OR (public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id))
);

DROP POLICY IF EXISTS "warehouses_delete_policy" ON public.warehouses;
CREATE POLICY "warehouses_delete_policy" ON public.warehouses FOR DELETE USING (public.is_admin());

-- Chef Planteurs policies
DROP POLICY IF EXISTS "chef_planteurs_select_policy" ON public.chef_planteurs;
CREATE POLICY "chef_planteurs_select_policy" ON public.chef_planteurs FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "chef_planteurs_insert_policy" ON public.chef_planteurs;
CREATE POLICY "chef_planteurs_insert_policy" ON public.chef_planteurs FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "chef_planteurs_update_policy" ON public.chef_planteurs;
CREATE POLICY "chef_planteurs_update_policy" ON public.chef_planteurs FOR UPDATE USING (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "chef_planteurs_delete_policy" ON public.chef_planteurs;
CREATE POLICY "chef_planteurs_delete_policy" ON public.chef_planteurs FOR DELETE USING (public.is_admin());

-- Planteurs policies
DROP POLICY IF EXISTS "planteurs_select_policy" ON public.planteurs;
CREATE POLICY "planteurs_select_policy" ON public.planteurs FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "planteurs_insert_policy" ON public.planteurs;
CREATE POLICY "planteurs_insert_policy" ON public.planteurs FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "planteurs_update_policy" ON public.planteurs;
CREATE POLICY "planteurs_update_policy" ON public.planteurs FOR UPDATE USING (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "planteurs_delete_policy" ON public.planteurs;
CREATE POLICY "planteurs_delete_policy" ON public.planteurs FOR DELETE USING (public.is_admin());

-- Deliveries policies
DROP POLICY IF EXISTS "deliveries_select_policy" ON public.deliveries;
CREATE POLICY "deliveries_select_policy" ON public.deliveries FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "deliveries_insert_policy" ON public.deliveries;
CREATE POLICY "deliveries_insert_policy" ON public.deliveries FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "deliveries_update_policy" ON public.deliveries;
CREATE POLICY "deliveries_update_policy" ON public.deliveries FOR UPDATE USING (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "deliveries_delete_policy" ON public.deliveries;
CREATE POLICY "deliveries_delete_policy" ON public.deliveries FOR DELETE USING (public.is_admin());

-- Delivery photos policies
DROP POLICY IF EXISTS "delivery_photos_select_policy" ON public.delivery_photos;
CREATE POLICY "delivery_photos_select_policy" ON public.delivery_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND public.can_access_cooperative(d.cooperative_id))
);

DROP POLICY IF EXISTS "delivery_photos_insert_policy" ON public.delivery_photos;
CREATE POLICY "delivery_photos_insert_policy" ON public.delivery_photos FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id AND public.can_access_cooperative(d.cooperative_id))
);

DROP POLICY IF EXISTS "delivery_photos_delete_policy" ON public.delivery_photos;
CREATE POLICY "delivery_photos_delete_policy" ON public.delivery_photos FOR DELETE USING (public.is_admin());

-- Invoices policies
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices FOR INSERT WITH CHECK (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices FOR UPDATE USING (
  public.is_agent_or_above() AND public.can_access_cooperative(cooperative_id)
);

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
CREATE POLICY "invoices_delete_policy" ON public.invoices FOR DELETE USING (public.is_admin());

-- Notifications policies
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- Conversations policies
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT USING (
  auth.uid() = ANY(participants)
);

DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT WITH CHECK (
  auth.uid() = ANY(participants)
);

-- Messages policies
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants))
);

DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() = ANY(c.participants))
);

-- Audit log policies (read-only for admin)
DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;
CREATE POLICY "audit_log_select_policy" ON public.audit_log FOR SELECT USING (public.is_admin());

-- Dashboard aggregates policies
DROP POLICY IF EXISTS "dashboard_aggregates_select_policy" ON public.dashboard_aggregates;
CREATE POLICY "dashboard_aggregates_select_policy" ON public.dashboard_aggregates FOR SELECT USING (
  public.can_access_cooperative(cooperative_id)
);

-- ============================================================================
-- PART 8: SEED DATA - Default Region and Cooperative
-- ============================================================================

-- Insert default region
INSERT INTO public.regions (id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'Côte d''Ivoire', 'CI')
ON CONFLICT (code) DO NOTHING;

-- Insert default cooperative
INSERT INTO public.cooperatives (id, name, code, region_id, address)
VALUES (
  '00000000-0000-0000-0000-000000000002', 
  'Coopérative Principale', 
  'COOP-001', 
  '00000000-0000-0000-0000-000000000001',
  'Abidjan, Côte d''Ivoire'
)
ON CONFLICT (code) DO NOTHING;

-- Insert default warehouse
INSERT INTO public.warehouses (id, name, code, cooperative_id, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Entrepôt Principal',
  'WH-001',
  '00000000-0000-0000-0000-000000000002',
  true
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DONE! Now create your admin user via Authentication > Users in Supabase
-- Then run the promote_to_admin.sql script
-- ============================================================================
