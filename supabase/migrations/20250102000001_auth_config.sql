-- CocoaTrack V2 - Auth Configuration Migration
-- This migration sets up authentication triggers and functions

-- ============================================================================
-- HANDLE NEW USER TRIGGER
-- Auto-creates a profile when a new user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    cooperative_id,
    region_id,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer', -- Default role for new users
    NULL,     -- No cooperative assigned by default
    NULL,     -- No region assigned by default
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUTH EVENT LOGGING
-- Logs authentication events for audit purposes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying auth events
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON public.auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON public.auth_events(event_type, created_at DESC);

-- Function to log auth events
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
-- PASSWORD RESET REQUIREMENT
-- For migrated users who need to reset their password
-- ============================================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up via Supabase Auth';
COMMENT ON TABLE public.auth_events IS 'Logs authentication events (login, logout, failed attempts) for audit purposes';
COMMENT ON FUNCTION public.log_auth_event IS 'Logs an authentication event with optional metadata';
