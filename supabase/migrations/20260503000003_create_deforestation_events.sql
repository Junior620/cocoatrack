-- Migration: Create deforestation_events table
-- Description: Stores detected deforestation events and their status for EUDR compliance
-- Date: 2026-05-03

-- Create deforestation_events table
CREATE TABLE IF NOT EXISTS deforestation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  baseline_date TIMESTAMPTZ NOT NULL,
  detection_date TIMESTAMPTZ NOT NULL,
  baseline_ndvi DECIMAL(5,4) NOT NULL,
  current_ndvi DECIMAL(5,4) NOT NULL,
  ndvi_change DECIMAL(5,4) NOT NULL, -- Negative value indicates vegetation loss
  affected_area_hectares DECIMAL(10,4) NOT NULL,
  affected_area_percent DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'disputed', 'resolved')),
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  acknowledgment_notes TEXT,
  disputed_by UUID REFERENCES profiles(id),
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_deforestation_events_parcelle 
  ON deforestation_events(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_deforestation_events_status 
  ON deforestation_events(status);

CREATE INDEX IF NOT EXISTS idx_deforestation_events_detection_date 
  ON deforestation_events(detection_date);

-- Add comment to table
COMMENT ON TABLE deforestation_events IS 'Stores detected deforestation events for EUDR compliance monitoring';

-- Add comments to key columns
COMMENT ON COLUMN deforestation_events.id IS 'Primary key';
COMMENT ON COLUMN deforestation_events.parcelle_id IS 'Foreign key to parcelles table';
COMMENT ON COLUMN deforestation_events.baseline_date IS 'EUDR baseline date (typically December 31, 2020)';
COMMENT ON COLUMN deforestation_events.detection_date IS 'Date when deforestation was detected';
COMMENT ON COLUMN deforestation_events.baseline_ndvi IS 'NDVI value at baseline date';
COMMENT ON COLUMN deforestation_events.current_ndvi IS 'NDVI value at detection date';
COMMENT ON COLUMN deforestation_events.ndvi_change IS 'NDVI change from baseline (negative indicates vegetation loss)';
COMMENT ON COLUMN deforestation_events.affected_area_hectares IS 'Area affected by deforestation in hectares';
COMMENT ON COLUMN deforestation_events.affected_area_percent IS 'Percentage of parcelle affected by deforestation';
COMMENT ON COLUMN deforestation_events.status IS 'Alert status: pending, acknowledged, disputed, or resolved';
COMMENT ON COLUMN deforestation_events.acknowledged_by IS 'Foreign key to profiles table - user who acknowledged the alert';
COMMENT ON COLUMN deforestation_events.acknowledged_at IS 'Timestamp when alert was acknowledged';
COMMENT ON COLUMN deforestation_events.acknowledgment_notes IS 'Notes provided when acknowledging the alert';
COMMENT ON COLUMN deforestation_events.disputed_by IS 'Foreign key to profiles table - user who disputed the alert';
COMMENT ON COLUMN deforestation_events.disputed_at IS 'Timestamp when alert was disputed';
COMMENT ON COLUMN deforestation_events.dispute_reason IS 'Reason provided when disputing the alert';
COMMENT ON COLUMN deforestation_events.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN deforestation_events.updated_at IS 'Timestamp when record was last updated';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deforestation_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deforestation_events_updated_at
  BEFORE UPDATE ON deforestation_events
  FOR EACH ROW
  EXECUTE FUNCTION update_deforestation_events_updated_at();
