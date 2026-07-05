-- ============================================================================
-- Migration: Delivery waybills (lettres de voiture)
-- One transport document linked to multiple deliveries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.waybill_code_counters (
  date DATE PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.delivery_waybills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  cooperative_id UUID REFERENCES public.cooperatives(id) ON DELETE SET NULL,
  sender_name TEXT,
  recipient_name TEXT,
  carrier_name TEXT,
  vehicle_plate TEXT,
  driver_name TEXT,
  origin_location TEXT,
  destination_location TEXT,
  loading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sack_count INTEGER,
  total_weight_kg NUMERIC(12, 2),
  lot_number TEXT,
  quality_grade public.quality_grade,
  notes TEXT,
  document_storage_path TEXT,
  document_file_name TEXT,
  document_mime_type TEXT,
  document_file_size INTEGER,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.waybill_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  waybill_id UUID NOT NULL REFERENCES public.delivery_waybills(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waybill_deliveries_delivery_unique UNIQUE (delivery_id)
);

CREATE INDEX idx_delivery_waybills_cooperative ON public.delivery_waybills(cooperative_id);
CREATE INDEX idx_delivery_waybills_loading_date ON public.delivery_waybills(loading_date DESC);
CREATE INDEX idx_delivery_waybills_lot_number ON public.delivery_waybills(lot_number);
CREATE INDEX idx_waybill_deliveries_waybill ON public.waybill_deliveries(waybill_id);
CREATE INDEX idx_waybill_deliveries_delivery ON public.waybill_deliveries(delivery_id);

-- Code generation LV-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.next_daily_waybill_seq(p_date DATE)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO public.waybill_code_counters (date, counter)
  VALUES (p_date, 1)
  ON CONFLICT (date) DO UPDATE
    SET counter = public.waybill_code_counters.counter + 1
  RETURNING counter INTO v_seq;
  RETURN v_seq;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_waybill_code()
RETURNS TEXT
SET search_path = public
AS $$
DECLARE
  v_date DATE := current_date;
  v_seq INTEGER;
BEGIN
  v_seq := public.next_daily_waybill_seq(v_date);
  RETURN 'LV-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_waybill_code()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_waybill_code();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_waybill_code_trigger
  BEFORE INSERT ON public.delivery_waybills
  FOR EACH ROW EXECUTE FUNCTION public.set_waybill_code();

CREATE OR REPLACE FUNCTION public.touch_waybill_updated_at()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_waybill_updated_at_trigger
  BEFORE UPDATE ON public.delivery_waybills
  FOR EACH ROW EXECUTE FUNCTION public.touch_waybill_updated_at();

-- RLS
ALTER TABLE public.delivery_waybills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waybill_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_waybills_select_policy" ON public.delivery_waybills
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.can_access_cooperative(cooperative_id)
    OR cooperative_id IS NULL
  );

CREATE POLICY "delivery_waybills_insert_policy" ON public.delivery_waybills
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_agent_or_above()
    AND created_by = auth.uid()
    AND (
      public.is_admin()
      OR cooperative_id IS NULL
      OR public.can_access_cooperative(cooperative_id)
    )
  );

CREATE POLICY "delivery_waybills_update_policy" ON public.delivery_waybills
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_above()
    AND (public.is_admin() OR public.can_access_cooperative(cooperative_id) OR cooperative_id IS NULL)
  );

CREATE POLICY "delivery_waybills_delete_policy" ON public.delivery_waybills
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "waybill_deliveries_select_policy" ON public.waybill_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_waybills w
      WHERE w.id = waybill_id
      AND (
        public.is_admin()
        OR public.can_access_cooperative(w.cooperative_id)
        OR w.cooperative_id IS NULL
      )
    )
  );

CREATE POLICY "waybill_deliveries_insert_policy" ON public.waybill_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_agent_or_above()
    AND EXISTS (
      SELECT 1 FROM public.delivery_waybills w
      WHERE w.id = waybill_id
      AND (public.is_admin() OR public.can_access_cooperative(w.cooperative_id) OR w.cooperative_id IS NULL)
    )
  );

CREATE POLICY "waybill_deliveries_delete_policy" ON public.waybill_deliveries
  FOR DELETE TO authenticated
  USING (
    public.is_manager_or_above()
    AND EXISTS (
      SELECT 1 FROM public.delivery_waybills w
      WHERE w.id = waybill_id
      AND (public.is_admin() OR public.can_access_cooperative(w.cooperative_id) OR w.cooperative_id IS NULL)
    )
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waybill-documents',
  'waybill-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "waybill_documents_insert_policy"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'waybill-documents'
  AND public.is_agent_or_above()
  AND (public.is_admin() OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text OR (storage.foldername(name))[1] = 'none')
);

CREATE POLICY "waybill_documents_select_policy"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'waybill-documents'
  AND (public.is_admin() OR (storage.foldername(name))[1] = public.get_user_cooperative_id()::text OR (storage.foldername(name))[1] = 'none')
);

CREATE POLICY "waybill_documents_delete_policy"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'waybill-documents'
  AND public.is_admin()
);

COMMENT ON TABLE public.delivery_waybills IS 'Lettres de voiture — preuve logistique de transport cacao';
COMMENT ON TABLE public.waybill_deliveries IS 'Liaison N livraisons ↔ 1 lettre de voiture';
