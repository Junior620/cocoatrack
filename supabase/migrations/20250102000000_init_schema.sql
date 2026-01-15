-- CocoaTrack V2 - Initial Schema Migration
-- This migration creates the core database schema

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

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
-- TABLES
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
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pdf_path TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX idx_profiles_cooperative ON public.profiles(cooperative_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Cooperatives indexes
CREATE INDEX idx_cooperatives_region ON public.cooperatives(region_id);

-- Warehouses indexes
CREATE INDEX idx_warehouses_cooperative ON public.warehouses(cooperative_id);

-- Chef Planteurs indexes
CREATE INDEX idx_chef_planteurs_cooperative_status ON public.chef_planteurs(cooperative_id, validation_status);
CREATE INDEX idx_chef_planteurs_cooperative_created ON public.chef_planteurs(cooperative_id, created_at);
CREATE INDEX idx_chef_planteurs_location ON public.chef_planteurs(latitude, longitude);

-- Planteurs indexes
CREATE INDEX idx_planteurs_chef ON public.planteurs(chef_planteur_id);
CREATE INDEX idx_planteurs_cooperative ON public.planteurs(cooperative_id);
CREATE INDEX idx_planteurs_cooperative_created ON public.planteurs(cooperative_id, created_at);
CREATE INDEX idx_planteurs_location ON public.planteurs(latitude, longitude);

-- Deliveries indexes
CREATE INDEX idx_deliveries_planteur_date ON public.deliveries(planteur_id, delivered_at DESC);
CREATE INDEX idx_deliveries_chef_planteur ON public.deliveries(chef_planteur_id, delivered_at DESC);
CREATE INDEX idx_deliveries_cooperative ON public.deliveries(cooperative_id);
CREATE INDEX idx_deliveries_cooperative_created ON public.deliveries(cooperative_id, created_at);
CREATE INDEX idx_deliveries_code ON public.deliveries(code);
CREATE INDEX idx_deliveries_warehouse ON public.deliveries(warehouse_id);

-- Invoices indexes
CREATE INDEX idx_invoices_cooperative ON public.invoices(cooperative_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Notifications indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- Messages indexes
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);

-- Audit log indexes
CREATE INDEX idx_audit_log_table_row ON public.audit_log(table_name, row_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id, created_at DESC);

-- Dashboard aggregates indexes
CREATE INDEX idx_dashboard_aggregates_coop_date ON public.dashboard_aggregates(cooperative_id, period_date DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_cooperatives_updated_at
  BEFORE UPDATE ON public.cooperatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
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

CREATE TRIGGER update_dashboard_aggregates_updated_at
  BEFORE UPDATE ON public.dashboard_aggregates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
