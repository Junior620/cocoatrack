-- Migration: Create satellite_audit_logs table
-- Description: Stores audit logs for satellite imagery analysis operations
-- Date: 2026-05-03

-- Create satellite_audit_logs table
CREATE TABLE IF NOT EXISTS satellite_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parcelle_id UUID REFERENCES parcelles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'imagery_retrieved',
    'ndvi_calculated',
    'deforestation_detected',
    'deforestation_acknowledged',
    'deforestation_disputed',
    'kml_exported',
    'report_generated',
    'cache_accessed',
    'api_request',
    'error_occurred'
  )),
  event_description TEXT NOT NULL,
  event_metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_user_id 
  ON satellite_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_parcelle_id 
  ON satellite_audit_logs(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_event_type 
  ON satellite_audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_created_at 
  ON satellite_audit_logs(created_at DESC);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_satellite_audit_logs_user_event_date 
  ON satellite_audit_logs(user_id, event_type, created_at DESC);

-- Add comment to table
COMMENT ON TABLE satellite_audit_logs IS 'Audit logs for satellite imagery analysis operations and user actions';

-- Add comments to columns
COMMENT ON COLUMN satellite_audit_logs.id IS 'Primary key';
COMMENT ON COLUMN satellite_audit_logs.user_id IS 'Foreign key to profiles table - user who performed the action';
COMMENT ON COLUMN satellite_audit_logs.parcelle_id IS 'Foreign key to parcelles table - parcelle involved in the action (nullable)';
COMMENT ON COLUMN satellite_audit_logs.event_type IS 'Type of event: imagery_retrieved, ndvi_calculated, deforestation_detected, deforestation_acknowledged, deforestation_disputed, kml_exported, report_generated, cache_accessed, api_request, error_occurred';
COMMENT ON COLUMN satellite_audit_logs.event_description IS 'Human-readable description of the event';
COMMENT ON COLUMN satellite_audit_logs.event_metadata IS 'Additional metadata about the event stored as JSONB (e.g., request parameters, error details)';
COMMENT ON COLUMN satellite_audit_logs.ip_address IS 'IP address of the user who performed the action';
COMMENT ON COLUMN satellite_audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN satellite_audit_logs.created_at IS 'Timestamp when the event occurred';

