-- ============================================================================
-- CocoaTrack V2 - Clients Module Migration
-- Adds client final tracking: clients, contracts, and shipments
-- ============================================================================

-- Clients table (final buyers/destinations)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  country TEXT,
  city TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client contracts (engagements for a season/period)
CREATE TABLE IF NOT EXISTS public.client_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  code TEXT NOT NULL UNIQUE,
  season TEXT NOT NULL, -- e.g., "2024-2025"
  quantity_contracted_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_per_kg NUMERIC(10,2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client shipments (actual deliveries to clients)
CREATE TABLE IF NOT EXISTS public.client_shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.client_contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  code TEXT NOT NULL UNIQUE,
  shipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity_kg NUMERIC(12,2) NOT NULL,
  quality_grade public.quality_grade DEFAULT 'B',
  transport_mode TEXT, -- e.g., "truck", "ship", "container"
  transport_reference TEXT, -- e.g., container number, truck plate
  destination_port TEXT,
  estimated_arrival DATE,
  actual_arrival DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipment code counter
CREATE TABLE IF NOT EXISTS public.shipment_code_counters (
  month TEXT PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.clients(is_active);
CREATE INDEX IF NOT EXISTS idx_client_contracts_client_id ON public.client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_season ON public.client_contracts(season);
CREATE INDEX IF NOT EXISTS idx_client_contracts_status ON public.client_contracts(status);
CREATE INDEX IF NOT EXISTS idx_client_shipments_contract_id ON public.client_shipments(contract_id);
CREATE INDEX IF NOT EXISTS idx_client_shipments_client_id ON public.client_shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_shipments_shipped_at ON public.client_shipments(shipped_at);
CREATE INDEX IF NOT EXISTS idx_client_shipments_status ON public.client_shipments(status);

-- RLS Policies
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_shipments ENABLE ROW LEVEL SECURITY;

-- Clients policies
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (true);

-- Contracts policies
CREATE POLICY "contracts_select" ON public.client_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contracts_insert" ON public.client_contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contracts_update" ON public.client_contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contracts_delete" ON public.client_contracts FOR DELETE TO authenticated USING (true);

-- Shipments policies
CREATE POLICY "shipments_select" ON public.client_shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "shipments_insert" ON public.client_shipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shipments_update" ON public.client_shipments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "shipments_delete" ON public.client_shipments FOR DELETE TO authenticated USING (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_contracts_updated_at ON public.client_contracts;
CREATE TRIGGER update_client_contracts_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_shipments_updated_at ON public.client_shipments;
CREATE TRIGGER update_client_shipments_updated_at
  BEFORE UPDATE ON public.client_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate shipment code
CREATE OR REPLACE FUNCTION generate_shipment_code()
RETURNS TEXT AS $$
DECLARE
  current_month TEXT;
  current_counter INTEGER;
  new_code TEXT;
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  INSERT INTO public.shipment_code_counters (month, counter)
  VALUES (current_month, 1)
  ON CONFLICT (month) DO UPDATE SET counter = shipment_code_counters.counter + 1
  RETURNING counter INTO current_counter;
  
  new_code := 'EXP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(current_counter::TEXT, 4, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;
